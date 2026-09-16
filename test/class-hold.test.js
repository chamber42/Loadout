'use strict';
/* Covers the class hold in 17-onboarding.js: the class stays put through a
   diet break, and at a reached goal weight a new one is offered rather than
   applied. The failures worth guarding are a break quietly changing the
   character, an offer that never goes away after "keep", and a hold that
   outlives a deliberate goal change. */

const fs = require('fs');
const vm = require('vm');
const {jsFile, extract, suite} = require('./helpers');

function rig(extra){
  const tiers = fs.readFileSync(jsFile('03-data-tiers.js'), 'utf8');
  const onboard = fs.readFileSync(jsFile('17-onboarding.js'), 'utf8');
  const at = tiers.indexOf('const TIERS = [');
  const tiersConst = tiers.slice(at, tiers.indexOf('];', at) + 2);
  const state = Object.assign({finalKcal: 1700, assignedTierId: null, selectedTierId: null,
                               classHold: null, classOffer: null}, extra);
  const ctx = {console, state};
  vm.createContext(ctx);
  vm.runInContext([tiersConst,
    ...['tierForKcal', 'assignTier', 'holdClass', 'releaseClassHold',
        'acceptClassOffer', 'declineClassOffer'].map(n => extract(onboard, n)),
  ].join('\n'), ctx);
  return ctx;
}

module.exports = () => suite('class hold', t => {

  t.section('without a hold the class follows the number');
  {
    const ctx = rig();
    ctx.assignTier();
    t.equal('1700 kcal is tier 1', ctx.state.assignedTierId, 1);
    ctx.state.finalKcal = 2455;
    ctx.assignTier();
    t.equal('2455 kcal is tier 3', ctx.state.assignedTierId, 3);
    t.equal('and nothing is offered', ctx.state.classOffer, null);
  }

  t.section('a diet break');
  {
    const ctx = rig();
    ctx.assignTier();
    ctx.holdClass('break');
    ctx.state.finalKcal = 2455;            // two weeks at maintenance
    ctx.assignTier();
    t.equal('keeps the class', ctx.state.assignedTierId, 1);
    t.equal('the plan reads the same class', ctx.state.selectedTierId, 1);
    t.equal('and offers nothing', ctx.state.classOffer, null);
    ctx.releaseClassHold('break');
    ctx.state.finalKcal = 1700;            // the cut is back
    ctx.assignTier();
    t.equal('after the break the class follows again', ctx.state.assignedTierId, 1);
  }

  t.section('reaching the goal weight');
  {
    const ctx = rig();
    ctx.assignTier();
    ctx.holdClass('goal');
    ctx.state.finalKcal = 2455;            // switched to maintain
    ctx.assignTier();
    t.equal('the class is not changed for them', ctx.state.assignedTierId, 1);
    t.equal('a new one is offered', ctx.state.classOffer, 3);
    t.equal('accepting takes it', ctx.acceptClassOffer(), true);
    t.equal('to tier 3', ctx.state.assignedTierId, 3);
    t.equal('and the hold is gone', ctx.state.classHold, null);
  }
  {
    const ctx = rig();
    ctx.assignTier();
    ctx.holdClass('goal');
    ctx.state.finalKcal = 2455;
    ctx.assignTier();
    ctx.declineClassOffer();
    t.equal('keeping the class clears the offer', ctx.state.classOffer, null);
    ctx.assignTier();
    t.equal('and a later redraw does not bring the same offer back', ctx.state.classOffer, null);
    t.equal('the class stays', ctx.state.assignedTierId, 1);
    ctx.state.finalKcal = 2800;
    ctx.assignTier();
    t.equal('a different class can still be offered later', ctx.state.classOffer, 4);
  }
  {
    const ctx = rig();
    ctx.assignTier();
    ctx.holdClass('goal');
    ctx.state.finalKcal = 1750;
    ctx.assignTier();
    t.equal('no offer when the class would not change', ctx.state.classOffer, null);
  }

  t.section('holds that meet');
  {
    const ctx = rig();
    ctx.assignTier();
    ctx.holdClass('goal');
    ctx.holdClass('break');
    t.equal('a break does not overwrite a goal hold', ctx.state.classHold.why, 'goal');
    ctx.releaseClassHold('break');
    t.check('and ending the break leaves it in place', !!ctx.state.classHold);
    ctx.releaseClassHold();
    t.equal('a deliberate goal change releases any hold', ctx.state.classHold, null);
  }
});
