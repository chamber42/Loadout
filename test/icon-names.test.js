'use strict';
/* Every icon in this app is fetched by a string — ic('warn') in script, or
   <use href="#i-warn"> in markup — and a name that does not exist fails
   silently, painting nothing at all. There is no error, no warning, and on a
   dark panel a missing 12x12 glyph is easy to miss in review.

   This walks every call site and checks the name against the registry in
   icons.js. It exists because ic('alert') was very nearly shipped for a
   storage-failure toast; the icon is called 'warn'. */

const fs = require('fs');
const path = require('path');
const {ROOT, suite} = require('./helpers');

/* Comments are stripped first: icons.js documents itself with ic('yourkey'),
   which is prose, not a call. */
function stripComments(src, isHtml){
  if (isHtml) src = src.replace(/<!--[\s\S]*?-->/g, ' ');
  src = src.replace(/\/\*[\s\S]*?\*\//g, ' ');
  // line comments, but not the // in a url
  return src.replace(/(^|[^:@\w])\/\/[^\n]*/g, '$1 ');
}

function registry(){
  const src = fs.readFileSync(path.join(ROOT, 'icons.js'), 'utf8');
  const names = new Set();
  for (const m of src.matchAll(/[{,]\s*'([a-z0-9-]+)'\s*:/g)) names.add(m[1]);
  for (const m of src.matchAll(/[{,]\s*([a-z0-9-]+)\s*:\s*[`'"]/g)) names.add(m[1]);
  return names;
}

function sources(){
  const files = fs.readdirSync(path.join(ROOT, 'js'))
    .filter(f => f.endsWith('.js')).sort().map(f => path.join('js', f));
  files.push('index.html');
  return files.map(rel => ({
    rel,
    text: stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'), rel.endsWith('.html')),
  }));
}

function lineOf(text, index){ return text.slice(0, index).split('\n').length; }

module.exports = () => suite('icon names resolve', t => {
  const defined = registry();

  t.section('the registry itself parsed');
  /* Guards the guard: if the shape of icons.js changes and this stops finding
     names, every check below would pass by finding nothing to check. */
  t.check(`icons.js yielded ${defined.size} names`, defined.size > 100, defined.size);
  ['warn', 'check', 'close', 'edit', 'camera'].forEach(n =>
    t.check(`a known icon is present: ${n}`, defined.has(n)));
  t.check('an invented name is absent', !defined.has('definitely-not-an-icon'));

  const files = sources();

  t.section("every ic('...') names something that exists");
  {
    const bad = [];
    for (const {rel, text} of files){
      for (const m of text.matchAll(/\bic\(\s*'([^']+)'/g)){
        if (!defined.has(m[1])) bad.push(`${rel}:${lineOf(text, m.index)} ic('${m[1]}')`);
      }
    }
    t.check(bad.length ? bad.join('; ') : 'all ic() call sites resolve', bad.length === 0, bad);
  }

  t.section('every <use href="#i-..."> points at something');
  {
    const bad = [];
    for (const {rel, text} of files){
      for (const m of text.matchAll(/href="#i-([a-z0-9-]+)"/g)){
        if (!defined.has(m[1])) bad.push(`${rel}:${lineOf(text, m.index)} #i-${m[1]}`);
      }
    }
    t.check(bad.length ? bad.join('; ') : 'all sprite references resolve', bad.length === 0, bad);
  }
});
