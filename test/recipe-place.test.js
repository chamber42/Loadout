'use strict';
/* Covers placeRecipeOnMeal in 11-goal-fit.js — what actually lands on a day
   when "put this on a day" is chosen.

   The two kinds of recipe mean different things by the same field, and this
   is the only place that difference matters. A built-in lists ALTERNATIVES
   ("pick one of these five proteins"); an imported one lists INGREDIENTS
   ("this chili has beef and beans in it"). Treating an import like a
   built-in silently drops half the dish, which is exactly what it did. */

const {loadFunctions, suite} = require('./helpers');

const FOODS = {
  protein: [{key:'beef93', name:'Ground Beef 93/7 (raw)'},
            {key:'blackbeans', name:'Black Beans (canned)'},
            {key:'chicken', name:'Chicken Breast (raw)'}],
  carbs:   [{key:'rice', name:'White Rice (dry)'}, {key:'onion', name:'Onion'}],
  fat:     [{key:'oil', name:'Olive Oil'}, {key:'butter', name:'Butter'}],
  veg:     [{key:'tomatoes', name:'Tomatoes'}, {key:'peppers', name:'Bell Peppers'},
            {key:'corn', name:'Corn'}],
  fruit:   [{key:'lime', name:'Lime'}],
  sauce:   [{key:'salsa', name:'Salsa'}],
};

function rig(over){
  const state = {selections: {}};
  const ctx = loadFunctions('11-goal-fit.js', ['placeRecipeOnMeal'], Object.assign({
    FOODS, state,
    MEALS: [{key:'dinner', name:'DINNER', required:true},
            {key:'snack1', name:'SNACK', required:false}],
    SLOT_DEFS: ['protein','carb','fat','veg','fruit','sauce'].map(s => ({slot:s})),
    POWDER_OK: ['snack'],
    listFor: s => ({protein:FOODS.protein, carb:FOODS.carbs, fat:FOODS.fat,
                    veg:FOODS.veg, fruit:FOODS.fruit, sauce:FOODS.sauce}[s]),
    isDisliked: () => false,
    passesPrefs: () => true,
    substituteFor: () => null,
    familyClashPair: () => false,
    isMeat: f => /beef|chicken/i.test(f.name),
    pickFood: () => null,
    recipeOptions: () => [],
    familyClash: () => false,
    mealAllowsFood: () => true,
    plainTitle: () => 'improvised',
    dishTitle: r => r.name,
    seasoningFor: () => [],
    pruneUnservedItems(){}, saveState(){},
  }, over || {}));
  ctx.state = state;
  return ctx;
}

const imported = {
  name: 'Weeknight Chili', _imported: true,
  protein:['beef93','blackbeans'], carb:['onion'], fat:['oil'],
  veg:['tomatoes','peppers','corn'], fruit:[], sauce:['salsa'],
};
const builtIn = {
  name: 'Burrito Bowl',
  protein:['chicken','beef93','blackbeans'], carb:['rice','onion'], fat:['oil','butter'],
  veg:['tomatoes','peppers','corn'], fruit:['lime'], sauce:['salsa'],
};

const place = (ctx, recipe, meal) => {
  ctx.placeRecipeOnMeal(recipe, meal || 'dinner');
  const s = ctx.state.selections[meal || 'dinner'];
  const out = {};
  ['protein','carb','fat','veg','fruit','sauce'].forEach(k => out[k] = s[k].filter(Boolean));
  return out;
};

module.exports = () => suite('placing a recipe on a day', t => {

  t.section('an imported recipe keeps every ingredient');
  {
    const got = place(rig(), imported);
    t.equal('both proteins survive', got.protein.join(','), 'beef93,blackbeans');
    t.equal('all three vegetables survive', got.veg.join(','), 'tomatoes,peppers,corn');
    t.equal('and the rest', got.carb.join(',') + '|' + got.fat.join(',') + '|' + got.sauce.join(','),
      'onion|oil|salsa');
  }
  {
    /* A snack normally takes no vegetables at all when the app is choosing.
       An import brought its own, so they stay. */
    const got = place(rig(), imported, 'snack1');
    t.equal('a snack still gets an imported recipe\'s vegetables',
      got.veg.join(','), 'tomatoes,peppers,corn');
  }

  t.section('a built-in recipe still picks one of its alternatives');
  {
    const got = place(rig(), builtIn);
    t.equal('one protein from the three offered', got.protein.length, 1);
    t.equal('one carb', got.carb.length, 1);
    t.equal('one fat', got.fat.length, 1);
    t.equal('two vegetables, as designed', got.veg.length, 2);
  }
  {
    const got = place(rig(), builtIn, 'snack1');
    t.equal('and a snack takes no vegetables', got.veg.length, 0);
  }

  t.section('dietary filters still apply to an import');
  {
    /* A web page saying "beef" does not overrule someone being vegetarian. */
    const ctx = rig({passesPrefs: f => !/beef/i.test(f.name)});
    const got = place(ctx, imported);
    t.equal('the beef is dropped', got.protein.indexOf('beef93'), -1);
    t.equal('the beans remain', got.protein.join(','), 'blackbeans');
  }
  {
    const ctx = rig({isDisliked: f => /corn/i.test(f.name)});
    const got = place(ctx, imported);
    t.equal('a disliked vegetable is dropped', got.veg.join(','), 'tomatoes,peppers');
  }

  t.section('combination rules relax only for imports');
  {
    /* Two meats in one dish is normally prevented, because the app would be
       inventing the pairing. Here somebody wrote it down. */
    const twoMeats = Object.assign({}, imported, {protein:['beef93','chicken']});
    t.equal('an import may carry two meats',
      place(rig(), twoMeats).protein.join(','), 'beef93,chicken');
    t.equal('a built-in may not',
      place(rig(), Object.assign({}, twoMeats, {_imported:false})).protein.length, 1);
  }
});
