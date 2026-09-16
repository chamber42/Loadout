'use strict';
/* Covers the class offer in 17-onboarding.js. The class is cosmetic, set
   when the character is made, and after that only changes when the person
   accepts an offer. The failures worth guarding are a class that changes
   without asking, an offer that keeps coming back after "keep", and a diet
   break that turns into a new character. */

const fs = require('fs');
const vm = require('vm');
const {jsFile, extract, suite} = require('./helpers');

function rig(extra){
  const tiers = fs.readFileSync(jsFile('03-data-tiers.js'), 'utf8');
  const onboard = fs.readFileSync(jsFile('17-onboarding.js'), 'utf8');
  const at = tiers.indexOf('const TIERS = [');
  const tiersConst = tiers.slice(at, tiers.indexOf('];', at) + 2);
  const state = Object.assign({finalKcal: 1700, assignedTierId: null, selectedTierId: null,
                               classOffer: null, classDeclined: null, classOfferWhy: null,
                               dietBreak: null, theme: 'fantasy'}, extra);
  const ctx = {console, state, toasts: [],
               THEMES: {fantasy: {words: {promoTitle: 'A PROMOTION AWAITS'}}}};
  ctx.toast = m => ctx.toasts.push(m);
  vm.createContext(ctx);
  vm.runInContext([tiersConst,
    ...['tierForKcal', 'assignTier', 'acceptClassOffer', 'declineClassOffer'].map(n => extract(onboard, n)),
  ].join('\n'), ctx);
  return ctx;
}

module.exports = () => suite('class offer', t => {

  t.section('making the character');
  {
    const ctx = rig();
    ctx.assignTier();
    t.equal('a new character takes the class its number is in', ctx.state.assignedTierId, 1);
    ctx.state.finalKcal = 2455;
    ctx.assignTier(true);
    t.equal('remaking it does too, without asking', ctx.state.assignedTierId, 3);
    t.equal('and nothing is offered', ctx.state.classOffer, null);
  }

  t.section('the target moves into another class');
  {
    const ctx = rig({assignedTierId: 1, selectedTierId: 1});
    ctx.state.finalKcal = 2455;
    ctx.assignTier();
    t.equal('the class does not change by itself', ctx.state.assignedTierId, 1);
    t.equal('the plan still reads the current class', ctx.state.selectedTierId, 1);
    t.equal('the new one is offered', ctx.state.classOffer, 3);
    t.equal('with a prompt in the theme\'s words', ctx.toasts[0], 'A promotion awaits.');
    ctx.assignTier();
    t.equal('said once, not on every redraw', ctx.toasts.length, 1);
    t.equal('accepting takes it', ctx.acceptClassOffer(), true);
    t.equal('to tier 3', ctx.state.assignedTierId, 3);
    t.equal('the plan follows', ctx.state.selectedTierId, 3);
    t.equal('and the offer is gone', ctx.state.classOffer, null);
  }
  {
    const ctx = rig({assignedTierId: 3, selectedTierId: 3, finalKcal: 1700});
    ctx.assignTier();
    t.equal('moving down a band is offered too', ctx.state.classOffer, 1);
  }
  {
    const ctx = rig({assignedTierId: 1, selectedTierId: 1, finalKcal: 1840});
    ctx.assignTier();
    t.equal('no offer while the target stays in the band', ctx.state.classOffer, null);
  }

  t.section('keeping the class');
  {
    const ctx = rig({assignedTierId: 1, selectedTierId: 1, finalKcal: 2455});
    ctx.assignTier();
    ctx.declineClassOffer();
    t.equal('clears the offer', ctx.state.classOffer, null);
    ctx.assignTier();
    t.equal('the same offer is not made again', ctx.state.classOffer, null);
    t.equal('the class stays', ctx.state.assignedTierId, 1);
    ctx.state.finalKcal = 2800;
    ctx.assignTier();
    t.equal('a different class can still be offered', ctx.state.classOffer, 4);
    ctx.declineClassOffer();
    ctx.state.finalKcal = 1700;
    ctx.assignTier();
    t.equal('back in the old band, the refusal is forgotten', ctx.state.classDeclined, null);
    ctx.state.finalKcal = 2455;
    ctx.assignTier();
    t.equal('so a later move there is offered afresh', ctx.state.classOffer, 3);
  }

  t.section('a diet break');
  {
    const ctx = rig({assignedTierId: 1, selectedTierId: 1, dietBreak: {resume: 'loss', until: '2026-10-01'}});
    ctx.state.finalKcal = 2455;
    ctx.assignTier();
    t.equal('keeps the class', ctx.state.assignedTierId, 1);
    t.equal('and offers nothing', ctx.state.classOffer, null);
    t.equal('and says nothing', ctx.toasts.length, 0);
    ctx.state.dietBreak = null;
    ctx.state.finalKcal = 1700;
    ctx.assignTier();
    t.equal('back on the cut, still nothing to offer', ctx.state.classOffer, null);
  }
});
