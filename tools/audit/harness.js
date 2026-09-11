'use strict';
/* ============================================================
   Run the whole app outside a browser, so the planner can be exercised
   thousands of times without a phone.

   WHY THIS EXISTS

   The unit suites in test/ check one function at a time against stubs, and
   they are the right tool for that. They cannot answer the questions that
   only show up across many preps on many profiles: does a dish contain what
   its name says, does a meal land on its calorie target, does the number of
   ingredients someone asked for hold. Those are statistical, and the only
   honest way to answer them is to build a few thousand preps and look.

   HOW IT WORKS

   The app is plain scripts sharing one global scope, loaded in order by
   index.html. They are run here in a vm context with a fake DOM underneath
   — enough of one that the modules load and the renderers can be called,
   not a real one. So the code under audit is the code that ships, byte for
   byte, the same principle test/helpers.js works on.

   A few modules want browser APIs this fake does not have (the barcode
   scanner wants `location`, the timers want real event listeners). They are
   skipped and reported; nothing the planner needs is among them.
   ============================================================ */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');

/* A DOM element that answers to anything asked of it. Renderers write into
   these and read sizes back; nothing here needs to be accurate, only
   present, because the audits read the app's own data rather than pixels. */
function element(tag){
  const style = {};
  style.setProperty = (k, v) => { style[k] = v; };
  style.getPropertyValue = k => style[k] || '';
  style.removeProperty = k => { delete style[k]; };
  const node = {
    tagName: String(tag || 'div').toUpperCase(),
    style, dataset: {}, attributes: {}, children: [],
    innerHTML: '', textContent: '', value: '', checked: false,
    scrollTop: 0, offsetHeight: 0, hidden: false,
    classList: {add(){}, remove(){}, toggle(){}, contains(){ return false; }},
    appendChild(c){ node.children.push(c); return c; },
    removeChild(){}, remove(){}, replaceChildren(){}, scrollIntoView(){},
    insertBefore(c){ return c; }, insertAdjacentHTML(){},
    cloneNode(){ return element(tag); },
    setAttribute(k, v){ node.attributes[k] = v; },
    getAttribute(k){ return node.attributes[k]; },
    removeAttribute(){},
    addEventListener(){}, removeEventListener(){}, dispatchEvent(){ return true; },
    click(){}, focus(){}, blur(){}, matches(){ return false; },
    querySelector(){ return element(); }, querySelectorAll(){ return []; },
    closest(){ return null; }, getContext(){ return null; },
    getBoundingClientRect(){ return {top:0, left:0, right:0, bottom:0, width:0, height:0}; },
    animate(){ return {cancel(){}, finished: Promise.resolve()}; },
  };
  return node;
}

/* Load the app and hand back a context plus a way to run code inside it.
   Everything the app declares is `const` at the top level of a script, which
   lives in the context's lexical scope rather than on the context object —
   so reading a value out means evaluating an expression in there, which is
   what `run` is for. */
function load(){
  const store = new Map();
  const byId = {};
  const ctx = {
    console,
    setTimeout, clearTimeout, setInterval, clearInterval,
    requestAnimationFrame: cb => setTimeout(cb, 0), cancelAnimationFrame(){},
    Uint8Array, Uint8ClampedArray, TextEncoder, TextDecoder, URL,
    Blob: function(){}, FileReader: function(){},
    crypto: require('crypto').webcrypto,
    performance: {now: () => Date.now()},
    fetch: () => Promise.reject(new Error('the audit runs offline')),
    localStorage: {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => store.delete(k),
      clear: () => store.clear(),
      key: i => [...store.keys()][i],
      get length(){ return store.size; },
    },
    navigator: {userAgent:'audit', language:'en-US', onLine:true,
                clipboard:{writeText: () => Promise.resolve()}},
    matchMedia: () => ({matches:false, addEventListener(){}, removeEventListener(){},
                        addListener(){}, removeListener(){}}),
    alert(){}, confirm(){ return true; }, prompt(){ return null; },
    /* The scanner and the timers reach for these on load. */
    location: {href:'file:///audit', protocol:'file:', host:'', search:'', hash:'',
               pathname:'/audit', reload(){}, assign(){}, replace(){}},
    addEventListener(){}, removeEventListener(){}, dispatchEvent(){ return true; },
    scrollTo(){}, getComputedStyle: () => ({getPropertyValue: () => ''}),
    innerWidth: 390, innerHeight: 844, devicePixelRatio: 3,
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  ctx.document = {
    documentElement: element('html'), head: element('head'), body: element('body'),
    createElement: t => element(t), createElementNS: t => element(t),
    createTextNode: () => element('text'), createDocumentFragment: () => element('fragment'),
    /* Kept by id so a renderer's output can be read back after it runs. */
    getElementById: id => (byId[id] = byId[id] || element()),
    querySelector: () => element(), querySelectorAll: () => [],
    getElementsByClassName: () => [], getElementsByTagName: () => [],
    addEventListener(){}, removeEventListener(){}, dispatchEvent(){ return true; },
    readyState: 'complete', visibilityState: 'visible', hidden: false, cookie: '',
  };
  vm.createContext(ctx);

  const skipped = [];
  const loaded = [];
  const runFile = file => {
    try {
      vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, {filename: path.basename(file)});
      loaded.push(path.basename(file));
    } catch (e){
      skipped.push(path.basename(file) + ': ' + e.message);
    }
  };

  runFile(path.join(ROOT, 'icons.js'));
  fs.readdirSync(path.join(ROOT, 'js'))
    .filter(f => /^\d\d-.*\.js$/.test(f))
    .sort()
    .forEach(f => runFile(path.join(ROOT, 'js', f)));

  const run = expr => vm.runInContext(expr, ctx);
  if (typeof run('typeof generateSuggestion') !== 'string' || run('typeof generateSuggestion') !== 'function'){
    throw new Error('the planner did not load; skipped: ' + skipped.join(' | '));
  }
  return {ctx, byId, run, loaded, skipped};
}

/* A profile to plan against. The defaults are an ordinary cut; each audit
   overrides what it cares about. */
function profile(app, over){
  const p = Object.assign({
    goal: 'extreme_loss', activity: 'light', sex: 'male',
    bodyweight: 213, heightIn: 66, age: 28,
    finalKcal: 1820, prepServings: 3,
    discoveryMode: 'favorites', favorites: {}, dislikes: [],
    preferences: [], cravings: [],
    variety: {protein:2, carb:2, fat:2, veg:2},
  }, over || {});
  Object.keys(p).forEach(k=>{
    app.run('state[' + JSON.stringify(k) + '] = ' + JSON.stringify(p[k]) + ';');
  });
  return p;
}

module.exports = {load, profile, ROOT};
