'use strict';
/* Covers the import pipeline in 51-recipe-import.js: finding the recipe in
   a page's structured data, reading an ingredient line, matching it to the
   library, and building a template the planner can portion.

   Two things are being guarded. That nothing copyrightable is carried —
   no description, no headnote, no photograph — and that a wrong match
   never happens quietly, since silently putting salmon in a chili is worse
   than admitting a line could not be placed. */

const {loadFunctions, suite} = require('./helpers');

const FOODS = {
  protein: [
    {key:'chicken',   name:'Chicken Breast (raw)', kcal:120, protein:22.5, carbs:0, fat:2.6},
    {key:'beef93',    name:'Ground Beef 93/7 (raw)', kcal:152, protein:21, carbs:0, fat:7},
    {key:'blackbeans',name:'Black Beans (canned)', kcal:91, protein:6, carbs:16, fat:0.5},
  ],
  carbs: [
    {key:'rice',  name:'White Rice (dry)', kcal:365, protein:7.1, carbs:80, fat:0.7},
    {key:'onion', name:'Onion', kcal:40, protein:1.1, carbs:9.3, fat:0.1},
  ],
  fat:   [{key:'oil', name:'Olive Oil', kcal:884, protein:0, carbs:0, fat:100}],
  veg:   [{key:'tomatoes', name:'Tomatoes', kcal:18, protein:0.9, carbs:3.9, fat:0.2},
          {key:'peppers',  name:'Bell Peppers', kcal:26, protein:1, carbs:6, fat:0.3}],
  fruit: [{key:'berries', name:'Mixed Berries', kcal:50, protein:0.7, carbs:12, fat:0.3}],
  sauce: [{key:'salsa', name:'Salsa', kcal:29, protein:1.5, carbs:6.6, fat:0.2}],
};

function rig(){
  const RECIPES = [];
  const state = {importedRecipes: []};
  const ctx = loadFunctions('51-recipe-import.js', [
    'extractRecipeJsonLd', 'parseIngredient', 'foodSlots', 'foodWords',
    'matchIngredient', 'siteOf', 'stepsFrom', 'ingredientsFrom',
    'buildImportedRecipe', 'mergeImportedRecipes', 'saveImportedRecipe',
    'forgetImportedRecipe',
  ], {
    FOODS, RECIPES, state, Date,
    MATCH_MIN_SCORE: 0.5,
    GENERIC_FOOD_WORDS: new Set(['ground','raw','cooked','canned','dry','dried',
      'frozen','fresh','whole','light','low','free','plain','sliced','shredded',
      'grated','lean','extra','virgin','pure','natural','organic','reduced']),
    UNIT_SET: new Set(('cup cups tablespoon tablespoons tbsp tsp teaspoon teaspoons ' +
      'ounce ounces oz pound pounds lb lbs gram grams g kg ml l litre liter ' +
      'clove cloves slice slices can cans package packages pinch dash handful ' +
      'sprig sprigs stalk stalks head bunch piece pieces large medium small').split(' ')),
    VULGAR: {'½':0.5,'⅓':1/3,'⅔':2/3,'¼':0.25,'¾':0.75,'⅕':0.2,'⅛':0.125,'⅜':0.375,'⅝':0.625,'⅞':0.875},
  });
  ctx.RECIPES = RECIPES;
  ctx.state = state;
  return ctx;
}

const page = inner => `<html><head>
  <script type="application/ld+json">${JSON.stringify(inner)}</script>
  </head><body>ignored</body></html>`;

module.exports = () => suite('recipe import', t => {

  t.section('finding the recipe in a page');
  {
    const c = rig();
    const found = c.extractRecipeJsonLd(page({'@type':'Recipe', name:'Chili'}));
    t.equal('a bare Recipe object', found && found.name, 'Chili');
  }
  {
    const c = rig();
    const found = c.extractRecipeJsonLd(page([
      {'@type':'WebSite', name:'A Blog'}, {'@type':'Recipe', name:'Chili'}]));
    t.equal('one inside an array', found && found.name, 'Chili');
  }
  {
    const c = rig();
    const found = c.extractRecipeJsonLd(page({'@context':'x', '@graph':[
      {'@type':'Organization'}, {'@type':['Recipe','Thing'], name:'Chili'}]}));
    t.equal('one inside an @graph with a multi-type', found && found.name, 'Chili');
  }
  {
    const c = rig();
    /* A page with a broken block and a good one must still find the good
       one — one malformed script tag should not lose the recipe. */
    const html = '<script type="application/ld+json">{oops</script>' +
                 page({'@type':'Recipe', name:'Chili'});
    t.equal('a malformed block does not hide a valid one',
      c.extractRecipeJsonLd(html).name, 'Chili');
  }
  {
    const c = rig();
    t.equal('a page with no structured data', c.extractRecipeJsonLd('<html></html>'), null);
    t.equal('a page whose data is not a recipe',
      c.extractRecipeJsonLd(page({'@type':'Article', name:'x'})), null);
  }

  t.section('reading an ingredient line');
  {
    const c = rig();
    const p = c.parseIngredient('2 cups cooked brown rice');
    t.equal('quantity', p.qty, 2);
    t.equal('unit', p.unit, 'cup');
    t.equal('the food name is left clean', p.name, 'brown rice');
  }
  {
    const c = rig();
    t.equal('a vulgar fraction', c.parseIngredient('½ cup rice').qty, 0.5);
    t.equal('a written fraction', c.parseIngredient('1/2 cup rice').qty, 0.5);
    t.near('a mixed number', c.parseIngredient('1 1/2 cups rice').qty, 1.5, 0.001);
    t.equal('a decimal', c.parseIngredient('1.5 lb beef').qty, 1.5);
  }
  {
    const c = rig();
    t.equal('a parenthetical is dropped',
      c.parseIngredient('1 can (14 oz) black beans').name, 'black beans');
    t.equal('preparation after a comma is dropped',
      c.parseIngredient('1 onion, finely diced').name, 'onion');
    t.equal('and preparation words inside the name',
      c.parseIngredient('2 boneless skinless chicken breasts').name, 'chicken breasts');
  }
  {
    const c = rig();
    t.equal('a line with no food in it', c.parseIngredient('to taste'), null);
    t.equal('an empty line', c.parseIngredient('   '), null);
  }

  t.section('matching to the library');
  {
    const c = rig();
    const m = c.matchIngredient('boneless skinless chicken breasts');
    t.equal('a wordy line still finds the food', m && m.food.key, 'chicken');
    t.equal('and knows which slot it belongs in', m && m.slot, 'protein');
  }
  {
    const c = rig();
    t.equal('olive oil', c.matchIngredient('extra virgin olive oil').food.key, 'oil');
    t.equal('tomatoes', c.matchIngredient('crushed tomatoes').food.key, 'tomatoes');
    t.equal('black beans', c.matchIngredient('black beans rinsed').food.key, 'blackbeans');
  }
  {
    const c = rig();
    /* The important refusal. Something the library has never heard of must
       come back as nothing rather than as the nearest vaguely similar
       food. */
    t.equal('an unknown ingredient matches nothing',
      c.matchIngredient('smoked paprika'), null);
    t.equal('and so does noise', c.matchIngredient('xyzzy'), null);
  }
  {
    const c = rig();
    /* The silent-wrong-match this is all guarding against. "Ground Beef
       93/7 (raw)" and "ground cumin" share the word "ground", which names
       neither of them. A match resting only on a generic word is refused
       however the score lands. */
    t.equal('a spice does not become a meat', c.matchIngredient('ground cumin'), null);
    t.equal('nor does a preparation word alone', c.matchIngredient('freshly ground'), null);
    t.equal('while the real thing still matches',
      c.matchIngredient('ground beef').food.key, 'beef93');
  }

  t.section('building the template');
  {
    const c = rig();
    const res = c.buildImportedRecipe({
      '@type':'Recipe', name:'Weeknight Chili',
      description:'My grandmother made this every autumn and the smell...',
      image:'https://example.com/chili.jpg',
      recipeIngredient:['1 lb ground beef', '1 can black beans', '1 onion, diced',
                        '2 tbsp olive oil', '1 can crushed tomatoes', '2 tsp smoked paprika'],
      recipeInstructions:[{'@type':'HowToStep', text:'Brown the beef.'},
                          {'@type':'HowToStep', text:'Add everything else.'}],
    }, 'https://www.example.com/recipes/chili');

    t.equal('it builds', res.ok, true);
    t.equal('named from the page', res.recipe.name, 'Weeknight Chili');
    t.check('protein slot filled', res.recipe.protein.indexOf('beef93') >= 0, res.recipe.protein);
    t.check('fat slot filled', res.recipe.fat.indexOf('oil') >= 0, res.recipe.fat);
    t.check('veg slot filled', res.recipe.veg.indexOf('tomatoes') >= 0, res.recipe.veg);
    t.equal('the unmatched line is reported, not silently dropped',
      res.unmatched.length, 1);
    t.check('and named', /paprika/.test(res.unmatched[0].raw), res.unmatched[0]);
  }
  {
    const c = rig();
    const res = c.buildImportedRecipe({
      '@type':'Recipe', name:'Chili',
      description:'A long personal story about autumn.',
      headline:'The best chili',
      image:'https://example.com/x.jpg',
      author:{name:'A Writer'},
      recipeIngredient:['1 lb ground beef'],
      recipeInstructions:['Brown the beef.'],
    }, 'https://example.com/c');

    /* The copyright line: ingredients and functional steps come across,
       expressive prose and photographs do not. */
    const json = JSON.stringify(res.recipe);
    t.check('no description is carried', json.indexOf('personal story') < 0);
    t.check('no headline is carried', json.indexOf('best chili') < 0);
    t.check('no image is carried', json.indexOf('x.jpg') < 0);
    t.check('no author is carried', json.indexOf('A Writer') < 0);
    t.equal('the steps are kept', res.recipe._steps.length, 1);
  }
  {
    const c = rig();
    const res = c.buildImportedRecipe({
      '@type':'Recipe', name:'Chili', recipeIngredient:['1 lb ground beef'],
    }, 'https://www.seriouseats.com/recipes/chili');
    t.equal('provenance is attached', res.recipe._imported, true);
    t.equal('with the source url', res.recipe._source.url,
      'https://www.seriouseats.com/recipes/chili');
    t.equal('and the site, without the www', res.recipe._source.site, 'seriouseats.com');
    t.check('and a timestamp', typeof res.recipe._source.importedAt === 'string');
  }
  {
    const c = rig();
    t.equal('a page with no ingredients is refused',
      c.buildImportedRecipe({'@type':'Recipe', name:'x'}, 'https://e.com/x').ok, false);
    t.equal('and one where nothing matched',
      c.buildImportedRecipe({'@type':'Recipe', name:'x',
        recipeIngredient:['smoked paprika', 'xyzzy']}, 'https://e.com/x').ok, false);
  }

  t.section('keeping and forgetting');
  {
    const c = rig();
    const res = c.buildImportedRecipe({'@type':'Recipe', name:'Chili',
      recipeIngredient:['1 lb ground beef']}, 'https://e.com/c');
    c.saveImportedRecipe(res.recipe);
    t.equal('it is stored', c.state.importedRecipes.length, 1);
    t.equal('and reaches the planner via RECIPES', c.RECIPES.length, 1);
  }
  {
    const c = rig();
    const make = () => c.buildImportedRecipe({'@type':'Recipe', name:'Chili',
      recipeIngredient:['1 lb ground beef']}, 'https://e.com/c').recipe;
    c.saveImportedRecipe(make());
    c.saveImportedRecipe(make());
    t.equal('re-importing replaces rather than duplicating',
      c.state.importedRecipes.length, 1);
    t.equal('in RECIPES too', c.RECIPES.filter(r => r.name === 'Chili').length, 1);
  }
  {
    const c = rig();
    const res = c.buildImportedRecipe({'@type':'Recipe', name:'Chili',
      recipeIngredient:['1 lb ground beef']}, 'https://e.com/c');
    c.saveImportedRecipe(res.recipe);
    c.forgetImportedRecipe('Chili');
    t.equal('forgetting removes it from storage', c.state.importedRecipes.length, 0);
    t.equal('and from the planner', c.RECIPES.length, 0);
  }
  {
    const c = rig();
    c.RECIPES.push({name:'Built-in Chili'});
    c.state.importedRecipes = [{name:'Built-in Chili', _imported:true}];
    c.mergeImportedRecipes();
    t.equal('an import never shadows a built-in of the same name',
      c.RECIPES.length, 1);
  }
});
