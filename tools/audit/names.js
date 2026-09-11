'use strict';
/* ============================================================
   Does a dish contain what its name says it does?

   A template lists a handful of ingredients per slot and the planner widens
   that to family siblings, which is what stops the same six dinners coming
   round forever. The title is then written from whatever was chosen. When
   those two disagree you get a card reading "Baked Oatmeal" over a croissant,
   greek yogurt and nine grams of peanuts.

   WHAT THIS MEASURES

   Every distinct dish built across N shuffles is read against its own title.
   A title word that names a food is a promise; the check is whether the plate
   keeps it.

   The reading below is hand-written and deliberately kept separate from the
   NAME_PROMISES table the app uses, so that the audit cannot pass by agreeing
   with the code. That also means it is only as good as the words in it — if a
   slot is missing from this list it is not being checked at all, which is
   exactly how vegetables went unmeasured while they were the worst slot in
   the app. Add words here before trusting a low number.
   ============================================================ */

/* title word -> what the dish must then contain, tested against the joined
   names of everything on the plate */
const MEANS = {
  // ---- carbs
  oatmeal:/oat|muesli|granola/, oats:/oat|muesli|granola/, oat:/oat|muesli|granola/,
  rice:/rice/, quinoa:/quinoa/, couscous:/couscous/, pierogi:/pierogi|dumpling|wonton/,
  pasta:/pasta|orzo|penne|linguine|macaroni|noodle|ziti|rigatoni|fettuccine|shell|cavatappi|ravioli|tortellini|lasagna/,
  mac:/macaroni|pasta|shell|cavatappi|penne|rigatoni/,
  noodles:/noodle|pasta|orzo|penne|linguine|macaroni|spaghetti|ziti|rigatoni|fettuccine|shell|cavatappi|soba|udon|ravioli|tortellini|lasagna/,
  pho:/pho|rice noodle/, ramen:/ramen/,
  toast:/bread|sourdough|ezekiel|muffin|bagel|rye|texas|brioche|crumpet|thins|pita/,
  sandwich:/bread|roll|bun|bagel|muffin|sourdough|rye|ciabatta|baguette|hoagie|focaccia|kaiser|thins|texas|brioche|hawaiian|pita|naan|arepa|injera|cornbread/,
  burger:/bun|roll|brioche|hawaiian|thins|bread/,
  tacos:/tortilla|taco|chapati|lavash|wrap|arepa/, taco:/tortilla|taco|chapati|lavash|wrap|arepa/,
  burrito:/tortilla|wrap|lavash|flatbread|nori|seaweed/,
  quesadilla:/tortilla|wrap|lavash|flatbread|chapati|arepa/,
  fajitas:/tortilla|wrap|chapati|lavash/,
  nachos:/chip|cracker|popcorn|rice cake|apple/,
  pancakes:/pancake|flapjack|waffle|griddle|oat/, waffles:/waffle|pancake|flapjack|oat/,
  fries:/fries|potato|tots/, potato:/potato|yuca|cassava|fries|tots|gnocchi|hash brown/,
  parfait:/granola|oat|muesli|cereal/,

  // ---- proteins
  egg:/egg/, eggs:/egg/, huevos:/egg/, shakshuka:/egg/,
  scramble:/egg|tofu/, scrambled:/egg|tofu/,
  chicken:/chicken|rotisserie/, turkey:/turkey/,
  beef:/beef|steak|brisket|chuck|bison|sirloin|short rib|round|tri-tip|flank|skirt|filet|oxtail|pastrami|corned/,
  steak:/steak|beef|sirloin|ribeye|strip|flank|skirt|filet|tri-tip|flat iron/,
  salmon:/salmon|char/, tuna:/tuna|ahi/, tofu:/tofu/, edamame:/edamame/,
  yogurt:/yogurt|skyr|kefir|labneh/, cottage:/cottage|quark|queijo/, cheddar:/cheddar|curds/,
  sausage:/sausage|kielbasa|andouille|bratwurst|chorizo|hot dog|salami|pepperoni/,
  bean:/bean|pea|lentil|chickpea|hummus|falafel/, falafel:/fava|chickpea|bean/,

  // ---- vegetables. Absent until late 2026, which is why the number looked
  //      better than it was: nothing here was ever checked.
  cucumber:/cucumber/, broccoli:/broccoli/, cauliflower:/cauliflower/,
  cabbage:/cabbage|slaw|napa|savoy|bok choy/, slaw:/slaw|cabbage|napa|bok choy/,
  lettuce:/lettuce|romaine|iceberg|radicchio|endive|frisée|frisee/,
  tomato:/tomato/, peppers:/pepper/, spinach:/spinach/, kale:/kale/,
  zucchini:/zucchini/, mushroom:/mushroom|cremini|shiitake|portobello/,
  asparagus:/asparagus/, celery:/celery/,

  // ---- sauces
  buffalo:/buffalo/, gravy:/gravy|cream|butter|milk/, alfredo:/alfredo/, pesto:/pesto/,
  teriyaki:/teriyaki/, tikka:/tikka|masala|curry/, korma:/curry|korma|tikka/,
  massaman:/curry|massaman|peanut/, harissa:/harissa/, jerk:/jerk/,
  katsu:/katsu|tonkatsu/, caesar:/caesar/, hummus:/hummus|tahini/, ranch:/ranch/,
  chipotle:/chipotle|adobo/, queso:/queso|cheese|nacho/,
  verde:/verde|tomatillo|zhoug|green/,
};

/* A bowl claims no wrapper: "Burrito Bowl" is not promising a tortilla. */
const BOWL_WORDS = /^(burrito|burger|taco|tacos|sandwich|sushi)$/;

function run(app, opts){
  const runs = opts.runs || 600;
  const rows = JSON.parse(app.run(`(function(){
    var seen = {}, out = [];
    for (var i = 0; i < ${runs}; i++){
      generateSuggestion();
      (state.prep.meals || []).concat(state.prep.snacks || []).forEach(function(d){
        var title = (d.dish || '').trim();
        if (!title) return;
        var keys = ['protein','carb','fat','veg','fruit','sauce']
          .reduce(function(a, s){ return a.concat(d[s] || []); }, []).filter(Boolean);
        var names = keys.map(function(k){
          var f = findFoodAnySlot(k); return f ? f.name.toLowerCase() : k;
        });
        var sig = title + ' :: ' + names.join(', ');
        if (seen[sig]) return;
        seen[sig] = 1;
        out.push([title, names.join(', ')]);
      });
    }
    return JSON.stringify(out);
  })()`));

  const byWord = {};
  let flagged = 0;
  rows.forEach(([title, have])=>{
    const t = title.toLowerCase();
    const bowl = /\bbowl\b/.test(t);
    const missing = t.replace(/[^a-z ]/g, ' ').split(/\s+/)
      .filter(w => MEANS[w])
      .filter(w => !(bowl && BOWL_WORDS.test(w)))
      .filter(w => !MEANS[w].test(have));
    if (!missing.length) return;
    flagged++;
    missing.forEach(w => { (byWord[w] = byWord[w] || []).push(title + ' :: ' + have); });
  });

  return {
    headline: rows.length + ' distinct dishes, ' + flagged + ' whose name outran the plate'
      + ' (' + (100 * flagged / (rows.length || 1)).toFixed(2) + '%)',
    detail: Object.entries(byWord).sort((a, b) => b[1].length - a[1].length)
      .map(([w, list]) => '  ' + w + ' ×' + list.length + '\n' +
        list.slice(0, 3).map(x => '     ' + x).join('\n')),
    failed: flagged / (rows.length || 1) > 0.01,
  };
}

module.exports = {
  name: 'names',
  describe: 'does a dish contain what its name says',
  run,
};
