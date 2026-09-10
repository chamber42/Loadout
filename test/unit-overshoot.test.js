'use strict';
/* Covers trimUnitOvershoot and buildUnitsFor in 24-daily-loadout.js — the
   reason a meal could come back at twice the calories it was given.

   Bread, tortillas and buns cannot be served in fractions, so the portion
   pass rounds them up to whole units after the balance has already landed on
   the target — and nothing checked the total afterwards. A sitting came back
   carrying two 12" tortillas and 1046 kcal against a 535 kcal target.

   trimUnitOvershoot was written for exactly this and was never called: dead
   code in the file. It is wired in now, and it will not trim past what a dish
   needs to be that dish — a sandwich is two slices of bread, a taco dish is
   two tortillas, and below that the answer is not a smaller sandwich but a
   different meal. */

const {loadFunctions, suite} = require('./helpers');

const bread    = {key:'rye',      name:'Rye Bread',   kcal:250, unit:{g:32, one:'slice'}};
const tortilla = {key:'tort12',   name:'Tortilla 12"',kcal:300, unit:{g:99, one:'tortilla', whole:true}};
const chicken  = {key:'chicken',  name:'Chicken',     kcal:165};

const FOODS = {protein:[chicken], carbs:[bread, tortilla], fat:[], veg:[], fruit:[], sauce:[]};
const SLOT_DEFS = [
  {slot:'protein', list:()=>FOODS.protein},
  {slot:'carb',    list:()=>FOODS.carbs},
  {slot:'fat',     list:()=>FOODS.fat},
  {slot:'veg',     list:()=>FOODS.veg},
  {slot:'fruit',   list:()=>FOODS.fruit},
  {slot:'sauce',   list:()=>FOODS.sauce},
];

function rig(){
  return loadFunctions('24-daily-loadout.js', ['trimUnitOvershoot','buildUnitsFor'], {
    SLOT_DEFS, FOODS,
    floorAt: (floors, slot, i) => (floors && floors[slot] && floors[slot][i]) || 0,
    HANDHELD_FORMS: new Set(['Sandwich','Toast','Tacos','Burger']),
    Math,
  });
}

const kcalOf = (food, g) => food.kcal * g / 100;

module.exports = () => suite('a whole slice is still a whole slice', t => {
  const ctx = rig();

  t.section('a sitting that cannot afford two tortillas gets one');
  const grams = {protein:{0:100}, carb:{0:198}, fat:{}, veg:{}, fruit:{}, sauce:{}};
  const sel = {protein:['chicken'], carb:['tort12'], fat:[], veg:[], fruit:[], sauce:[]};
  const before = kcalOf(chicken, 100) + kcalOf(tortilla, 198);
  t.check('starts well over a 400 kcal sitting', before > 700, Math.round(before));
  const shed = ctx.trimUnitOvershoot(grams, sel, 400, {});
  const after = kcalOf(chicken, 100) + kcalOf(tortilla, grams.carb[0]);
  t.check('it reports that it shed something', shed === true, shed);
  t.equal('one tortilla left, not two', grams.carb[0], 99);
  /* One tortilla is the floor, so 462 against 400 is as close as it goes —
     the overshoot is what a whole tortilla costs, not a doubled portion. */
  t.check('and the overshoot is down to what one tortilla costs',
    after < before - 250 && after < 400 * 1.2, {before:Math.round(before), after:Math.round(after)});

  t.section('it stops at what the dish needs to be that dish');
  /* A sandwich is two slices. Trimming to one does not make a cheaper
     sandwich, it makes an open sandwich nobody asked for. */
  const g2 = {protein:{0:100}, carb:{0:64}, fat:{}, veg:{}, fruit:{}, sauce:{}};
  const s2 = {protein:['chicken'], carb:['rye'], fat:[], veg:[], fruit:[], sauce:[]};
  ctx.trimUnitOvershoot(g2, s2, 120, {carb:{0:64}});
  t.equal('both slices stay', g2.carb[0], 64);

  t.section('nothing to do when the meal already fits');
  const g3 = {protein:{0:100}, carb:{0:99}, fat:{}, veg:{}, fruit:{}, sauce:{}};
  const s3 = {protein:['chicken'], carb:['tort12'], fat:[], veg:[], fruit:[], sauce:[]};
  t.check('it says so', ctx.trimUnitOvershoot(g3, s3, 600, {}) === false);
  t.equal('and changes nothing', g3.carb[0], 99);

  t.section('what a dish needs to be built');
  t.equal('a sandwich takes two slices', ctx.buildUnitsFor(bread, {form:'Sandwich'}), 2);
  t.equal('so does toast with something on it', ctx.buildUnitsFor(bread, {form:'Toast'}), 2);
  t.equal('a taco dish takes two tortillas', ctx.buildUnitsFor(tortilla, {form:'Tacos'}), 2);
  t.equal('a burger takes one bun', ctx.buildUnitsFor(tortilla, {form:'Burger'}), 1);
  t.equal('and a bowl takes no bread at all', ctx.buildUnitsFor(bread, {form:'Bowl'}), 0);
  t.equal('an explicit count wins', ctx.buildUnitsFor(bread, {form:'Sandwich', carbUnits:3}), 3);
});
