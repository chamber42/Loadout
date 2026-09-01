'use strict';
/* Covers the streak arithmetic in 49-streaks.js.

   The design claim being tested is that the streak counts days LOGGED
   rather than days on target — so a day somebody ate badly and recorded
   honestly must extend it, and a day nobody finished recording must not.
   If that ever inverts, the app starts rewarding people for hiding the
   days most worth seeing. */

const {loadFunctions, suite} = require('./helpers');

const CONSTS = {STREAK_MIN_LEVEL: 2, STREAK_SCAN_DAYS: 1000};

const TODAY = '2026-09-10';

function key(offset){
  const d = new Date(TODAY + 'T00:00:00');
  d.setDate(d.getDate() + offset);
  return d.getFullYear() + '-' +
         String(d.getMonth() + 1).padStart(2, '0') + '-' +
         String(d.getDate()).padStart(2, '0');
}

/* `byDaysAgo` maps days-ago to that day's logged kcal against a 2000 target. */
function rig(byDaysAgo, today){
  const log = {};
  Object.keys(byDaysAgo).forEach(d => { log[key(-Number(d))] = byDaysAgo[d]; });
  const state = {log};

  const ctx = loadFunctions('38-weight.js', ['weightKeyToDate', 'daysBetweenKeys'],
    Object.assign({state, todayKey: () => today || TODAY}, CONSTS));

  /* The real dayLevel from the quest log, with its own dependencies stubbed
     — the 0.55 and 0.85 bands are the thing under test here, so they are
     taken from the shipping source rather than restated. */
  ctx.state = state;
  ctx.currentTargets = () => ({kcal: 2000});
  ctx.dayTotals = k => ({kcal: state.log[k] || 0, items: state.log[k] != null ? 1 : 0});
  ctx.dayHasEntries = k => state.log[k] != null;

  const {extract} = require('./helpers');
  const questSrc = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'js', '15-quest-log.js'), 'utf8');
  require('vm').runInContext(extract(questSrc, 'dayLevel'), ctx, {filename: '15-quest-log.js'});

  const src = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'js', '49-streaks.js'), 'utf8');
  require('vm').runInContext(
    ['streakDayCounts','streakShift','currentStreak','streakLoggedKeys',
     'bestStreak','totalLoggedDays']
      .map(n => extract(src, n)).join('\n'), ctx, {filename: '49-streaks.js'});

  return ctx;
}

/* A day at 1600 kcal against a 2000 target is 80% — level 2, counts.
   A day at 600 is 30% — level 1, a half-finished log, does not. */
const FULL = 1600, OVER = 3200, THIN = 600;

module.exports = () => suite('streaks', t => {

  t.section('what counts as a logged day');
  {
    const c = rig({0: FULL});
    t.equal('a normal day counts', c.streakDayCounts(key(0)), true);
  }
  {
    /* The claim that matters. Someone who ate 3,200 against a 2,000 target
       and wrote it all down has done exactly what the app asked. */
    const c = rig({0: OVER});
    t.equal('a day way over target still counts', c.streakDayCounts(key(0)), true);
  }
  {
    const c = rig({0: THIN});
    t.equal('a half-finished log does not', c.streakDayCounts(key(0)), false);
  }
  {
    const c = rig({});
    t.equal('and neither does a day with nothing in it',
      c.streakDayCounts(key(0)), false);
  }

  t.section('the current run');
  {
    const c = rig({0: FULL, 1: FULL, 2: FULL});
    t.equal('three days running', c.currentStreak(), 3);
  }
  {
    /* Today is allowed not to count yet — at nine in the morning nobody has
       logged half a day, and the streak must not read zero until dinner. */
    const c = rig({1: FULL, 2: FULL, 3: FULL});
    t.equal('an unlogged today does not break the run', c.currentStreak(), 3);
  }
  {
    const c = rig({0: FULL, 1: FULL, 3: FULL, 4: FULL});
    t.equal('a gap ends the run', c.currentStreak(), 2);
  }
  {
    const c = rig({1: FULL, 2: THIN, 3: FULL});
    t.equal('a half-logged day breaks it like a missed one', c.currentStreak(), 1);
  }
  {
    const c = rig({2: FULL, 3: FULL});
    t.equal('a run that ended before yesterday is over', c.currentStreak(), 0);
  }
  {
    const c = rig({});
    t.equal('nothing logged, no streak', c.currentStreak(), 0);
  }

  t.section('the best run ever');
  {
    const c = rig({0: FULL, 1: FULL, 5: FULL, 6: FULL, 7: FULL, 8: FULL});
    t.equal('the longest run is found, not the current one', c.bestStreak(), 4);
    t.equal('while the current one stays short', c.currentStreak(), 2);
  }
  {
    const c = rig({3: FULL});
    t.equal('one day is a run of one', c.bestStreak(), 1);
  }
  {
    t.equal('no days, no best', rig({}).bestStreak(), 0);
  }

  t.section('lifetime count');
  {
    const c = rig({0: FULL, 2: FULL, 9: FULL, 40: FULL, 4: THIN});
    t.equal('every counted day, however scattered', c.totalLoggedDays(), 4);
  }
  {
    /* The lifetime count is what milestones are measured against, so a
       broken streak must not take badges with it. */
    const c = rig({0: FULL, 30: FULL, 60: FULL});
    t.equal('a broken streak does not reduce the total', c.totalLoggedDays(), 3);
    t.equal('even though the run is short', c.currentStreak(), 1);
  }

  t.section('a long history');
  {
    const days = {};
    for (let i = 0; i < 400; i++) days[i] = FULL;
    const c = rig(days);
    t.equal('a year-plus run is counted in full', c.currentStreak(), 400);
    t.equal('and matches the best', c.bestStreak(), 400);
  }
});
