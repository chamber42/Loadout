'use strict';
/* Covers which screen changes are allowed to crossfade.

   showScreen() runs its swap inside a view transition so the page being
   left and the page arriving overlap. One hand-off must not: the splash.
   The attract screen dissolves to black under its own steam, and the
   moment it finishes, 27-init.js clears attract-auto/attract-out and calls
   showScreen() for the real screen.

   Clearing attract-out restores the title card to full opacity. If the
   swap crossfades from there, the browser snapshots a re-lit title card
   and plays it back over the arriving page — the splash appearing a second
   time for a quarter of a second, at the end of a sequence that had just
   faded it out. That shipped, and it is what these checks exist to stop
   coming back.

   The guard cannot be "is body.attract-auto set", because init clears that
   class immediately BEFORE handing over — it is already gone by the time
   showScreen runs, on the one call it was written for. It has to be the
   screen actually being left. */

const {loadFunctions, suite} = require('./helpers');

/* A document stub with just enough of the two things showScreen reads: the
   screen currently marked active, and the classes on <body>. */
function rig(opts){
  const active = opts.from;
  const bodyClasses = new Set(opts.bodyClasses || []);
  const calls = {crossfaded: [], plain: []};
  const doc = {
    querySelector(sel){
      return sel === '.screen.active' && active ? {id: active} : null;
    },
    body: {classList: {contains: c => bodyClasses.has(c)}},
  };
  if (opts.supported !== false){
    doc.startViewTransition = function(cb){ calls.crossfaded.push(true); cb(); return {}; };
  }
  const ctx = loadFunctions('16-tabs.js', ['showScreen'], {
    document: doc,
    canCrossfade: opts.supported !== false,
    swapScreen(id){ calls.plain.push(id); },
  });
  ctx.showScreen(opts.to);
  return {crossfaded: calls.crossfaded.length > 0};
}

module.exports = () => suite('screen transitions', t => {

  t.section('the splash hand-off is never a crossfade');
  /* Exactly the state 27-init.js leaves behind: both classes already
     cleared, still standing on the attract screen. */
  t.equal('leaving the attract screen for the sheet',
    rig({from: 'screen-attract', to: 'screen-tiers', bodyClasses: []}).crossfaded, false);
  t.equal('leaving it for the loadout, as the START tap does',
    rig({from: 'screen-attract', to: 'screen-loadout', bodyClasses: []}).crossfaded, false);
  t.equal('arriving at the attract screen',
    rig({from: 'screen-journal', to: 'screen-attract'}).crossfaded, false);
  t.equal('while the splash is still running',
    rig({from: 'screen-tiers', to: 'screen-loadout', bodyClasses: ['attract-auto']}).crossfaded, false);

  t.section('every ordinary screen change is');
  t.equal('tab to tab', rig({from: 'screen-journal', to: 'screen-quest'}).crossfaded, true);
  t.equal('into the pantry', rig({from: 'screen-shop', to: 'screen-pantry'}).crossfaded, true);
  t.equal('a back link', rig({from: 'screen-pantry', to: 'screen-journal'}).crossfaded, true);
  t.equal('with no screen yet active',
    rig({from: null, to: 'screen-tiers'}).crossfaded, true);

  t.section('a browser without the API just swaps');
  t.equal('ordinary change',
    rig({from: 'screen-journal', to: 'screen-quest', supported: false}).crossfaded, false);
  t.equal('splash hand-off',
    rig({from: 'screen-attract', to: 'screen-tiers', supported: false}).crossfaded, false);
});
