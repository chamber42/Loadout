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
    /* ---- what "usual" means ---------------------------------------------

       One blended mean across every day alike — a training day is a gym
       session lifting weights, which carries no more walking than any other
       day, so the rest/training flag says nothing about how far somebody
       walked and nothing here reads it.

       Measured over FOUR WEEKS rather than HealthKit's seven days, and that
       window length is doing real work.

       The buff credits movement beyond a usual day, on the grounds that a
       usual day is already paid for by state.activity inside TDEE. That
       holds only while state.activity is right, and it is one of four fixed
       numbers chosen once at character creation. It never moves. So when
       somebody genuinely starts walking further, a seven-day baseline
       absorbs the change inside a week — the buff decays to nothing — while
       their TDEE never rises to replace it. They burn more permanently and
       are credited for none of it.

       The measured expenditure in 39-expenditure.js does catch that, because
       it reads intake against the weight trend rather than a multiplier. But
       it needs two to four weeks to see it. A four-week baseline makes the
       buff fade over roughly the same period the measurement takes to catch
       up, so the credit hands off from one to the other instead of falling
       through the gap between them.

       Falls back to HealthKit's own figure when there is not yet a month of
       history to average. */
    var USUAL_WINDOW_DAYS = 28;
    var USUAL_MIN_DAYS    = 7;

    function meanRecent(map, fallback){
      if (!map) return fallback;
      var today = todayKeyLocal();
      var vals = Object.keys(map).filter(function(k){
        if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return false;
        if (k >= today) return false;                 // still being lived
        /* Zeros excluded, for the same reason sessionStepCost excludes them:
           a recorded zero is a phone left on a desk far more often than a
           day without a single step. The two means must also agree on which
           days they count, or the difference between them means nothing. */
        return map[k] > 0;
      }).sort().slice(-USUAL_WINDOW_DAYS).map(function(k){ return map[k]; });

      if (vals.length < USUAL_MIN_DAYS) return fallback;
      return vals.reduce(function(a, b){ return a + b; }, 0) / vals.length;
    }

    function usualSteps(){
      return Math.round(meanRecent(latest && latest.byDay,
                                   (latest && latest.average) || 0));
    }
    function usualEnergy(){
      return meanRecent(latest && latest.energyByDay,
                        (latest && latest.energyAverage) || 0);
    }

    /* ---- how many steps a training session actually costs ---------------

       On a training day the credited session burn is already inside the
       target, so any part of it that ALSO shows up in the step surplus
       would be paid for twice. The question is how much of it does.

       That depends on the session, and the app has no idea what the session
       was — it has a step count and nothing else. Rather than ask, and then
       guess the step cost from the answer, this measures the step cost
       directly: on the days you marked as training, how many more steps did
       you take than on the days you did not?

       The difference IS the session's contribution to the counter, for you.
       Lifting comes out near zero, a run comes out in the thousands, and
       cycling comes out near zero too — correctly, because a bike puts no
       steps on the counter whatever else it does. The exercise type never
       needs naming, because it was only ever a way of predicting this
       number, and this number can be observed.

       Null until there is enough of both kinds to compare, and the caller
       falls back to subtracting the whole session while that is true. */
    var INFER_MIN_DAYS = 3;    // of each kind, before a difference means anything

    function dayKindAtKey(key){
      var day = (typeof state !== 'undefined' && state.log) ? state.log[key] : null;
      /* Same default the journal uses: a date nobody marked is a rest day. */
      return (day && day.dayKind === 'train') ? 'train' : 'rest';
    }

    window.sessionStepCost = function(){
      if (!latest || !latest.byDay) return null;
      var today = todayKeyLocal();
      var train = [], rest = [];
      Object.keys(latest.byDay).forEach(function(k){
        if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return;
        if (k >= today) return;                       // still being lived
        var n = latest.byDay[k];
        /* A recorded zero is a phone left on a desk far more often than a
           day without a single step, and it would drag whichever mean it
           lands in. */
        if (!(n > 0)) return;
        (dayKindAtKey(k) === 'train' ? train : rest).push(n);
      });

      if (train.length < INFER_MIN_DAYS || rest.length < INFER_MIN_DAYS) return null;
      var mean = function(a){
        return a.reduce(function(x, y){ return x + y; }, 0) / a.length;
      };
      /* Clamped at zero: a training population that walks LESS than the rest
         population is noise, not a session that removes steps. */
      return Math.max(0, Math.round(mean(train) - mean(rest)));
    };

    window.stepBuffFor = function(key, kind){
      if (!latest) return null;
      if (typeof state === 'undefined' || !(state.bodyweight > 0)) return null;

      var steps  = window.stepsOn(key);
      var energy = window.energyOn(key);

      /* On a training day the session burn is already inside the training
         target, so it must not be paid for a second time here. Whether it
         IS in a given figure depends entirely on which figure:

           ENERGY captures the session. Active energy comes from heart rate
           and motion, so an hour of lifting shows up in it plainly. Credit
           it again and the day is paid twice, so the session comes out.

           STEPS do not. Lifting produces almost no walking — a few hundred
           paces between racks, against a surplus measured in thousands. The
           session was never in this number, so taking it out is subtracting
           something that is not there.

         Both earlier versions got this wrong in opposite directions. The
         first refused the step path outright on a training day, so a gym day
         with 17,000 steps earned nothing. The second subtracted the whole
         session from the step figure, which zeroed out almost every day it
         touched. The distinction is not the day, it is the signal.

         Worth revisiting only if training ever means long runs: a run DOES
         show up in the step count, and then the overlap is real. */
      var dayKind = kind || ((typeof activeDayKind === 'function') ? activeDayKind() : 'rest');
      var session = (dayKind === 'train' && typeof rawExerciseKcal === 'function')
        ? rawExerciseKcal() : 0;

      /* BOTH signals are computed, and whichever shows a real surplus wins.

         Measured active energy used to win outright whenever it existed,
         which was wrong on a phone carried without a Watch: iOS still
         estimates active energy from motion, that estimate barely moves with
         a long walk, and a flat estimate would then block a step count that
         had plainly doubled. A day of 25,415 steps against a usual of 13,524
         reported no buff and said "no further than usual" — while the number
         on the same line said otherwise.

         Energy is still preferred when both agree there was a surplus: it
         knows a hill from a flat stroll and counts activity that takes no
         steps at all. It is only overruled when it says nothing happened and
         the step count says something did. */
      var fromEnergy = null, fromSteps = null;
      var usualE = usualEnergy();
      var usualS = usualSteps();

      if (energy != null && usualE > 0){
        fromEnergy = (energy - usualE) - session;
      }
      if (steps != null && usualS > 0){
        var kg = state.bodyweight * 0.453592;
        /* Subtract the session's own step cost, measured rather than
           assumed — see sessionStepCost above. Near zero for lifting or
           cycling, thousands for a run, and whatever it actually is for
           whatever you actually do.

           Where there is not yet enough history to measure it, fall back to
           taking the whole session burn out. That is the conservative
           answer and it is the one that was zeroing out training days, so
           it should be temporary: a few marked days of each kind is all it
           takes to replace a guess with a measurement. */
        var costSteps = (dayKind === 'train') ? window.sessionStepCost() : 0;
        if (dayKind === 'train' && costSteps == null){
          fromSteps = ((steps - usualS) * NET_KCAL_PER_STEP_PER_KG * kg) - session;
        } else {
          fromSteps = (steps - usualS - (costSteps || 0)) * NET_KCAL_PER_STEP_PER_KG * kg;
        }
      }

      var source, extraKcal;
      if (fromEnergy != null && fromEnergy > 0){ source = 'energy'; extraKcal = fromEnergy; }
      else if (fromSteps != null && fromSteps > 0){ source = 'steps'; extraKcal = fromSteps; }
      else return null;

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
        /* What the session was measured to cost in steps, so the journal can
           say so rather than leaving a deduction unexplained. Null when
           there was not enough history and the whole session was taken out
           instead. */
        sessionSteps: (dayKind === 'train') ? window.sessionStepCost() : null,
        steps: steps,
        /* The usual for this kind of day, not the blended one — it is what
           the figure was actually measured against, and it is what the
           journal quotes back. */
        average: usualS,
        extra: (steps != null && usualS) ? Math.round(steps - usualS) : null
      };
    };

    /* Whether the day's step count was actually above the usual, regardless
       of whether it earned anything. The journal needs this to avoid telling
       somebody they went "no further than usual" on a day they walked twice
       as far — which is what it did whenever a buff was declined for a
       reason other than the distance. */
    window.stepsBeatUsual = function(key){
      var steps = window.stepsOn(key);
      var usual = usualSteps();
      return !!(steps != null && usual > 0 && steps > usual);
    };

    /* A usual day lately, over the last seven completed days. Null until
       Health has been read. */
    window.stepAverage = function(){
      return usualSteps() || null;
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

    /* The activity panel now lives on the quest log rather than the
       character sheet, so the calendar has to be able to refresh it too —
       see the note in renderCalendar. */
    window.refreshStepsPanel = refresh;

  })();
