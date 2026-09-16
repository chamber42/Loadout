'use strict';
/* ============================================================
   LOADOUT - CLASS PROGRESS

   The class is cosmetic — a name, a portrait and a rank. It used to be the
   calorie band the target sat in, and simulating six months of weigh-ins
   across 1,548 invented people showed why that never felt like anything:
   57–85% of them were never offered a new class at all, most offers that
   did appear were scale noise walking the target back and forth over a
   band edge, and on a cut every change was a step DOWN, announced as an
   upgrade. The class names read as a ladder — Rookie to Final Boss, Novice
   to Legend — and the calorie bands made people walk down it.

   So a class is earned, and only ever upward.

   HOW

   Each stretch of one kind of goal is a journey (state.classJourney),
   started from whatever class the person already holds:

                 to class 2   3      4      5        all four
     cutting     2%        3%     4%     5%       14% of the starting weight lost
     bulking     1%        1.5%   2%     2.5%     7% gained — muscle comes slower
     steady      28        42     56     70       196 days logged (Recomp, Maintain)

   Each class costs more than the one before, the way levels do: the first
   arrives within a month of honest work, the last takes months more.

   Weight is read off the smoothed trend, never a single reading, so one
   dry morning cannot earn anything and a salty one cannot cost anything.
   A logged day is one the streak counts — at least 55% of the day's target
   recorded — so a class for consistency still has to be logged, not
   merely opened.

   From 213 lb the steps are 4.3, 6.4, 8.5 and 10.7 lb — about 30 lb for the
   top class. A flat step was tried first and simulated: 98% of cutters
   maxed out inside six months, leaving nothing for the rest of the year.
   Steady goals cost more days than a cut costs weeks, since logging alone
   is easier than losing 30 lb. Classes are never taken away. Switching between cut speeds
   keeps the journey; changing direction starts a new one from the class
   already held, so toggling goals earns nothing.

   A diet break is part of the cut it interrupts, so it keeps that journey.

   An earned class is offered, not applied (state.classOffer). Keeping the
   current one is remembered (state.classDeclined) and not asked again; the
   next class up still is.
   ============================================================ */

  const CLASS_MAX = 5;
  /* What each step costs, indexed by the class being left (1 → 2 first). */
  const CLASS_STEPS_CUT    = [0.02, 0.03, 0.04, 0.05];
  const CLASS_STEPS_GAIN   = [0.01, 0.015, 0.02, 0.025];
  const CLASS_STEPS_STEADY = [28, 42, 56, 70];

  /* Walks up from the journey's starting class for as long as `have`
     covers the next step. `unit` scales a share into pounds. */
  function climbClasses(base, have, steps, unit){
    let earned = base, spent = 0;
    while (earned < CLASS_MAX && have + 1e-9 >= spent + steps[earned - 1] * unit){
      spent += steps[earned - 1] * unit;
      earned++;
    }
    const next = earned < CLASS_MAX ? steps[earned - 1] * unit : 0;
    return {earned, spent, next,
            frac: earned >= CLASS_MAX ? 1 : Math.max(0, (have - spent) / next)};
  }

  function classDirection(){
    if (state.dietBreak) return state.classJourney ? state.classJourney.dir : -1;
    return goalDef(state.goal).dir;
  }

  function classWeightNow(){
    const t = (typeof trendWeightNow === 'function') ? trendWeightNow() : null;
    return t != null ? t : (state.bodyweight > 0 ? state.bodyweight : null);
  }

  /* `base` is the class the journey starts from — including one earned on
     the last journey but not taken yet, so reaching a goal weight and
     switching to Maintain in the same moment does not lose it. */
  function startClassJourney(today, base){
    state.classJourney = {
      dir: classDirection(),
      startLb: classWeightNow(),
      startDay: today,
      base: base || state.assignedTierId || 1,
    };
  }

  /* Where the journey stands: the class earned so far, and how far through
     the step to the next one. */
  function classProgress(today){
    const j = state.classJourney;
    const base = (j && j.base) || state.assignedTierId || 1;
    if (!j) return {earned: base, frac: 0};
    if (base >= CLASS_MAX) return {earned: CLASS_MAX, frac: 1, max: true};

    if (j.dir){
      const now = classWeightNow();
      if (now == null || !(j.startLb > 0)) return {earned: base, frac: 0, dir: j.dir};
      const moved = Math.max(0, j.dir < 0 ? j.startLb - now : now - j.startLb);
      const c = climbClasses(base, moved, j.dir < 0 ? CLASS_STEPS_CUT : CLASS_STEPS_GAIN, j.startLb);
      return {
        earned: c.earned, dir: j.dir, now, moved,
        max: c.earned >= CLASS_MAX, frac: c.frac,
        nextLb: j.startLb + j.dir * (c.spent + c.next),
      };
    }

    const day = today || todayKey();
    const days = (typeof streakLoggedKeys === 'function')
      ? streakLoggedKeys().filter(k => k >= j.startDay && k <= day).length : 0;
    const c = climbClasses(base, days, CLASS_STEPS_STEADY, 1);
    return {
      earned: c.earned, dir: 0, days,
      max: c.earned >= CLASS_MAX, frac: c.frac,
      needDays: c.spent + c.next,
    };
  }

  /* Run wherever the weight, the goal or the character changes, and when
     the sheet is drawn. A new character starts at the first class; a remade
     one keeps what it has earned, and its journey carries on unless the
     goal now points the other way. */
  function assignTier(){
    const today = todayKey();
    if (!state.assignedTierId){
      state.assignedTierId = 1;
      state.classOffer = state.classDeclined = null;
      startClassJourney(today);
    } else if (!state.classJourney || state.classJourney.dir !== classDirection()){
      const carried = state.classJourney ? classProgress(today).earned : state.assignedTierId;
      startClassJourney(today, Math.max(carried, state.assignedTierId));
    }
    state.selectedTierId = state.assignedTierId;

    const earned = classProgress(today).earned;
    const before = state.classOffer;
    if (earned > state.assignedTierId && earned !== state.classDeclined){
      state.classOffer = earned;
      /* Said once as it arrives, since the sheet may not be on screen. */
      if (before !== earned && typeof toast === 'function' && typeof THEMES !== 'undefined'){
        const w = (THEMES[state.theme] || THEMES.cyberpunk || {}).words || {};
        const title = String(w.promoTitle || 'NEW CLASS AVAILABLE').toLowerCase();
        toast(title.charAt(0).toUpperCase() + title.slice(1) + '.', 'star');
      }
    } else {
      state.classOffer = null;
    }
  }

  function acceptClassOffer(){
    if (!state.classOffer) return false;
    state.assignedTierId = state.selectedTierId = state.classOffer;
    state.classOffer = state.classDeclined = null;
    return true;
  }

  function declineClassOffer(){
    if (!state.classOffer) return false;
    state.classDeclined = state.classOffer;
    state.classOffer = null;
    return true;
  }

  /* Logging a day can earn a class on a steady goal, and nothing on the
     journal redraws the sheet — so it is checked whenever the sheet is. */
  (function hookClassProgress(){
    if (typeof window.renderTiers !== 'function') return;
    const original = window.renderTiers;
    window.renderTiers = function(){
      try{
        if (state.assignedTierId){
          const had = state.classOffer, hadJourney = state.classJourney;
          assignTier();
          if ((state.classOffer !== had || state.classJourney !== hadJourney) &&
              typeof saveState === 'function') saveState();
        }
      }catch(e){ console.error('Loadout: class progress', e); }
      return original.apply(this, arguments);
    };
  })();
