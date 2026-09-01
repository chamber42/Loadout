'use strict';
/* ============================================================
   LOADOUT - DAILY REMINDERS

   Native builds only. On the web this file loads and does nothing: a
   WKWebView — and a browser tab — gets no execution time in the
   background, so a reminder scheduled there would simply never arrive, and
   a switch that silently does nothing is worse than no switch.

   The app already had the plumbing for one notification and used it for
   exactly one thing: a cook timer finishing. That case works because
   somebody is looking at the app while it counts down. A reminder is the
   opposite by definition — it has to arrive when they are not — which is
   why this goes through a native scheduler instead.

   WHY THESE TWO

   The weight trend and the measured expenditure both need a person to keep
   doing two small things: step on a scale, and finish logging the day.
   Neither is hard, both are easy to forget, and when they are forgotten
   the app gets quietly worse at its job — an expenditure measured over a
   half-logged fortnight is refused outright, and a trend with four
   readings in it says nothing.

   So these are not engagement nags. They are the two inputs the maths in
   38-weight.js and 39-expenditure.js are built on, and they are the only
   two reminders offered.

   A THIRD ONE IS NOT HERE ON PURPOSE

   "Prep day tomorrow, here is your shopping list" was the obvious third,
   and it cannot be built yet: a prep is a run of numbered days
   (state.prep.schedule) with no start date anywhere on it, so nothing in
   the app knows which calendar date a cook day falls on. Giving the prep a
   real start date is a change to the prep model, not a reminder, and it
   should be decided on its own terms rather than smuggled in behind this.
   ============================================================ */

  (function(){

    var cap = window.Capacitor;
    var RM  = cap && cap.Plugins && cap.Plugins.Reminders;
    if (!RM) return;

    var PREF_KEY = 'gfl.reminders.v1';

    /* Defaults chosen from what each reminder is for, not from habit.

       A weigh-in belongs first thing: bodyweight swings by pounds across a
       day with food and water, so the only reading comparable to yesterday's
       is the one taken under the same conditions, which in practice means
       after waking and before eating.

       The log reminder sits after a normal dinner rather than at bedtime.
       Asked at nine, most people can still remember lunch; asked at eleven,
       they are guessing, and a guessed day is exactly the half-logged day
       the expenditure maths has to throw away. */
    var REMINDERS = [
      {id: 'weigh',  label: 'Morning weigh-in', hour: 7,  minute: 30,
       title: 'Weigh in',
       body:  'Same time, same conditions — that is what makes the trend mean anything.'},
      {id: 'log',    label: 'Finish the day’s log', hour: 20, minute: 30,
       title: 'Log today',
       body:  'Anything still missing from today?'},
    ];

    function prefs(){
      try{ return JSON.parse(localStorage.getItem(PREF_KEY)) || {}; }
      catch(e){ return {}; }
    }
    function savePrefs(p){
      try{ localStorage.setItem(PREF_KEY, JSON.stringify(p)); }catch(e){}
    }

    /* Re-applies every switch to the system. Called after any change and
       once on load, because what iOS actually holds and what this app last
       asked for come apart easily — notifications are cleared on reinstall,
       and a person can turn them off in Settings without the app hearing. */
    function apply(){
      var p = prefs();
      REMINDERS.forEach(function(r){
        var on = !!p[r.id];
        var at = p[r.id + '.at'] || {hour: r.hour, minute: r.minute};
        if (on){
          RM.scheduleDaily({id: r.id, title: r.title, body: r.body,
                            hour: at.hour, minute: at.minute}).catch(function(){});
        } else {
          RM.cancel({id: r.id}).catch(function(){});
        }
      });
      /* The prep reminder follows the log switch, so it is re-applied with
         everything else rather than only when the prep changes. */
      if (typeof schedulePrepReminder === 'function') schedulePrepReminder();
    }

    function timeText(hour, minute){
      var h = hour % 12; if (h === 0) h = 12;
      return h + ':' + String(minute).padStart(2, '0') + (hour < 12 ? ' am' : ' pm');
    }

    /* ---- the prep running out -------------------------------------------

       Not a daily habit, so not in the list above: it happens on a date,
       once, and only if a prep exists with a start date on it.

       Fires on the evening of the LAST day the prep covers, not the morning
       after it has already run out. The point is to arrive while there is
       still time to do something — shop tonight, cook tomorrow — rather
       than to report a problem that has already happened. */
    var PREP_ID = 'prep.out';
    var PREP_HOUR = 18;

    function schedulePrepReminder(){
      if (typeof prepLastKey !== 'function'){ return; }
      var last = prepLastKey();
      var p = prefs();

      /* Rides on the log reminder's switch rather than adding a third one.
         Someone who wants to be told to finish logging wants to be told
         their food is about to run out; a separate toggle for a thing that
         fires once a fortnight is a control nobody would find. */
      if (!last || !p.log){ RM.cancel({id: PREP_ID}).catch(function(){}); return; }

      var d = new Date(last + 'T00:00:00');
      d.setHours(PREP_HOUR, 0, 0, 0);
      var at = d.getTime();
      if (at <= Date.now()){ RM.cancel({id: PREP_ID}).catch(function(){}); return; }

      var left = (typeof prepDaysLeft === 'function') ? prepDaysLeft() : null;
      RM.scheduleAt({
        id: PREP_ID,
        at: at,
        title: 'Last day of your prep',
        body: left != null && left <= 1
          ? 'Your shopping list is ready when you are.'
          : 'After today there is nothing prepped. Your shopping list is ready.'
      }).catch(function(){});
    }
    window.schedulePrepReminder = schedulePrepReminder;

    /* ---- the panel ------------------------------------------------------ */

    function render(){
      var panel = document.getElementById('sheetRemindPanel');
      var host  = document.getElementById('sheetRemind');
      if (!panel || !host) return;

      RM.status().then(function(res){
        var status = (res && res.status) || 'denied';
        panel.hidden = false;

        if (status === 'denied'){
          /* Refused in Settings. Offering switches that cannot fire would
             be offering something that quietly does nothing. */
          host.innerHTML =
            '<p class="subtitle" style="font-size:11px; margin:0;">' +
            'Notifications are off for Loadout. You can turn them back on in ' +
            'Settings &rarr; Notifications &rarr; Loadout.</p>';
          return;
        }

        if (status === 'unasked'){
          host.innerHTML =
            '<button class="btn-ghost" id="btnRemindAsk" style="margin:0;">' +
            '<svg class="px" aria-hidden="true"><use href="#i-timer"></use></svg> TURN ON REMINDERS</button>';
          var ask = document.getElementById('btnRemindAsk');
          if (ask) ask.addEventListener('click', function(){
            ask.disabled = true;
            RM.requestAuthorization().then(function(r){
              if (r && r.granted){
                /* Asking for reminders means wanting them, so both go on —
                   rather than granting permission and then being shown two
                   switches still set to off. */
                var p = prefs();
                REMINDERS.forEach(function(x){ p[x.id] = true; });
                savePrefs(p);
                apply();
              }
              render();
            }).catch(function(){ ask.disabled = false; });
          });
          return;
        }

        var p = prefs();
        host.innerHTML = REMINDERS.map(function(r){
          var on = !!p[r.id];
          var at = p[r.id + '.at'] || {hour: r.hour, minute: r.minute};
          return '<div class="vital vital-wide">' +
                   '<span class="vital-lbl">' + r.label + '</span>' +
                   '<span class="vital-edit">' +
                     '<input type="time" id="rt-' + r.id + '" value="' +
                        String(at.hour).padStart(2,'0') + ':' + String(at.minute).padStart(2,'0') +
                     '"' + (on ? '' : ' disabled') + ' aria-label="' + r.label + ' time">' +
                     '<button class="btn-ghost" data-remind="' + r.id + '" style="margin:0 0 0 8px;">' +
                       (on ? 'ON' : 'OFF') +
                     '</button>' +
                   '</span>' +
                 '</div>';
        }).join('');

        host.querySelectorAll('[data-remind]').forEach(function(b){
          b.addEventListener('click', function(){
            var id = b.getAttribute('data-remind');
            var q = prefs();
            q[id] = !q[id];
            savePrefs(q);
            apply();
            render();
          });
        });

        REMINDERS.forEach(function(r){
          var el = document.getElementById('rt-' + r.id);
          if (!el) return;
          el.addEventListener('change', function(){
            var bits = String(el.value || '').split(':');
            var hour = parseInt(bits[0], 10), minute = parseInt(bits[1], 10);
            if (!(hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59)) return;
            var q = prefs();
            q[r.id + '.at'] = {hour: hour, minute: minute};
            savePrefs(q);
            apply();
          });
        });
      }).catch(function(){});
    }

    if (typeof window.renderTiers === 'function'){
      var original = window.renderTiers;
      window.renderTiers = function(){
        var out = original.apply(this, arguments);
        try{ render(); }catch(e){}
        return out;
      };
    }

    /* Re-applied on load rather than trusted to have survived. */
    apply();
    schedulePrepReminder();
    render();

    window.reminderTimeText = timeText;

  })();
