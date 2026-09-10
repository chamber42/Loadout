'use strict';
/* Covers buildPalette and drawShortlist in 23-suggested-loadout.js — whether
   the answers given on the meal-prep screens actually govern the prep.

   Two of them were being treated as suggestions. "Two proteins" was only
   ever a starting count: the list took a food for each dish in turn without
   keeping score, so three dishes with different tastes handed back three,
   four or five however the screen was set. And "stick to my favourites"
   picked the starred foods first but then filled the rest at random, so a
   prep built on six starred proteins could come back carrying one of them
   and two nobody had asked for. */

const {loadFunctions, suite} = require('./helpers');

const FOODS = {
  protein: [{key:'chicken', name:'Chicken', kcal:165, protein:31},
            {key:'beef',    name:'Beef',    kcal:180, protein:26},
            {key:'salmon',  name:'Salmon',  kcal:200, protein:25},
            {key:'egg',     name:'Egg',     kcal:143, protein:13},
            {key:'tofu',    name:'Tofu',    kcal:145, protein:16}],
  carbs:   [{key:'rice', name:'Rice', kcal:365}, {key:'oats', name:'Oats', kcal:389},
            {key:'pasta', name:'Pasta', kcal:371}],
  fat:     [{key:'oil', name:'Oil', kcal:884}],
  veg:     [{key:'broccoli', name:'Broccoli', kcal:34}, {key:'spinach', name:'Spinach', kcal:23},
            {key:'peppers', name:'Peppers', kcal:31}],
};
const listFor = s => ({protein:FOODS.protein, carb:FOODS.carbs, fat:FOODS.fat, veg:FOODS.veg}[s]);

/* Three dishes that each prefer a different protein but could all take an
   egg — the shape that used to produce three proteins from a budget of two. */
const DISHES = {
  roast:  {protein:['chicken','egg'], carb:['rice'],  fat:['oil'], veg:['broccoli']},
  grill:  {protein:['beef','egg'],    carb:['pasta'], fat:['oil'], veg:['spinach']},
  bake:   {protein:['salmon','egg'],  carb:['rice'],  fat:['oil'], veg:['peppers']},
  vegan:  {protein:['tofu'],          carb:['oats'],  fat:['oil'], veg:['broccoli']},
  /* three dishes that share nothing at all: no two foods can cover them */
  solo1:  {protein:['chicken'], carb:['rice'],  fat:['oil'], veg:['broccoli']},
  solo2:  {protein:['beef'],    carb:['pasta'], fat:['oil'], veg:['spinach']},
  solo3:  {protein:['salmon'],  carb:['oats'],  fat:['oil'], veg:['peppers']},
};

function rig(over){
  const state = Object.assign({
    variety:{protein:2, carb:2, fat:2, veg:2},
    discoveryMode:'favorites', favorites:{}, prepServings:1,
  }, (over || {}).state || {});
  const ctx = loadFunctions('23-suggested-loadout.js', ['buildPalette','drawShortlist'],
    Object.assign({
      state, FOODS, listFor,
      MEALS: [{key:'m1', name:'BREAKFAST', required:true},
              {key:'m2', name:'LUNCH', required:true},
              {key:'m3', name:'DINNER', required:true}],
      VARIETY_SLOTS: ['protein','carb','fat','veg'],
      varietyBudget: slot => (state.variety[slot] == null ? 2 : state.variety[slot]),
      recipeOptions: (recipe, slot) => (DISHES[recipe.name] || {})[slot] || [],
      favKeys: slot => (state.favorites[slot] || []),
      shortlistFor: slot => (state.discoveryMode === 'favorites' ? (state.favorites[slot] || []) : []),
      planPantryKeys: () => [],
      slotOf: () => null,
      wantsBreakfast: () => false,
      isDisliked: () => false,
      passesPrefs: () => true,
      substituteFor: () => null,
      mealAllowsFood: () => true,
      familyClashPair: () => false,
      carriesProtein: f => f.protein >= 13,
      isMustUse: () => false,
      POWDER_OK: [],
      LAST_DRAW: {recipes:new Set(), foods:new Set()},
      randOf: a => a[Math.floor(Math.random()*a.length)],
      COMMITTED: {},
      Math,
    }, (over || {}).ctx || {}));
  ctx.state = state;
  return ctx;
}

const picked = names => names.map(n => ({recipe:{name:n}, role:'dinner'}));

module.exports = () => suite('the answers given on the prep screens', t => {

  t.section('the number of proteins is a number, not a starting point');
  /* Run it repeatedly: the old code only overshot on some draws, so a single
     pass could pass by luck. */
  let worst = 0, everyRun = true;
  for (let i = 0; i < 200; i++){
    const ctx = rig();
    const p = ctx.buildPalette(picked(['roast','grill','bake']));
    worst = Math.max(worst, p.protein.length);
    if (p.protein.length > 2) everyRun = false;
  }
  t.check('two asked for, never more than two over 200 draws', everyRun, {worst});
  t.equal('and the most it ever bought', worst, 2);

  t.section('one list covers dishes that each wanted something different');
  const shared = rig().buildPalette(picked(['roast','grill','bake']));
  t.check('the egg all three can take is on the list',
    shared.protein.some(f=>f.key === 'egg'), shared.protein.map(f=>f.key));

  t.section('"stick to my favourites" decides what gets bought');
  let fromFavs = 0, total = 0;
  for (let i = 0; i < 200; i++){
    const ctx = rig({state:{favorites:{protein:['chicken','egg','salmon']}}});
    ctx.COMMITTED = {};
    const p = ctx.buildPalette(picked(['roast','grill','bake']));
    p.protein.forEach(f=>{ total++; if (['chicken','egg','salmon'].includes(f.key)) fromFavs++; });
  }
  t.check('nearly everything bought is starred', fromFavs / total > 0.9,
    {fromFavs, total, share: fromFavs/total});

  t.section('four dishes, one odd one out, still two proteins');
  /* The vegan dish shares nothing with the other three, but they share an
     egg between them — so two foods cover all four, and it finds them. */
  const stretched = rig().buildPalette(picked(['roast','grill','bake','vegan']));
  t.equal('still only what was asked for', stretched.protein.length, 2);
  t.check('the odd dish out still has its protein',
    stretched.protein.some(f=>f.key === 'tofu'), stretched.protein.map(f=>f.key));

  t.section('a dish is never left with nothing to cook');
  /* Nothing covers these three at once, so honouring the number to the
     letter would leave one unbuildable. Going over beats an empty slot. */
  const forced = rig().buildPalette(picked(['solo1','solo2','solo3']));
  t.equal('the number bends exactly as far as it must', forced.protein.length, 3);
  t.check('and every dish has its own', ['chicken','beef','salmon']
    .every(k => forced.protein.some(f=>f.key === k)), forced.protein.map(f=>f.key));

  t.section('the list is settled before the dishes are chosen');
  const ctx = rig({state:{favorites:{protein:['chicken','beef','salmon','egg']}}});
  const settled = ctx.drawShortlist('protein');
  t.equal('as many foods as the screen asked for', settled.length, 2);
  t.check('all of them starred',
    settled.every(k => ['chicken','beef','salmon','egg'].includes(k)), settled);
});
