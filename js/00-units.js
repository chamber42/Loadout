'use strict';
/* ============================================================
   LOADOUT - POUNDS OR KILOGRAMS

   Every weight in this app was a pound and every height an inch, written
   into the markup as fixed labels. That is most of the world unable to
   finish character creation without doing arithmetic first, over a
   difference that is purely presentational.

   NOTHING STORED EVER CHANGES

   state.bodyweight stays pounds. state.heightIn stays inches. The weight
   series, the trend, the least-squares rate, the expenditure maths and
   every saved file keep working in exactly the units they always did.

   That is deliberate rather than lazy. Storing whichever unit the person
   last chose would mean every reader has to know which one a given number
   is in, a saved file would change meaning when somebody flipped a switch,
   and a plan cooked in March would be sized against a figure that means
   something different in April. One internal unit, converted at the edges,
   is the only version of this that cannot silently corrupt a history.

   So this file is a display layer and an input parser, and nothing else.
   ============================================================ */

  const LB_PER_KG = 2.2046226218;
  const CM_PER_IN = 2.54;

  const UNIT_SYSTEMS = {
    imperial: {
      weight: {
        label: 'lb',
        show:  lb => lb,                       // stored unit is the shown unit
        store: n  => n,
        min: 60, max: 600, step: 1,
      },
      /* Feet and inches need two boxes; centimetres need one. The two are
         different enough in shape that the markup carries both and this
         says which is on screen. */
      heightSplit: true,
      heightLabel: 'ft / in',
    },
    metric: {
      weight: {
        label: 'kg',
        show:  lb => lb / LB_PER_KG,
        store: n  => n * LB_PER_KG,
        min: 27, max: 275, step: 0.5,
      },
      heightSplit: false,
      heightLabel: 'cm',
      height: {
        show:  inches => inches * CM_PER_IN,
        store: cm     => cm / CM_PER_IN,
        min: 120, max: 230, step: 1,
      },
    },
  };

  /* A first guess, not a decision. Only three countries use pounds for
     bodyweight in everyday life, so anyone outside them is far likelier to
     want kilograms than to want to go looking for a switch. Overridden the
     moment somebody sets it themselves, and remembered from then on. */
  function defaultUnits(){
    try{
      const region = (Intl.DateTimeFormat().resolvedOptions().locale ||
                      navigator.language || 'en-US').toUpperCase();
      return /-(US|LR|MM)\b/.test(region) || region === 'EN-US' ? 'imperial' : 'metric';
    }catch(e){ return 'imperial'; }
  }

  function unitSystem(){
    if (typeof state === 'undefined') return UNIT_SYSTEMS.imperial;
    if (state.units !== 'imperial' && state.units !== 'metric') state.units = defaultUnits();
    return UNIT_SYSTEMS[state.units];
  }

  function isMetric(){ return unitSystem() === UNIT_SYSTEMS.metric; }

  /* ---- weight ---------------------------------------------------------- */

  function weightUnitLabel(){ return unitSystem().weight.label; }

  /* A stored weight in pounds, as the number to show. */
  function showWeight(lb, decimals){
    if (!(lb > 0)) return null;
    const v = unitSystem().weight.show(lb);
    return decimals == null ? Math.round(v) : +v.toFixed(decimals);
  }

  /* A number the person typed, back into pounds for storage. */
  function storeWeight(n){
    const v = parseFloat(n);
    if (!isFinite(v)) return null;
    return unitSystem().weight.store(v);
  }

  function weightBounds(){
    const w = unitSystem().weight;
    return {min: w.min, max: w.max, step: w.step};
  }

  /* A rate of change. Written per week in both systems — the interval is
     not what differs between them. */
  function showRate(lbPerWeek){
    if (lbPerWeek == null) return null;
    return unitSystem().weight.show(lbPerWeek);
  }

  /* "0.4 kg a week", "1.0 lb a week". Below a tenth in the DISPLAYED unit
     there is no direction to report — a tenth of a kilogram and a tenth of
     a pound are different thresholds, and the one that matters is the one
     the person can see. */
  function rateText(lbPerWeek){
    const v = showRate(lbPerWeek);
    if (v == null) return '';
    const per = Math.abs(v);
    if (per < 0.1) return 'Holding steady';
    return (v < 0 ? 'Down ' : 'Up ') + per.toFixed(1) + ' ' + weightUnitLabel() + ' a week';
  }

  function rateTextLower(lbPerWeek){
    const v = showRate(lbPerWeek);
    if (v == null) return '';
    const per = Math.abs(v);
    if (per < 0.1) return 'holding steady';
    return (v < 0 ? 'down ' : 'up ') + per.toFixed(1) + ' ' + weightUnitLabel() + ' a week';
  }

  /* Protein written against bodyweight — the one place a macro carries a
     unit of mass in its denominator. */
  function perBodyweight(grams, lb){
    if (!(lb > 0)) return '';
    const shown = unitSystem().weight.show(lb);
    if (!(shown > 0)) return '';
    return (grams / shown).toFixed(2) + ' g/' + weightUnitLabel();
  }

  /* ---- height ---------------------------------------------------------- */

  function heightIsSplit(){ return !!unitSystem().heightSplit; }
  function heightUnitLabel(){ return unitSystem().heightLabel; }

  function showHeight(inches){
    if (!(inches > 0)) return null;
    return isMetric() ? Math.round(inches * CM_PER_IN) : inches;
  }

  function storeHeight(n){
    const v = parseFloat(n);
    if (!isFinite(v)) return null;
    return isMetric() ? v / CM_PER_IN : v;
  }

  /* ---- switching ------------------------------------------------------- */

  function setUnits(which){
    if (which !== 'imperial' && which !== 'metric') return;
    if (typeof state !== 'undefined') state.units = which;
    /* Nothing is converted and nothing is recalculated: the stored figures
       did not move, only the labels on them. Every screen that shows one
       simply redraws. */
    if (typeof renderTiers === 'function') renderTiers();
    if (typeof renderOnboardUnits === 'function') renderOnboardUnits();
    if (typeof saveState === 'function') saveState();
  }

  window.isMetric         = isMetric;
  window.weightUnitLabel  = weightUnitLabel;
  window.showWeight       = showWeight;
  window.storeWeight      = storeWeight;
  window.weightBounds     = weightBounds;
  window.showRate         = showRate;
  window.rateText         = rateText;
  window.rateTextLower    = rateTextLower;
  window.perBodyweight    = perBodyweight;
  window.heightIsSplit    = heightIsSplit;
  window.heightUnitLabel  = heightUnitLabel;
  window.showHeight       = showHeight;
  window.storeHeight      = storeHeight;
  window.setUnits         = setUnits;
  window.defaultUnits     = defaultUnits;
