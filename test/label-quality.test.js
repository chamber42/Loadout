'use strict';
/* Covers offParseProduct in 21-food-lookup.js: what it makes of a label, and
   what it says about one it cannot fully trust.

   Both flags matter beyond the results list. A product missing its protein
   figure is logged as containing none, and a product whose stated calories
   disagree with its own macros is logged at the stated figure — so the flags
   travel onto the entry and are repeated wherever its numbers appear. */

const {loadFunctions, suite} = require('./helpers');

/* A sound label: Kirkland Signature Chicken Bakes, as OFF holds it. */
const SOUND = {
  code: '0096619329939',
  product_name: 'Chicken Bakes',
  brands: 'Kirkland Signature',
  serving_size: '1 sandwich (227 g)',
  serving_quantity: 227,
  nutriments: {
    'energy-kcal_100g': 237.885462555066,
    proteins_100g: 15.4185022026432,
    carbohydrates_100g: 25.5506607929515,
    fat_100g: 8.37004405286344,
    fiber_100g: 1.3215859030837,
    salt_100g: 1.50881057268722,
  },
};

const withNutriments = extra =>
  Object.assign({}, SOUND, {nutriments: Object.assign({}, SOUND.nutriments, extra)});

module.exports = () => suite('reading a product label', t => {
  const {offParseProduct} = loadFunctions('21-food-lookup.js',
    ['offServingGrams', 'brandOf', 'offParseProduct']);

  t.section('a label that agrees with itself');
  {
    const h = offParseProduct(SOUND);
    t.equal('parsed', !!h, true);
    t.equal('brand taken from a comma string', h.brand, 'Kirkland Signature');
    t.equal('serving read', h.servingG, 227);
    t.equal('not flagged as incomplete', h.partial, false);
    t.equal('not flagged as suspect', h.suspect, false);
    t.near('its macros imply what it states', h.impliedKcal, 239.2, 0.2);
    t.near('salt converted to sodium in mg', h.sodium, 593.6, 1);
  }

  t.section('brands arrive in two shapes');
  t.equal('an array, as search returns',
    offParseProduct(Object.assign({}, SOUND, {brands: ['Kirkland Signature', 'Costco']})).brand,
    'Kirkland Signature');
  t.equal('missing entirely',
    offParseProduct(Object.assign({}, SOUND, {brands: null})).brand, '');

  t.section('a label missing a macro');
  {
    const h = offParseProduct(withNutriments({proteins_100g: undefined}));
    t.equal('flagged incomplete', h.partial, true);
    t.equal('the gap is counted as zero, having nothing better', h.protein, 0);
    t.equal('and it is not also called suspect, which would be double counting',
      h.suspect, false);
  }

  t.section('a label that contradicts itself');
  {
    const h = offParseProduct(withNutriments({'energy-kcal_100g': 100}));
    t.equal('flagged suspect', h.suspect, true);
    t.near('carrying what the macros actually work out to', h.impliedKcal, 239.2, 0.2);
    t.equal('the stated figure is still what it reports', Math.round(h.kcal), 100);
  }

  t.section('and one that only looks like it does');
  {
    /* Fibre and sugar alcohols legitimately move the sum, so a narrow gap
       must not cry wolf. 250 stated against 239 implied is ordinary. */
    t.equal('a few percent out is normal',
      offParseProduct(withNutriments({'energy-kcal_100g': 250})).suspect, false);
    /* And on a very low-calorie product a small absolute gap is a large
       proportion, which is why there is a floor as well as a ratio. */
    t.equal('a tiny product with a tiny gap is left alone',
      offParseProduct({product_name:'Diet Cola', nutriments:{
        'energy-kcal_100g': 1, proteins_100g: 0, carbohydrates_100g: 2, fat_100g: 0}}).suspect,
      false);
  }

  t.section('what it refuses outright');
  t.equal('no name', offParseProduct(Object.assign({}, SOUND, {product_name: ''})), null);
  t.equal('no calories', offParseProduct({product_name: 'X', nutriments: {}}), null);
  t.equal('impossible density', offParseProduct(withNutriments({'energy-kcal_100g': 980})), null);
  t.equal('nothing at all', offParseProduct(null), null);
});
