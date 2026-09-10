'use strict';
/* Covers when a press and a release on the tab bar count as one tap.

   The tab bar used to act on `click`, and a click was being dropped in two
   situations. Straight after a screen change, a view transition puts a
   snapshot of the page in the top layer for the length of the crossfade
   and a tap landing on it never reaches the button underneath. Straight
   after a scroll, iOS spends the first touch stopping the momentum and
   never synthesises the click at all. Both looked the same from the
   outside: the tab did nothing and you had to press it twice.

   Pointer events arrive in both situations, so the tap is recognised from
   those instead. That moves the judgement into thresholds, and thresholds
   are worth pinning: too tight and a thumb that rolls slightly does
   nothing, too loose and a scroll that starts on the bar changes tab under
   you. */

const {loadFunctions, suite} = require('./helpers');

function rig(){
  return loadFunctions('16-tabs.js', ['isTap'], {TAP_SLOP: 12, TAP_TIME: 700});
}

module.exports = () => suite('tab taps', t => {
  const {isTap} = rig();
  const TAB = {id: 'tab'}, OTHER = {id: 'other'};
  const press = {b: TAB, x: 100, y: 200, t: 1000};

  t.section('a tap is a tap');
  t.equal('pressed and released in the same place',
    isTap(press, TAB, 100, 200, 1050), true);
  t.equal('a thumb that rolls a few pixels',
    isTap(press, TAB, 108, 194, 1120), true);
  t.equal('right on the edge of the slop',
    isTap(press, TAB, 112, 212, 1100), true);
  t.equal('a slow, deliberate press',
    isTap(press, TAB, 100, 200, 1690), true);

  t.section('a drag is not');
  t.equal('dragged sideways off the tab',
    isTap(press, TAB, 160, 200, 1080), false);
  t.equal('dragged up the screen, which is a scroll',
    isTap(press, TAB, 100, 120, 1080), false);
  t.equal('one pixel past the slop',
    isTap(press, TAB, 113, 200, 1050), false);

  t.section('and neither is a hold, or a release somewhere else');
  t.equal('held past the limit', isTap(press, TAB, 100, 200, 1701), false);
  t.equal('released over a different tab', isTap(press, OTHER, 100, 200, 1050), false);
  t.equal('released with nothing under it', isTap(press, null, 100, 200, 1050), false);
  t.equal('no press was recorded', isTap(null, TAB, 100, 200, 1050), false);
});
