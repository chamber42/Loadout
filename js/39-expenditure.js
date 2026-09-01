'use strict';
/* ============================================================
   LOADOUT - MEASURED EXPENDITURE

   computeTDEE() in 17-onboarding.js is Mifflin-St Jeor times an activity
   factor: a population average, run once at character creation and then
   frozen. For any given person it can be 200-400 kcal a day out, which on
   a 500 kcal deficit is most of the deficit. It is the best guess
   available on day one, when the app knows four numbers about someone and
   nothing about what those numbers do.

   After a few weeks it is no longer the best guess available. Energy
   balance says the same thing it has always said:

       expenditure = intake - (change in stored energy)

   So someone who ate 2,200 a day for a month and lost a pound a week was
   burning about 2,700, whatever any formula predicts. That is a
   measurement of this person rather than a prediction about people like
   them, and it needs no new hardware and no new logging — only the food
   log and the weight series that already exist.

   WHAT THIS FILE WILL NOT DO

   It will not change anybody's target on its own.

   A measurement is only as honest as the logging under it. Miss a week of
   dinners and intake reads low, the arithmetic concludes a low
   expenditure, and the target gets CUT — punishing someone for a logging
   lapse rather than for eating. The guards below throw out the days that
   would do that, but no guard catches everything, so the measurement is
   offered and never imposed: both numbers stay on screen and the person
   decides.

   Adoption also SNAPSHOTS the figure rather than leaving it live. A target
   that re-fitted itself every time a new reading landed would move under a
   prep that had already been cooked, and a plan is meant to be the thing
   you decided, not a thing that drifts. A newer measurement announces
   itself; it does not apply itself.
   ============================================================ */

  /* Energy in a pound of body mass. The textbook 3,500 is a figure for fat
     alone; real weight change is fat, lean tissue and water in a ratio
     nobody can observe from a bathroom scale. It is the standard constant
     and it is what every app in this category uses, but it is an
     approximation, and it is the largest single source of error in the
     result below. */
  const KCAL_PER_LB = 3500;

  const EXP_WINDOW_DAYS   = 28;   // how far back to look
  const EXP_MIN_SPAN      = 14;   // shorter than this and noise dominates
  const EXP_MIN_LOGGED    = 10;   // days that actually carry a full log
  const EXP_MIN_COVERAGE  = 0.6;  // of the span, so the mean isn't a sample
                                  // of only the days someone felt like logging

  /* A day logged below this share of the rest-day target is treated as a
     partial log rather than as a very light day. The same 0.55 the calendar
     already uses to draw a thin mark: below it, the far likelier
     explanation is a forgotten dinner. Counting those would drag mean
     intake down and hand back an expenditure — and a target — that is too
     low. */
  const EXP_COMPLETE_FRACTION = 0.55;

  /* Outside this band the arithmetic has produced something no adult
     sustains, which means an input was wrong rather than a metabolism
     unusual. Refused rather than clamped: a clamped number looks like a
     measurement and is not one. */
  const EXP_PLAUSIBLE = {min: 1000, max: 6000};

  /* Below this the two figures are not really disagreeing, and offering to
     swap one for the other would be asking someone to make a decision that
     changes nothing. */
  const EXP_MEANINGFUL_DIFF = 50;

  /* The largest share of bodyweight a week that a real trend can be. Beyond
     this the arithmetic is describing a data-entry mistake. */
  const EXP_MAX_WEEKLY_FRACTION = 0.02;

  function expDayKeys(endKey, days){
    const out = [];
    const d = weightKeyToDate(endKey);
    for (let i = 0; i < days; i++){
      out.push(d.getFullYear() + '-' +
               String(d.getMonth() + 1).padStart(2, '0') + '-' +
               String(d.getDate()).padStart(2, '0'));
      d.setDate(d.getDate() - 1);
    }
    return out.reverse();
  }

  /* The formula estimate, with the adopted measurement deliberately ignored
     — otherwise adopting one would overwrite the thing it is meant to be
     compared against, and the panel would show a number agreeing with
     itself. */
  function formulaTDEE(){
    if (typeof state === 'undefined') return null;
    if (!(state.bodyweight > 0 && state.heightIn > 0 && state.age > 0 && state.sex)) return null;
    const kg = state.bodyweight * 0.453592;
    const cm = state.heightIn * 2.54;
    const base = (10*kg) + (6.25*cm) - (5*state.age);
    const bmr = state.sex === 'male' ? base + 5 : base - 161;
    return bmr * state.activity;
  }

  /* Expenditure measured from what was eaten and what the scale did.

     Returns null with a `why` whenever it cannot answer, so the panel can
     say what is still missing instead of simply staying blank — the one
     place a line of explanation earns itself, because the person is
     looking at an empty space and wondering what they did wrong. */
  function measuredExpenditure(){
    if (typeof state === 'undefined') return null;
    if (typeof weightRatePerWeek !== 'function') return null;

    const series = (typeof weightSeries === 'function') ? weightSeries() : [];
    if (series.length < 2) return {kcal: null, why: 'weigh in a few more times'};

    const endKey = series[series.length - 1].key;
    const keys = expDayKeys(endKey, EXP_WINDOW_DAYS);

    /* The rest-day target is the stable reference for "was this day fully
       logged". Historical targets are not kept, and today's is the closest
       honest stand-in. */
    const reference = (state.restKcal || state.finalKcal || 0);
    const floor = reference * EXP_COMPLETE_FRACTION;

    let sum = 0, counted = 0, firstCounted = null;
    keys.forEach(k => {
      const t = dayTotals(k);
      if (!t.items) return;
      if (floor > 0 && t.kcal < floor) return;   // a partial log, not a light day
      if (!firstCounted) firstCounted = k;
      sum += t.kcal;
      counted++;
    });

    /* The window starts at the first day that actually carries a full log,
       not at the first day with anything in it.

       Someone who logged badly for a fortnight and then got serious has two
       weeks of good evidence, and measuring across all four would both dilute
       it and fail the coverage test below — refusing to answer on the grounds
       that they used to be worse at this. Starting from the first good day
       measures what can be measured. Sparse logging is still caught: a person
       who records one day in three has a long span with few counted days in
       it, and fails coverage exactly as before. */
    const span = firstCounted ? daysBetweenKeys(firstCounted, endKey) + 1 : 0;

    if (span < EXP_MIN_SPAN)        return {kcal: null, why: 'keep logging for a couple of weeks'};
    if (counted < EXP_MIN_LOGGED)   return {kcal: null, why: 'more fully logged days needed'};
    if (counted / span < EXP_MIN_COVERAGE)
                                    return {kcal: null, why: 'too many days missing to be sure'};

    /* The rate is fitted over the same span the intake was averaged over.
       Two different windows would be comparing what was eaten in one period
       against what the body did in another. */
    const rate = weightRatePerWeek(span);
    if (rate == null)               return {kcal: null, why: 'weigh in a few more times'};

    /* A sustained swing beyond about 2% of bodyweight a week is not a
       metabolism, it is a mistyped weight or a scale in the wrong units.
       Checked against bodyweight rather than as a flat number of pounds,
       because four pounds a week means something very different at 150 lb
       and at 400 lb. */
    if (state.bodyweight > 0 && Math.abs(rate) > state.bodyweight * EXP_MAX_WEEKLY_FRACTION)
      return {kcal: null, why: 'a weigh-in looks wrong'};

    const meanIntake = sum / counted;
    /* Losing weight means rate is negative, so subtracting it ADDS the
       deficit back on: what was eaten plus what came off the body is what
       was spent. */
    const kcal = meanIntake - (rate / 7) * KCAL_PER_LB;

    if (!(kcal >= EXP_PLAUSIBLE.min && kcal <= EXP_PLAUSIBLE.max))
      return {kcal: null, why: 'the numbers do not add up yet'};

    return {
      kcal: Math.round(kcal),
      meanIntake: Math.round(meanIntake),
      ratePerWeek: rate,
      days: span,
      logged: counted,
      coverage: counted / span,
      formula: formulaTDEE(),
      why: null,
    };
  }

  /* Adopt the current measurement as the character's daily burn. */
  function adoptMeasuredExpenditure(){
    const m = measuredExpenditure();
    if (!m || m.kcal == null) return false;
    state.tdeeMeasured = m.kcal;
    state.tdeeMeasuredAt = todayKey();
    if (typeof syncTargets === 'function') syncTargets();
    if (typeof assignTier === 'function') assignTier();
    return true;
  }

  function dropMeasuredExpenditure(){
    state.tdeeMeasured = null;
    state.tdeeMeasuredAt = null;
    if (typeof syncTargets === 'function') syncTargets();
    if (typeof assignTier === 'function') assignTier();
  }

  /* ---------------------------------------------------------
     THE PANEL

     Both numbers, always, whenever there are two to show. The whole point
     is that the person can see the formula and the measurement disagree
     and decide which they believe; hiding either would turn a comparison
     into an announcement.
     --------------------------------------------------------- */
  function renderExpenditurePanel(){
    const panel = document.getElementById('sheetBurnPanel');
    const host  = document.getElementById('sheetBurn');
    if (!panel || !host) return;

    /* Only meaningful when the app is calculating a target at all. Someone
       who typed their own number is not asking to have it second-guessed. */
    if (typeof state === 'undefined' || state.mode !== 'calc'){
      panel.hidden = true;
      return;
    }

    const m = measuredExpenditure();
    const formula = formulaTDEE();
    const adopted = state.tdeeMeasured > 0 ? Math.round(state.tdeeMeasured) : null;

    if (!formula){ panel.hidden = true; return; }
    /* Nothing measured and nothing adopted: there is no comparison to make,
       so the panel stays away rather than standing there explaining that it
       has nothing to say yet. */
    if ((!m || m.kcal == null) && !adopted){ panel.hidden = true; return; }

    panel.hidden = false;

    const row = (label, value, cls) =>
      `<div class="vital vital-wide">
         <span class="vital-lbl">${label}</span>
         <span class="vital-edit"><strong${cls ? ` class="${cls}"` : ''}>${value}</strong><span class="vital-unit">kcal</span></span>
       </div>`;

    let html = row('Formula', Math.round(formula), adopted ? '' : 'n-green');

    if (m && m.kcal != null){
      html += row('Measured', m.kcal, adopted === m.kcal ? 'n-green' : '');
      const rateTxt = (typeof rateTextLower === 'function')
        ? rateTextLower(m.ratePerWeek)
        : (Math.abs(m.ratePerWeek) < 0.1 ? 'holding steady'
           : (m.ratePerWeek < 0 ? 'down ' : 'up ') + Math.abs(m.ratePerWeek).toFixed(1) + ' lb a week');
      html += `<p class="subtitle" style="font-size:11px; margin:12px 0 0;">
                 From ${m.logged} logged ${m.logged === 1 ? 'day' : 'days'} averaging
                 ${m.meanIntake} kcal over ${m.days} days, ${rateTxt}.</p>`;
    } else if (m && m.why){
      html += `<p class="subtitle" style="font-size:11px; margin:12px 0 0;">
                 Measured burn needs a longer run &mdash; ${escapeHtml(m.why)}.</p>`;
    }

    if (adopted && (!m || m.kcal !== adopted)){
      html += row('In use', adopted, 'n-green');
    }

    const canAdopt = m && m.kcal != null &&
                     Math.abs(m.kcal - (adopted != null ? adopted : formula)) >= EXP_MEANINGFUL_DIFF;

    if (canAdopt){
      html += `<button class="btn-ghost" id="btnUseMeasured" style="margin:14px 0 0;">
                 ${ic('bolt')} USE ${m.kcal} KCAL</button>`;
    }
    if (adopted){
      html += `<button class="text-link" id="btnDropMeasured" style="margin-top:10px;">
                 Back to the formula</button>`;
    }

    host.innerHTML = html;

    const use = document.getElementById('btnUseMeasured');
    if (use) use.addEventListener('click', ()=>{
      if (!adoptMeasuredExpenditure()) return;
      if (typeof saveState === 'function') saveState();
      if (typeof renderTiers === 'function') renderTiers();
      if (typeof toast === 'function') toast('Target now built on your own numbers.', 'check');
    });

    const drop = document.getElementById('btnDropMeasured');
    if (drop) drop.addEventListener('click', ()=>{
      dropMeasuredExpenditure();
      if (typeof saveState === 'function') saveState();
      if (typeof renderTiers === 'function') renderTiers();
    });
  }

  (function hookExpenditurePanel(){
    if (typeof window.renderTiers !== 'function') return;
    const original = window.renderTiers;
    window.renderTiers = function(){
      const out = original.apply(this, arguments);
      try{ renderExpenditurePanel(); }catch(e){ console.error('Loadout: expenditure panel', e); }
      return out;
    };
  })();

  window.measuredExpenditure      = measuredExpenditure;
  window.formulaTDEE              = formulaTDEE;
  window.adoptMeasuredExpenditure = adoptMeasuredExpenditure;
  window.dropMeasuredExpenditure  = dropMeasuredExpenditure;
  window.renderExpenditurePanel   = renderExpenditurePanel;
