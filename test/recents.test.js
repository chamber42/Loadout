'use strict';
/* Covers journalRecents in 40-recents.js — the ranking that decides which
   dozen foods sit in front of the search box.

   The ordering is the whole feature: a list that puts last spring's habits
   above this week's is no better than the search box it replaced. */

const {loadFunctions, suite} = require('./helpers');

const CONSTS = {
  RECENT_HALF_LIFE_DAYS: 21, RECENT_LIMIT: 12, RECENT_WINDOW_DAYS: 120,
};

const TODAY = '2026-03-01';

function key(offset){
  const d = new Date(TODAY + 'T00:00:00');
  d.setDate(d.getDate() + offset);
  return d.getFullYear() + '-' +
         String(d.getMonth() + 1).padStart(2, '0') + '-' +
         String(d.getDate()).padStart(2, '0');
}

/* A log built from {daysAgo: [entry, ...]} */
function rig(byDaysAgo){
  const log = {};
  Object.keys(byDaysAgo).forEach(d => {
    log[key(-Number(d))] = {meals: {main: byDaysAgo[d]}};
  });
  const state = {log};

  const ctx = loadFunctions('38-weight.js', ['weightKeyToDate', 'daysBetweenKeys'],
    Object.assign({state, todayKey: () => TODAY}, CONSTS));

  /* The library the picker resolves keys against. */
  ctx.foodIndex = () => [
    {food: {key: 'chicken', name: 'Chicken breast'}, slot: 'protein', icon: 'meat'},
    {food: {key: 'rice',    name: 'White rice'},     slot: 'carb',    icon: 'rice'},
    {food: {key: 'oats',    name: 'Oats'},           slot: 'carb',    icon: 'rice'},
  ];

  const src = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'js', '40-recents.js'), 'utf8');
  const {extract} = require('./helpers');
  require('vm').runInContext(
    ['recentKeyFor', 'journalRecents'].map(n => extract(src, n)).join('\n'),
    ctx, {filename: '40-recents.js'});

  ctx.state = state;
  return ctx;
}

const food = (k, g) => ({name: k + ' — ' + g + ' g', _food: k, _grams: g, kcal: 200});

module.exports = () => suite('journal recents', t => {

  t.section('ranking');
  {
    const ctx = rig({1: [food('chicken', 150)], 2: [food('chicken', 150)],
                     3: [food('rice', 200)]});
    const r = ctx.journalRecents();
    t.equal('the more-used food leads', r[0].label, 'Chicken breast');
    t.equal('and the other still appears', r[1].label, 'White rice');
    t.equal('with its use count', r[0].uses, 2);
  }
  {
    /* Twelve uses three months ago against five uses this week. The old
       habit has more entries; the recent one is what the person eats now. */
    const byDay = {};
    for (let i = 0; i < 12; i++) byDay[80 + i] = [food('oats', 60)];
    for (let i = 0; i < 5; i++)  byDay[i + 1]  = [food('chicken', 150)];
    const r = rig(byDay).journalRecents();
    t.equal('this week outranks last quarter', r[0].label, 'Chicken breast');
  }
  {
    const byDay = {};
    for (let i = 0; i < 6; i++) byDay[i + 1] = [food('oats', 60)];
    byDay[2] = byDay[2].concat([food('chicken', 150)]);
    const r = rig(byDay).journalRecents();
    t.equal('a genuine staple stays on top', r[0].label, 'Oats');
  }

  t.section('the amount to reopen on');
  {
    const ctx = rig({1: [food('rice', 250)], 10: [food('rice', 150)]});
    const r = ctx.journalRecents();
    t.equal('the most recent amount wins', r[0].grams, 250);
    t.equal('both uses still counted', r[0].uses, 2);
  }

  t.section('what gets left out');
  {
    const ctx = rig({200: [food('chicken', 150)], 1: [food('rice', 200)]});
    const r = ctx.journalRecents();
    t.equal('beyond the window is history, not habit', r.length, 1);
    t.equal('and the recent one remains', r[0].label, 'White rice');
  }
  {
    /* The library can retire a food. What the person logged still holds its
       own calories, so it survives as something to copy rather than
       disappearing from their own list. */
    const ctx = rig({1: [food('deleted-food', 100)], 2: [food('rice', 200)]});
    const r = ctx.journalRecents();
    t.equal('a retired library food is still offered', r.length, 2);
    t.equal('as a verbatim copy', r.find(x => x.label === 'deleted-food').kind, 'entry');
  }
  {
    const ctx = rig({1: [{_food: 'deleted-food'}], 2: [food('rice', 200)]});
    const r = ctx.journalRecents();
    t.equal('but one with nothing to copy either is dropped', r.length, 1);
    t.equal('leaving the loggable one', r[0].label, 'White rice');
  }
  {
    const many = {};
    for (let i = 1; i <= 20; i++) many[i] = [{name: 'Thing ' + i, kcal: 100}];
    t.equal('the list is capped', rig(many).journalRecents().length, 12);
  }

  t.section('entries with no library food behind them');
  {
    const ctx = rig({1: [{name: 'Protein bar — 60 g', kcal: 220, protein: 20}],
                     2: [{name: 'Protein bar — 60 g', kcal: 220, protein: 20}]});
    const r = ctx.journalRecents();
    t.equal('a typed row is offered', r[0].label, 'Protein bar');
    t.equal('to be copied rather than re-scaled', r[0].kind, 'entry');
    t.equal('and its repeats are counted as one thing', r[0].uses, 2);
  }
  {
    const ctx = rig({1: [{name: 'Skyr', _foodData: {name: 'Skyr', kcal: 63}, _grams: 170}]});
    const r = ctx.journalRecents();
    t.equal('a scanned product goes through the amount step', r[0].kind, 'food');
    t.equal('carrying its own table', r[0].pick.food.kcal, 63);
  }
});
