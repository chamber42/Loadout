'use strict';
/* Covers the family map in 05-food-families.js — which foods can stand in
   for which, and which cannot share a plate.

   A food with no family is invisible to substitution: it appears only where
   a recipe names it outright, and nothing can replace it when it is disliked
   or unavailable. Twenty-six foods were in that position, most of them
   ordinary vegetables — asparagus, green beans, celery, corn.

   The reason to be careful is that the map does two jobs: family also means
   "not two of these on one plate". MIXABLE is what separates them, and every
   vegetable family added here belongs to it — asparagus and green beans can
   swap for each other AND sit side by side, which is how vegetables work. */

const fs = require('fs');
const vm = require('vm');
const {jsFile, suite} = require('./helpers');

function rig(){
  const ctx = {console};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(jsFile('05-food-families.js'), 'utf8'), ctx);
  const src = fs.readFileSync(jsFile('23-suggested-loadout.js'), 'utf8');
  const at = src.indexOf('  function familyClashPair(');
  const end = src.indexOf('\n  }', at) + 4;
  if (at < 0) throw new Error('food-families: familyClashPair moved');
  vm.runInContext(src.slice(at, end) +
    '\nglobalThis.api = {FAMILY, MIXABLE, GROUP, familyClashPair};', ctx);
  return ctx.api;
}

const food = key => ({key, name:key});

module.exports = () => suite('what can stand in for what', t => {
  const {FAMILY, MIXABLE, familyClashPair} = rig();
  const sameFamily = (a, b) => FAMILY[a] && FAMILY[a] === FAMILY[b];
  const together = (a, b) => !familyClashPair(food(a), food(b));

  t.section('vegetables that had no family have one now');
  t.check('asparagus and green beans are interchangeable', sameFamily('asparagus','greenbeans'));
  t.check('so are celery and fennel', sameFamily('celery','fennel'));
  t.check('and sweet corn, frozen or not', sameFamily('corn','cornfroz'));
  t.check('and the artichoke with the hearts of palm', sameFamily('artichoke','heartsofpalm'));
  t.check('water chestnuts with bamboo shoots', sameFamily('waterchest','bambooshoot'));

  t.section('but they can still share a plate');
  /* This is the whole reason it was left alone until MIXABLE was checked. */
  t.check('asparagus and green beans together', together('asparagus','greenbeans'));
  t.check('celery and cucumber together', together('celery','cucumber'));
  t.check('garlic and ginger together', together('garlic','ginger'));
  t.check('every new vegetable family is mixable',
    ['greenstem','corn','crisp','thistle','crunchveg','aromatic'].every(f => MIXABLE.has(f)),
    ['greenstem','corn','crisp','thistle','crunchveg','aromatic'].filter(f => !MIXABLE.has(f)));

  t.section('the starches join the one-starch-per-plate rule');
  /* Gnocchi is potato. Being family-less let it sit next to rice, which is
     two starches whatever the packet calls them. */
  t.check('gnocchi is filed with the potatoes', FAMILY['gnocchi'] === 'potato');
  t.check('so is a plantain', FAMILY['plantain'] === 'potato');
  t.check('and gnocchi no longer shares a plate with rice', !together('gnocchi','rice'));
  t.check('nor with a potato', !together('gnocchi','potato'));

  t.section('shellfish are on the same shelf');
  t.check('shrimp with scallops', sameFamily('shrimp','scallops'));
  t.check('crab with lobster', sameFamily('crab','lobster'));
  t.check('and sardines with the other oily fish', sameFamily('sardines','herring'));

  t.section('what is left alone is left alone on purpose');
  /* Nothing substitutes for nutritional yeast or for nori. */
  ['nutyeast','seaweed','meatball'].forEach(k=>{
    t.check(k + ' stays a one-off', !FAMILY[k], FAMILY[k]);
  });
});
