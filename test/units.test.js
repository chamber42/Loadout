'use strict';
/* Covers the display/input conversions in 00-units.js.

   The stakes here are quiet ones. Nothing in this file is visible when it
   goes wrong in a small way — a weight that drifts a tenth every time
   somebody flips the switch, or an input that stores kilograms into a field
   the expenditure maths reads as pounds, would both look fine on screen and
   be wrong in the save file. So the checks are mostly about round trips and
   about what is stored, not about what is shown. */

const {loadFunctions, suite} = require('./helpers');

const CONSTS = {LB_PER_KG: 2.2046226218, CM_PER_IN: 2.54};

function rig(units){
  const state = {units: units};
  const ctx = loadFunctions('00-units.js', [
    'defaultUnits', 'unitSystem', 'isMetric', 'weightUnitLabel', 'showWeight',
    'storeWeight', 'weightBounds', 'showRate', 'rateText', 'rateTextLower',
    'perBodyweight', 'heightIsSplit', 'heightUnitLabel', 'showHeight', 'storeHeight',
  ], Object.assign({state, Intl, navigator: {language: 'en-US'}}, CONSTS));

  /* UNIT_SYSTEMS is an object literal at file scope, not a function, so it
     is evaluated into the context rather than extracted. */
  const src = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'js', '00-units.js'), 'utf8');
  const table = src.slice(src.indexOf('const UNIT_SYSTEMS'), src.indexOf('/* A first guess'));
  require('vm').runInContext(table, ctx, {filename: '00-units.js'});
  ctx.state = state;
  return ctx;
}

module.exports = () => suite('units', t => {

  t.section('imperial shows what is stored');
  {
    const c = rig('imperial');
    t.equal('label', c.weightUnitLabel(), 'lb');
    t.equal('a stored weight is shown unchanged', c.showWeight(184.2, 1), 184.2);
    t.equal('and a typed one is stored unchanged', c.storeWeight(184.2), 184.2);
    t.equal('height too', c.showHeight(70), 70);
  }

  t.section('metric converts at the edge');
  {
    const c = rig('metric');
    t.equal('label', c.weightUnitLabel(), 'kg');
    t.near('200 lb reads as 90.7 kg', c.showWeight(200, 1), 90.7, 0.05);
    t.near('80 kg stores as 176.4 lb', c.storeWeight(80), 176.37, 0.01);
    t.equal('70 inches reads as 178 cm', c.showHeight(70), 178);
    t.near('180 cm stores as 70.9 inches', c.storeHeight(180), 70.87, 0.01);
  }

  t.section('round trips do not drift');
  {
    const c = rig('metric');
    [50, 63.5, 80, 97.2, 120].forEach(kg => {
      const back = c.showWeight(c.storeWeight(kg), 1);
      t.near(`${kg} kg survives a round trip`, back, kg, 0.05);
    });
    [150, 165, 180, 195].forEach(cm => {
      const back = c.showHeight(c.storeHeight(cm));
      t.near(`${cm} cm survives a round trip`, back, cm, 0.5);
    });
  }
  {
    /* The switch is presentation only. Flipping it must not move the
       stored figure at all — this is the check that would fail if anyone
       ever "helpfully" converted state.bodyweight on toggle. */
    const imperial = rig('imperial'), metric = rig('metric');
    const stored = 184.2;
    t.equal('the same stored weight under both systems',
      imperial.showWeight(stored, 1) === 184.2 &&
      Math.abs(metric.showWeight(stored, 1) - 83.6) < 0.05, true);
  }

  t.section('rates carry the displayed unit');
  {
    const c = rig('imperial');
    t.equal('a pound a week down', c.rateText(-1), 'Down 1.0 lb a week');
    t.equal('and up', c.rateText(0.5), 'Up 0.5 lb a week');
    t.equal('noise is not a direction', c.rateText(-0.02), 'Holding steady');
  }
  {
    const c = rig('metric');
    t.equal('a pound a week reads as 0.5 kg', c.rateText(-1), 'Down 0.5 kg a week');
    /* The "too small to report" floor is a tenth of the DISPLAYED unit.
       0.2 lb is 0.09 kg — below a tenth of a kilogram, so in metric this is
       correctly nothing, while in pounds it would round to 0.2. */
    t.equal('the floor follows the unit shown', c.rateText(-0.2), 'Holding steady');
    t.equal('but the same rate does read in pounds',
      rig('imperial').rateText(-0.2), 'Down 0.2 lb a week');
  }

  t.section('protein against bodyweight');
  {
    t.equal('per pound', rig('imperial').perBodyweight(180, 200), '0.90 g/lb');
    t.equal('per kilogram', rig('metric').perBodyweight(180, 200), '1.98 g/kg');
  }

  t.section('bounds move with the unit');
  {
    const i = rig('imperial').weightBounds(), m = rig('metric').weightBounds();
    t.check('imperial bounds are in pounds', i.min === 60 && i.max === 600, i);
    t.check('metric bounds are in kilograms', m.min === 27 && m.max === 275, m);
    t.check('and the metric step is finer, since a kilogram is coarser',
      m.step < i.step, {imperial: i.step, metric: m.step});
  }

  t.section('height input shape');
  {
    t.equal('feet and inches need two boxes', rig('imperial').heightIsSplit(), true);
    t.equal('centimetres need one', rig('metric').heightIsSplit(), false);
    t.equal('labelled', rig('metric').heightUnitLabel(), 'cm');
  }

  t.section('the first guess follows the phone');
  {
    /* Only three countries use pounds for bodyweight day to day, so
       everyone else is far likelier to want kilograms than to go hunting
       for a switch. Read from Intl rather than navigator.language, which
       reports the UI language and not the region — a US-English phone set
       to Germany should still open in kilograms. */
    const vm = require('vm');
    const {extract} = require('./helpers');
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'js', '00-units.js'), 'utf8');
    const guess = loc => {
      const c = {Intl: {DateTimeFormat: () => ({resolvedOptions: () => ({locale: loc})})},
                 navigator: {language: loc}};
      vm.createContext(c);
      vm.runInContext(extract(src, 'defaultUnits'), c);
      return c.defaultUnits();
    };
    [['en-US','imperial'], ['en-LR','imperial'], ['my-MM','imperial'],
     ['en-GB','metric'], ['de-DE','metric'], ['en-AU','metric'],
     ['fr-FR','metric'], ['ja-JP','metric']].forEach(([loc, want]) =>
      t.equal(loc, guess(loc), want));
  }

  t.section('refusing what is not a number');
  {
    const c = rig('metric');
    t.equal('a stored weight of zero shows nothing', c.showWeight(0, 1), null);
    t.equal('nor a negative one', c.showWeight(-5, 1), null);
    t.equal('typed nonsense stores nothing', c.storeWeight('heavy'), null);
    t.equal('and an empty box stores nothing', c.storeWeight(''), null);
  }
});
