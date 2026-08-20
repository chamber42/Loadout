'use strict';
/* ============================================================
   LOADOUT - STEPS ON THE CHARACTER SHEET

   Native builds only. Safari has no step history, so on the web the
   panel stays hidden rather than showing a feature that cannot work —
   the same rule the camera scanner and the Health import already follow.

   Reads first, asks second. HealthKit only prompts for types it has not
   been asked about, so a plain read costs nothing when permission was
   already granted at character creation and returns nothing when it was
   not. Someone who has already said yes never sees a second prompt; only
   someone who has not gets offered the button.

   Nothing here is written back into state. Steps are a reading taken from
   Health, not something the app owns — persisting them would mean keeping
   a stale copy in the save file that disagrees with Health the moment
   anybody walks anywhere.
   ============================================================ */

  (function(){

    var panel = document.getElementById('sheetActivityPanel');
    var host  = document.getElementById('sheetSteps');
    if (!panel || !host) return;

    var cap = window.Capacitor;
    var HK  = cap && cap.Plugins && cap.Plugins.HealthKit;
    if (!HK) return;

    function commas(n){ return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

    /* The most recent reading, kept here rather than in state: steps belong
       to Health, and a copy in the save file would be wrong the moment
       anybody walked anywhere. */
    var latest = null;

    /* ---- what extra walking is worth ------------------------------------

       Net cost of walking, above the resting metabolism that TDEE already
       covers: about 2.5 METs over rest, at roughly 100 steps a minute.

         kcal/min = MET x 3.5 x kg / 200  ->  2.5 x 3.5 x kg / 200
         per step = that / 100            ->  0.0004375 x kg

       Only the EXCESS over the usual day is credited, and this is the whole
       reason the average is fetched. state.activity is already a multiplier
       over BMR describing how much someone moves on a normal day, so a
       normal day's steps are in the target twice if they are added again.
       The difference is the only part TDEE has not already accounted for.

       Positive only, deliberately. Today's count necessarily sits below the
       daily average all morning, so crediting the difference in both
       directions would cut the target at breakfast and restore it by
       evening — punishing a slow start and making the number untrustworthy.
       Below average simply leaves the baseline alone, which is exactly what
       the activity multiplier already assumed.

       Then discounted by creditRate(), the same slide the app applies to
       exercise: step-derived burn runs high, and an over-estimate should
       hurt least where it matters most.
       -------------------------------------------------------------------- */
    var NET_KCAL_PER_STEP_PER_KG = 0.0004375;

    /* Steps recorded on a given day key (YYYY-MM-DD), or null if that day is
       outside the window Health was asked for or holds nothing. */
    window.stepsOn = function(key){
      if (!latest || !latest.byDay) return null;
      var n = latest.byDay[key];
      return (typeof n === 'number') ? n : null;
    };

    /* Active energy recorded on a day key, or null. */
    window.energyOn = function(key){
      if (!latest || !latest.energyByDay) return null;
      var n = latest.energyByDay[key];
      return (typeof n === 'number') ? n : null;
    };

    /* The buff earned on a given day. Null when there is none, so a caller
       can test the result rather than compare a number against zero.

       Works for any day in the window, not just today: a past day's figures
       are final, which makes its buff more trustworthy than today's — today
       is still being lived.

       TWO SOURCES, PREFERRED IN ORDER

       1. Measured active energy. Apple derives it from heart rate and
          motion, so it knows a hill from a flat stroll, a fast walk from a
          slow one, and counts activity that takes no steps at all. Where it
          exists it is simply better evidence.

       2. Step count times a textbook net walking cost. Blind to pace,
          terrain and load — two identical step counts can be quite
          different days. Used only when active energy is missing, which is
          common on a phone carried without a Watch.

       Either way the figure is the DIFFERENCE from a usual day, never the
       whole thing: state.activity is already a multiplier over BMR standing
       for how much this person moves normally, so crediting a normal day
       again would pay for the same movement twice. */
    window.stepBuffFor = function(key, kind){
      if (!latest) return null;
      if (typeof state === 'undefined' || !(state.bodyweight > 0)) return null;

      var source, extraKcal;
      var steps  = window.stepsOn(key);
      var energy = window.energyOn(key);

      if (energy != null && latest.energyAverage > 0){
        source = 'energy';
        extraKcal = energy - latest.energyAverage;
      } else if (steps != null && latest.average > 0){
        source = 'steps';
        var kg = state.bodyweight * 0.453592;
        extraKcal = (steps - latest.average) * NET_KCAL_PER_STEP_PER_KG * kg;
      } else {
        return null;
      }

      /* On a training day the logged session burn is already added into the
         training-day target, and the same effort is inside these figures
         too. Measured energy can have it taken back out, so a training day
         that ALSO involved a lot of walking still earns something for the
         walking — which is the fair answer, and a kinder one than refusing
         the whole day. A step count cannot be separated that way: there is
         no telling which steps belonged to the session, so that path still
         declines rather than risk paying twice. */
      /* The caller passes the kind of the day being LOOKED AT. Falling back
         to activeDayKind() would answer for today whatever day is on screen,
         which is wrong the moment anyone scrolls back through the journal. */
      var dayKind = kind || ((typeof activeDayKind === 'function') ? activeDayKind() : 'rest');

      if (dayKind === 'train'){
        if (source !== 'energy') return null;
        var session = (typeof rawExerciseKcal === 'function') ? rawExerciseKcal() : 0;
        extraKcal -= session;
      }

      if (extraKcal <= 0) return null;

      /* The same slide the app applies to exercise. Both sources run high —
         wearables optimistically, step formulas by ignoring that most of a
         day is not brisk walking — and an over-estimate should hurt least
         where it matters most. */
      var rate = (typeof creditRate === 'function') ? creditRate() : 0.85;
      var kcal = Math.round(extraKcal * rate);
      if (kcal <= 0) return null;

      return {
        kcal: kcal,
        source: source,
        steps: steps,
        average: latest.average,
        extra: (steps != null && latest.average) ? Math.round(steps - latest.average) : null
      };
    };

    /* A usual day lately, over the last seven completed days. Null until
       Health has been read. */
    window.stepAverage = function(){
      return (latest && latest.average) ? latest.average : null;
    };

    function todayKeyLocal(){
      var d = new Date();
      return d.getFullYear() + '-' +
             String(d.getMonth() + 1).padStart(2, '0') + '-' +
             String(d.getDate()).padStart(2, '0');
    }

    /* Kept for the character sheet, which only ever means today. */
    window.stepBuff = function(){ return window.stepBuffFor(todayKeyLocal()); };

    /* Today against the last six days. A bare number says nothing about
       whether it is a good day; the comparison is the useful part. */
    function verdict(today, average){
      if (!average) return '';
      var diff = Math.round((today / average - 1) * 100);
      if (diff >= 15)  return 'Well above your usual ' + commas(average) + '.';
      if (diff <= -15) return 'Below your usual ' + commas(average) + '.';
      return 'About your usual ' + commas(average) + '.';
    }

    function showSteps(res){
      var today = res.today;
      var buff = window.stepBuff();
      var bonus = buff ? buff.kcal : 0;
      panel.hidden = false;
      host.innerHTML =
        '<div class="vital vital-wide">' +
          '<span class="vital-lbl">Steps today</span>' +
          '<span class="vital-edit"><strong id="stepsToday">' + commas(today) + '</strong></span>' +
        '</div>' +
        (bonus > 0
          ? '<div class="vital vital-wide">' +
              '<span class="vital-lbl">Step buff</span>' +
              '<span class="vital-edit"><strong class="n-green">+' + bonus + ' kcal</strong></span>' +
            '</div>'
          : '') +
        (res.average
          ? '<p class="subtitle" style="font-size:11px; margin:12px 0 0;">' +
            verdict(today, res.average) +
            ' Averaged over the last ' + res.days + ' full ' +
            (res.days === 1 ? 'day' : 'days') + ', today not counted.' +
            (bonus > 0
              ? ' The buff lands on your journal, not your prep, and counts only what you did ' +
                'beyond a usual day — the rest is already in your activity level. ' +
                (buff.source === 'energy'
                  ? 'Measured from your activity data.'
                  : 'Estimated from step count, which cannot see pace or hills.')
              : '') +
            '</p>'
          : '');
    }

    function offerConnect(){
      panel.hidden = false;
      host.innerHTML =
        '<p class="subtitle" style="font-size:11px; margin:0 0 12px;">' +
        'Loadout can show your step count from the Health app. It only reads ' +
        'steps &mdash; nothing is ever written back.</p>' +
        '<button class="btn-ghost" id="btnStepsConnect" style="margin:0;">' +
        '<svg class="px" aria-hidden="true"><use href="#i-run"></use></svg> SHOW MY STEPS</button>';

      document.getElementById('btnStepsConnect').addEventListener('click', function(){
        var btn = this;
        btn.disabled = true;
        HK.requestAuthorization()
          .then(function(){ return HK.readSteps(); })
          .then(function(res){
            if (res && res.today != null) { showSteps(res); return; }
            /* Permission was refused, or Health genuinely holds no steps.
               HealthKit will not say which, so the message must cover both
               without accusing the person of either. */
            host.innerHTML =
              '<p class="subtitle" style="font-size:11px; margin:0;">' +
              'No steps to show. Either Health has none recorded, or Loadout ' +
              'was not given access &mdash; you can change that in Settings ' +
              '&rarr; Privacy &amp; Security &rarr; Health &rarr; Loadout.</p>';
          })
          .catch(function(){
            btn.disabled = false;
          });
      });
    }

    function refresh(){
      HK.readSteps().then(function(res){
        if (res && res.today != null){
          var before = window.stepBuff();
          var beforeKcal = before ? before.kcal : 0;
          latest = res;
          showSteps(res);
          /* The HUD reads the bonus rather than being told it, so it only
             needs redrawing when the figure actually moved. */
          var now = window.stepBuff();
          /* The journal reads the buff rather than being told it, so it
             only needs redrawing when the figure actually moved. */
          if ((now ? now.kcal : 0) !== beforeKcal && typeof renderJournal === 'function') renderJournal();
        } else {
          latest = null;
          offerConnect();
        }
      }).catch(function(){ /* leave the panel as it is */ });
    }

    /* The sheet is drawn by renderTiers, which runs on load and whenever the
       character changes. Hooking the render rather than calling once keeps
       the figure from going stale on a sheet that stays open all day. */
    if (typeof window.renderTiers === 'function'){
      var original = window.renderTiers;
      window.renderTiers = function(){
        var out = original.apply(this, arguments);
        refresh();
        return out;
      };
    }

    /* Coming back to the app after a walk should show the walk. */
    document.addEventListener('visibilitychange', function(){
      if (document.visibilityState === 'visible') refresh();
    });

    /* And a sheet left open should not sit on a stale figure. Once a minute
       is far more often than the data actually changes — iOS batches step
       samples out of the motion coprocessor rather than writing every
       footfall, so the underlying number moves in steps of minutes no matter
       how often it is asked for. Skipped while backgrounded, where the timer
       would be throttled anyway and there is nobody looking. */
    setInterval(function(){
      if (document.visibilityState === 'visible') refresh();
    }, 60000);

    refresh();

  })();
