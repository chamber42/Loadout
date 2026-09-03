'use strict';
/* Covers the barcode cache in 21-food-lookup.js.

   A barcode always names the same product, so a rescan should cost nothing.
   The risks are the ones any cache has: serving a wrong answer forever, and
   growing without bound inside a localStorage blob that has to hold a food
   diary as well. Both are what this suite watches. */

const {loadFunctions, suite} = require('./helpers');

const NAMES = ['offCacheKey','offCacheGet','offCachePut'];
const DAY = 86400000;

function rig(cache){
  const state = {offCache: cache || {}};
  const ctx = loadFunctions('21-food-lookup.js', NAMES, {
    state, saveState(){},
    OFF_CACHE_MAX: 300, OFF_CACHE_FRESH_DAYS: 14,
  });
  ctx.state = state;
  return ctx;
}

module.exports = () => suite('off-cache', (t) => {

  t.section('remembering a product');
  {
    const m = rig();
    m.offCachePut('3017620422003', {name:'Nutella', kcal:539});
    const got = m.offCacheGet('3017620422003');
    t.check('a looked-up product comes back', !!got);
    t.equal('with its data intact', got.hit.name, 'Nutella');
    t.check('and counts as fresh', got.fresh);
    t.check('an unseen barcode returns nothing', m.offCacheGet('99999999') === null);
  }

  t.section('how a barcode is keyed');
  {
    const m = rig();
    m.offCachePut('3017620422003', {name:'Nutella'});
    /* The scanner strips separators before looking up, but a hand-typed
       number can arrive with them still in. Both are the same product. */
    t.check('spaces and dashes do not make a second entry',
      !!m.offCacheGet('301-762 042 2003'));
    t.equal('and only one entry is stored',
      Object.keys(m.state.offCache).length, 1);
    t.check('an empty code stores nothing',
      (m.offCachePut('', {name:'x'}), Object.keys(m.state.offCache).length === 1));
  }

  t.section('going stale');
  {
    const old = {'123': {hit:{name:'Old'}, at: Date.now() - 20 * DAY}};
    const m = rig(old);
    const got = m.offCacheGet('123');
    /* Still answered — waiting on the network to re-confirm what we already
       know helps nobody. It is just marked for a background refresh. */
    t.check('a stale entry is still answered', !!got);
    t.equal('with the remembered data', got.hit.name, 'Old');
    t.check('but is flagged as not fresh', !got.fresh);
  }
  {
    const recent = {'123': {hit:{name:'New'}, at: Date.now() - 3 * DAY}};
    const m = rig(recent);
    t.check('a recent entry is fresh', m.offCacheGet('123').fresh);
  }
  {
    const m = rig({'123': {hit:null, at: Date.now()}});
    t.check('a record with no product is ignored', m.offCacheGet('123') === null);
  }

  t.section('staying bounded');
  {
    /* This lives in the same localStorage as the food diary, so it cannot be
       allowed to grow forever. */
    const m = rig();
    for (let i = 0; i < 340; i++){
      m.state.offCache[String(1000000 + i)] = {hit:{name:'p'+i}, at: 1000 + i};
    }
    m.offCachePut('9999999', {name:'newest'});
    const n = Object.keys(m.state.offCache).length;
    t.check('the cache is capped', n <= 300, n);
    t.check('the newest entry survives', !!m.offCacheGet('9999999'));
    t.check('the oldest was evicted', m.offCacheGet('1000000') === null);
    t.check('a recent one was kept', !!m.offCacheGet('1000339'));
  }
});
