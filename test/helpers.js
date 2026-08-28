'use strict';
/* ============================================================
   Shared rig for the suites in this folder.

   The app is plain scripts sharing one global scope, loaded in
   order by index.html — there are no modules and nothing is
   exported. Rather than restructure working code to make it
   testable, these helpers lift named functions straight out of
   the source text and run them in a vm context with whatever
   stubs the suite needs. The code under test is therefore the
   code that ships, byte for byte.
   ============================================================ */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const jsFile = name => path.join(ROOT, 'js', name);

/* Pull one function's full source out of a file by brace matching. */
function extract(src, name){
  const at = src.indexOf('function ' + name + '(');
  if (at < 0) throw new Error(`extract: no function named ${name}`);
  let depth = 0;
  for (let j = src.indexOf('{', at); j < src.length; j++){
    if (src[j] === '{') depth++;
    else if (src[j] === '}' && --depth === 0) return src.slice(at, j + 1);
  }
  throw new Error(`extract: unbalanced braces reading ${name}`);
}

/* Load the named functions from a js/ file into a fresh context. */
function loadFunctions(file, names, sandbox){
  const src = fs.readFileSync(jsFile(file), 'utf8');
  const ctx = Object.assign({console, Uint8ClampedArray}, sandbox || {});
  vm.createContext(ctx);
  vm.runInContext(names.map(n => extract(src, n)).join('\n'), ctx, {filename: file});
  return ctx;
}

/* Run a whole file in a context — for modules that wire themselves up. */
function loadScript(file, sandbox){
  const ctx = Object.assign({console}, sandbox || {});
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(jsFile(file), 'utf8'), ctx, {filename: file});
  return ctx;
}

/* A suite is a name plus a body that reports through the passed-in `t`. */
function suite(name, body){
  const results = {passed: 0, failed: 0, failures: []};
  const t = {
    section(label){ console.log('\n  ' + label); },
    check(label, condition, got){
      if (condition){ results.passed++; console.log('    PASS  ' + label); }
      else {
        results.failed++;
        results.failures.push(name + ' :: ' + label);
        console.log('    FAIL  ' + label +
          (got === undefined ? '' : '  got: ' + JSON.stringify(got)));
      }
    },
    equal(label, got, want){
      const ok = Object.is(got, want) ||
        (typeof got === 'number' && typeof want === 'number' && Math.abs(got - want) < 1e-9);
      t.check(label, ok, ok ? undefined : {got, want});
    },
    near(label, got, want, tol){
      const ok = typeof got === 'number' && Math.abs(got - want) <= (tol === undefined ? 0.05 : tol);
      t.check(label, ok, ok ? undefined : {got, want});
    },
  };
  console.log('\n' + name);
  body(t);
  return results;
}

module.exports = {ROOT, jsFile, extract, loadFunctions, loadScript, suite};
