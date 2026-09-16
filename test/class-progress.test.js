'use strict';
/* Covers 54-class-progress.js — a class is earned by progress toward the
   goal and offered, never applied or taken away.

   The failures guarded here are the two directions it could go wrong: a
   handout (scale noise, goal toggling or a single reading earning a class)
   and a let-down (real progress not recognised, an earned class lost to a
   goal change, or a class taken away). Every person and weight below is
   invented for the test. */

const fs = require('fs');
const vm = require('vm');
const {jsFile, extract, suite} = require('./helpers');

function key(offset){
  const d = new Date('2026-01-01T00:00:00');
  d.setDate(d.getDate() + offset);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
         String(d.getDate()).padStart(2, '0');
}

function rig(extra){
  const tiers = fs.readFileSync(jsFile('03-data-tiers.js'), 'utf8');
  const weight = fs.readFileSync(jsFile('38-weight.js'), 'utf8');
  const cls = fs.readFileSync(jsFile('54-class-progress.js'), 'utf8');
  const constBlock = (src, name) => {
    const at = src.indexOf('const ' + name + ' = {');
    let depth = 0;
    for (let j = src.indexOf('{', at); j < src.length; j++){
      if (src[j] === '{') depth++;
      else if (src[j] === '}' && --depth === 0) return src.slice(at, j + 1) + ';';
    }
  };
  const state = Object.assign({goal: 'loss', bodyweight: 200, weights: {}, healthWeights: {},
    assignedTierId: null, selectedTierId: null, classJourney: null, classOffer: null,
    classDeclined: null, dietBreak: null, theme: 'fantasy', loggedDays: []}, extra);
  const ctx = {console, state, day: 0, toasts: [],
               THEMES: {fantasy: {words: {promoTitle: 'A PROMOTION AWAITS'}}}};
  ctx.toast = m => ctx.toasts.push(m);
  ctx.todayKey = () => key(ctx.day);
  ctx.streakLoggedKeys = () => state.loggedDays.slice().sort();
  vm.createContext(ctx);
  vm.runInContext([
    constBlock(tiers, 'GOAL_DEFS'), extract(tiers, 'goalDef'),
    'const WEIGHT_ALPHA = 0.10, TREND_MIN_READINGS = 3;',
    ...['weightKeyToDate', 'daysBetweenKeys', 'weightSeries', 'weightTrend', 'trendWeightNow']
      .map(n => extract(weight, n)),
    'const CLASS_MAX = 5, CLASS_STEPS_CUT = [0.02, 0.03, 0.04, 0.05], CLASS_STEPS_GAIN = [0.01, 0.015, 0.02, 0.025], CLASS_STEPS_STEADY = [28, 42, 56, 70];',
    ...['climbClasses', 'classDirection', 'classWeightNow', 'startClassJourney', 'classProgress', 'assignTier',
        'acceptClassOffer', 'declineClassOffer'].map(n => extract(cls, n)),
  ].join('\n'), ctx);
  return ctx;
}

/* A day's reading: the scale says `lb`, and the class is re-checked the way
   every weigh-in path does. */
function weigh(ctx, lb){
  ctx.state.weights[key(ctx.day)] = lb;
  ctx.state.bodyweight = lb;
  ctx.assignTier();
  ctx.day++;
}

module.exports = () => suite('class progress', t => {

  t.section('a new character');
  {
    const ctx = rig();
    ctx.assignTier();
    t.equal('starts at the first class', ctx.state.assignedTierId, 1);
    t.equal('with nothing to offer', ctx.state.classOffer, null);
    t.equal('on a cutting journey', ctx.state.classJourney.dir, -1);
  }

  t.section('earning on a cut');
  {
    const ctx = rig();
    for (let i = 0; i < 5; i++) weigh(ctx, 200);
    ctx.state.classJourney.startLb = 200;
    for (let lb = 200; lb >= 196.5; lb -= 0.25) weigh(ctx, lb);
    t.equal('3.5 lb down of the first 4 lb step: not yet', ctx.state.classOffer, null);
    for (let i = 0; i < 40; i++) weigh(ctx, 193);
    t.equal('the trend past 2% of 200 lb earns class 2', ctx.state.classOffer, 2);
    t.equal('offered, not applied', ctx.state.assignedTierId, 1);
    t.equal('with one prompt', ctx.toasts.length, 1);
    t.equal('taking it', ctx.acceptClassOffer(), true);
    t.equal('makes it the class', ctx.state.assignedTierId, 2);
    for (let i = 0; i < 40; i++) weigh(ctx, 205);
    t.equal('gaining it back never takes a class away', ctx.state.assignedTierId, 2);
    t.equal('and offers nothing', ctx.state.classOffer, null);
  }
  {
    const ctx = rig();
    for (let i = 0; i < 20; i++) weigh(ctx, 200);
    weigh(ctx, 185);
    t.equal('one light reading earns nothing', ctx.state.classOffer, null);
  }
  {
    const ctx = rig();
    ctx.assignTier();
    ctx.state.classJourney.startLb = 200;
    for (let i = 0; i < 60; i++) weigh(ctx, 176);
    t.equal('24 lb (past 4+6+8) earns classes up to 4, offered as the highest', ctx.state.classOffer, 4);
  }

  t.section('earning on a bulk and on a steady goal');
  {
    const ctx = rig({goal: 'lean_gain'});
    ctx.assignTier();
    ctx.state.classJourney.startLb = 200;
    for (let i = 0; i < 60; i++) weigh(ctx, 203.2);
    t.equal('1% gained earns the next class', ctx.state.classOffer, 2);
  }
  {
    const ctx = rig({goal: 'maintain'});
    ctx.assignTier();
    for (let i = 0; i < 27; i++) ctx.state.loggedDays.push(key(i));
    ctx.day = 30; ctx.assignTier();
    t.equal('27 logged days: not yet', ctx.state.classOffer, null);
    ctx.state.loggedDays.push(key(27));
    ctx.assignTier();
    t.equal('28 logged days earns the next class', ctx.state.classOffer, 2);
  }

  t.section('what cannot be farmed');
  {
    const ctx = rig({goal: 'maintain'});
    ctx.assignTier();
    ctx.day = 5;
    ctx.state.goal = 'loss';  ctx.assignTier();
    ctx.state.goal = 'maintain'; ctx.assignTier();
    ctx.state.goal = 'gain'; ctx.assignTier();
    t.equal('toggling goals earns nothing', ctx.state.classOffer, null);
    t.equal('class unchanged', ctx.state.assignedTierId, 1);
  }
  {
    const ctx = rig();
    ctx.assignTier();
    ctx.state.classJourney.startLb = 200;
    for (let i = 0; i < 60; i++) weigh(ctx, 193);
    ctx.declineClassOffer();
    ctx.assignTier();
    t.equal('keeping the current class is not asked again', ctx.state.classOffer, null);
    for (let i = 0; i < 60; i++) weigh(ctx, 187);
    t.equal('the next class up still is', ctx.state.classOffer, 3);
  }
  {
    const ctx = rig({goal: 'maintain', assignedTierId: 2, selectedTierId: 2});
    ctx.assignTier();
    for (let i = 0; i < 41; i++) ctx.state.loggedDays.push(key(i));
    ctx.day = 45; ctx.assignTier();
    t.equal('each class costs more: 41 days is short of class 3', ctx.state.classOffer, null);
    ctx.state.loggedDays.push(key(41)); ctx.assignTier();
    t.equal('42 days earns it', ctx.state.classOffer, 3);
  }

  t.section('goals and breaks');
  {
    const ctx = rig();
    ctx.assignTier();
    ctx.state.classJourney.startLb = 200;
    for (let i = 0; i < 60; i++) weigh(ctx, 193);
    t.equal('class 2 earned on the cut', ctx.state.classOffer, 2);
    ctx.state.goal = 'maintain';          // goal weight reached
    ctx.assignTier();
    t.equal('switching to Maintain keeps the unclaimed class', ctx.state.classOffer, 2);
    t.equal('on a new steady journey', ctx.state.classJourney.dir, 0);
  }
  {
    const ctx = rig();
    ctx.assignTier();
    const journey = ctx.state.classJourney;
    ctx.state.dietBreak = {resume: 'loss', until: key(14)};
    ctx.state.goal = 'maintain';
    ctx.assignTier();
    t.check('a diet break keeps the cut\'s journey', ctx.state.classJourney === journey);
    ctx.state.dietBreak = null; ctx.state.goal = 'loss';
    ctx.assignTier();
    t.check('and the cut carries on with it', ctx.state.classJourney === journey);
  }
  {
    const ctx = rig({assignedTierId: 5, selectedTierId: 5});
    ctx.assignTier();
    ctx.state.classJourney.startLb = 200;
    for (let i = 0; i < 60; i++) weigh(ctx, 170);
    t.equal('the last class is the last', ctx.state.classOffer, null);
    t.check('and reads as maxed', ctx.classProgress().max === true);
  }
});
