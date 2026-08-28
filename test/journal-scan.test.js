'use strict';
/* Covers jfFoodFromHit in 31-journal-scan.js: the shape a scanned or searched
   product takes when it enters the journal.

   The fibre and sodium checks matter more than they look. fibreOf() and
   sodiumOf() in 04-nutrition.js fall back to USDA tables and family averages
   only when a food's value is null; a zero is taken as a measurement, so
   coercing a silent label to 0 tells the day's totals the product contains no
   fibre and no salt at all. */

const fs = require('fs');
const vm = require('vm');
const {extract, jsFile, suite} = require('./helpers');

/* jfFoodFromHit leans on offServingUnit from the file loaded before it, so
   both come into one context the way the browser has them share a scope. */
function load(){
  const lookup = fs.readFileSync(jsFile('21-food-lookup.js'), 'utf8');
  const journalScan = fs.readFileSync(jsFile('31-journal-scan.js'), 'utf8');
  const ctx = {console, document: {getElementById: () => null}};
  vm.createContext(ctx);
  vm.runInContext([
    extract(lookup, 'offServingUnit'),
    extract(journalScan, 'jfFoodFromHit'),
  ].join('\n'), ctx);
  return ctx;
}

module.exports = () => suite('scanned products in the journal', t => {
  const {jfFoodFromHit} = load();

  t.section('what the label actually said');
  {
    const food = jfFoodFromHit({
      name:'Baked Beans', brand:'Heinz', kcal:78, protein:4.7, carbs:12.9, fat:0.2,
      fibre:3.7, sodium:290, servingG:207,
    });
    t.equal('name carries the brand', food.name, 'Baked Beans (Heinz)');
    t.equal('fibre passes through', food.fibre, 3.7);
    t.equal('sodium passes through', food.sodium, 290);
    t.equal('counts in servings when one was published', food.unit && food.unit.g, 207);
  }

  t.section('what the label left out');
  {
    const food = jfFoodFromHit({
      name:'Mystery Snack', brand:'', kcal:400, protein:5, carbs:60, fat:15,
      fibre:null, sodium:null, servingG:null,
    });
    t.equal('fibre stays null so the estimate can fill it', food.fibre, null);
    t.equal('sodium stays null for the same reason', food.sodium, null);
    t.check('neither is silently zeroed',
      food.fibre !== 0 && food.sodium !== 0, {fibre:food.fibre, sodium:food.sodium});
    t.equal('no serving means no unit, so the amount stays in grams', food.unit, null);
    t.equal('unbranded names are left alone', food.name, 'Mystery Snack');
  }

  t.section('a real zero is still a zero');
  {
    const food = jfFoodFromHit({
      name:'Diet Cola', kcal:0.4, protein:0, carbs:0, fat:0,
      fibre:0, sodium:10, servingG:330,
    });
    t.equal('a stated zero is kept as measured', food.fibre, 0);
    t.equal('and is not confused with a missing value', food.sodium, 10);
  }
});
