'use strict';
/* Covers the arithmetic behind the new trackers.

   Water is stored in millilitres whatever the units and stepped a glass at
   a time, so the claims are that a glass is the right size in each system,
   that the count can never go below nothing, and that switching units
   leaves what was drunk exactly as it was.

   The weekly check-in averages over the days that were LOGGED. A day with
   nothing in it is a day not recorded, and averaging it in as zero would
   make a half-logged week read as a crash diet — that is the claim most
   worth pinning. */

const {loadFunctions, suite} = require('./helpers');

function waterRig(units){
  const state = {units, log:{}};
  const ctx = loadFunctions('55-water.js', ['waterUnits', 'waterGoalMl', 'waterOn', 'addWater'], {
    state, ML_PER_FLOZ: 29.5735,
    dayLog: k => (state.log[k] = state.log[k] || {meals:{}}),
    saveState: ()=>{},
  });
  return {ctx, state};
}

function weekRig(days){
  const log = {};
  Object.keys(days).forEach(k => { log[k] = {meals:{LUNCH: days[k]}}; });
  const state = {log, units:'imperial'};
  return loadFunctions('58-checkin.js', ['keyOf', 'weekKeys', 'trendAt', 'weekStats'], {
    state,
    dayTotals: k => {
      const out = {kcal:0, protein:0, carbs:0, fat:0, items:0};
      ((log[k] || {}).meals ? Object.values(log[k].meals) : []).forEach(list => list.forEach(it => {
        out.kcal += it.kcal; out.protein += it.protein; out.items++;
      }));
      return out;
    },
    currentTargets: ()=>({kcal:2000, protein:150}),
  });
}

module.exports = () => suite('trackers', t => {
  t.section('water');
  const imp = waterRig('imperial');
  imp.ctx.addWater('2026-10-10', 1);
  t.equal('a glass is 8 fl oz in imperial', Math.round(imp.ctx.waterOn('2026-10-10')), 237);
  t.equal('and shows as 8', imp.ctx.waterUnits().show(imp.ctx.waterOn('2026-10-10')), '8');
  imp.ctx.addWater('2026-10-10', -3);
  t.equal('it never goes below nothing', imp.ctx.waterOn('2026-10-10'), 0);
  t.equal('the imperial goal is 64 fl oz', Math.round(imp.ctx.waterGoalMl() / 29.5735), 64);

  const met = waterRig('metric');
  met.ctx.addWater('2026-10-10', 5);
  t.equal('a glass is 250 ml in metric', met.ctx.waterOn('2026-10-10'), 1250);
  t.equal('and shows in litres', met.ctx.waterUnits().show(1250), '1.25');
  t.equal('a whole litre shows without decimals', met.ctx.waterUnits().show(2000), '2');
  met.state.units = 'imperial';
  t.equal('switching units leaves what was drunk alone', met.ctx.waterOn('2026-10-10'), 1250);

  t.section('the week');
  const ctx = weekRig({});
  const keys = ctx.weekKeys(0);
  t.equal('a week is seven days', keys.length, 7);
  const monday = new Date(keys[0] + 'T00:00');
  t.equal('starting on a Monday', monday.getDay(), 1);

  const day = i => keys[i];
  const today = ctx.keyOf(new Date());
  const past = keys.filter(k => k <= today);
  const logged = {};
  logged[past[0]] = [{kcal:1800, protein:140}];
  if (past.length > 1) logged[past[1]] = [{kcal:2200, protein:160}];
  const w = weekRig(logged).weekStats(0);
  const want = past.length > 1 ? 2000 : 1800;
  t.equal('averages only the days that were logged', Math.round(w.kcal), want);
  t.equal('counts how many were', w.logged, past.length > 1 ? 2 : 1);
  t.equal('an empty week has no average rather than zero', weekRig({}).weekStats(0).kcal, null);
  t.check('looking back a week gives the week before', weekRig({}).weekKeys(1)[0] < day(0));
});
