'use strict';
/* Covers the weight series and its smoothed trend in 38-weight.js.

   The trend is the number a person will steer by, so what matters here is
   that it refuses to say anything until it can, that it damps a single bad
   morning instead of following it, and that someone who weighs in weekly
   gets the same answer as someone who weighs in daily. */

const {loadFunctions, suite} = require('./helpers');

/* The module's tuning constants live at file scope rather than inside a
   function, so they are handed to the context rather than extracted. */
const CONSTS = {WEIGHT_ALPHA: 0.10, TREND_MIN_READINGS: 3,
                RATE_MIN_DAYS: 14, RATE_MIN_READINGS: 5};

function rig(weights, healthWeights){
  const state = {weights: weights || {}, healthWeights: healthWeights || {},
                 bodyweight: null, goal: 'loss'};
  const ctx = loadFunctions('38-weight.js', [
    'weightKeyToDate', 'daysBetweenKeys', 'weightSeries', 'weightTrend',
    'trendWeightNow', 'weightRatePerWeek', 'recordWeight', 'forgetWeight',
    'seedWeightHistory',
  ], Object.assign({state, todayKey: () => '2026-03-01'}, CONSTS));
  ctx.state = state;
  return ctx;
}

/* A run of daily readings starting from a date, for the shapes below. */
function daily(start, values){
  const out = {};
  const d = new Date(start + 'T00:00:00');
  values.forEach(v => {
    out[d.getFullYear() + '-' +
       String(d.getMonth() + 1).padStart(2, '0') + '-' +
       String(d.getDate()).padStart(2, '0')] = v;
    d.setDate(d.getDate() + 1);
  });
  return out;
}

module.exports = () => suite('weight trend', t => {

  t.section('the series');
  {
    const ctx = rig({'2026-01-03': 181, '2026-01-01': 180, '2026-01-02': 182});
    const s = ctx.weightSeries();
    t.equal('sorted oldest first', s.map(p => p.key).join(','),
      '2026-01-01,2026-01-02,2026-01-03');
    t.equal('carries the readings', s.map(p => p.lb).join(','), '180,182,181');
  }
  {
    const ctx = rig({'2026-01-01': 180, 'junk': 170, '2026-01-02': null,
                     '2026-01-03': 0, '2026-01-04': 'heavy'});
    t.equal('a malformed entry cannot poison the series',
      ctx.weightSeries().length, 1);
  }

  t.section('refusing to speak too early');
  {
    const ctx = rig(daily('2026-01-01', [180, 181]));
    t.equal('two readings is not a trend', ctx.trendWeightNow(), null);
    t.equal('and not a rate', ctx.weightRatePerWeek(), null);
  }
  {
    const ctx = rig(daily('2026-01-01', [180, 181, 180, 181, 180]));
    t.check('five daily readings give a trend', ctx.trendWeightNow() != null);
    t.equal('but five days is too short a span for a weekly rate',
      ctx.weightRatePerWeek(), null);
  }

  t.section('damping a bad morning');
  {
    /* Fourteen steady days, then one reading four pounds high — a salty
       dinner, not four pounds of tissue. The trend must barely move. */
    const flat = [];
    for (let i = 0; i < 14; i++) flat.push(180);
    const ctx = rig(daily('2026-01-01', flat.concat([184])));
    const trend = ctx.trendWeightNow();
    t.check('the spike moves the trend less than half a pound',
      trend - 180 < 0.5, trend);
    t.check('but it does move it', trend > 180, trend);
  }

  t.section('weighing weekly and weighing daily agree');
  {
    /* The same real loss — a pound a week for eight weeks — recorded at two
       different cadences. Gap-aware smoothing is what makes these land in
       the same place; a fixed per-sample alpha would leave the weekly
       weigher's trend lagging weeks behind their body. */
    const dailyVals = [];
    for (let d = 0; d < 56; d++) dailyVals.push(200 - d / 7);
    const everyDay = rig(daily('2026-01-01', dailyVals)).trendWeightNow();

    const weekly = {};
    const cur = new Date('2026-01-01T00:00:00');
    for (let w = 0; w < 8; w++){
      weekly[cur.getFullYear() + '-' +
             String(cur.getMonth() + 1).padStart(2, '0') + '-' +
             String(cur.getDate()).padStart(2, '0')] = 200 - w;
      cur.setDate(cur.getDate() + 7);
    }
    const onceAWeek = rig(weekly).trendWeightNow();
    t.near('the two cadences land within a pound', onceAWeek, everyDay, 1.0);
  }

  t.section('the weekly rate');
  {
    const vals = [];
    for (let d = 0; d < 28; d++) vals.push(200 - d * (1 / 7));  // 1 lb/week down
    const ctx = rig(daily('2026-01-01', vals));
    const rate = ctx.weightRatePerWeek();
    t.near('reads about a pound a week down', rate, -1, 0.15);
  }
  {
    const vals = [];
    for (let d = 0; d < 28; d++) vals.push(180);
    const ctx = rig(daily('2026-01-01', vals));
    t.near('a steady month reads as no movement', ctx.weightRatePerWeek(), 0, 0.05);
  }

  t.section('recording a reading');
  {
    const ctx = rig({'2026-02-01': 190});
    ctx.recordWeight(188.44);
    t.equal('rounds to a tenth', ctx.state.weights['2026-03-01'], 188.4);
    t.equal('the newest reading becomes the current weight',
      ctx.state.bodyweight, 188.4);
  }
  {
    const ctx = rig({'2026-03-01': 188, '2026-02-01': 190});
    ctx.state.bodyweight = 188;
    ctx.recordWeight(191, '2026-02-01');
    t.equal('correcting an older day fixes the history',
      ctx.state.weights['2026-02-01'], 191);
    t.equal('without rewriting what the character weighs now',
      ctx.state.bodyweight, 188);
  }
  {
    const ctx = rig({});
    t.equal('a nonsense reading is refused', ctx.recordWeight('heavy'), false);
    t.equal('and so is an impossible one', ctx.recordWeight(2000), false);
    t.equal('nothing was written', Object.keys(ctx.state.weights).length, 0);
  }

  t.section('weigh-ins read from the Health app');
  {
    /* Health fills the days the person never typed. */
    const ctx = rig({'2026-01-05': 180}, {'2026-01-01': 182, '2026-01-03': 181});
    const s = ctx.weightSeries();
    t.equal('both sources appear', s.length, 3);
    t.equal('in date order', s.map(p => p.key).join(','),
      '2026-01-01,2026-01-03,2026-01-05');
  }
  {
    /* The precedence that matters. A scale reading is the better default
       and the worse override: someone who typed a figure into Loadout for
       a day meant that figure. */
    const ctx = rig({'2026-01-01': 180}, {'2026-01-01': 195});
    const s = ctx.weightSeries();
    t.equal('only one entry for the day', s.length, 1);
    t.equal('and it is the one that was typed here', s[0].lb, 180);
  }
  {
    const ctx = rig({}, {'2026-01-01': 182});
    t.equal('Health alone is enough to build a series', ctx.weightSeries().length, 1);
  }
  {
    /* Health's map is replaced wholesale on each read, so a weigh-in
       deleted in Health disappears here too rather than lingering. */
    const ctx = rig({}, {'2026-01-01': 182, '2026-01-02': 181});
    ctx.state.healthWeights = {'2026-01-02': 181};
    t.equal('a reading removed in Health leaves the series',
      ctx.weightSeries().length, 1);
  }
  {
    const ctx = rig({'2026-01-02': 180}, {'2026-01-01': 'heavy', '2026-01-03': null});
    t.equal('a malformed Health entry cannot poison the series',
      ctx.weightSeries().length, 1);
  }
  {
    /* A trend built from a connected scale alone must work — that is the
       whole point of reading them. */
    const health = {};
    const d = new Date('2026-01-01T00:00:00');
    for (let i = 0; i < 28; i++){
      health[d.getFullYear() + '-' +
             String(d.getMonth() + 1).padStart(2, '0') + '-' +
             String(d.getDate()).padStart(2, '0')] = 200 - i / 7;
      d.setDate(d.getDate() + 1);
    }
    const ctx = rig({}, health);
    t.near('a month of scale readings gives a rate',
      ctx.weightRatePerWeek(), -1, 0.15);
  }

  t.section('seeding an older save');
  {
    const ctx = rig({});
    ctx.state.bodyweight = 195;
    ctx.seedWeightHistory();
    t.equal('a save with no history starts from its bodyweight',
      ctx.state.weights['2026-03-01'], 195);
  }
  {
    const ctx = rig({'2026-01-01': 200});
    ctx.state.bodyweight = 195;
    ctx.seedWeightHistory();
    t.equal('an existing history is left alone',
      Object.keys(ctx.state.weights).join(','), '2026-01-01');
  }
});
