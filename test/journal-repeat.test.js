'use strict';
/* Covers the repeat helpers in 45-journal-repeat.js — "same as yesterday"
   for one sitting, and copying a whole day onto an empty one.

   The thing most worth guarding is that a copy is a copy: the new day must
   not end up sharing entry objects with the old one, or correcting today's
   portion would silently rewrite what the person ate last week. */

const {loadFunctions, suite} = require('./helpers');

const CONSTS = {
  RECENT_HALF_LIFE_DAYS: 21, RECENT_LIMIT: 12, RECENT_WINDOW_DAYS: 120,
  REPEAT_LOOKBACK_DAYS: 45,
  DOW: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
  MONTHS: ['January','February','March','April','May','June','July',
           'August','September','October','November','December'],
};

const TODAY = '2026-03-10';

function key(offset){
  const d = new Date(TODAY + 'T00:00:00');
  d.setDate(d.getDate() + offset);
  return d.getFullYear() + '-' +
         String(d.getMonth() + 1).padStart(2, '0') + '-' +
         String(d.getDate()).padStart(2, '0');
}

function rig(byDaysAgo){
  const log = {};
  Object.keys(byDaysAgo).forEach(d => { log[key(-Number(d))] = {meals: byDaysAgo[d]}; });
  const state = {log};

  const ctx = loadFunctions('38-weight.js', ['weightKeyToDate', 'daysBetweenKeys'],
    Object.assign({state, todayKey: () => TODAY}, CONSTS));

  ctx.mondayIndex = d => (d.getDay() + 6) % 7;
  ctx.dayLog = k => {
    state.log = state.log || {};
    if (!state.log[k]) state.log[k] = {meals: {}};
    return state.log[k];
  };
  ctx.dayTotals = k => {
    const day = state.log[k];
    if (!day) return {kcal: 0, items: 0};
    let kcal = 0, items = 0;
    Object.values(day.meals || {}).forEach(list =>
      (list || []).forEach(it => { kcal += it.kcal || 0; items++; }));
    return {kcal, items};
  };

  const src = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'js', '45-journal-repeat.js'), 'utf8');
  const {extract} = require('./helpers');
  require('vm').runInContext(
    ['cloneEntries','loggedDaysBefore','lastMealBefore','lastDayBefore',
     'repeatDayLabel','repeatMealInto','repeatDayInto']
      .map(n => extract(src, n)).join('\n'), ctx, {filename: '45-journal-repeat.js'});

  ctx.state = state;
  return ctx;
}

const eggs  = () => ({name: 'Eggs — 2', kcal: 156, protein: 12, carbs: 1, fat: 11});
const toast = () => ({name: 'Toast — 1 slice', kcal: 80, protein: 3, carbs: 15, fat: 1});

module.exports = () => suite('journal repeat', t => {

  t.section('finding a meal to repeat');
  {
    const ctx = rig({1: {Breakfast: [eggs()]}, 5: {Breakfast: [toast()]}});
    const hit = ctx.lastMealBefore('Breakfast', TODAY);
    t.equal('the most recent one wins', hit.key, key(-1));
    t.equal('carrying its items', hit.items[0].name, 'Eggs — 2');
  }
  {
    const ctx = rig({1: {Dinner: [eggs()]}});
    t.equal('a sitting never logged has nothing to repeat',
      ctx.lastMealBefore('Breakfast', TODAY), null);
  }
  {
    const ctx = rig({60: {Breakfast: [eggs()]}});
    t.equal('beyond the lookback is not "the same as usual"',
      ctx.lastMealBefore('Breakfast', TODAY), null);
  }
  {
    /* Only backwards. A later day is a plan, not a habit. */
    const ctx = rig({});
    ctx.state.log[key(3)] = {meals: {Breakfast: [eggs()]}};
    t.equal('a future day is never offered',
      ctx.lastMealBefore('Breakfast', TODAY), null);
  }

  t.section('repeating a meal');
  {
    const ctx = rig({1: {Breakfast: [eggs(), toast()]}});
    t.equal('it reports success', ctx.repeatMealInto('Breakfast', TODAY), true);
    t.equal('both items land', ctx.state.log[TODAY].meals.Breakfast.length, 2);
  }
  {
    /* Appends rather than replaces: repeating a breakfast onto a sitting
       that already holds a coffee means having both. */
    const ctx = rig({1: {Breakfast: [eggs()]}});
    ctx.state.log[TODAY] = {meals: {Breakfast: [toast()]}};
    ctx.repeatMealInto('Breakfast', TODAY);
    t.equal('what was already there is kept',
      ctx.state.log[TODAY].meals.Breakfast.length, 2);
  }
  {
    /* The one that would corrupt history. */
    const ctx = rig({1: {Breakfast: [eggs()]}});
    ctx.repeatMealInto('Breakfast', TODAY);
    ctx.state.log[TODAY].meals.Breakfast[0].kcal = 999;
    t.equal('editing the copy does not rewrite the original',
      ctx.state.log[key(-1)].meals.Breakfast[0].kcal, 156);
  }

  t.section('repeating a whole day');
  {
    const ctx = rig({1: {Breakfast: [eggs()], Dinner: [toast()]}});
    t.equal('it reports success', ctx.repeatDayInto(TODAY), true);
    t.equal('every sitting comes across',
      Object.keys(ctx.state.log[TODAY].meals).sort().join(','), 'Breakfast,Dinner');
    t.equal('with its items', ctx.state.log[TODAY].meals.Dinner[0].name, 'Toast — 1 slice');
  }
  {
    const ctx = rig({1: {Breakfast: []}, 4: {Breakfast: [eggs()]}});
    t.equal('a day logged but empty is skipped for one with food in it',
      ctx.lastDayBefore(TODAY).key, key(-4));
  }
  {
    const ctx = rig({});
    t.equal('nothing to copy reports failure', ctx.repeatDayInto(TODAY), false);
  }

  t.section('naming the day it came from');
  {
    const ctx = rig({});
    t.equal('one day back', ctx.repeatDayLabel(key(-1), TODAY), 'yesterday');
    t.check('within the week is a weekday name',
      /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/.test(ctx.repeatDayLabel(key(-4), TODAY)),
      ctx.repeatDayLabel(key(-4), TODAY));
    t.check('further back is a date',
      /^[A-Z][a-z]{2} \d+$/.test(ctx.repeatDayLabel(key(-20), TODAY)),
      ctx.repeatDayLabel(key(-20), TODAY));
  }
});
