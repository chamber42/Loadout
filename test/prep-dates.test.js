'use strict';
/* Covers the prep date arithmetic in 48-prep-dates.js.

   One stored field — the day key of prep day 1 — and everything else is
   derived from it. The checks that matter are the boundaries: the day a
   prep starts, the day it runs out, and the day after. Those are what a
   reminder fires on, and an off-by-one there means telling somebody their
   food has run out while they still have a container in the fridge, or
   telling them nothing at all until it is too late. */

const {loadFunctions, suite} = require('./helpers');

const CONSTS = {
  DOW: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
  MONTHS: ['January','February','March','April','May','June','July',
           'August','September','October','November','December'],
};

function rig(startDate, days, today){
  const state = {
    prep: startDate === undefined ? null
      : {startDate: startDate, schedule: new Array(days || 5).fill({kind: 'rest'})},
  };
  const ctx = loadFunctions('38-weight.js', ['weightKeyToDate', 'daysBetweenKeys'],
    Object.assign({state, todayKey: () => today || '2026-09-10'}, CONSTS));
  ctx.mondayIndex = d => (d.getDay() + 6) % 7;

  const src = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'js', '48-prep-dates.js'), 'utf8');
  const {extract} = require('./helpers');
  require('vm').runInContext(
    ['prepStartKey','prepDayCountTotal','shiftKey','prepDateFor','prepDayForDate',
     'prepLastKey','prepDaysLeft','ensurePrepStartDate','setPrepStartDate','prepDateLabel']
      .map(n => extract(src, n)).join('\n'), ctx, {filename: '48-prep-dates.js'});
  ctx.state = state;
  return ctx;
}

module.exports = () => suite('prep dates', t => {

  t.section('mapping days to dates');
  {
    const c = rig('2026-09-07', 5);
    t.equal('day 1 is the start', c.prepDateFor(0), '2026-09-07');
    t.equal('day 3', c.prepDateFor(2), '2026-09-09');
    t.equal('the last day of a five-day prep', c.prepLastKey(), '2026-09-11');
  }
  {
    /* Across a month end, which is where naive date arithmetic breaks. */
    const c = rig('2026-08-29', 6);
    t.equal('a prep spanning a month end', c.prepLastKey(), '2026-09-03');
  }
  {
    /* And across a leap day. */
    const c = rig('2028-02-27', 4);
    t.equal('a prep spanning 29 February', c.prepLastKey(), '2028-03-01');
  }

  t.section('mapping dates back to days');
  {
    const c = rig('2026-09-07', 5);
    t.equal('the first day', c.prepDayForDate('2026-09-07'), 1);
    t.equal('a day in the middle', c.prepDayForDate('2026-09-09'), 3);
    t.equal('the last day', c.prepDayForDate('2026-09-11'), 5);
    t.equal('the day after it runs out', c.prepDayForDate('2026-09-12'), null);
    t.equal('a day before it starts', c.prepDayForDate('2026-09-06'), null);
  }

  t.section('days left');
  {
    const c = rig('2026-09-07', 5, '2026-09-07');
    t.equal('on the first day, all of them', c.prepDaysLeft(), 5);
  }
  {
    const c = rig('2026-09-07', 5, '2026-09-11');
    t.equal('on the last day, one — today still counts', c.prepDaysLeft(), 1);
  }
  {
    const c = rig('2026-09-07', 5, '2026-09-12');
    t.equal('the day after, none', c.prepDaysLeft(), 0);
  }
  {
    const c = rig('2026-09-07', 5, '2026-09-20');
    t.equal('long after, still none rather than a negative', c.prepDaysLeft(), 0);
  }
  {
    const c = rig('2026-09-20', 5, '2026-09-10');
    t.equal('a prep that has not started yet counts in full', c.prepDaysLeft(), 5);
  }

  t.section('stamping a date on a prep that has none');
  {
    const c = rig(null, 5, '2026-09-10');
    c.ensurePrepStartDate();
    t.equal('a prep saved before dates existed gets today',
      c.state.prep.startDate, '2026-09-10');
  }
  {
    const c = rig('2026-09-01', 5, '2026-09-10');
    c.ensurePrepStartDate();
    t.equal('an existing date is left alone', c.state.prep.startDate, '2026-09-01');
  }
  {
    const c = rig(undefined, 0, '2026-09-10');
    c.ensurePrepStartDate();
    t.equal('no prep, nothing to stamp', c.state.prep, null);
  }

  t.section('setting it by hand');
  {
    const c = rig('2026-09-07', 5);
    t.equal('a real date is accepted', c.setPrepStartDate('2026-09-14'), true);
    t.equal('and stored', c.state.prep.startDate, '2026-09-14');
    t.equal('the run moves with it', c.prepLastKey(), '2026-09-18');
  }
  {
    const c = rig('2026-09-07', 5);
    t.equal('nonsense is refused', c.setPrepStartDate('next monday'), false);
    t.equal('and nothing moved', c.state.prep.startDate, '2026-09-07');
  }

  t.section('nothing to answer with');
  {
    const c = rig(undefined, 0);
    t.equal('no prep, no start', c.prepStartKey(), null);
    t.equal('no last day', c.prepLastKey(), null);
    t.equal('no days left', c.prepDaysLeft(), null);
    t.equal('and no day for any date', c.prepDayForDate('2026-09-10'), null);
  }
});
