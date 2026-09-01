'use strict';
/* Covers usdaSearch in 43-usda.js against the real bundled table.

   Two things are being checked. That the ranking puts the plain form of a
   food first — someone typing "broccoli" wants "Broccoli, raw", not
   "Broccoli, raw, USDA commodity" — and that the hits come out in exactly
   the shape the Open Food Facts path produces, since every screen
   downstream assumes that shape and knows nothing about a second source. */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const {ROOT, extract, suite} = require('./helpers');

function rig(){
  const ctx = {console};
  vm.createContext(ctx);
  /* The generated table, run whole — it is one const assignment. */
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', '42-usda-data.js'), 'utf8'),
    ctx, {filename: '42-usda-data.js'});
  const src = fs.readFileSync(path.join(ROOT, 'js', '43-usda.js'), 'utf8');
  vm.runInContext(
    'let USDA_INDEX = null;\n' +
    ['usdaIndex', 'usdaScore', 'usdaHit', 'usdaSearch'].map(n => extract(src, n)).join('\n'),
    ctx, {filename: '43-usda.js'});
  /* `const USDA_ROWS` is a lexical binding in the script scope, not a
     property of the context object, so it has to be read back out. */
  ctx.USDA_ROWS = vm.runInContext('USDA_ROWS', ctx);
  return ctx;
}

module.exports = () => suite('usda search', t => {
  const ctx = rig();
  const search = ctx.usdaSearch;

  t.section('the table itself');
  t.check('several thousand foods are bundled',
    ctx.USDA_ROWS.length > 7000, ctx.USDA_ROWS.length);
  t.check('every row has a name', ctx.USDA_ROWS.every(r => !!r[0]));
  t.check('nothing exceeds what food can carry per 100g',
    ctx.USDA_ROWS.every(r => r[1] <= 950));
  t.check('macros are never negative',
    ctx.USDA_ROWS.every(r => r[2] >= 0 && r[3] >= 0 && r[4] >= 0));

  t.section('the plain form of a food comes first');
  [
    ['broccoli', 'Broccoli, raw'],
    ['spinach',  'Spinach, raw'],
    ['banana',   'Bananas, raw'],
  ].forEach(([q, want]) => {
    const top = search(q).slice(0, 3).map(h => h.name);
    t.check(`"${q}" surfaces ${want} in the top three`, top.includes(want), top);
  });

  t.section('known values are right');
  {
    const oil = search('olive oil').find(h => /^Oil, olive/.test(h.name));
    t.check('olive oil is nearly pure fat', oil && oil.fat >= 99 && oil.kcal > 850, oil);
  }
  {
    const rice = search('rice white long-grain regular raw')[0];
    t.check('raw white rice is a carbohydrate near 80g',
      rice && rice.carbs > 75 && rice.carbs < 85, rice && rice.carbs);
  }

  t.section('multi-word queries');
  {
    const hits = search('chicken breast roasted');
    t.check('every hit contains all three words',
      hits.length > 0 && hits.every(h => {
        const n = h.name.toLowerCase();
        return n.includes('chicken') && n.includes('breast') && n.includes('roasted');
      }), hits.map(h => h.name));
  }

  t.section('the hit shape matches the Open Food Facts path');
  {
    const h = search('broccoli')[0];
    ['code','name','brand','serving','servingG','kcal','protein','carbs','fat',
     'fibre','sodium','partial','suspect','impliedKcal'].forEach(k =>
      t.check(`carries ${k}`, Object.prototype.hasOwnProperty.call(h, k)));
    t.equal('no barcode, so nothing tries to re-fetch it', h.code, '');
    t.equal('the source is named where the result is read', h.brand, 'USDA');
    t.equal('no serving is claimed that USDA did not publish', h.servingG, null);
    t.equal('flagged as USDA for anything that needs to know', h._usda, true);
  }
  {
    /* USDA carbohydrate is "by difference", and alcohol and organic acids
       carry calories no macro accounts for, so a sound record can disagree
       with its own Atwater sum. Flagging that would cry wolf over the
       better data. */
    t.check('nothing is ever marked suspect',
      search('beer').every(h => h.suspect === false));
  }
  {
    const withNull = ctx.USDA_ROWS.find(r => r[5] === null);
    t.check('fibre stays null where USDA published none, never zero',
      withNull && withNull[5] === null);
  }

  t.section('queries that should return nothing');
  t.equal('a single letter is not a search', search('b').length, 0);
  t.equal('empty', search('').length, 0);
  t.equal('nonsense', search('zzzzqqqq').length, 0);
  t.check('results are capped', search('a').length <= 8, search('a').length);
});
