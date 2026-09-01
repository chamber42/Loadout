'use strict';
/* ============================================================
   LOADOUT - SAVING WHAT YOU LOGGED INTO HEALTH

   Native builds only. On the web this file loads and does nothing, leaving
   the control hidden — Safari has no Health store to write to, and a
   switch that can only fail is worse than no switch.

   Until now Health was a one-way street: Loadout read a height, a weight
   and a step count out of it and put nothing back. That leaves the food
   log stranded inside this app, invisible to the Health app's own summary,
   to the Fitness rings' context, and to whatever else someone runs.

   WHY IT IS OFF UNTIL ASKED FOR

   Writing into Health is a different kind of act from reading. It puts
   Loadout's numbers where other software will treat them as fact, and it
   is the one thing this app does that leaves the app. So it is a switch
   somebody turns on, with its own permission prompt, and off until then.

   WHAT GETS WRITTEN

   A day's totals, and only from the journal — what was actually eaten,
   never what was planned. Each save replaces Loadout's own samples for
   that day rather than adding to them, so correcting a forgotten dinner
   leaves the day stated once, correctly. Days logged in other apps are
   never touched.
   ============================================================ */

  (function(){

    var cap = window.Capacitor;
    var HK  = cap && cap.Plugins && cap.Plugins.HealthKit;
    if (!HK || typeof HK.writeNutrition !== 'function') return;

    var PREF_KEY = 'gfl.health.write.v1';

    function enabled(){
      try{ return localStorage.getItem(PREF_KEY) === '1'; }catch(e){ return false; }
    }
    function setEnabled(on){
      try{ localStorage.setItem(PREF_KEY, on ? '1' : '0'); }catch(e){}
    }

    /* The four figures the journal actually holds against each entry.
       Anything else Loadout knows about a food is a property of the food,
       not of what was eaten, and reconstructing it here would be sending an
       estimate into a store other apps read as measurement. */
    function totalsFor(dayKey){
      if (typeof dayTotals !== 'function') return null;
      var t = dayTotals(dayKey);
      if (!t || !t.items) return {kcal: 0, protein: 0, carbs: 0, fat: 0, _empty: true};
      return {
        kcal:    Math.round(t.kcal),
        protein: Math.round(t.protein * 10) / 10,
        carbs:   Math.round(t.carbs   * 10) / 10,
        fat:     Math.round(t.fat     * 10) / 10,
      };
    }

    /* Saving is debounced and coalesced by day. A journal edit fires on
       every keystroke of a typed amount, and each one would otherwise be a
       delete-and-rewrite of the whole day against the Health store. */
    var pending = {};
    var timer = null;

    function flush(){
      timer = null;
      var days = Object.keys(pending);
      pending = {};
      if (!enabled()) return;
      days.forEach(function(day){
        var totals = totalsFor(day);
        if (!totals) return;
        HK.writeNutrition({day: day, totals: totals}).catch(function(e){
          /* Permission can be withdrawn in Settings at any time, and a
             failed write must not cost the person their log. Reported to
             the console and otherwise ignored: the journal is the record,
             Health is a copy of it. */
          console.error('Loadout: could not write to Health', e);
        });
      });
    }

    function queueDay(dayKey){
      if (!enabled()) return;
      if (!dayKey) return;
      pending[dayKey] = true;
      clearTimeout(timer);
      timer = setTimeout(flush, 1200);
    }

    /* The journal is the only thing that knows a day changed, and it
       redraws whenever one does. Hooking the render rather than every call
       site that can touch a log means nothing can edit a day and quietly
       skip the copy. */
    window.queueHealthWrite = queueDay;

    (function hookJournal(){
      if (typeof window.renderJournal !== 'function') return;
      var original = window.renderJournal;
      window.renderJournal = function(){
        var out = original.apply(this, arguments);
        try{
          queueDay((typeof state !== 'undefined' && state.journalDate) ||
                   (typeof todayKey === 'function' ? todayKey() : null));
        }catch(e){}
        return out;
      };
    })();

    /* ---- the switch, inside the activity panel on the quest log ------- */

    function renderHealthWriteControl(){
      var host = document.getElementById('sheetHealthWrite');
      if (!host) return;
      var on = enabled();
      host.innerHTML =
        '<div class="vital vital-wide">' +
          '<span class="vital-lbl">Save meals to Health</span>' +
          '<span class="vital-edit">' +
            '<button class="btn-ghost" id="btnHealthWrite" style="margin:0;">' +
              (on ? 'ON' : 'OFF') +
            '</button>' +
          '</span>' +
        '</div>';

      document.getElementById('btnHealthWrite').addEventListener('click', function(){
        var btn = this;
        if (enabled()){
          setEnabled(false);
          renderHealthWriteControl();
          return;
        }
        btn.disabled = true;
        HK.requestWriteAuthorization().then(function(res){
          btn.disabled = false;
          if (!res || !res.granted){
            host.innerHTML =
              '<p class="subtitle" style="font-size:11px; margin:0;">' +
              'Health did not allow it. You can change that in Settings ' +
              '&rarr; Privacy &amp; Security &rarr; Health &rarr; Loadout.</p>';
            return;
          }
          setEnabled(true);
          renderHealthWriteControl();
          /* Everything already logged, not only what happens next — someone
             turning this on means their food should be in Health, not that
             their food should be in Health from Tuesday onwards. */
          backfill();
        }).catch(function(){ btn.disabled = false; });
      });
    }

    /* The last month of logged days, oldest first. Bounded deliberately: a
       year of history would be hundreds of round trips through HealthKit
       for data nobody is looking at, and a month covers everything the
       Health app's own summaries show. */
    var BACKFILL_DAYS = 30;

    function backfill(){
      if (typeof state === 'undefined' || !state.log) return;
      if (typeof daysBetweenKeys !== 'function' || typeof todayKey !== 'function') return;
      var today = todayKey();
      Object.keys(state.log)
        .filter(function(k){
          if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return false;
          var age = daysBetweenKeys(k, today);
          return age >= 0 && age <= BACKFILL_DAYS;
        })
        .sort()
        .forEach(function(k){ pending[k] = true; });
      clearTimeout(timer);
      timer = setTimeout(flush, 400);
    }

    if (typeof window.renderTiers === 'function'){
      var original = window.renderTiers;
      window.renderTiers = function(){
        var out = original.apply(this, arguments);
        try{ renderHealthWriteControl(); }catch(e){}
        return out;
      };
    }

    /* Called by renderCalendar as well as renderTiers: the panel this sits
       in moved to the quest log, and the calendar has to be able to draw it. */
    window.renderHealthWriteControl = renderHealthWriteControl;

    /* The activity panel is hidden until the steps module decides otherwise,
       and this control lives inside it, so it inherits that. On a device
       where Health exists the panel is shown either way. */

    HK.canWrite().then(function(res){
      if (!res || !res.available) return;
      var panel = document.getElementById('sheetActivityPanel');
      if (panel) panel.hidden = false;
      renderHealthWriteControl();
    }).catch(function(){});

  })();
