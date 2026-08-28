'use strict';
/* Covers offServingGrams in 21-food-lookup.js: what "one serving" resolves to
   for a scanned or searched product, across the shapes Open Food Facts really
   publishes. This decides the amount every barcode lookup opens on. */

const {loadFunctions, suite} = require('./helpers');

module.exports = () => suite('open food facts serving sizes', t => {
  const ctx = loadFunctions('21-food-lookup.js', ['offServingGrams', 'offServingUnit']);
  const f = ctx.offServingGrams;

  t.section('serving_quantity is trusted first');
  t.equal('numeric quantity', f({serving_quantity:120, serving_size:'1 serving (120 g)'}), 120);
  t.equal('quantity given as a string', f({serving_quantity:'30'}), 30);
  t.equal('beats a conflicting label', f({serving_quantity:55, serving_size:'1 bar (60 g)'}), 55);

  t.section('falling back to the label text');
  t.equal('plain grams', f({serving_size:'30 g'}), 30);
  t.equal('millilitres', f({serving_size:'125 ml'}), 125);
  t.equal('a count before the weight', f({serving_size:'1 bar (55 g)'}), 55);
  t.equal('the doubled form OFF often stores', f({serving_size:'30 ml (30 ml)'}), 30);
  t.equal('a cup measure with the weight beside it', f({serving_size:'3/4 cup (28 g)'}), 28);
  t.equal('decimal', f({serving_size:'12.5 g'}), 12.5);
  t.equal('comma decimal', f({serving_size:'12,5 g'}), 12.5);
  t.equal('no space before the unit', f({serving_size:'45g'}), 45);
  t.equal('uppercase unit', f({serving_size:'250 ML'}), 250);

  t.section('derived from per-serving nutriments when nothing else says');
  t.equal('ratio of the two energy figures',
    f({nutriments:{'energy-kcal_serving':540, 'energy-kcal_100g':237.885462555066}}), 227);
  t.equal('ignored without a per-100g figure',
    f({nutriments:{'energy-kcal_serving':540}}), null);
  t.equal('ignored when the ratio is absurd',
    f({nutriments:{'energy-kcal_serving':5400, 'energy-kcal_100g':100}}), null);
  t.equal('a stated serving still wins',
    f({serving_quantity:30, nutriments:{'energy-kcal_serving':540, 'energy-kcal_100g':237.9}}), 30);

  t.section('refusing what it cannot read');
  t.equal('nothing published at all', f({}), null);
  t.equal('a count with no unit', f({serving_size:'1 slice'}), null);
  t.equal('zero', f({serving_quantity:0, serving_size:''}), null);
  t.equal('absurdly large', f({serving_quantity:5000}), null);
  t.equal('negative', f({serving_quantity:-30}), null);
  t.equal('a unit that only looks like grams', f({serving_size:'1 gallon'}), null);

  t.section('the unit handed to the amount step');
  t.equal('counts in servings when the weight is known',
    JSON.stringify(ctx.offServingUnit({servingG:120})),
    JSON.stringify({g:120, one:'serving', many:'servings'}));
  t.equal('none when it is not', ctx.offServingUnit({servingG:null}), null);
});
