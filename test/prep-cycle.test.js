'use strict';
/* Covers when a meal prep counts as finished.

   A prep is a fixed run of days anchored to a start date, and the morning
   after the last one it is over — the food is gone. Until this existed,
   nothing in the app said so, and the only way to start another was the
   System sheet behind the character screen. The loadout screen now asks,
   once, on the first visit after the run ends.

   The arithmetic is worth pinning because both ways of getting it wrong
   are bad and neither is visible. A prep judged finished a day early
   offers to throw away food that is still in the fridge. One judged
   finished a day late leaves somebody with no plan and no prompt on the
   morning they needed one. Off-by-one on the last day is the whole risk. */

const {loadFunctions, suite} = require('./helpers');

function rig(startDate, days, today){
  const state = {prep: startDate ? {startDate, schedule: new Array(days).fill({}), meals:[{}]} : null};
  const ctx = loadFunctions('48-prep-dates.js', [
    'prepStartKey', 'prepDayCountTotal', 'shiftKey', 'prepDateFor',
    'prepLastKey', 'prepDaysLeft', 'prepCycleDone', 'prepStamp', 'prepOfferDue',
  ], {
    state,
    todayKey: () => today,
    /* Same whole-day difference the app uses, on plain date keys. */
    daysBetweenKeys(a, b){
      return Math.round((Date.parse(b + 'T00:00:00') - Date.parse(a + 'T00:00:00')) / 86400000);
    },
    weightKeyToDate: k => new Date(k + 'T00:00:00'),
    prepReady: () => !!(state.prep && state.prep.schedule.length && state.prep.meals.length),
  });
  return ctx;
}

module.exports = () => suite('prep cycle', t => {

  t.section('a four-day prep started on the 9th');
  const on = d => rig('2026-09-09', 4, d);
  t.equal('day one — three still ahead of it', on('2026-09-09').prepDaysLeft(), 4);
  t.equal('not finished on day one', on('2026-09-09').prepCycleDone(), false);
  t.equal('not finished on the last day', on('2026-09-12').prepCycleDone(), false);
  t.equal('one day left on the last day', on('2026-09-12').prepDaysLeft(), 1);
  t.equal('finished the morning after', on('2026-09-13').prepCycleDone(), true);
  t.equal('and stays finished a week on', on('2026-09-20').prepCycleDone(), true);
  t.equal('the last day it covers', on('2026-09-09').prepLastKey(), '2026-09-12');

  t.section('a prep that has not started yet is not finished');
  t.equal('the day before it begins', on('2026-09-08').prepCycleDone(), false);
  t.equal('and counts its full run', on('2026-09-08').prepDaysLeft(), 4);

  t.section('no prep at all is not a finished prep');
  const none = rig(null, 0, '2026-09-13');
  t.equal('nothing to finish', none.prepCycleDone(), false);
  t.equal('and no days to count', none.prepDaysLeft(), null);

  t.section('a one-day prep');
  const one = d => rig('2026-09-09', 1, d);
  t.equal('not finished on the day', one('2026-09-09').prepCycleDone(), false);
  t.equal('finished the next morning', one('2026-09-10').prepCycleDone(), true);

  t.section('the stamp changes when the prep does, so the question comes back');
  const a = rig('2026-09-09', 4, '2026-09-13').prepStamp();
  t.equal('a different start date', a !== rig('2026-09-15', 4, '2026-09-20').prepStamp(), true);
  t.equal('a different length', a !== rig('2026-09-09', 5, '2026-09-20').prepStamp(), true);
  t.equal('but the same prep stamps the same', a, rig('2026-09-09', 4, '2026-09-13').prepStamp());

  t.section('the question is put once, and only when there is something to ask');
  const done = rig('2026-09-09', 4, '2026-09-13');   // finished two days ago
  const live = rig('2026-09-09', 4, '2026-09-10');   // still running
  t.equal('asked when the run has ended and nobody has been asked',
    done.prepOfferDue(null), true);
  t.equal('not asked again once this prep has been answered',
    done.prepOfferDue(done.prepStamp()), false);
  t.equal('never asked while the prep is still running',
    live.prepOfferDue(null), false);
  t.equal('nor while it is still running, even if an older prep was answered',
    live.prepOfferDue('2026-08-01:4'), false);
  t.equal('asked again for the next prep, because its stamp differs',
    rig('2026-09-15', 3, '2026-09-20').prepOfferDue(done.prepStamp()), true);
  t.equal('never asked when there is no prep at all',
    rig(null, 0, '2026-09-13').prepOfferDue(null), false);
});
