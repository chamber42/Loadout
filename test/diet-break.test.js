'use strict';
/* Covers 53-diet-break.js — how long the current cut has been running, and
   offering, starting and ending a break.

   The count is read off the weight trend, so the checks that matter most
   are the ones where that could go wrong: a plateau inside a cut resetting
   it, a maintenance phase months ago being counted as part of this cut, and
   a break that never gives the cut back. Every weight series below is
   invented for the test. */

const fs = require('fs');
const vm = require('vm');
const {jsFile, extract, suite} = require('./helpers');

const TODAY = '2026-09-16';

function key(base, offset){
  const d = new Date(base + 'T00:00:00');
  d.setDate(d.getDate() + offset);
  return d.getFullYear() + '-' +
         String(d.getMonth() + 1).padStart(2, '0') + '-' +
         String(d.getDate()).padStart(2, '0');
}

/* Daily readings from `start`, each segment [days, lbPerWeek]. */
function series(start, startLb, segments){
  const out = {};
  let day = 0, lb = startLb;
  for (const [days, perWeek] of segments){
    for (let i = 0; i < days; i++){
      out[key(start, day)] = Math.round(lb * 10) / 10;
      lb += perWeek / 7;
      day++;
    }
  }
  return out;
}

function rig(extra){
  const tiers = fs.readFileSync(jsFile('03-data-tiers.js'), 'utf8');
  const weight = fs.readFileSync(jsFile('38-weight.js'), 'utf8');
  const brk = fs.readFileSync(jsFile('53-diet-break.js'), 'utf8');
  const state = Object.assign({mode: 'calc', goal: 'loss', weights: {}, healthWeights: {},
                               cutSince: null, dietBreak: null, dietBreakSnoozed: null}, extra);
  const ctx = {console, state, todayKey: () => TODAY};
  vm.createContext(ctx);
  const constBlock = (src, name) => {
    const at = src.indexOf('const ' + name + ' = {');
    let depth = 0;
    for (let j = src.indexOf('{', at); j < src.length; j++){
      if (src[j] === '{') depth++;
      else if (src[j] === '}' && --depth === 0) return src.slice(at, j + 1) + ';';
    }
  };
  vm.runInContext([
    constBlock(tiers, 'GOAL_DEFS'),
    extract(tiers, 'goalDef'),
    'const WEIGHT_ALPHA = 0.10, TREND_MIN_READINGS = 3;',
    ...['weightKeyToDate', 'daysBetweenKeys', 'weightSeries', 'weightTrend'].map(n => extract(weight, n)),
    'const BREAK_DAYS = 14, BREAK_SNOOZE_DAYS = 14, CUT_WEEK_MIN_DROP = 0.2;',
    constBlock(brk, 'BREAK_AFTER_WEEKS'),
    ...['keyPlusDays', 'trendOn', 'inferCutStart', 'trackCutPhase', 'cutWeeks', 'dietBreakDue',
        'startDietBreak', 'endDietBreakIfOver', 'snoozeDietBreak'].map(n => extract(brk, n)),
  ].join('\n'), ctx);
  return ctx;
}

module.exports = () => suite('diet break', t => {

  t.section('finding where this cut began');
  {
    /* A long cut, two months at maintenance, then a new cut from 1 August. */
    const weights = series('2025-07-01', 285, [
      [334, -1.5],      // to 31 May 2026
      [61, 0],          // June and July
      [47, -1.5],       // 1 August to 15 September
    ]);
    const ctx = rig({weights});
    const start = ctx.inferCutStart(ctx.weightTrend(), TODAY);
    const off = ctx.daysBetweenKeys('2026-08-01', start);
    t.check('starts near 1 August, not back in last July', Math.abs(off) <= 14, {start});
  }
  {
    const weights = series('2026-03-01', 240, [[60, -1.5], [7, 0], [60, -1.5]]);
    const ctx = rig({weights});
    const start = ctx.inferCutStart(ctx.weightTrend(), key('2026-03-01', 126));
    t.check('one flat week inside a cut is stepped over',
      ctx.daysBetweenKeys('2026-03-01', start) <= 14, {start});
  }
  {
    const ctx = rig();
    t.equal('no readings: the cut starts today', ctx.inferCutStart(ctx.weightTrend(), TODAY), TODAY);
  }
  {
    const weights = series('2026-05-01', 200, [[138, 0]]);
    const ctx = rig({weights});
    t.equal('after months flat, a cut picked today starts today',
      ctx.inferCutStart(ctx.weightTrend(), TODAY), TODAY);
  }

  t.section('tracking the phase');
  {
    const ctx = rig({goal: 'extreme_loss'});
    ctx.trackCutPhase(TODAY);
    t.equal('a cutting goal gets a start date', ctx.state.cutSince, TODAY);
    ctx.state.goal = 'loss';
    ctx.trackCutPhase('2026-10-01');
    t.equal('changing cut speed keeps it', ctx.state.cutSince, TODAY);
    ctx.state.goal = 'maintain';
    ctx.trackCutPhase(TODAY);
    t.equal('leaving the cut clears it', ctx.state.cutSince, null);
  }

  t.section('when a break is offered');
  {
    const ctx = rig({goal: 'loss', cutSince: key(TODAY, -15 * 7)});
    t.equal('Fat Loss at 15 weeks: not yet', ctx.dietBreakDue(TODAY), false);
    ctx.state.cutSince = key(TODAY, -16 * 7);
    t.equal('Fat Loss at 16 weeks: offered', ctx.dietBreakDue(TODAY), true);
    ctx.state.goal = 'extreme_loss'; ctx.state.cutSince = key(TODAY, -12 * 7);
    t.equal('Cut Hard is due sooner, at 12', ctx.dietBreakDue(TODAY), true);
    ctx.state.goal = 'slow_cut';
    t.equal('Slow Cut at 12 is not due', ctx.dietBreakDue(TODAY), false);
    ctx.state.goal = 'extreme_loss';
    ctx.snoozeDietBreak(TODAY);
    t.equal('not now hides it', ctx.dietBreakDue(key(TODAY, 13)), false);
    t.equal('for two weeks', ctx.dietBreakDue(key(TODAY, 14)), true);
    ctx.state.mode = 'direct';
    t.equal('a pasted target is never offered one', ctx.dietBreakDue(key(TODAY, 20)), false);
  }

  t.section('taking and ending a break');
  {
    const ctx = rig({goal: 'extreme_loss', cutSince: key(TODAY, -90)});
    ctx.startDietBreak(TODAY);
    t.equal('goes to maintain', ctx.state.goal, 'maintain');
    ctx.trackCutPhase(TODAY);
    t.check('the break survives the target sync that follows', !!ctx.state.dietBreak);
    t.equal('and is not offered again during it', ctx.dietBreakDue(TODAY), false);
    t.equal('day 13: still on break', ctx.endDietBreakIfOver(key(TODAY, 13)), false);
    t.equal('day 14: over', ctx.endDietBreakIfOver(key(TODAY, 14)), true);
    t.equal('the cut comes back as it was', ctx.state.goal, 'extreme_loss');
    t.equal('and its count starts again', ctx.state.cutSince, key(TODAY, 14));
  }
  {
    const ctx = rig({goal: 'loss', cutSince: key(TODAY, -120)});
    ctx.startDietBreak(TODAY);
    ctx.state.goal = 'gain';
    ctx.trackCutPhase(TODAY);
    t.equal('picking another goal mid-break ends the break', ctx.state.dietBreak, null);
    t.equal('and the break never snaps the old goal back', ctx.endDietBreakIfOver(key(TODAY, 30)), false);
  }
});
