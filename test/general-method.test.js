'use strict';
/* Covers generalMethod in 07-method.js — the cooking instructions written
   from the plate itself.

   Almost every plate in a prep is rebuilt out of the shopping list, so the
   recipe's own steps end up describing different food. The cook plan said
   "no written method" and stopped there, which over a hundred preps was
   nine dishes in ten: someone holding four raw ingredients and a jar of
   paprika, with the paprika on the shopping list and nothing anywhere
   saying what it was for. */

const fs = require('fs');
const vm = require('vm');
const {jsFile, suite} = require('./helpers');

const FOODS = {
  protein: [{key:'chicken', name:'Chicken Breast, skin-on (raw)'},
            {key:'yogurt0', name:'Greek Yogurt, 0%'}],
  carbs:   [{key:'rice', name:'White Rice, long (dry)'},
            {key:'granola', name:'Granola'}],
  fat:     [{key:'oil', name:'Extra Virgin Olive Oil'},
            {key:'almonds', name:'Almonds'}],
  veg:     [{key:'broccoli', name:'Broccoli'}, {key:'peppers', name:'Bell Peppers'}],
  fruit:   [{key:'berries', name:'Mixed Berries'}],
  sauce:   [{key:'harissa', name:'Harissa'}],
};
const FAMILY = {
  chicken:'chickencut', yogurt0:'yogurt', rice:'rice', granola:'granola',
  oil:'oil', almonds:'nuts', broccoli:'greens', peppers:'greens', berries:'berry',
  harissa:'chili',
};

function rig(){
  const ctx = {console, FOODS, FAMILY, RECIPES: [], RECIPE_STEPS: {}};
  vm.createContext(ctx);
  const src = fs.readFileSync(jsFile('07-method.js'), 'utf8');
  const from = src.indexOf('  /* =========================================================\n     GENERAL METHOD');
  const to = src.indexOf('  RECIPES.forEach(');
  if (from < 0 || to < 0) throw new Error('general-method: the slice markers moved');
  vm.runInContext(src.slice(from, to) +
    '\nglobalThis.api = {generalMethod};', ctx);
  return ctx.api;
}

const plate = over => Object.assign({
  protein:[], carb:[], fat:[], veg:[], fruit:[], sauce:[], season:[],
}, over);

module.exports = () => suite('a method written from the plate', t => {
  const {generalMethod} = rig();

  t.section('a plate that gets cooked');
  const hot = generalMethod(plate({
    protein:['chicken'], carb:['rice'], fat:['oil'], veg:['broccoli','peppers'],
    sauce:['harissa'], season:['Smoked Paprika','Ground Cumin'],
  }));
  const joined = hot.join('\n');
  t.check('the pan is dealt with first', /Olive Oil/.test(hot[0]), hot[0]);
  t.check('seasoning goes on before the heat, not after',
    hot.findIndex(s=>/Smoked Paprika/.test(s)) < hot.findIndex(s=>/and cook it right through/.test(s)), hot);
  t.check('and it names the food it goes on',
    /on the Chicken Breast before it meets the heat/.test(joined), joined);
  t.check('the chicken is cooked to a temperature', /74C\/165F/.test(joined));
  t.check('the rice is cooked before the chicken is plated',
    /Rinse the White Rice/.test(joined), joined);
  t.check('both vegetables are one job, not two',
    (joined.match(/Roast the/g) || []).length === 1 &&
    /Broccoli and Bell Peppers/.test(joined), joined);
  t.check('the sauce goes on at the end',
    hot.findIndex(s=>/Harissa/.test(s)) > hot.findIndex(s=>/and cook it right through/.test(s)), hot);
  t.check('and it finishes by telling you how to store it',
    /keeps three to four days/.test(hot[hot.length-1]), hot[hot.length-1]);

  t.section('the parenthetical grades are dropped mid-sentence');
  t.check('"Chicken Breast, skin-on (raw)" reads as "Chicken Breast"',
    /the Chicken Breast and cook/.test(joined) && !/skin-on/.test(joined), joined);

  t.section('a plate that never meets heat');
  const cold = generalMethod(plate({
    protein:['yogurt0'], carb:['granola'], fat:['almonds'], fruit:['berries'],
    season:['Cinnamon'],
  }));
  t.check('it says so rather than telling you to season the pan',
    /Nothing here is cooked/.test(cold.join('\n')), cold);
  t.check('and it is not told to cool before the lids go on',
    /keep it cold and covered/.test(cold[cold.length-1]), cold[cold.length-1]);
  t.check('the granola is kept back so it stays crunchy',
    /stays crunchy/.test(cold.join('\n')), cold);

  t.section('seasonings always have somewhere to go');
  const seasoned = generalMethod(plate({protein:['chicken'], season:['Za\'atar','Sumac']}));
  t.check('every seasoning bought for the dish is named in its method',
    /Za'atar and Sumac/.test(seasoned.join('\n')), seasoned);

  t.section('an empty plate');
  t.equal('has nothing to say', generalMethod(plate({})).length, 0);
  t.equal('and neither does no plate at all', generalMethod(null).length, 0);
});
