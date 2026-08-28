'use strict';
/* Runs every suite in this folder and exits non-zero if any check failed.
   `npm test` from the repo root. */

const SUITES = [
  './custom-food.test.js',
  './serving-size.test.js',
  './barcode-decode.test.js',
];

let passed = 0, failed = 0;
const failures = [];

for (const path of SUITES){
  const r = require(path)();
  passed += r.passed;
  failed += r.failed;
  failures.push(...r.failures);
}

console.log('\n' + '-'.repeat(58));
console.log(`  ${passed} passed, ${failed} failed`);
if (failures.length){
  console.log('\n  failures:');
  failures.forEach(f => console.log('    ' + f));
}
process.exit(failed ? 1 : 0);
