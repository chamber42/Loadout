'use strict';
/* Covers measuredExpenditure in 39-expenditure.js — the arithmetic that
   turns a month of logged food and a weight trend into a daily burn.

   This is the number a calorie target can be rebuilt on, so the checks here
   are less about the happy path than about the ways it can be wrong in the
   direction that hurts: reading low off a half-logged week and quietly
   cutting somebody's food. */

const {loadFunctions, suite} = require('./helpers');

const CONSTS = {
  WEIGHT_ALPHA: 0.10, TREND_MIN_READINGS: 3,
  RATE_MIN_DAYS: 14, RATE_MIN_READINGS: 5,
  KCAL_PER_LB: 3500,
  EXP_WINDOW_DAYS: 28, EXP_MIN_SPAN: 14, EXP_MIN_LOGGED: 10,
  EXP_MIN_COVERAGE: 0.6, EXP_COMPLETE_FRACTION: 0.55,
  EXP_PLAUSIBLE: {min: 1000, max: 6000},
  EXP_MEANINGFUL_DIFF: 50, EXP_MAX_WEEKLY_FRACTION: 0.02,
};

function key(base, offset){
  const d = new Date(base + 'T00:00:00');
  d.setDate(d.getDate() + offset);
  return d.getFullYear() + '-' +
         String(d.getMonth() + 1).padStart(2, '0') + '-' +
         String(d.getDate()).padStart(2, '0');
}

/* `days` back from 2026-03-01, weight falling at lbPerWeek, intake as given
   per day (a number, or a function of the day index). */
function build(opts){
  const END = '2026-03-01';
  const n = opts.days;
  const weights = {}, log = {};
  for (let i = 0; i < n; i++){
    const k = key(END, -(n - 1 - i));
    if (!opts.skipWeights) weights[k] = opts.startLb + (opts.lbPerWeek / 7) * i;
    const kcal = typeof opts.intake === 'function' ? opts.intake(i) : opts.intake;
    if (kcal != null) log[k] = {meals: {m: [{kcal: kcal}]}};
  }
  return {weights, log};
}

function rig(data, extra){
  const state = Object.assign({
    weights: data.weights, log: data.log,
    bodyweight: 200, heightIn: 70, age: 35, sex: 'male', activity: 1.5,
    restKcal: 2200, mode: 'calc', tdeeMeasured: null,
  }, extra || {});

  const ctx = loadFunctions('38-weight.js',
    ['weightKeyToDate', 'daysBetweenKeys', 'weightSeries', 'weightTrend',
     'trendWeightNow', 'weightRatePerWeek'],
    Object.assign({state, todayKey: () => '2026-03-01'}, CONSTS));

  /* dayTotals belongs to the quest log; only the kcal and the item count
     matter here, so it is stubbed rather than dragged in whole. */
  ctx.dayTotals = function(k){
    const day = state.log[k];
    if (!day) return {kcal: 0, items: 0};
    let kcal = 0, items = 0;
    Object.values(day.meals || {}).forEach(list =>
      (list || []).forEach(it => { kcal += it.kcal || 0; items++; }));
    return {kcal, items};
  };

  const src = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'js', '39-expenditure.js'), 'utf8');
  const {extract} = require('./helpers');
  require('vm').runInContext(
    ['expDayKeys', 'formulaTDEE', 'measuredExpenditure']
      .map(nm => extract(src, nm)).join('\n'), ctx, {filename: '39-expenditure.js'});

  ctx.state = state;
  return ctx;
}

module.exports = () => suite('measured expenditure', t => {

  t.section('the core arithmetic');
  {
    /* Ate 2,200 a day for four weeks, lost a pound a week. Energy balance
       says the missing 500 a day came off the body. */
    const ctx = rig(build({days: 28, startLb: 200, lbPerWeek: -1, intake: 2200}));
    const m = ctx.measuredExpenditure();
    t.check('a measurement comes back', m && m.kcal != null, m);
    t.near('intake plus what came off the body', m.kcal, 2700, 6);
    t.equal('mean intake is reported', m.meanIntake, 2200);
    t.near('and the rate it used', m.ratePerWeek, -1, 0.02);
  }
  {
    const ctx = rig(build({days: 28, startLb: 200, lbPerWeek: 0, intake: 2500}));
    const m = ctx.measuredExpenditure();
    t.near('a flat month measures expenditure as intake', m.kcal, 2500, 6);
  }
  {
    /* Gaining. The sign has to go the other way: some of what was eaten is
       now on the body rather than spent, so burn is BELOW intake. */
    const ctx = rig(build({days: 28, startLb: 180, lbPerWeek: 0.5, intake: 3000}));
    const m = ctx.measuredExpenditure();
    t.near('a bulk measures below intake', m.kcal, 2750, 6);
  }

  t.section('refusing a half-logged month');
  {
    /* The failure that matters. Two weeks logged properly at 2,200, two
       weeks where only breakfast got written down. Counting those 400 kcal
       mornings as real days would drag mean intake to about 1,300 and
       report a burn near 1,800 — and then offer to cut this person's food
       by 900 calories a day because they got sloppy with the app. */
    const ctx = rig(build({days: 28, startLb: 200, lbPerWeek: -1,
      intake: i => (i < 14 ? 400 : 2200)}));
    const m = ctx.measuredExpenditure();
    t.check('the partial days are thrown out, not averaged in',
      m.kcal == null || m.kcal > 2500, m);
  }
  {
    const ctx = rig(build({days: 28, startLb: 200, lbPerWeek: -1,
      intake: i => (i < 14 ? 400 : 2200)}));
    const m = ctx.measuredExpenditure();
    t.equal('measuring only across the fortnight that was logged properly',
      m.logged, 14);
    t.equal('and the span starts at the first good day, not the first entry',
      m.days, 14);
    t.near('so the good fortnight still yields a measurement', m.kcal, 2700, 25);
  }

  t.section('refusing to answer too early');
  {
    const ctx = rig(build({days: 8, startLb: 200, lbPerWeek: -1, intake: 2200}));
    const m = ctx.measuredExpenditure();
    t.equal('a week is not enough', m.kcal, null);
    t.check('and it says what is missing', !!m.why, m);
  }
  {
    /* Logged on only nine of twenty-eight days: a long enough span, but the
       mean is a sample of the days someone felt like logging. */
    const ctx = rig(build({days: 28, startLb: 200, lbPerWeek: -1,
      intake: i => (i % 3 === 0 ? 2200 : null)}));
    const m = ctx.measuredExpenditure();
    t.equal('sparse logging is refused', m.kcal, null);
  }
  {
    const ctx = rig(build({days: 28, startLb: 200, lbPerWeek: -1,
      intake: 2200, skipWeights: true}));
    const m = ctx.measuredExpenditure();
    t.equal('no weigh-ins, no measurement', m.kcal, null);
  }

  t.section('refusing what cannot be true');
  {
    /* Six pounds a week off while eating 2,200 implies a burn over 5,200.
       Far likelier that a scale was misread or a weight typed wrong. */
    const ctx = rig(build({days: 28, startLb: 260, lbPerWeek: -6, intake: 2200}));
    const m = ctx.measuredExpenditure();
    t.equal('an impossible result is refused rather than clamped', m.kcal, null);
  }

  t.section('the formula stays available for comparison');
  {
    const ctx = rig(build({days: 28, startLb: 200, lbPerWeek: -1, intake: 2200}));
    const f = ctx.formulaTDEE();
    t.check('Mifflin-St Jeor times activity', f > 2000 && f < 3600, f);
    ctx.state.tdeeMeasured = 2700;
    t.near('an adopted figure does not overwrite it', ctx.formulaTDEE(), f, 0.01);
  }
});
