'use strict';
/* Covers the goal speeds in 03-data-tiers.js and the calorie target built
   on them in 17-onboarding.js.

   Goals used to be flat daily adjustments, and two failures came of it: a
   flat cut grows harsher as the weight comes off, and on a small frame two
   different goals hit the calorie floor and produced the same number. The
   checks here are mostly about those two things staying fixed. Every
   person below is invented for the test. */

const fs = require('fs');
const vm = require('vm');
const {jsFile, extract, suite} = require('./helpers');

/* GOAL_DEFS is a file-scope const, so it is lifted out by brace matching
   the same way extract() lifts a function. */
function extractConst(src, name){
  const at = src.indexOf('const ' + name + ' = {');
  if (at < 0) throw new Error(`extractConst: no const named ${name}`);
  let depth = 0;
  for (let j = src.indexOf('{', at); j < src.length; j++){
    if (src[j] === '{') depth++;
    else if (src[j] === '}' && --depth === 0) return src.slice(at, j + 1) + ';';
  }
  throw new Error(`extractConst: unbalanced braces reading ${name}`);
}

function rig(person){
  const tiers = fs.readFileSync(jsFile('03-data-tiers.js'), 'utf8');
  const onboard = fs.readFileSync(jsFile('17-onboarding.js'), 'utf8');
  const weight = fs.readFileSync(jsFile('38-weight.js'), 'utf8');
  const state = Object.assign({mode: 'calc', tdeeMeasured: null, exerciseKcal: 0}, person);
  const ctx = {console, state, toasts: []};
  ctx.toast = msg => ctx.toasts.push(msg);
  vm.createContext(ctx);
  vm.runInContext([
    extractConst(tiers, 'GOAL_DEFS'),
    'const GOAL_KEYS = Object.keys(GOAL_DEFS);',
    'const KCAL_DAY_PER_LB_WEEK = 500;',
    'const KCAL_FLOOR = { male:1500, female:1200 };',
    ...['goalDef', 'goalBand', 'goalAdjustKcal', 'goalProjection'].map(n => extract(tiers, n)),
    ...['computeTDEE', 'formulaTDEE', 'tdeeAtWeight', 'computeCalcKcal', 'calcReady',
        'goalRateLbWeek'].map(n => extract(onboard, n)),
    ...['weightGoalLine', 'checkGoalReached'].map(n => extract(weight, n)),
    'this.GOAL_DEFS = GOAL_DEFS; this.GOAL_KEYS = GOAL_KEYS;',
  ].join('\n'), ctx);
  return ctx;
}

const PEOPLE = {
  smallWoman: {sex: 'female', bodyweight: 125, heightIn: 62, age: 30, activity: 1.25},
  avgMan:     {sex: 'male',   bodyweight: 180, heightIn: 70, age: 25, activity: 1.6},
  bigMan:     {sex: 'male',   bodyweight: 300, heightIn: 74, age: 35, activity: 1.25},
  at285:      {sex: 'male',   bodyweight: 285, heightIn: 72, age: 30, activity: 1.25},
  at213:      {sex: 'male',   bodyweight: 213, heightIn: 72, age: 30, activity: 1.25},
  active213:  {sex: 'male',   bodyweight: 213, heightIn: 72, age: 30, activity: 1.6},
};

module.exports = () => suite('goals', t => {

  t.section('the goal table');
  {
    const ctx = rig(PEOPLE.avgMan);
    ['extreme_loss', 'loss', 'maintain', 'gain'].forEach(k =>
      t.check(`a saved "${k}" still loads as a goal`, !!ctx.GOAL_DEFS[k]));
    t.equal('seven goals', ctx.GOAL_KEYS.length, 7);
    t.equal('an unknown goal reads as maintain', ctx.goalDef('nonsense').name, 'Maintain');
    ctx.GOAL_KEYS.forEach(k =>
      t.check(`${k} borrows one of the four eating bands`,
        ['extreme_loss', 'loss', 'maintain', 'gain'].includes(ctx.goalBand(k))));
  }

  t.section('speeds scale with bodyweight');
  {
    const a = rig(PEOPLE.at285), b = rig(PEOPLE.at213), c = rig(PEOPLE.active213);
    const cutA = -a.goalRateLbWeek('extreme_loss');
    const cutB = -b.goalRateLbWeek('extreme_loss');
    t.check('Cut Hard asks for less a week at 213 than at 285', cutB < cutA, {cutA, cutB});
    t.near('uncapped, Cut Hard at 213 is 1% of bodyweight', -c.goalRateLbWeek('extreme_loss'), 2.13, 0.01);
    t.near('Slow Cut at 213 is 0.5%', -c.goalRateLbWeek('slow_cut'), 1.065, 0.01);
    t.near('Lean Bulk at 180 is 0.25%', rig(PEOPLE.avgMan).goalRateLbWeek('lean_gain'), 0.45, 0.01);
  }

  t.section('caps on a heavy, sedentary frame');
  {
    const ctx = rig(PEOPLE.bigMan);
    const tdee = ctx.computeTDEE();
    const adj = ctx.goalAdjustKcal('extreme_loss', tdee, 300);
    t.check('1% of 300 lb would be 1500 kcal, capped at 40% of burn',
      Math.abs(adj) < 1500 && Math.abs(Math.abs(adj) - tdee * 0.40) < 1, {adj, tdee});
    t.near('recomp is 5% under burn', ctx.goalAdjustKcal('recomp', tdee, 300), -tdee * 0.05, 1);
    t.equal('Bulk never asks for more than a pound a week', ctx.goalAdjustKcal('gain', tdee, 300), 500);
    t.equal('Lean Bulk never more than half', ctx.goalAdjustKcal('lean_gain', tdee, 300), 250);
    t.equal('maintain adds nothing', ctx.goalAdjustKcal('maintain', tdee, 300), 0);
  }

  t.section('goals never collapse onto each other above the floor');
  {
    /* A sweep of invented bodies. Wherever the calorie floor is not the
       thing deciding, every step down the list must be a real step. */
    let people = 0, collapses = 0;
    for (const sex of ['male', 'female'])
    for (let bw = 110; bw <= 400; bw += 15)
    for (const heightIn of [60, 66, 72, 78])
    for (const age of [20, 40, 60])
    for (const activity of [1.25, 1.4, 1.6, 1.8]){
      const ctx = rig({sex, bodyweight: bw, heightIn, age, activity});
      const floor = sex === 'male' ? 1500 : 1200;
      const kcal = ctx.GOAL_KEYS.map(k => ctx.computeCalcKcal('rest', k));
      people++;
      for (let i = 1; i < kcal.length; i++){
        if (kcal[i - 1] > floor && !(kcal[i] > kcal[i - 1])) collapses++;
      }
    }
    t.equal(`no two goals give the same target (${people} bodies)`, collapses, 0);
  }

  t.section('projection');
  {
    const ctx = rig(PEOPLE.at285);
    const p = ctx.goalProjection('extreme_loss', 285, 213, ctx.tdeeAtWeight, 1500);
    t.check('285 to 213 on Cut Hard lands', p && p.weeks > 0, p);
    /* Flat 2.85 lb a week would be 25 weeks; tapering has to take longer. */
    t.check('and takes longer than the starting rate implies', p.weeks > 72 / 2.85, p);
    const slow = ctx.goalProjection('slow_cut', 285, 213, ctx.tdeeAtWeight, 1500);
    t.check('Slow Cut takes longer again', slow.weeks > p.weeks, {slow, p});
    t.check('a gaining goal pointed downhill is a mismatch',
      ctx.goalProjection('gain', 285, 213, ctx.tdeeAtWeight, 1500).mismatch === true);
    t.equal('already there is zero weeks',
      ctx.goalProjection('loss', 213, 213, ctx.tdeeAtWeight, 1500).weeks, 0);
  }
  {
    /* 110 lb, short and sedentary: the 1200 floor sits right at her burn. */
    const ctx = rig({sex: 'female', bodyweight: 110, heightIn: 58, age: 60, activity: 1.25});
    const p = ctx.goalProjection('slow_cut', 110, 95, ctx.tdeeAtWeight, 1200);
    t.check('a speed the floor will not allow stalls rather than inventing a date',
      p.stalled === true, p);
  }

  t.section('reaching the goal weight');
  {
    const ctx = rig(Object.assign({goal: 'loss', goalWeight: 200}, PEOPLE.at213));
    ctx.trendWeightNow = () => 204;
    t.equal('not yet at 204', ctx.checkGoalReached(), false);
    ctx.trendWeightNow = () => 199.6;
    t.equal('switches once the trend crosses', ctx.checkGoalReached(), true);
    t.equal('to maintain', ctx.state.goal, 'maintain');
    t.equal('and says so', ctx.toasts.length, 1);
  }
  {
    const ctx = rig(Object.assign({goal: 'lean_gain', goalWeight: 200}, PEOPLE.avgMan));
    ctx.trendWeightNow = () => 190;
    t.equal('a bulk below its goal carries on', ctx.checkGoalReached(), false);
    ctx.trendWeightNow = () => null;
    ctx.state.goal = 'loss'; ctx.state.goalWeight = 250;
    t.equal('no trend yet, no switch', ctx.checkGoalReached(), false);
  }

  t.section('weight verdict follows the new goals');
  {
    const ctx = rig(Object.assign({goal: 'slow_cut'}, PEOPLE.at213));
    ctx.weightRatePerWeek = () => -1.0;
    t.equal('losing on Slow Cut is on target', ctx.weightGoalLine(), 'On target.');
    ctx.state.goal = 'lean_gain';
    t.equal('losing on Lean Bulk is the wrong way', ctx.weightGoalLine(), 'Going the wrong way.');
    ctx.state.goal = 'recomp';
    t.equal('moving on Recomp is drifting', ctx.weightGoalLine(), 'Drifting.');
  }
});
