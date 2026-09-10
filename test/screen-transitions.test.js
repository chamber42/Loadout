'use strict';
/* Covers that changing screen happens immediately.

   Screens used to swap inside a view transition so the outgoing and
   incoming pages would overlap. While one runs, WebKit replaces the live
   DOM with snapshots and nothing on the page is hit-testable: measured with
   elementFromPoint, a tab and a panel in the middle of the page both
   returned <html> from 64ms to 293ms after a swap. Every navigation bought
   a quarter of a second in which no control anywhere could be pressed,
   which is the "it takes two taps" people reported.

   So the swap is synchronous, and this pins that down. A future attempt to
   defer it — a view transition, an animation frame, a timeout to line
   something up — fails here, and the comment above says why that is not a
   trade worth making again. */

const {loadFunctions, suite} = require('./helpers');

module.exports = () => suite('screen changes', t => {
  const swapped = [];
  const ctx = loadFunctions('16-tabs.js', ['showScreen'], {
    swapScreen(id){ swapped.push(id); },
    document: {
      querySelector(){ return null; },
      body: {classList: {contains(){ return false; }}},
      /* If anything reaches for this again, the test should fail rather
         than quietly hand back a transition object. */
      startViewTransition(){ throw new Error('screen changes must not be deferred'); },
    },
  });

  t.section('the screen changes on the spot');
  ctx.showScreen('screen-journal');
  t.equal('one swap, immediately', swapped.length, 1);
  t.equal('and it is the screen asked for', swapped[0], 'screen-journal');

  t.section('a second change is not queued behind the first');
  ctx.showScreen('screen-quest');
  ctx.showScreen('screen-loadout');
  t.equal('all three landed', swapped.length, 3);
  t.equal('in order', swapped.join(','), 'screen-journal,screen-quest,screen-loadout');
});
