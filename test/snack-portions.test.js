'use strict';
/* Covers minPortion and foodFitsBudget — whether a snack sitting can be
   built from a recipe at all.

   The smallest portion worth plating is set per slot in calories: 140 kcal
   of carb, which is a sensible smallest serving of rice on a dinner plate.
   A snack sitting is worth a fraction of a main — 214 kcal on a 1820 kcal
   day — so 140 kcal of carb is most of the snack before anything else is on
   it. Held to a main meal's floors, all 57 snack recipes were ruled out and
   every snack in every prep came back improvised, unnamed and with no
   method. The floors now scale with the sitting. */

const {loadFunctions, suite} = require('./helpers');

const MEALS = [
  {key:'m1', name:'BREAKFAST', required:true,  share:0.294},
  {key:'m2', name:'LUNCH',     required:true,  share:0.294},
  {key:'m3', name:'DINNER',    required:true,  share:0.294},
  {key:'s1', name:'SNACK',     required:false, share:0.118},
];
const TARGET = 1820;
const mainKcal  = TARGET * 0.294;   // ~535
const snackKcal = TARGET * 0.118;   // ~214

const rice   = {key:'rice', name:'White Rice', kcal:365};
const chicken= {key:'chicken', name:'Chicken Breast', kcal:165};
const bagel  = {key:'bagel', name:'Bagel', kcal:275, unit:{g:95, whole:true}};

function rig(){
  return loadFunctions('24-daily-loadout.js',
    ['minPortion', 'floorScale', 'mainSittingKcal'], {
      MEALS,
      currentTargets: () => ({kcal: TARGET}),
      MIN_KCAL:  {protein:80, carb:140, fat:45, veg:12, fruit:40, sauce:6},
      MIN_GRAMS: {protein:25, carb:20, fat:5, veg:25, fruit:30, sauce:8},
      CENTREPIECE_KCAL: 140, CENTREPIECE_GRAMS: 100,
      isMeat: f => /chicken|beef/i.test(f.name),
      Math,
    });
}

module.exports = () => suite('what fits in a sitting', t => {
  const ctx = rig();
  const kcalOf = (food, grams) => food.kcal * grams / 100;

  t.section('a main meal is unchanged');
  t.equal('its floor is the full floor', ctx.floorScale(mainKcal), 1);
  t.near('140 kcal of rice, as before',
    kcalOf(rice, ctx.minPortion('carb', rice, mainKcal)), 140, 1);
  /* 140 kcal of chicken is 85g, which is under the 100g a centrepiece gets,
     so the raw-weight floor is the one that binds. */
  t.near('and a centrepiece protein still starts at 100g',
    ctx.minPortion('protein', chicken, mainKcal), 100, 0.5);

  t.section('a snack is not held to a dinner plate\'s floors');
  t.check('a centrepiece protein shrinks with the sitting too',
    ctx.minPortion('protein', chicken, snackKcal) < 60,
    ctx.minPortion('protein', chicken, snackKcal));
  const snackFloor = kcalOf(rice, ctx.minPortion('carb', rice, snackKcal));
  t.check('the carb floor no longer exceeds the whole sitting',
    snackFloor < snackKcal, {snackFloor, snackKcal});
  t.check('and it leaves room for the rest of the snack',
    snackFloor < snackKcal * 0.55, {snackFloor, room: snackKcal * 0.55});
  t.check('but it is still a portion, not a crumb', snackFloor > 30, snackFloor);

  t.section('the floor is scaled, never inflated');
  t.check('a sitting bigger than a main meal gets no bigger floor',
    ctx.floorScale(mainKcal * 3) === 1, ctx.floorScale(mainKcal * 3));
  t.check('and a tiny sitting still stops somewhere',
    ctx.floorScale(1) === 0.3, ctx.floorScale(1));

  t.section('the gram floor underneath does not scale');
  /* Below 20g of a carb you are weighing dust, whatever the sitting is. */
  const puffed = {key:'puffed', name:'Puffed Rice', kcal:380};
  t.check('20g stands even at a snack',
    ctx.minPortion('carb', puffed, snackKcal) >= 20, ctx.minPortion('carb', puffed, snackKcal));

  t.section('a snack still cannot carry a whole bagel');
  /* The reason foodFitsBudget exists: a unit food cannot be served in
     fractions, so its smallest serving is one of it. */
  const room = snackKcal * 0.55;
  t.check('one bagel is more than the sitting has', kcalOf(bagel, bagel.unit.g) > room,
    {bagel: kcalOf(bagel, bagel.unit.g), room});
});
