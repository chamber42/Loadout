'use strict';
/* ============================================================
   LOADOUT - BRINGING A RECIPE IN FROM THE WEB

   The dish library is rich and completely closed: nobody can bring their
   grandmother's chili in. This opens it, one page at a time, at the user's
   own request.

   WHAT A LOADOUT RECIPE ACTUALLY IS

   Not an ingredient list. A recipe here is a TEMPLATE — candidate foods
   per slot, which the planner then picks from and portions against your
   targets. That is the whole engine: the same dish comes out at different
   sizes for a cut and a bulk.

   A recipe on the web is the opposite shape: fixed ingredients, fixed
   quantities, fixed yield. Importing one verbatim would drop a rigid
   four-serving dish into an app whose entire value is re-sizing.

   So an import is translated rather than copied. Each ingredient is
   matched to a food already in the library, bucketed into the slot that
   food belongs to, and the result is a template Loadout can portion —
   your chili, sized to your numbers. The quantities on the page are used
   to decide what the dish IS, and then discarded, because the whole point
   is that the app works out the amounts.

   That translation is also why this sits comfortably on the right side of
   copyright. What is taken is which foods a dish contains — a listing of
   ingredients, which the US Copyright Office states plainly is not
   protected (Circular 33). What is NOT taken is the prose: no headnote, no
   story, no description, no photograph.

   WHERE IT CAN GO AFTERWARDS

   Nowhere, by design. An imported recipe lands in one person's book on
   one device. There is no sync, no server, and deliberately no way to
   share a recipe — the app should never become a route for passing
   copyrighted writing around. Every import carries its source URL
   permanently, so an imported dish can never be mistaken for one of
   Loadout's own and credit travels with it. `_imported` marks them, so
   any feature that ever publishes anything has an explicit thing to check.
   ============================================================ */

  /* Sent so the sites being read can see who is asking. Same courtesy the
     Open Food Facts calls extend, and the same reason: a caller that
     identifies itself can be contacted rather than simply blocked. */
  const RECIPE_UA = 'Loadout/1.0 (' + (typeof LOADOUT_CONTACT !== 'undefined'
    ? LOADOUT_CONTACT : 'https://github.com/chamber42/Loadout') + ')';

  /* One page, on request. Never a crawl: nothing here follows a link, and
     nothing runs without somebody pasting a URL. */
  async function fetchRecipePage(url){
    const ctrl = new AbortController();
    const bail = setTimeout(()=>ctrl.abort(), 15000);
    try{
      const res = await fetch(url, {signal: ctrl.signal,
        headers:{'Accept':'text/html', 'User-Agent':RECIPE_UA}});
      clearTimeout(bail);
      if (!res.ok) return {httpError: res.status};
      return {html: await res.text()};
    }catch(err){
      clearTimeout(bail);
      return {netError: (err && err.name === 'AbortError') ? 'timeout' : 'unreachable'};
    }
  }

  /* ---- reading the structured data -------------------------------------

     Only JSON-LD, and only schema.org/Recipe. Recipe sites publish this
     deliberately, for machines — it is what produces Google's recipe
     cards — so reading it is using a channel the publisher opened rather
     than picking a page apart.

     When a page carries none, this gives up and says so. Falling back to
     scraping the rendered HTML would mean guessing at someone's markup,
     breaking whenever they redesign, and taking data they did not offer
     for the purpose. A clear refusal is the better failure. */
  function extractRecipeJsonLd(html){
    const blocks = [];
    const re = /<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let m;
    while ((m = re.exec(html))){
      try{ blocks.push(JSON.parse(m[1].trim())); }
      catch(e){ /* one malformed block must not lose the others */ }
    }

    /* Recipes hide in three shapes: the object itself, an array of
       objects, or inside an @graph. Walked rather than special-cased so a
       fourth shape does not need new code. */
    const seen = [];
    const walk = node => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)){ node.forEach(walk); return; }
      const type = node['@type'];
      const isRecipe = type === 'Recipe' ||
        (Array.isArray(type) && type.indexOf('Recipe') >= 0);
      if (isRecipe) seen.push(node);
      if (node['@graph']) walk(node['@graph']);
    };
    blocks.forEach(walk);
    return seen.length ? seen[0] : null;
  }

  /* ---- reading one ingredient line -------------------------------------

     "2 cups cooked brown rice" -> {qty: 2, unit: 'cup', name: 'cooked brown rice'}

     The quantity is parsed and then, deliberately, thrown away by the
     caller. It is read only because it has to be removed to leave a clean
     food name behind — "1 lb chicken breast" matches the library far
     better once the "1 lb" is gone. */
  const UNIT_WORDS = ('cup cups tablespoon tablespoons tbsp tsp teaspoon teaspoons ' +
    'ounce ounces oz pound pounds lb lbs gram grams g kg ml l litre liter ' +
    'clove cloves slice slices can cans package packages pinch dash handful ' +
    'sprig sprigs stalk stalks head bunch piece pieces large medium small').split(' ');

  const UNIT_SET = new Set(UNIT_WORDS);

  /* Vulgar fractions appear constantly in real recipes and parseFloat
     reads them as NaN. */
  const VULGAR = {'½':0.5,'⅓':1/3,'⅔':2/3,'¼':0.25,'¾':0.75,'⅕':0.2,'⅛':0.125,'⅜':0.375,'⅝':0.625,'⅞':0.875};

  function parseIngredient(line){
    const raw = String(line || '').trim();
    if (!raw) return null;

    let rest = raw.toLowerCase();
    let qty = null;

    /* Leading quantity: "2", "1.5", "1/2", "½", "1 1/2". */
    const num = rest.match(/^([\d]+\s+[\d]+\/[\d]+|[\d]+\/[\d]+|[\d]*\.?[\d]+|[½⅓⅔¼¾⅕⅛⅜⅝⅞])\s*/);
    if (num){
      const t = num[1].trim();
      if (VULGAR[t]) qty = VULGAR[t];
      else if (t.indexOf('/') >= 0){
        const parts = t.split(/\s+/);
        const frac = parts[parts.length - 1].split('/');
        qty = (parts.length > 1 ? parseFloat(parts[0]) : 0) +
              (parseFloat(frac[0]) / parseFloat(frac[1]));
      } else qty = parseFloat(t);
      rest = rest.slice(num[0].length);
    }

    /* A unit word immediately after the number, if there is one. */
    let unit = null;
    const firstWord = rest.match(/^([a-z]+)\.?\s+/);
    if (firstWord && UNIT_SET.has(firstWord[1])){
      /* Normalised to the singular so "cup" and "cups" are one thing. The
         unit is read only to strip it off the front of the name, but a
         field that reports two spellings of the same measure is a trap for
         anything that ever reads it. */
      const w = firstWord[1];
      unit = (w.length > 2 && w.slice(-1) === 's' && UNIT_SET.has(w.slice(0, -1)))
        ? w.slice(0, -1) : w;
      rest = rest.slice(firstWord[0].length);
    }

    /* Everything in brackets is a parenthetical — "(about 2 cups)",
       "(optional)" — and everything after a comma is usually preparation:
       "onion, finely diced". Neither helps identify the food. */
    let name = rest.replace(/\([^)]*\)/g, ' ').split(',')[0];
    name = name.replace(/\b(fresh|freshly|chopped|diced|minced|sliced|grated|shredded|ground|cooked|raw|boneless|skinless|large|medium|small|ripe|optional|to taste|plus more|divided)\b/g, ' ');
    name = name.replace(/[^a-z\s-]/g, ' ').replace(/\s+/g, ' ').trim();

    if (!name) return null;
    return {qty: qty, unit: unit, name: name, raw: raw};
  }

  /* ---- matching a name to something the app knows ----------------------

     Scored rather than exact: a page says "boneless skinless chicken
     breasts" and the library says "Chicken Breast (raw)". What matters is
     how much of the library food's name the ingredient actually contains.

     Deliberately conservative. A wrong match is worse than no match — it
     silently puts salmon in somebody's chili — so anything below the
     threshold is reported as unmatched and shown to the person to fix. */
  const MATCH_MIN_SCORE = 0.5;

  /* Words that appear in library food names but say nothing about which
     food it is. A match resting only on one of these is not a match at
     all: "ground cumin" shares a word with "Ground Beef 93/7" and is not
     remotely the same thing. Checked separately from the score, so the
     rule holds however the threshold is later tuned. */
  const GENERIC_FOOD_WORDS = new Set([
    'ground','raw','cooked','canned','dry','dried','frozen','fresh',
    'whole','light','low','free','plain','sliced','shredded','grated',
    'lean','extra','virgin','pure','natural','organic','reduced',
  ]);

  function foodSlots(){
    return [
      {slot:'protein', list: FOODS.protein},
      {slot:'carb',    list: FOODS.carbs},
      {slot:'fat',     list: FOODS.fat},
      {slot:'veg',     list: FOODS.veg},
      {slot:'fruit',   list: FOODS.fruit},
      {slot:'sauce',   list: FOODS.sauce},
    ];
  }

  /* The library's display names carry qualifiers the page will not —
     "(raw)", "93/7", "b/s". Stripped before comparison. */
  function foodWords(name){
    return String(name).toLowerCase()
      .replace(/\([^)]*\)/g, ' ')
      .replace(/[^a-z\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2);
  }

  function matchIngredient(name){
    const words = new Set(foodWords(name));
    if (!words.size) return null;

    let best = null;
    foodSlots().forEach(function(group){
      (group.list || []).forEach(function(food){
        const fw = foodWords(food.name);
        if (!fw.length) return;
        let hit = 0, distinctive = false;
        fw.forEach(function(w){
          if (!words.has(w)) return;
          hit++;
          if (!GENERIC_FOOD_WORDS.has(w)) distinctive = true;
        });
        if (!hit) return;
        /* At least one of the overlapping words has to actually name the
           food. Without this, a library entry with a generic word in it
           can be reached by any ingredient sharing only that word. */
        if (!distinctive) return;
        /* Share of the LIBRARY food's words that the ingredient contains.
           Scoring the other way round would let a long ingredient line
           match everything a little. */
        const score = hit / fw.length;
        if (!best || score > best.score){
          best = {food: food, slot: group.slot, score: score};
        }
      });
    });

    return (best && best.score >= MATCH_MIN_SCORE) ? best : null;
  }

  /* ---- building the template ------------------------------------------- */

  function siteOf(url){
    try{ return String(url).split('/')[2].replace(/^www\./, ''); }
    catch(e){ return ''; }
  }

  /* schema.org allows a bare string, an array, or HowToStep objects. Steps
     are kept because they are functional directions; the description and
     headnote are not read at all. */
  function stepsFrom(schema){
    const src = schema.recipeInstructions;
    if (!src) return [];
    const out = [];
    const take = n => {
      if (!n) return;
      if (typeof n === 'string'){ out.push(n.trim()); return; }
      if (Array.isArray(n)){ n.forEach(take); return; }
      if (n.text) out.push(String(n.text).trim());
      else if (n.itemListElement) take(n.itemListElement);
    };
    take(src);
    return out.filter(Boolean).map(s => s.replace(/<[^>]*>/g, '').trim()).filter(Boolean);
  }

  function ingredientsFrom(schema){
    const src = schema.recipeIngredient || schema.ingredients;
    if (!src) return [];
    return (Array.isArray(src) ? src : [src]).map(String);
  }

  /* Turns a parsed page into something the planner can portion.

     Returns the template plus the working, because the matching is
     imperfect by nature and the person has to be able to see what it
     decided before they keep it. */
  function buildImportedRecipe(schema, url){
    const name = String(schema.name || '').trim() || 'Imported recipe';
    const lines = ingredientsFrom(schema);
    if (!lines.length) return {ok: false, why: 'That page has no ingredient list in its recipe data.'};

    const slots = {protein:[], carb:[], fat:[], veg:[], fruit:[], sauce:[]};
    const matched = [], unmatched = [];

    lines.forEach(function(line){
      const parsed = parseIngredient(line);
      if (!parsed){ unmatched.push({raw: line}); return; }
      const hit = matchIngredient(parsed.name);
      if (!hit){ unmatched.push({raw: line, name: parsed.name}); return; }
      if (slots[hit.slot].indexOf(hit.food.key) < 0) slots[hit.slot].push(hit.food.key);
      matched.push({raw: line, name: parsed.name, key: hit.food.key,
                    label: hit.food.name, slot: hit.slot, score: hit.score});
    });

    if (!matched.length){
      return {ok: false, why: 'None of those ingredients matched anything in the library.'};
    }

    const recipe = {
      name: name,
      /* The shape the planner expects, so an imported dish is portioned by
         exactly the same code as a built-in one and needs no special case
         anywhere downstream. */
      pattern: name,
      form: 'Imported',
      slots: ['lunch','dinner'],
      crave: [],
      season: [],
      protein: slots.protein, carb: slots.carb, fat: slots.fat,
      veg: slots.veg, fruit: slots.fruit, sauce: slots.sauce,

      /* Provenance, permanently attached. An imported dish can never be
         mistaken for one of Loadout's own, credit travels with the data,
         and any feature that ever publishes anything has this to check. */
      _imported: true,
      _source: {
        url: String(url),
        site: siteOf(url),
        title: name,
        importedAt: new Date().toISOString(),
      },
      /* Functional directions only. No description, no headnote, no
         photograph — see the note at the top of this file. */
      _steps: stepsFrom(schema),
    };

    return {ok: true, recipe: recipe, matched: matched, unmatched: unmatched};
  }

  /* ---- the whole journey ----------------------------------------------- */

  async function importRecipeFromUrl(url){
    const clean = String(url || '').trim();
    if (!/^https?:\/\/\S+\.\S+/.test(clean)){
      return {ok: false, why: 'That does not look like a web address.'};
    }
    const res = await fetchRecipePage(clean);
    if (res.netError) return {ok: false, why: res.netError === 'timeout'
      ? 'That page took too long to answer.'
      : 'Could not reach that page.'};
    if (res.httpError) return {ok: false, why: 'That page returned an error (' + res.httpError + ').'};

    const schema = extractRecipeJsonLd(res.html);
    if (!schema) return {ok: false, why: 'That page does not publish recipe data Loadout can read.'};

    return buildImportedRecipe(schema, clean);
  }

  /* ---- keeping them --------------------------------------------------- */

  /* Merged into RECIPES on load so every screen that lists, searches,
     scores or portions a recipe treats an imported one identically. */
  function mergeImportedRecipes(){
    if (typeof state === 'undefined' || typeof RECIPES === 'undefined') return;
    const kept = state.importedRecipes;
    if (!Array.isArray(kept) || !kept.length) return;
    const have = new Set(RECIPES.map(r => r.name));
    kept.forEach(function(r){
      if (r && r.name && !have.has(r.name)){ RECIPES.push(r); have.add(r.name); }
    });
  }

  function saveImportedRecipe(recipe){
    if (typeof state === 'undefined' || !recipe || !recipe.name) return false;
    state.importedRecipes = state.importedRecipes || [];
    /* Re-importing the same dish replaces it rather than stacking a second
       copy with the same name, which would make the recipe book ambiguous
       and the planner's name lookup pick one at random. */
    state.importedRecipes = state.importedRecipes.filter(r => r.name !== recipe.name);
    state.importedRecipes.push(recipe);
    if (typeof RECIPES !== 'undefined'){
      const at = RECIPES.findIndex(r => r.name === recipe.name);
      if (at >= 0) RECIPES[at] = recipe; else RECIPES.push(recipe);
    }
    return true;
  }

  function forgetImportedRecipe(name){
    if (typeof state === 'undefined' || !Array.isArray(state.importedRecipes)) return;
    state.importedRecipes = state.importedRecipes.filter(r => r.name !== name);
    if (typeof RECIPES !== 'undefined'){
      const at = RECIPES.findIndex(r => r.name === name && r._imported);
      if (at >= 0) RECIPES.splice(at, 1);
    }
  }

  window.importRecipeFromUrl   = importRecipeFromUrl;
  window.extractRecipeJsonLd   = extractRecipeJsonLd;
  window.parseIngredient       = parseIngredient;
  window.matchIngredient       = matchIngredient;
  window.buildImportedRecipe   = buildImportedRecipe;
  window.mergeImportedRecipes  = mergeImportedRecipes;
  window.saveImportedRecipe    = saveImportedRecipe;
  window.forgetImportedRecipe  = forgetImportedRecipe;
