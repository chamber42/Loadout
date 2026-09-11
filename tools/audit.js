'use strict';
/* ============================================================
   Run the app a few thousand times and check what comes out.

   WHY THIS EXISTS AS A SCRIPT AND NOT A TEST

   `npm test` answers questions with a yes or a no about one function at a
   time, and it should stay fast enough to run on every change. The questions
   here are statistical and slow: does a dish contain what its name says,
   does a meal land on its calories, does the number of ingredients someone
   asked for hold. They are answered by building thousands of preps across
   the whole space of settings a user can reach, and the answer is a rate
   rather than a pass.

   Every one of these found a real bug that the unit suites could not have:
   a croissant in a baked oatmeal, a meal at twice its calories, a main
   served with no fat at all, snacks that were never dishes.

   USAGE

     npm run audit                  all of them, default sample
     npm run audit -- names         one of them
     npm run audit -- --runs 2000   a bigger sample

   A bigger sample matters. These rates live in the tail — a run of 300 preps
   will happily report zero for something that is really one in a thousand,
   which is a mistake worth not making twice.
   ============================================================ */

const {load, profile} = require('./audit/harness');

const AUDITS = [
  require('./audit/names'),
  require('./audit/portions'),
  require('./audit/invariants'),
  require('./audit/options'),
];

/* The fuzzed profiles the portion and invariant audits plan against: the
   whole space someone can actually set, not one comfortable profile. */
const RANDOM_PROFILE = `
  function randOfArr(a){ return a[Math.floor(Math.random() * a.length)]; }
  function randomProfile(){
    state.goal = randOfArr(['extreme_loss','loss','maintain','gain']);
    state.activity = randOfArr(['sedentary','light','moderate','very','athlete']);
    state.sex = randOfArr(['male','female']);
    state.bodyweight = 100 + Math.floor(Math.random() * 180);
    state.heightIn = 58 + Math.floor(Math.random() * 20);
    state.age = 18 + Math.floor(Math.random() * 55);
    state.finalKcal = 1200 + Math.floor(Math.random() * 2400);
    state.restKcal = null; state.trainKcal = null;
    state.prepServings = 1 + Math.floor(Math.random() * 5);
    state.discoveryMode = randOfArr(['favorites','new']);
    state.variety = {protein:1 + Math.floor(Math.random() * 4), carb:1 + Math.floor(Math.random() * 4),
                     fat:1 + Math.floor(Math.random() * 3), veg:1 + Math.floor(Math.random() * 5)};
    state.preferences = [];
    var pool = ['vegan','vegetarian','pescatarian','dairyfree','glutenfree','nutfree',
                'eggfree','soyfree','porkfree','redmeatfree','poultryfree','fishfree','wholefoods'];
    var n = Math.floor(Math.random() * 3);
    for (var i = 0; i < n; i++){
      var p = randOfArr(pool);
      if (state.preferences.indexOf(p) < 0) state.preferences.push(p);
    }
    state.favorites = {};
    if (Math.random() < 0.6){
      ['protein','carb','fat','veg'].forEach(function(sl){
        var list = listFor(sl).filter(passesPrefs), favs = [];
        for (var i = 0; i < 1 + Math.floor(Math.random() * 6) && list.length; i++) favs.push(randOfArr(list).key);
        state.favorites[sl] = favs;
      });
    }
    state.dislikes = [];
    var every = ['protein','carb','fat','veg','fruit','sauce']
      .reduce(function(a, s){ return a.concat(listFor(s)); }, []);
    var d = Math.floor(Math.random() * 12);
    for (var i = 0; i < d; i++) state.dislikes.push(randOfArr(every).key);
    state.cravings = [];
  }
`;

function main(){
  const args = process.argv.slice(2);
  const runsAt = args.indexOf('--runs');
  const runs = runsAt >= 0 ? parseInt(args[runsAt + 1], 10) : null;
  const only = args.filter(a => !a.startsWith('--') && a !== String(runs));

  const wanted = only.length ? AUDITS.filter(a => only.includes(a.name)) : AUDITS;
  if (!wanted.length){
    console.log('no such audit. try: ' + AUDITS.map(a => a.name).join(', '));
    process.exit(2);
  }

  let failed = 0;
  wanted.forEach(audit=>{
    /* A fresh load per audit: these write all over `state`, and one audit's
       leftovers are the last thing the next one should be planning against. */
    const app = load();
    profile(app);
    app.run(RANDOM_PROFILE);
    console.log('\n' + audit.name.toUpperCase() + ' — ' + audit.describe);
    const t0 = Date.now();
    const out = audit.run(app, {runs: runs || undefined});
    console.log('  ' + out.headline + '   (' + ((Date.now() - t0) / 1000).toFixed(0) + 's)');
    (out.detail || []).forEach(line => console.log(line));
    if (out.failed){ failed++; console.log('  ^ worse than this audit expects'); }
  });

  console.log('');
  process.exit(failed ? 1 : 0);
}

main();
