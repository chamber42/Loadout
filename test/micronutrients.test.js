'use strict';
/* Covers how fibreOf() and sodiumOf() pick a figure out of their stack of
   tables.

   The stack exists because no one source covers 850 foods: a scanned
   label first, then USDA Foundation Foods, then SR Legacy, then the
   hand-written overrides, then a family average. The order is the whole
   design, and it went wrong quietly. Both generated tables store a
   literal 0 where FDC published no fibre at all, so for a while lentils
   and chia — two of the highest-fibre foods in the app — reported none,
   because a 0 meaning "not measured" was being read as a measurement and
   returned ahead of the real number sitting one layer down.

   Nothing on screen looks broken when that happens. The day's fibre bar
   is simply lower than the food on the plate deserves, which is exactly
   the kind of wrong these checks are here to catch.

   sodiumOf() reads the same way off the same kind of table and had the
   same fault, with more at stake: salami, pepperoni, bologna, mayo and
   ranch all reported no sodium at all. */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const {loadFunctions, suite, jsFile} = require('./helpers');

/* The tables are object literals at file scope, not functions, so they are
   sliced out and evaluated rather than extracted by name like a function. */
function literal(src, decl){
  const at = src.indexOf(decl);
  if (at < 0) throw new Error('no declaration ' + decl);
  let depth = 0;
  for (let j = src.indexOf('{', at); j < src.length; j++){
    if (src[j] === '{') depth++;
    else if (src[j] === '}' && --depth === 0) return src.slice(at, j + 1) + ';';
  }
  throw new Error('unbalanced braces reading ' + decl);
}

function rig(){
  const ctx = loadFunctions('04-nutrition.js', ['nutriFam', 'fibreOf', 'sodiumOf'], {});
  const nutri = fs.readFileSync(jsFile('04-nutrition.js'), 'utf8');
  const fams  = fs.readFileSync(jsFile('05-food-families.js'), 'utf8');
  [
    literal(fams,  'const FAMILY'),
    literal(nutri, 'const NUTRI_FAMILY'),
    literal(nutri, 'const FIBRE_BY_FAMILY'),
    literal(nutri, 'const FIBRE_OVERRIDE'),
    literal(nutri, 'const SODIUM_BY_FAMILY'),
    literal(nutri, 'const SODIUM_OVERRIDE'),
    literal(nutri, 'const USDA_FF_FIBRE'),
    literal(nutri, 'const USDA_FIBRE'),
    literal(nutri, 'const USDA_FF_SODIUM'),
    literal(nutri, 'const USDA_SODIUM'),
  ].forEach(code => vm.runInContext(code, ctx, {filename: '04-nutrition.js'}));
  return ctx;
}

module.exports = () => suite('fibre and sodium', t => {
  const ctx = rig();
  const fibre = key => vm.runInContext('fibreOf', ctx)({key});
  const fibreOf = f => vm.runInContext('fibreOf', ctx)(f);

  t.section('a zero meaning "not measured" never wins');
  /* All four sit at 0 in USDA_FF_FIBRE and carry a real figure below it. */
  t.equal('chia reaches its override', fibre('chia'), 34.4);
  t.equal('lentils reach their override', fibre('lentils'), 30.5);
  t.equal('chickpeas reach their override', fibre('chickpeas'), 17.4);
  t.equal('blueberries reach the SR Legacy figure', fibre('berries'), 2.4);
  t.equal('raspberries are not fibre-free', fibre('raspberry'), 6.5);
  t.equal('a corn tortilla is not fibre-free', fibre('corntort6'), 6.3);

  t.section('a food that genuinely has none still reads none');
  t.equal('olive oil', fibre('oil'), 0);
  t.equal('chicken breast', fibre('chicken'), 0);
  t.equal('cheddar', fibre('cheddar'), 0);

  t.section('a scanned label is believed, including its zeros');
  t.equal('a packet stating 0g', fibreOf({key: 'lentils', fibre: 0}), 0);
  t.equal('a packet stating 4.5g', fibreOf({key: 'oil', fibre: 4.5}), 4.5);

  t.section('the layers below still rank in order');
  t.equal('an override beats the family average', fibre('strawbfroz'), 2.1);
  t.equal('the family average is the last resort', fibre('mangofroz'), 1.7);
  t.equal('an unknown food falls back to 1.0', fibre('nosuchfoodatall'), 1.0);

  t.section('sodium: the same zero, in the tables that matter most');
  const sodium = key => vm.runInContext('sodiumOf', ctx)({key});
  /* Five foods that read 0 mg and have four figures a layer below. */
  t.equal('salami', sodium('salami'), 1140);
  t.equal('pepperoni', sodium('pepperoni'), 1582);
  t.equal('bologna', sodium('bologna'), 1013);
  t.equal('ranch dressing', sodium('ranch'), 901);
  t.equal('mayonnaise', sodium('mayo'), 635);

  t.section('sodium: what genuinely has almost none is left alone');
  t.equal('olive oil stays at zero', sodium('oil'), 0);
  t.equal('avocado oil stays at zero', sodium('avocadooil'), 0);
  t.equal('blueberries carry their 1mg', sodium('berries'), 1);
  t.equal('a packet stating 0mg', vm.runInContext('sodiumOf', ctx)({key: 'salami', sodium: 0}), 0);

  t.section('no food in the table reports an impossible figure');
  /* `const` in a vm context is not a property of the context object, so the
     tables are read back by evaluating their names rather than indexing. */
  const table = name => vm.runInContext(name, ctx);
  const keys = new Set();
  ['USDA_FF_FIBRE', 'USDA_FIBRE', 'FIBRE_OVERRIDE']
    .forEach(name => Object.keys(table(name)).forEach(k => keys.add(k)));
  const bad = [...keys].filter(k => {
    const v = fibre(k);
    return !isFinite(v) || v < 0 || v > 100;
  });
  t.check('every known fibre key resolves to a sane number', bad.length === 0, bad.slice(0, 8));

  const sodKeys = new Set();
  ['USDA_FF_SODIUM', 'USDA_SODIUM', 'SODIUM_OVERRIDE']
    .forEach(name => Object.keys(table(name)).forEach(k => sodKeys.add(k)));
  /* Nothing edible reaches a tablespoon of salt in 100g. */
  const badSod = [...sodKeys].filter(k => {
    const v = sodium(k);
    return !isFinite(v) || v < 0 || v > 20000;
  });
  t.check('every known sodium key resolves to a sane number', badSod.length === 0, badSod.slice(0, 8));
});
