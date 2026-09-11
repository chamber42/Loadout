'use strict';
/* Covers recipeOptions in 23-suggested-loadout.js — specifically the rule
   that keeps a dish honest about its own title.

   A template lists a handful of ingredients per slot and the planner widens
   that list to family siblings, which is what stops the same six dinners
   coming round forever. What it did not do was read the title. "Baked
   Oatmeal" lists a protein flapjack mix alongside its oats; the mix was
   filed under pastry; pastry also holds croissants — so the breakfast card
   came out reading "Baked Oatmeal" over a croissant, greek yogurt and nine
   grams of peanuts, with no oat in it anywhere.

   The suites below use the real dish templates and the real family map, so
   they fail if either drifts back. */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const {jsFile, extract, suite} = require('./helpers');

/* Only the foods these dishes reach for, at their shipped calories — the
   sibling filter is a calorie ratio, so the numbers have to be real. */
const CARBS = [
  {key:'oats', name:'Rolled Oats (dry)', kcal:389},
  {key:'proteinoats', name:'Protein Oatmeal (dry)', kcal:370},
  {key:'steelcut', name:'Steel-Cut Oats (dry)', kcal:379},
  {key:'muesli', name:'Muesli', kcal:340},
  {key:'kodiakmix', name:'Protein Flapjack Mix (dry)', kcal:360},
  {key:'pancakemix', name:'Pancake Mix (dry)', kcal:363},
  {key:'croissant', name:'Croissant', kcal:406},
  {key:'biscuit', name:'Buttermilk Biscuit', kcal:350},
  {key:'ricecakes', name:'Rice Cakes', kcal:387},
  {key:'proteinchips', name:'Protein Chips', kcal:375},
  {key:'crackers', name:'Whole Grain Crackers', kcal:420},
  {key:'popcorn', name:'Air-Popped Popcorn', kcal:387},
  {key:'rice', name:'White Rice, long (dry)', kcal:365},
  {key:'basmati', name:'Basmati Rice (dry)', kcal:356},
];

function rig(){
  const ctx = {console};
  vm.createContext(ctx);
  // the real family map and the real templates, run as they ship
  vm.runInContext(fs.readFileSync(jsFile('05-food-families.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(jsFile('06-dish-templates.js'), 'utf8'), ctx);

  const src = fs.readFileSync(jsFile('23-suggested-loadout.js'), 'utf8');
  const from = src.indexOf('  const SIGNATURE = {');
  const to = src.indexOf('  function recipeUsable');
  if (from < 0 || to < 0) throw new Error('dish-name: the slice markers moved');
  ctx.CARBS = CARBS;
  vm.runInContext('const listFor = () => CARBS;\n' + src.slice(from, to), ctx);

  /* Everything above is declared with const, which lives in the context's
     lexical scope rather than on the context object — hand it out. */
  vm.runInContext(
    'globalThis.api = {RECIPES, FAMILY, GROUP, recipeOptions, promiseFor};', ctx);
  return ctx.api;
}

module.exports = () => suite('a dish is made of what its name says', t => {
  const app = rig();
  const dish = name => app.RECIPES.find(r => r.name === name);
  const carbs = name => app.recipeOptions(dish(name), 'carb');

  t.section('the breakfast that started this');
  const oatmeal = carbs('Baked Protein Oatmeal');
  t.check('Baked Oatmeal is still made of oats', oatmeal.includes('oats'));
  t.check('and reaches the other oats around them', oatmeal.includes('muesli'));
  t.check('but no longer reaches a croissant', !oatmeal.includes('croissant'), oatmeal);
  t.check('nor a buttermilk biscuit', !oatmeal.includes('biscuit'), oatmeal);

  t.section('the flapjack mix that opened the door is shut out with it');
  /* "{F} Baked Oatmeal" has no {C} to rename itself with, so the carb is
     bound outright: the mix goes, and so does everything it could reach. */
  t.check('the flapjack mix itself is no longer an option',
    !oatmeal.includes('kodiakmix'), oatmeal);
  t.check('nor is anything else off its shelf',
    !oatmeal.includes('pancakemix') && !oatmeal.includes('waffle'), oatmeal);
  t.check('and the dish still has oats enough to be built',
    oatmeal.filter(function(k){ return /oat|muesli|steelcut/.test(k); }).length >= 3, oatmeal);

  t.section('a promise the dish cannot keep is not applied');
  /* "Rice Cakes" is built out of rice cakes, which are filed with the
     crackers rather than with rice. Reading "rice" as a promise about the
     grain would have left the dish expanding into basmati. */
  const stack = carbs('Rice Cake Stack');
  t.check('rice cakes still reach the other crunchy things',
    stack.includes('popcorn'), stack);
  t.check('and never turn into a pot of rice',
    !stack.includes('rice') && !stack.includes('basmati'), stack);

  t.section('a title that promises nothing keeps its full range');
  t.check('a pattern of nothing but placeholders binds no slot',
    app.promiseFor({name:'x', pattern:'{P} with {C}', carb:['rice','oats']}, 'carb') === null);

  t.section('a placeholder binds the siblings but not the template');
  /* "{P} & Eggs" renames itself after whatever protein is chosen, so the
     steak stays — but the eggs in the title stop it reaching the rest of
     the beef shelf, which is where the venison came from. */
  const steak = app.recipeOptions(dish('Steak & Eggs'), 'protein');
  t.check('the steak the template lists is still allowed', steak.includes('steak'), steak);
  t.check('and no longer drags venison in with it', !steak.includes('venison'), steak);

  t.section('a slot named outright is bound completely');
  /* "Three-Bean Chili" has no {P} to rename itself with, so the soy curls
     its template also lists cannot stand in for the beans. */
  const chili = app.recipeOptions(dish('Three-Bean Chili'), 'protein');
  t.check('the beans stay', chili.includes('kidneycan'), chili);
  t.check('the soy curls do not', !chili.includes('tvp') && !chili.includes('veganground'), chili);

  t.section('a dish named after a fruit is bound to that fruit');
  /* "Apple Nachos" is apple slices and a drizzle. Without the apple it is a
     bowl of nut butter, and that is exactly how it was being served: the
     fruit was chosen and then dropped first when the snack could not hold
     everything, so the card read "none available" about an apple nothing
     had ruled out. */
  const apples = app.promiseFor(dish('Apple Nachos'), 'fruit');
  t.check('the title binds the fruit slot', typeof apples === 'function');
  t.check('and it is not merely a placeholder that renames itself',
    apples && apples.soft !== true, apples && apples.soft);
  t.check('an apple keeps it', apples && apples('honeycrisp') === true);
  t.check('a banana does not', apples && apples('bananamed') === false);

  t.section('a title that names no fruit binds nothing');
  t.check('a chicken dinner leaves its fruit slot alone',
    app.promiseFor({name:'x', pattern:'{P} with {C}', fruit:['bananamed']}, 'fruit') === null);

  t.section('the family map keeps batter and pastry apart');
  t.check('a flapjack mix is not a croissant',
    app.FAMILY.kodiakmix !== app.FAMILY.croissant);
  t.check('a pancake mix and a frozen waffle still are the same thing',
    app.FAMILY.pancakemix === app.FAMILY.waffle);
  t.check('and griddle cakes still clash with bread on a plate',
    app.GROUP[app.FAMILY.pancakemix] === 'bready');
});
