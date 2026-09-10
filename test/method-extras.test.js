'use strict';
/* Covers methodExtras in 32-method-check.js — the box that tells you what a
   method needs that your plate does not carry.

   It was reading ordinary words in a sentence as branded products. "Grill
   until it has real char on the edges" bought Arctic Char; "brown the meat"
   bought Goat Meat; a bowl of rolled oats and peanut butter was told it also
   needed Protein Oatmeal and Pine Nuts. Across 450 dishes it flagged
   something on 46% of them, and almost none of it was real.

   The second job here is the difference between an ingredient that is used
   up and one that is eaten. A marinade is thrown away and leaving it out of
   the macros is honest; milk that oats are cooked in is drunk by the oats,
   and calling that "not counted" understates the bowl. */

const fs = require('fs');
const vm = require('vm');
const {jsFile, suite} = require('./helpers');

const FOODS = {
  protein: [{key:'milk', name:'Skim Milk', kcal:34},
            {key:'milkwhole', name:'Whole Milk', kcal:61},
            {key:'plantpro', name:'Plant Protein Powder', kcal:380},
            {key:'yogurt0', name:'Greek Yogurt, 0%', kcal:59},
            {key:'goat', name:'Goat Meat (raw)', kcal:109},
            {key:'arcticchar', name:'Arctic Char (raw)', kcal:154}],
  carbs:   [{key:'oats', name:'Rolled Oats (dry)', kcal:389},
            {key:'proteinoats', name:'Protein Oatmeal (dry)', kcal:370}],
  fat:     [{key:'pb', name:'Natural Peanut Butter', kcal:588},
            {key:'pinenuts', name:'Pine Nuts', kcal:673},
            {key:'butter', name:'Butter', kcal:717}],
  veg:     [{key:'garlic', name:'Garlic', kcal:149}],
  fruit:   [{key:'bananamed', name:'Banana', kcal:89}],
  sauce:   [{key:'cheesesauce', name:'Cheese Sauce', kcal:180},
            {key:'protqueso', name:'High-Protein Queso', kcal:90}],
  season:  [{key:'cinnamon', name:'Cinnamon', kcal:247}],
};
const FAMILY = {
  milk:'dairyliquid', milkwhole:'dairyliquid', yogurt0:'yogurt',
  oats:'oats', proteinoats:'oats', pb:'nutbutter', pinenuts:'nuts',
  butter:'butter', goat:'beefcut', arcticchar:'salmon',
};

function rig(){
  const ctx = {console, FOODS, FAMILY};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(jsFile('32-method-check.js'), 'utf8') +
    '\nglobalThis.api = {methodExtras};', ctx);
  return ctx.api;
}

const plate = over => Object.assign({
  protein:[], carb:[], fat:[], veg:[], fruit:[], sauce:[], season:[],
}, over);

const OATS = {
  name:'Gainer Oats',
  protein:['plantpro','milkwhole','yogurt0'], carb:['oats','proteinoats'],
  fat:['pb','pinenuts'], fruit:['bananamed'], veg:[], sauce:[], season:['cinnamon'],
  steps:[
    'Cook the oats in milk rather than water. It is the single easiest calorie upgrade in the bowl.',
    'Salt the oats. Unsalted oatmeal tastes of nothing however much sugar goes in.',
    'Fold the nut butter through while it is hot so it melts into ribbons.',
  ],
};

module.exports = () => suite('what a method needs that the plate has not got', t => {
  const {methodExtras} = rig();
  const names = list => list.map(x => x.name);

  t.section('the bowl that started this');
  const ex = methodExtras(OATS, plate({
    protein:['plantpro'], carb:['oats'], fat:['pb'], fruit:['bananamed'],
    season:['Cinnamon'],
  }));
  t.check('"oatmeal" is the oats on the plate, not a product to buy',
    !names(ex.dense).includes('Protein Oatmeal (dry)'), names(ex.dense));
  t.check('"nut butter" is the peanut butter on the plate, not pine nuts',
    !names(ex.dense).includes('Pine Nuts'), names(ex.dense));
  t.check('and not a tub of dairy butter either',
    !names(ex.dense).includes('Butter'), names(ex.dense));

  t.section('milk the oats drink is not a free ingredient');
  t.check('it is disclosed as going into the food',
    names(ex.absorbed).includes('Skim Milk'), names(ex.absorbed));
  t.check('and not as something that misses your macros',
    !names(ex.light).includes('Skim Milk') && !names(ex.dense).includes('Skim Milk'),
    {light: names(ex.light), dense: names(ex.dense)});

  t.section('a marinade is the case that really is thrown away');
  const marinade = methodExtras(Object.assign({}, OATS, {
    steps:['Marinate the meat in the milk overnight, then drain it and pat dry.'],
  }), plate({protein:['plantpro'], carb:['oats']}));
  t.check('nothing is claimed to end up in the food',
    marinade.absorbed.length === 0, names(marinade.absorbed));

  t.section('a word is not a product');
  const verbs = methodExtras(Object.assign({}, OATS, {
    steps:['Grill until it has real char on the edges.', 'Brown the meat hard in batches.'],
  }), plate({protein:['plantpro'], carb:['oats']}));
  t.check('"char" does not buy Arctic Char',
    !names(verbs.dense).concat(names(verbs.light)).includes('Arctic Char (raw)'), verbs);
  t.check('"meat" does not buy Goat Meat',
    !names(verbs.dense).concat(names(verbs.light)).includes('Goat Meat (raw)'), verbs);

  t.section('but a method that names a thing outright still says so');
  const real = methodExtras(Object.assign({}, OATS, {
    steps:['Soften the garlic in the pan before anything else goes in.'],
  }), plate({protein:['plantpro'], carb:['oats']}));
  t.check('garlic the plate has not got is still reported',
    names(real.dense).concat(names(real.light)).includes('Garlic'), real);

  t.section('a sauce the plate already carries is that sauce');
  const sauced = methodExtras(Object.assign({}, OATS, {
    steps:['Pour the cheese sauce over and bake.'],
  }), plate({protein:['plantpro'], carb:['oats'], sauce:['protqueso']}));
  t.check('no second bottle is asked for',
    !names(sauced.dense).concat(names(sauced.light)).includes('Cheese Sauce'), sauced);
});
