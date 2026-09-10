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
    'globalThis.api = {RECIPES, FAMILY, GROUP, recipeOptions, allowedFamilies};', ctx);
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

  t.section('what the template lists by hand always stays');
  t.check('the flapjack mix the recipe asks for is still allowed',
    oatmeal.includes('kodiakmix'), oatmeal);
  t.check('but it brings none of its own siblings with it',
    !oatmeal.includes('pancakemix'), oatmeal);

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
  const open = app.allowedFamilies({name:'x', pattern:'{P} with {C}', carb:['rice','oats']}, 'carb');
  t.check('both listed families stay reachable',
    open.has('rice') && open.has('oats'), [...open]);

  t.section('the family map keeps batter and pastry apart');
  t.check('a flapjack mix is not a croissant',
    app.FAMILY.kodiakmix !== app.FAMILY.croissant);
  t.check('a pancake mix and a frozen waffle still are the same thing',
    app.FAMILY.pancakemix === app.FAMILY.waffle);
  t.check('and griddle cakes still clash with bread on a plate',
    app.GROUP[app.FAMILY.pancakemix] === 'bready');
});
