'use strict';
/* ============================================================
   LOADOUT - SCREEN 2.8: SUGGESTED LOADOUT
   From app.js lines 9553-11334 of the original single file.
   Loaded in order by index.html; all files share one global scope,
   so declarations here are visible to every file listed after it.
   ============================================================ */

  /* =========================================================
     SCREEN 2.8: SUGGESTED LOADOUT
  ========================================================= */
  const suggestIntro = document.getElementById('suggestIntro');
  const suggestList = document.getElementById('suggestList');
  const btnUseSuggestion = document.getElementById('btnUseSuggestion');
  const btnShuffle = document.getElementById('btnShuffle');
  const btnBuildOwn = document.getElementById('btnBuildOwn');

  /* Largest sensible serving per slot. Without this the macro math will
     happily suggest 700g of black beans to hit a protein target. */
  const PORTION_CAP = { protein:350, carb:300, fat:90, veg:300, fruit:250, sauce:150 };
  /* Hard ceiling applied to the finished plan. Ultra-light foods (shirataki,
     cucumber) can otherwise be scaled to a kilo chasing a macro target. */
  const HARD_CAP = { protein:700, carb:600, fat:200, veg:600, fruit:500, sauce:300 };
  const SLOT_MACRO  = { protein:'protein', carb:'carbs', fat:'fat', veg:'kcal', fruit:'kcal', sauce:'kcal' };

  /* Grams this food would need to cover a main meal's share of the target */
  function servingFor(slot, food){
    const tg = currentTargets();
    const share = 0.30; // sized against a main meal
    const target = slot === 'veg'   ? tg.kcal * share * VEG_KCAL_SHARE
                 : slot === 'fruit' ? tg.kcal * share * FRUIT_KCAL_SHARE
                 : slot === 'sauce' ? tg.kcal * share * SAUCE_KCAL_CAP
                 : (slot === 'protein' ? tg.protein : slot === 'carb' ? tg.carbs : tg.fat) * share;
    return gramsFor(food, SLOT_MACRO[slot], target);
  }

  /* ---------------------------------------------------------
     FAVORITES & DISCOVERY
     "Similar" is judged three ways: shared flavour moods, shared dietary
     tags, and a comparable macro shape (what share of its calories comes
     from protein/carb/fat, plus how energy-dense it is). A food scoring
     high on all three eats like the favorite it's standing in for.
  --------------------------------------------------------- */
  function jaccard(a, b){
    const A = new Set(a || []), B = new Set(b || []);
    if (!A.size && !B.size) return 0;
    let inter = 0; A.forEach(x => { if (B.has(x)) inter++; });
    const uni = A.size + B.size - inter;
    return uni ? inter / uni : 0;
  }

  function macroShape(f){
    const p = f.protein*4, c = f.carbs*4, ft = f.fat*9;
    const tot = p + c + ft || 1;
    return [p/tot, c/tot, ft/tot, Math.min(f.kcal, 900)/900];
  }

  function similarity(a, b){
    const A = macroShape(a), B = macroShape(b);
    let d = 0; for (let i = 0; i < 4; i++) d += Math.abs(A[i] - B[i]);
    const macroSim = Math.max(0, 1 - d / 2.5);
    return jaccard(a.crave, b.crave)*3 + jaccard(a.tags, b.tags)*1.5 + macroSim*2;
  }

  /* When a dish leans on something the person hates, swap in the closest
     thing that plays the same role rather than dropping the dish. */
  const SUBSTITUTES = {
    mayo:["mayolight","yogurt0","tzatziki","avocado"],
    mayolight:["yogurt0","tzatziki","avocado"],
    bluecheese:["feta","goatcheese","parmesan"],
    gorgonzola:["feta","goatcheese","parmesan"],
    sourcream:["yogurt0","tzatzikilight","guac"],
    ranch:["ranchlight","tzatzikilight","vinlight"],
    caesar:["vinlight","balsamic","greekdress"],
    heavycream:["halfhalf","coconutmilk","milk"],
    butter:["oil","avocadooil","ghee"],
    cheddar:["cheddarred","jack","mozzarella"],
    parmesan:["romano","asiago","nutyeast"],
    mushrooms:["zucchini","peppers","broccoli"],
    olives:["pickles","artichokehearts","sundried"],
    tofu:["tempeh","chicken","chickpeas"],
    salmon:["trout","cod","chicken"],
    tunacan:["salmoncan","chicken","eggwhites"],
    cottage1:["yogurt0","skyr","ricotta"],
    yogurt0:["skyr","cottage1","kefir"],
  };

  function isMustUse(food){
    return !!food && (state.mustUse || []).includes(food.key);
  }

  /* Which slot does a given food key live in? */
  function slotOf(key){
    for (const sl of ['protein','carb','fat','veg','fruit','sauce']){
      if (listFor(sl).some(f => f.key === key)) return sl;
    }
    return null;
  }


  function isDisliked(food){
    return !!food && (state.dislikes || []).includes(food.key);
  }

  /* A stand-in for a blocked food, from the same slot and also not blocked */
  function substituteFor(slot, key){
    const opts = SUBSTITUTES[key] || [];
    for (const alt of opts){
      const f = listFor(slot).find(x=>x.key === alt);
      if (f && passesPrefs(f) && !isDisliked(f)) return f;
    }
    return null;
  }

  function favKeys(slot){ return (state.favorites && state.favorites[slot]) || []; }

  /* The candidate pool for a slot, given favorites and the chosen mode.
     Returns null when no favorites are set, so the full inventory is used. */
  function discoveryPool(slot, avail){
    const favs = favKeys(slot);
    if (!favs.length) return null;
    const favFoods = listFor(slot).filter(f => favs.includes(f.key));

    if (state.discoveryMode === 'favorites'){
      const pool = avail.filter(f => favs.includes(f.key));
      return pool.length ? pool : null;
    }

    // "Try something new" — everything EXCEPT the favorites, ranked by how
    // closely it resembles the closest favorite, then take the top slice.
    const candidates = avail.filter(f => !favs.includes(f.key));
    if (!candidates.length || !favFoods.length) return null;
    const scored = candidates
      .map(f => ({f, s: Math.max(...favFoods.map(g => similarity(f, g)))}))
      .sort((a, b) => b.s - a.s);
    const take = Math.min(candidates.length, Math.max(4, Math.ceil(candidates.length * 0.3)));
    return scored.slice(0, take).map(x => x.f);
  }

  /* The closest favorite to a given food — used to explain a suggestion */
  function nearestFavorite(slot, food){
    const favs = listFor(slot).filter(f => favKeys(slot).includes(f.key));
    if (!favs.length) return null;
    return favs.reduce((best, f) =>
      (!best || similarity(food, f) > similarity(food, best)) ? f : best, null);
  }

  /* Animal flesh only. Beans, lentils, tofu, dairy, eggs and powders are
     NOT counted here — the one-per-meal rule is about cooking two separate
     cuts of meat, which is the part that makes prep a chore. */
  function isMeat(food){
    const t = food.tags || [];
    return t.includes('meat') || t.includes('fish') || t.includes('shellfish');
  }

  /* What a full serving of this food would cost in calories. Dry legumes
     hit their protein target only at portions that swallow the whole meal,
     so anything that greedy gets passed over when better options exist. */
  function servingKcal(slot, food){
    return food.kcal * servingFor(slot, food) / 100;
  }

  /* ---------------------------------------------------------
     CAN THIS FOOD CARRY A MEAL?
     A protein target isn't missed by bad arithmetic, it's missed by the
     wrong ingredient. Plain kefir is 3.3g protein per 100g, so 45g of
     protein means 1.4kg of it — past every sane cap, and 560 kcal before
     anything else reaches the plate. Dry beans and oxtail have the same
     problem more quietly.

     What matters is what a food charges in calories per gram of protein:
     chicken breast about 5, salmon 10, cheddar 16, dry pinto beans 17. The
     ceiling is derived from the person's own numbers rather than fixed, so
     a bulk at 3000 kcal can afford ribeye and a hard cut at 1800 can't.
  --------------------------------------------------------- */
  function proteinCostKcal(food){
    if (!food || !(food.protein > 0)) return Infinity;
    return food.kcal / food.protein;
  }

  /* How much of a meal's calories may go on its protein source */
  const PROTEIN_KCAL_SHARE = 0.80;

  function proteinCostCeiling(){
    const tg = currentTargets();
    if (!tg.protein || !tg.kcal) return Infinity;
    return (tg.kcal / tg.protein) * PROTEIN_KCAL_SHARE;
  }

  /* Could this food deliver its share of the day's protein without eating
     the whole meal? Share cancels out, so one test serves every sitting. */
  function carriesProtein(food){
    return proteinCostKcal(food) <= proteinCostCeiling();
  }

  /* Keep the foods that can carry the meal, unless none can — a vegan on a
     hard cut may genuinely have nothing efficient left, and a plate of
     something beats a plate of nothing. */
  function preferCarriers(pool){
    if (!pool || pool.length < 2) return pool;
    const good = pool.filter(carriesProtein);
    return good.length ? good : pool;
  }

  /* Pick a food: honor prefs, respect favorites/discovery, prefer craving
     matches, keep portions realistic, and avoid repeats when asked.
     hardFilter is absolute — if nothing survives it, nothing is returned. */
  function pickFood(list, usedKeys, avoidRepeat, slot, hardFilter){
    let avail = list.filter(passesPrefs).filter(f => !isDisliked(f));
    if (hardFilter) avail = avail.filter(hardFilter);
    if (!avail.length) return null;

    // favorites / discovery narrows the field before anything else
    const special = slot ? discoveryPool(slot, avail) : null;
    let pool = (special && special.length) ? special : avail;
    if (hardFilter) pool = pool.filter(hardFilter);
    if (!pool.length) pool = avail;

    const onHand = pool.filter(isMustUse);
    if (onHand.length && (onHand.length === pool.length || Math.random() < 0.82)) pool = onHand;

    const craved = pool.filter(matchesCraving);
    if (craved.length && (craved.length === pool.length || Math.random() < 0.75)) pool = craved;

    // aromatics and sweeteners are real ingredients but poor standalone
    // picks — nobody plates 30g of garlic or calls maple syrup their carb
    if (slot === 'veg' || slot === 'carb'){
      const sensible = pool.filter(f => !f.aromatic && !f.topping);
      if (sensible.length) pool = sensible;
    }

    // drop anything that would demand a silly serving size
    if (slot && PORTION_CAP[slot]){
      const sane = pool.filter(f => servingFor(slot, f) <= PORTION_CAP[slot]);
      if (sane.length) pool = sane;
    }

    // ...or that would eat most of the meal's calories on its own
    if (slot === 'protein'){
      pool = preferCarriers(pool);
      const roomy = pool.filter(f => servingKcal(slot, f) <= currentTargets().kcal * 0.30 * 0.75);
      if (roomy.length) pool = roomy;
      // whey is the only powder ever suggested; casein and plant blends stay
      // selectable by hand but don't get auto-picked
      const noOddPowders = pool.filter(f => !f.powder || f.key === 'whey');
      if (noOddPowders.length) pool = noOddPowders;
    }

    if (avoidRepeat && usedKeys){
      const fresh = pool.filter(f => !usedKeys.has(f.key));
      if (fresh.length) pool = fresh;
    }
    const notLast = pool.filter(f => !LAST_DRAW.foods.has(f.key));
    if (notLast.length) pool = notLast;
    return randOf(pool);
  }

  /* Sauces the person's goal can afford */
  function sauceAllowed(food){
    const levels = SAUCE_LEVELS[state.goal || 'maintain'] || SAUCE_LEVELS.maintain;
    /* A sauce added without a level used to fail this test silently and
       disappear from the inventory altogether. Treat it as standard. */
    return levels.includes(food.level || 'standard');
  }

  /* Does this sauce belong on this meal? It has to either share a mood with
     something already on the plate, or be a listed match for the carb. A
     sweet oats-and-berries breakfast shares nothing with marinara, so it
     simply doesn't get a sauce — which is the point. */
  function sauceFits(food, sel){
    if (!sauceAllowed(food)) return false;
    const carbKeys = sel.carb.filter(Boolean);
    if ((food.pairs || []).some(k => carbKeys.includes(k))) return true;

    const plate = [];
    ['protein','carb','veg'].forEach(sl=>{
      sel[sl].filter(Boolean).forEach(k=>{
        const f = listFor(sl).find(x=>x.key===k);
        if (f) plate.push(...(f.crave || []));
      });
    });
    if (!plate.length) return false;
    const overlap = (food.crave || []).filter(c => plate.includes(c));
    // a shared "sweet" mood alone isn't enough to justify a savory sauce
    return overlap.some(c => c !== 'sweet');
  }

  /* Trim a food name down to something that reads well in a dish title:
     "Chicken Breast (raw)" -> "Chicken", "Ground Beef 93/7 (raw)" -> "Ground Beef" */
  const NAME_OVERRIDES = {
    chicken:"Chicken", chickthigh:"Chicken Thigh", grndchick:"Ground Chicken",
    grndturk93:"Ground Turkey", grndturk85:"Ground Turkey", turkey:"Turkey",
    beef93:"Ground Beef", beef85:"Ground Beef", beef80:"Ground Beef",
    steak:"Sirloin", ribeye:"Ribeye", bison:"Bison", pork:"Pork Loin", porkchop:"Pork Chop",
    tilapia:"Tilapia", cod:"Cod", salmon:"Salmon", ahi:"Ahi", tunacan:"Tuna", salmoncan:"Salmon",
    shrimp:"Shrimp", scallops:"Scallop", wholeegg:"Egg", eggwhites:"Egg White",
    yogurt0:"Greek Yogurt", yogurt2:"Greek Yogurt", yogurt5:"Greek Yogurt", skyr:"Skyr",
    cottage1:"Cottage Cheese", cottage4:"Cottage Cheese", whey:"Protein",
    tofu:"Tofu", tempeh:"Tempeh", seitan:"Seitan", lentils:"Lentil", chickpeas:"Chickpea",
    blackbeans:"Black Bean", pintobeans:"Pinto Bean", edamame:"Edamame", jerky:"Jerky",
    ham:"Ham", turkbacon:"Turkey Bacon", feta:"Feta", mozzarella:"Mozzarella", cheddar:"Cheddar",
    rice:"Jasmine Rice", whiterice:"White Rice", brownrice:"Brown Rice", caulirice:"Cauliflower Rice",
    ricenoodle:"Rice Noodle", soba:"Soba", shirataki:"Shirataki",
    pasta:"Pasta", wwpasta:"Whole Wheat Pasta", propasta:"Protein Pasta",
    lentilpasta:"Red Lentil Pasta", edamamepasta:"Edamame Pasta", orzo:"Orzo",
    lowcarbtort6:"Low-Carb Tortilla", lowcarbtort8:"Low-Carb Tortilla", lowcarbtort10:"Low-Carb Tortilla",
    flourtort6:"Flour Tortilla", flourtort8:"Flour Tortilla", flourtort10:"Flour Tortilla", flourtort12:"Flour Tortilla",
    corntort6:"Corn Tortilla", corntort8:"Corn Tortilla", whitecorn:"White Corn Tortilla", wwtort8:"Whole Wheat Tortilla",
    protwrap:"High-Protein Wrap", spinachwrap:"Spinach Wrap",
    honeycrisp:"Honeycrisp Apple", gala:"Gala Apple", fuji:"Fuji Apple", grannysmith:"Granny Smith",
    pinklady:"Pink Lady", navel:"Navel Orange", valencia:"Valencia Orange", cara:"Cara Cara",
    bartlett:"Bartlett Pear", bosc:"Bosc Pear", hassavo:"Avocado", bananamed:"Banana", bananalg:"Banana",
    protbread:"High-Protein Bread", sandthin:"Sandwich Thin", sourdough:"Sourdough",
    bread:"Whole Wheat", ezekiel:"Ezekiel", pita:"Pita", lavash:"Lavash",
    potato:"Sweet Potato", whitepot:"Potato", quinoa:"Quinoa", farro:"Farro",
    couscous:"Couscous", bulgur:"Bulgur", oats:"Oat", granola:"Granola",
    squashzoodle:"Zoodle", spaghettisq:"Spaghetti Squash", ricecakes:"Rice Cake",
    strawberry:"Strawberry", berries:"Blueberry", raspberry:"Raspberry", blackberry:"Blackberry",
    cherries:"Cherry", grapes:"Grape", dates:"Date", figs:"Fig", raisins:"Raisin",
    blueberrfroz:"Mixed Berry", applesauce:"Apple", cranberry:"Cranberry",
    greenbeans:"Green Bean", snappeas:"Snap Pea", snowpeas:"Snow Pea", peas:"Pea",
    brussels:"Brussels Sprout", mushrooms:"Mushroom", carrots:"Carrot", tomatoes:"Tomato",
    peppers:"Bell Pepper", olives:"Olive", collards:"Collard Green", greens:"Mixed Green",
    beets:"Beet", radish:"Radish", pickles:"Pickle", sprouts:"Bean Sprout",
    roastedpeppers:"Roasted Pepper", sundried:"Sun-Dried Tomato", artichokehearts:"Artichoke",
    heartsofpalm:"Hearts of Palm", edamamepod:"Edamame", scallion:"Scallion",
    american:"American", velveeta:"Melting Cheese", muenster:"Muenster",
    mexblend:"Mexican Blend", cheddarsharp:"Sharp Cheddar", cheddarjack:"Cheddar Jack",
    swissslice:"Swiss", provoslice:"Provolone",
    roastbeef:"Roast Beef", chickdeli:"Deli Chicken", capicola:"Capicola",
    mortadella:"Mortadella", bologna:"Bologna", soppressata:"Soppressata",
    porchetta:"Porchetta",
    greatnorth:"White Bean", chilibeans:"Chili Bean", refried:"Refried Bean",
    pintocan:"Pinto Bean", kidneycan:"Kidney Bean", blackbeancan:"Black Bean",
    potatobun:"Potato Roll", pretzelbun:"Pretzel Bun", kaiser:"Kaiser Roll",
    protbun:"High-Protein Bun", hawaiian:"Hawaiian Roll", marblerye:"Marble Rye",
    whitebread:"White Bread", shellpasta:"Shells", cavatappi:"Cavatappi",
    promacaroni:"Protein Macaroni", macaroni:"Macaroni", hominy:"Hominy",
    cornchips:"Corn Chip", onionring:"Onion Ring", crinklefry:"Fries",
    frenchfries:"Fries", burgerbun:"Burger Bun", hoagie:"Hoagie", brioche:"Brioche",
    firetom:"Fire-Roasted Tomato", dicedtom:"Tomato", tompaste:"Tomato Paste",
    tomatoslice:"Tomato", shreddedlettuce:"Lettuce", dillspears:"Pickle",
    pickledonion:"Pickled Onion", grillonion:"Grilled Onion",
    giardiniera:"Giardiniera", greenchilecan:"Green Chile", chipotleadobo:"Chipotle",
  };
  function shortName(food){
    if (!food) return '';
    if (NAME_OVERRIDES[food.key]) return NAME_OVERRIDES[food.key];
    return food.name.replace(/\s*\([^)]*\)/g, '').replace(/,.*$/, '').trim();
  }

  /* Naming a swap needs the pair to be told apart, and shortName exists to
     drop exactly the part that distinguishes two grades of one food —
     "Cottage Cheese, 1%" and "Cottage Cheese, 4%" both shorten to "Cottage
     Cheese", so the swap printed as "Cottage Cheese → Cottage Cheese". Fall
     back to the full names whenever the short ones collide. */
  function swapNames(from, to){
    const a = shortName(from), b = shortName(to);
    return (a && a === b)
      ? {from:(from.name || a), to:(to.name || b)}
      : {from:a, to:b};
  }

  /* Build the dish title from what was actually chosen, so a "Stir-Fry"
     template that landed on shrimp and soba reads "Shrimp Soba Stir-Fry". */
  const PLURAL_OK = {wholeegg:"Eggs", eggwhites:"Egg Whites"};
  /* An empty placeholder can leave orphaned connectives behind —
     "{S}-Glazed Chicken" with no sauce becomes "-Glazed Chicken". */
  function tidyTitle(str){
    return dedupeWords(str
      .replace(/(^|\s)[-&,]+\s*/g, '$1')       // leading hyphens/ampersands
      .replace(/\s+[-&,]+(\s|$)/g, '$1')        // trailing ones
      .replace(/\b(with|over|on|and)\s+(with|over|on|and)\b/gi, '$1')
      .replace(/\s+(with|over|on|&|and)\s*$/i, '')  // dangling preposition
      .replace(/^\s*(with|over|on|and)\s+/i, '')
      .replace(/\s{2,}/g, ' ')
      .trim());
  }

  /* A pattern like "{P} Eggs" filled with "Egg" reads "Egg Eggs". Drop a
     word when the one beside it is the same, or the same in the plural. */
  function dedupeWords(str){
    const words = str.split(' ');
    const out = [];
    const same = (a, b)=>{
      const x = a.toLowerCase(), y = b.toLowerCase();
      return x === y || x + 's' === y || y + 's' === x || x + 'es' === y || y + 'es' === x;
    };
    words.forEach(w=>{
      const prev = out[out.length-1];
      if (prev && same(prev, w)){
        // keep whichever form is longer, so "Egg Eggs" ends up "Eggs"
        if (w.length > prev.length) out[out.length-1] = w;
        return;
      }
      out.push(w);
    });
    return out.join(' ');
  }

  function dishTitle(recipe, sel){
    const nameOf = (slot) => {
      const k = sel[slot] && sel[slot].find(Boolean);
      return k ? shortName(listFor(slot).find(f=>f.key===k)) : '';
    };
    let P = nameOf('protein');
    const pk = sel.protein && sel.protein.find(Boolean);
    if (recipe.form === 'Toast' && PLURAL_OK[pk]) P = PLURAL_OK[pk];
    const C = nameOf('carb'), V = nameOf('veg'), S_ = nameOf('sauce'), F = nameOf('fruit');
    const out = (recipe.pattern || '{P} {C} {form}')
      .replace('{P}', P).replace('{C}', C).replace('{V}', V)
      .replace('{S}', S_).replace('{F}', F)
      .replace('{form}', recipe.form || 'Bowl');
    return tidyTitle(out) || recipe.name;
  }

  /* Which meal slot is this? First three sittings map to breakfast/lunch/
     dinner; anything beyond is a snack. */
  function mealRole(meal, index){
    if (!meal.required) return 'snack';
    return ['breakfast','lunch','dinner'][index] || 'dinner';
  }

  /* A recipe only works if every slot it actually needs still has at least
     one ingredient after dietary filters. */
  /* ---------------------------------------------------------
     RECIPE OPTIONS
     A template lists a handful of ingredients, which left most of the
     pantry unreachable — 617 foods, only 175 ever suggested. A dish that
     calls for "Chicken Breast" is just as happy with chicken thigh or
     tenderloin; one that wants jasmine rice takes basmati. So the listed
     keys are expanded to their family siblings, which unlocks the whole
     inventory without putting a banana in a burrito bowl.
  --------------------------------------------------------- */
  /* Slots that define a dish. "Steak & Potatoes" needs an actual steak cut;
     a stir-fry doesn't care which chicken it gets. Listed slots take only
     what the recipe names — no family substitution — so the name on the
     card keeps describing what's on the plate. */
  const SIGNATURE = {
    /* One entry per dish. This was a plain object literal with repeats
       in it, which meant a later ['protein'] entry silently threw away
       an earlier ['carb'] one and the bread lock stopped applying. */
    'Steak & Potatoes':['protein','carb'],
    'Salmon & Rice':['protein'],
    'Hummus & Veg Plate':['protein','veg'],
    'Greek Yogurt Bowl':['protein'],
    'Cottage Cheese & Fruit':['protein'],
    'Chicken Caesar':['protein'],
    'Shrimp Scampi':['protein'],
    'Beef & Broccoli':['protein','veg'],
    'Spaghetti & Meat Sauce':['carb'],
    'Tuna Salad':['protein'],
    'Poke Bowl':['protein'],
    'Fish Tacos':['protein'],
    'Smash Burger Plate':['protein','carb'],
    'Chicken Burrito Bowl':['protein'],
    'Turkey Roll-Ups':['protein'],
    'Egg Scramble':['protein'],
    'Overnight Oats':['carb'],
    'Protein Pancakes':['carb'],
    'Avocado Toast':['carb','fat'],
    'Lentil Curry':['protein'],
    'Tofu Stir-Fry':['protein'],
    'Chicken Shawarma':['protein'],
    'Buffalo Chicken Wrap':['protein'],
    'Reuben':['carb','protein'],
    'Tuna Melt':['carb'],
    'Tomato Soup & Grilled Cheese':['carb'],
    'Turkey Sloppy Joes':['carb'],
    'Cheeseburger & Fries':['carb'],
    'Buffalo Chicken Sandwich':['carb'],
    'Crispy Chicken Sandwich':['carb'],
    'French Dip':['protein','carb'],
    'Patty Melt':['protein','carb'],
    'Cuban Sandwich':['protein','carb'],
    'Chopped Cheese':['protein','carb'],
    'Steak & Cheese Hoagie':['protein','carb'],
    'BLT':['protein','carb'],
    'Pastrami on Rye':['protein','carb'],
    'Club Sandwich':['carb'],
    'Egg Salad Sandwich':['carb'],
    'Pimento Cheese Melt':['carb'],
    'Nashville Hot Chicken Sandwich':['carb'],
    'Roast Beef & Cheddar':['carb'],
    'Baked Mac & Cheese':['carb'],
    'Buffalo Chicken Mac':['carb'],
    'Green Chile Mac':['carb'],
    'Cheeseburger Mac':['carb'],
    'Cincinnati Chili':['carb'],
    'Chili Cheese Fries':['carb'],
    'Loaded Cheese Fries':['carb'],
    'Beer Cheese Pretzel Plate':['carb'],
    'Italian Sub':['carb','protein'],
  };
  const isSignature = (recipe, slot) =>
    (SIGNATURE[recipe.name] || []).includes(slot);

  /* Slots this dish cannot be served without. Sauce is the usual case:
     "Mac & Cheese" without a cheese sauce, "Chicken Alfredo" without the
     alfredo, a Reuben without the Russian dressing — the dish stops being
     itself. A core slot is always filled and gets a bigger share of the
     meal's calories, because on those dishes the sauce IS the meal. */
  const isCore = (recipe, slot) =>
    !!recipe && (recipe.core || []).includes(slot);

  const OPTION_CACHE = {};
  function recipeOptions(recipe, slot){
    const cacheKey = recipe.name + '|' + slot;
    if (OPTION_CACHE[cacheKey]) return OPTION_CACHE[cacheKey];
    const listed = recipe[slot] || [];
    const out = new Set(listed);
    // a defining ingredient isn't negotiable
    if (isSignature(recipe, slot)){
      const only = [...out];
      OPTION_CACHE[cacheKey] = only;
      return only;
    }
    listed.forEach(k=>{
      const base = listFor(slot).find(f=>f.key === k);
      if (!base) return;
      const fam = FAMILY[k];
      if (!fam) return;
      listFor(slot).forEach(f=>{
        if (FAMILY[f.key] !== fam) return;
        // a sibling has to be close in energy density, or a dish built for
        // lean chicken ends up carrying pork belly
        const ratio = base.kcal > 0 ? f.kcal / base.kcal : 1;
        if (ratio >= 0.55 && ratio <= 1.9) out.add(f.key);
      });
    });
    const arr = [...out];
    OPTION_CACHE[cacheKey] = arr;
    return arr;
  }

  function recipeUsable(recipe, role, budgetKcal){
    if (role === 'universal'){
      // has to read as breakfast AND as a main — few dishes do, so fall
      // back to anything that works at lunch if none qualify
      if (!recipe.slots.includes('breakfast') && !recipe.slots.includes('lunch')) return false;
    } else if (!recipe.slots.includes(role)) return false;
    /* A dish that cannot get its defining sauce past the dietary filters
       shouldn't be offered at all — better a different dish than a
       Mac & Cheese with no cheese sauce in it. */
    for (const slot of (recipe.core || [])){
      const live = recipeOptions(recipe, slot)
        .map(k => listFor(slot).find(x=>x.key===k))
        .filter(f => f && passesPrefs(f) && !isDisliked(f));
      if (!live.length) return false;
    }
    for (const slot of ['protein','carb','fat']){
      const opts = recipeOptions(recipe, slot).map(k => {
        const f = listFor(slot).find(x=>x.key===k);
        return (f && isDisliked(f)) ? substituteFor(slot, k) : f;
      }).filter(f => f && passesPrefs(f) && !isDisliked(f) && !(f.powder && !POWDER_OK.includes(role)));
      if (!opts.length) return false;
      /* A dish gets offered for a sitting its own ingredients aren't allowed
         at, and then gets built out of whatever is: shakshuka made with
         chicken because eggs don't pass at dinner, a rice pudding on a
         tortilla because the sitting is too small for rice. The substitution
         used to happen silently at build time and the dish quietly stopped
         being itself. Rule it out here and let a buildable dish take the
         slot instead. */
      if (!opts.some(f => mealAllowsFood(role, f))) return false;
      if (budgetKcal && !opts.some(f => foodFitsBudget(slot, f, budgetKcal) && mealAllowsFood(role, f))) return false;
    }
    return true;
  }

  /* Shared with buildOneMeal: the smallest serving of this food worth
     plating, measured against what the sitting can actually afford. */
  function foodFitsBudget(slot, f, budgetKcal){
    if (!budgetKcal) return true;
    const room = budgetKcal * 0.55;
    const min = minPortion(slot, f);
    if (f.unit && !f.unit.soft)
      return (f.kcal * Math.max(f.unit.g * unitStep(f), min) / 100) <= room;
    const floor = slot === 'protein' ? (MIN_GRAMS[slot] || 0) : min;
    return (f.kcal * floor / 100) <= room;
  }

  /* ---------------------------------------------------------
     SHUFFLE RANDOMNESS
     Scores used to decide the winner outright — highest total took the
     slot every time. Because an on-hand ingredient is worth +12 and a
     starred one +2.5, one recipe could out-score the field by a margin no
     amount of jitter would ever close, so shuffle returned the same dish
     forever. Scores now set a *probability* instead: a strong recipe comes
     up often, but never always. The same fix is applied to ingredients.
  --------------------------------------------------------- */

  /* Draw from {item, s} pairs, treating the score as a preference weight.
     Scores are shifted positive and put through a power curve — `sharp`
     high means "usually the best one", low means "genuinely mixed". */
  function weightedPick(scored, sharp){
    if (!scored || !scored.length) return null;
    if (scored.length === 1) return scored[0].item;
    const k = sharp == null ? 1.6 : sharp;
    let min = Infinity, max = -Infinity;
    scored.forEach(x=>{ if (x.s < min) min = x.s; if (x.s > max) max = x.s; });
    const span = max - min;
    // everything level — a flat draw is the honest answer
    if (!(span > 0.0001)) return scored[Math.floor(Math.random()*scored.length)].item;
    let total = 0;
    const w = scored.map(x=>{
      const norm = (x.s - min) / span;            // 0..1
      const weight = Math.pow(norm, k) + 0.12;    // floor keeps every option live
      total += weight;
      return weight;
    });
    let r = Math.random() * total;
    for (let i = 0; i < w.length; i++){ r -= w[i]; if (r <= 0) return scored[i].item; }
    return scored[scored.length-1].item;
  }

  /* Plain random choice, used everywhere a list is already filtered */
  function randOf(arr){
    return (arr && arr.length) ? arr[Math.floor(Math.random()*arr.length)] : null;
  }

  /* What the last draw produced. Shuffle deliberately steers away from it,
     which is the whole point of pressing the button twice. */
  const LAST_DRAW = {recipes:new Set(), foods:new Set()};
  function rememberDraw(recipeNames, foodKeys){
    LAST_DRAW.recipes = new Set(recipeNames);
    LAST_DRAW.foods = new Set(foodKeys);
  }

  /* Score a recipe: favorites it can use, cravings it matches, and a nudge
     away from whatever was served earlier today. */
  function scoreRecipe(recipe, usedNames){
    let score = Math.random() * 0.8;
    // whatever came up last time steps aside so a second press changes things
    if (LAST_DRAW.recipes.has(recipe.name)) score -= 4;
    // on-hand ingredients outrank favourites — they have to be used up
    (state.mustUse || []).forEach(k=>{
      const sl = slotOf(k);
      if (sl && (recipe[sl] || []).includes(k)) score += 12;
    });
    ['protein','carb','fat','veg','fruit','sauce'].forEach(slot=>{
      // ingredients the person already has weigh heaviest — a dish that can
      // absorb them naturally beats one we'd have to force them into
      const onHandHits = (recipe[slot] || []).filter(k => (state.mustUse||[]).includes(k)).length;
      score += onHandHits * 6;
      const favs = favKeys(slot);
      if (!favs.length) return;
      const hits = (recipe[slot] || []).filter(k => favs.includes(k)).length;
      score += hits * 2.5;
    });
    if (state.cravings.length){
      const hits = (recipe.crave || []).filter(c => state.cravings.includes(c)).length;
      score += hits * 2;
    }
    if (usedNames.has(recipe.name)) score -= 5;
    return score;
  }

  /* Choose an ingredient for one slot of a recipe: favorites first, then
     craving matches, then anything the recipe allows. */
  function pickFromRecipe(recipe, slot, role, taken, guard, sel){
    // swap blocked ingredients for a stand-in before filtering
    const expanded = [];
    (recipe[slot] || []).forEach(k=>{
      const f = listFor(slot).find(x=>x.key===k);
      if (!f) return;
      if (isDisliked(f)){
        const sub = substituteFor(slot, k);
        if (sub) expanded.push(sub);
      } else expanded.push(f);
    });
    let opts = expanded
      .filter(Boolean)
      .filter(passesPrefs)
      .filter(f => !isDisliked(f))
      .filter(f => !(f.powder && !POWDER_OK.includes(role)))
      .filter(f => !taken.includes(f.key));
    // never two variants of the same thing on one plate — if nothing clean
    // is left, return nothing rather than duplicating
    if (sel){
      opts = opts.filter(f => !familyClash(f, sel));
      if (!opts.length) return null;
    }
    if (guard) opts = opts.filter(guard);
    if (!opts.length) return null;

    /* On-hand food used to return immediately and favorites replaced the
       pool outright, so a slot with exactly one starred item served that
       item on every shuffle for ever. They're strong preferences now, not
       locks — the rest of the pool stays reachable. */
    const onHand = opts.filter(isMustUse);
    if (onHand.length && (opts.length === onHand.length || Math.random() < 0.82))
      return randOf(onHand);

    const favs = favKeys(slot);
    const faved = opts.filter(f => favs.includes(f.key));
    if (faved.length && (faved.length === opts.length || Math.random() < 0.72)) opts = faved;
    else {
      const craved = opts.filter(matchesCraving);
      if (craved.length && (craved.length === opts.length || Math.random() < 0.75)) opts = craved;
    }
    // On a deficit, high-protein swaps (Barilla Protein+, edamame pasta,
    // low-carb tortillas) let you eat a full serving and still hit protein,
    // so they get preference where they exist in the dish.
    if (slot === 'carb' && (state.goal === 'loss' || state.goal === 'extreme_loss')){
      const smart = opts.filter(f => f.macroFriendly);
      if (smart.length && Math.random() < 0.65) opts = smart;
    }

    // Portion sanity — very low-calorie carbs (cauliflower rice, shirataki)
    // would need absurd weights to hit a macro target on their own, and the
    // leanest proteins can run past 400g. Prefer options that plate sensibly.
    if (PORTION_CAP[slot]){
      const sane = opts.filter(f => servingFor(slot, f) <= PORTION_CAP[slot]);
      if (sane.length) opts = sane;
    }
    if (slot === 'protein'){
      opts = preferCarriers(opts);
      const roomy = opts.filter(f => servingKcal(slot, f) <= currentTargets().kcal * 0.30 * 0.75);
      if (roomy.length) opts = roomy;
    }
    // prefer something other than last shuffle's answer, when there is one
    const fresh = opts.filter(f => !LAST_DRAW.foods.has(f.key));
    if (fresh.length) opts = fresh;
    return randOf(opts);
  }

  /* ---------------------------------------------------------
     HOW MANY OF EACH DISH, AND WHEN
     "6 unique meals over 7 days" doesn't mean six sittings a day — it means
     six recipes shared out over the week. Sittings are grouped by the role
     they have to play (breakfast / lunch / dinner) and each group is given
     a share of the unique count, so a group with two dishes alternates day
     to day and a group with one repeats. Snacks get their own budget and
     never eat into the meal count.
  --------------------------------------------------------- */
  function splitEvenly(total, buckets){
    const out = Array.from({length:buckets}, ()=>Math.floor(total / buckets));
    let extra = total - out.reduce((a,b)=>a+b, 0);
    for (let i = 0; extra > 0; i = (i+1) % buckets){ out[i]++; extra--; }
    return out;
  }

  /* Group the day's sittings and say how many distinct dishes each gets.
     Returns [{indexes:[sitting positions], role, count}] */
  function dishGroups(sittings, unique, roleFor){
    const n = sittings.length;
    if (!n) return [];
    const groups = [];
    if (unique >= n){
      // every sitting keeps its own identity — breakfast stays breakfast
      const counts = splitEvenly(unique, n);
      for (let i = 0; i < n; i++){
        groups.push({indexes:[i], role: roleFor(sittings[i], i), count: Math.max(1, counts[i])});
      }
      return groups;
    }
    /* Fewer dishes than sittings — some sittings have to share one. Sittings
       are bundled in order and a bundle spanning breakfast and dinner has to
       be a dish that reads well at both. */
    const sizes = splitEvenly(n, unique);
    let cursor = 0;
    sizes.forEach(size=>{
      const indexes = [];
      for (let k = 0; k < size; k++) indexes.push(cursor++);
      const roles = new Set(indexes.map(i => roleFor(sittings[i], i)));
      const role = roles.size > 1
        ? (roles.has('breakfast') ? 'universal' : 'dinner')
        : [...roles][0];
      groups.push({indexes, role, count:1});
    });
    return groups;
  }

  /* A two-meal day runs BREAKFAST then DINNER, so the second sitting isn't
     always lunch — go by the name the plan gave it, not its position. */
  const mainRoleFor = (m, idx) => {
    const n = (m && m.name) || '';
    if (n === 'BREAKFAST') return 'breakfast';
    if (n === 'LUNCH') return 'lunch';
    return 'dinner';
  };

  /* Choose the recipes, build the dishes, and deal them across the days.
     Everything the rest of the app reads lives on state.prep. */
  function generateSuggestion(){
    /* Dishes are shared across every prepped day, so they're CHOSEN against
       the blended target for the mix — picking against a 3200 kcal training
       day would leave rest days padded out, and vice versa. Portions are
       recomputed per day afterwards, so the split still lands exactly. */
    return withTargetKind('avg', ()=> generateSuggestionInner());
  }

  function generateSuggestionInner(){
    const usedNames = new Set();
    const days = Math.max(1, state.prepServings || 1);
    const kinds = dayKinds();

    const mainMeals  = MEALS.filter(m=>m.required);
    const snackMeals = MEALS.filter(m=>!m.required);

    const uniqMeals  = clampUniqueMeals();
    const uniqSnacks = clampUniqueSnacks();

    const mainGroups  = dishGroups(mainMeals,  uniqMeals,  mainRoleFor);
    const snackGroups = dishGroups(snackMeals, uniqSnacks, ()=>'snack');

    /* ---- ORDER MATTERS ----
       Dishes are chosen FIRST, then the shopping palette is drawn from what
       those dishes actually call for. Doing it the other way round produced
       "Banana Protein Pancakes" made of Canadian bacon — the palette had
       ingredients the recipe never wanted, and they got forced in anyway. */
    const pickRecipe = (role)=>{
      const budgetKcal = role === 'snack' ? snackKcal() : null;
      const usable = RECIPES.filter(r => recipeUsable(r, role, budgetKcal));
      if (!usable.length) return null;
      // fresh dishes first; only reuse a name when the pool is genuinely spent
      const unused = usable.filter(r => !usedNames.has(r.name));
      const from = unused.length ? unused : usable;
      const pick = weightedPick(from.map(r => ({item:r, s: scoreRecipe(r, usedNames)})), 1.8);
      if (pick) usedNames.add(pick.name);
      return pick;
    };

    // one recipe per distinct dish, group by group
    const assignRecipes = groups => groups.map(g=>({
      group: g,
      recipes: Array.from({length:g.count}, ()=> pickRecipe(g.role))
    }));
    const mainPlan  = assignRecipes(mainGroups);
    const snackPlan = assignRecipes(snackGroups);

    const allPicked = [];
    mainPlan.forEach(p => p.recipes.forEach(r => { if (r) allPicked.push({recipe:r, role:p.group.role}); }));
    snackPlan.forEach(p => p.recipes.forEach(r => { if (r) allPicked.push({recipe:r, role:'snack'}); }));
    const palette = buildPalette(allPicked);

    // turn each recipe into a real dish with real ingredients
    const buildAll = (plan, budget) => plan.map(p=>({
      group: p.group,
      dishes: p.recipes.map(r => buildOneMeal(p.group.role, usedNames, palette, budget, r))
    }));
    const mainBuilt  = buildAll(mainPlan,  null);
    const snackBuilt = buildAll(snackPlan, snackKcal());

    state.paletteUsed = {};
    VARIETY_SLOTS.forEach(slot=>{ state.paletteUsed[slot] = palette[slot].length; });

    /* ---- FLATTEN AND SCHEDULE ----
       Dishes go into one flat list; the schedule then says which dish each
       sitting gets on each day. A group holding two dishes alternates, one
       holding three cycles every third day, and so on. */
    const meals = [], snacks = [];
    const schedule = Array.from({length:days}, (_,d)=>({mains:[], snacks:[], kind:kinds[d] || 'rest'}));

    const layOut = (built, sittings, store, lane)=>{
      built.forEach(b=>{
        const base = store.length;
        b.dishes.forEach(d => store.push(d));
        b.group.indexes.forEach((sittingIdx, offset)=>{
          for (let d = 0; d < days; d++){
            // offset staggers shared sittings so they don't all land together
            const which = b.dishes.length
              ? (d + offset) % b.dishes.length : 0;
            schedule[d][lane][sittingIdx] = base + which;
          }
        });
      });
      // any sitting the grouping missed falls back to the first dish
      for (let d = 0; d < days; d++){
        for (let i = 0; i < sittings.length; i++){
          if (schedule[d][lane][i] == null) schedule[d][lane][i] = 0;
        }
      }
    };
    layOut(mainBuilt,  mainMeals,  meals,  'mains');
    layOut(snackBuilt, snackMeals, snacks, 'snacks');

    state.prep = {
      days,
      trainingDays: kinds.filter(k=>k === 'train').length,
      mealKeys:  mainMeals.map(m=>m.key),
      snackKeys: snackMeals.map(m=>m.key),
      meals: meals.map(toStoredMeal),
      snacks: snacks.map(toStoredMeal),
      schedule
    };
    state.activeDay = 1;
    state.portionOverrides = {};
    applyDayToSelections(1);

    enforceOnHand();
    pruneUnservedItems();
    writeBackActiveDay();
    recordOnHandOutcome();
    rememberDraw(
      [...usedNames],
      state.prep.meals.concat(state.prep.snacks)
        .flatMap(d => SLOT_DEFS.flatMap(sd => d[sd.slot] || []))
        .filter(Boolean)
    );
  }

  /* A dish as it's stored on the prep plan — plain data, safe to serialise */
  function toStoredMeal(src){
    return {
      protein:[...src.protein], carb:[...src.carb], fat:[...src.fat],
      veg:[...src.veg], fruit:[...src.fruit], sauce:[...src.sauce],
      notes: src.notes || "", dish: src.dish || "",
      _recipe: src._recipe || "", _improvised: !!src._improvised,
      _augmented: !!src._augmented,
      season: src.season || []
    };
  }

  /* ---------------------------------------------------------
     ACTIVE DAY
     The loadout screen edits one day at a time. state.selections is a
     working copy of that day; edits are written back to the unique dish it
     came from, so changing Tuesday's lunch changes it everywhere that dish
     is served rather than quietly forking it.
  --------------------------------------------------------- */
  function prepReady(){
    const p = state.prep;
    return !!(p && p.schedule && p.schedule.length && (p.meals || []).length);
  }

  function dayIndex(){
    if (!prepReady()) return 0;
    return Math.min(Math.max((state.activeDay || 1) - 1, 0), state.prep.schedule.length - 1);
  }

  /* Which stored dish is behind a given meal key on a given day */
  function dishRefFor(mealKey, dayIdx){
    if (!prepReady()) return null;
    const p = state.prep;
    const row = p.schedule[dayIdx] || {};
    const mi = (p.mealKeys || []).indexOf(mealKey);
    if (mi >= 0){
      const idx = (row.mains || [])[mi];
      if (idx != null && p.meals[idx]) return {store:'meals', index:idx};
    }
    const si = (p.snackKeys || []).indexOf(mealKey);
    if (si >= 0){
      const idx = (row.snacks || [])[si];
      if (idx != null && p.snacks[idx]) return {store:'snacks', index:idx};
    }
    return null;
  }

  function dishAt(ref){
    return ref ? (state.prep[ref.store] || [])[ref.index] : null;
  }

  function applyDayToSelections(day){
    if (!prepReady()) return;
    state.activeDay = Math.min(Math.max(day || 1, 1), state.prep.schedule.length);
    const di = dayIndex();
    MEALS.forEach(m=>{
      const dish = dishAt(dishRefFor(m.key, di));
      state.selections[m.key] = dish ? toStoredMeal(dish)
                                     : (state.selections[m.key] || blankMeal());
    });
  }

  /* Push the working copy back onto the unique dishes it came from. Where
     two sittings share a dish only the first one writes, so editing lunch
     doesn't get clobbered by dinner's untouched copy. */
  function writeBackActiveDay(){
    if (!prepReady()) return;
    const di = dayIndex();
    const done = new Set();
    MEALS.forEach(m=>{
      const ref = dishRefFor(m.key, di);
      if (!ref) return;
      const tag = ref.store + ':' + ref.index;
      if (done.has(tag)) return;
      done.add(tag);
      const sel = state.selections[m.key];
      if (sel) state.prep[ref.store][ref.index] = toStoredMeal(sel);
    });
  }

  /* The portion engine drops anything too small to plate. Those choices are
     removed from the meal as well, so what you see selected is exactly what
     you'll be given an amount for. */
  function pruneUnservedItems(){
    /* Settle the plate before trimming it: pair up an overworked carb
       first, so the second half of the pair is sized and kept rather
       than pruned as an afterthought. */
    balanceCarbLoad();
    MEALS.forEach(m=>{
      const plan = computeMealPlan(m.key);
      const sel = state.selections[m.key];
      SLOT_DEFS.forEach(d=>{
        const kept = [];
        sel[d.slot].forEach((k, i)=>{
          if (!k) return;
          if (plan[d.slot][i] != null) kept.push(k);
        });
        sel[d.slot] = kept.length ? kept
          : (d.slot === 'sauce' || d.slot === 'fruit' ? [] : [""]);
      });
    });
    refreshDishTitles();
  }

  /* A title is written when the plate is first built, but the plate can
     still lose an ingredient afterwards - anything too small to serve is
     pruned above. The name has to be re-derived from what actually
     survived, or a card goes on advertising food that isn't on it:
     "Light String Cheese Date Plate" with no date in the ingredients. */
  function refreshDishTitles(){
    MEALS.forEach(m=>{
      const sel = state.selections[m.key];
      if (!sel || !sel.dish) return;
      const recipe = sel._recipe ? RECIPES.find(r => r.name === sel._recipe) : null;
      const next = (sel._improvised || !recipe) ? plainTitle(sel) : dishTitle(recipe, sel);
      if (next) sel.dish = next;
    });
  }

  /* Draw the shopping palette from what the chosen dishes actually use.
     Every item here is something at least one recipe calls for, so nothing
     ends up on a plate it doesn't belong on. */
  function buildPalette(picked){
    const hasBreakfast = MEALS.some(m=>m.required && m.name === 'BREAKFAST')
      && !state.breakfastForDinner && !state.breakfastAllDay;
    const palette = {};

    VARIETY_SLOTS.forEach(slot=>{
      const want = varietyBudget(slot);
      const needsBoth = hasBreakfast && slot !== 'veg';
      const allowance = (needsBoth && want < 2) ? want + 1 : want;

      // every ingredient any chosen dish could use for this slot
      const wanted = [];
      picked.forEach(({recipe, role})=>{
        recipeOptions(recipe, slot).forEach(k=>{
          let f = listFor(slot).find(x=>x.key===k);
          if (f && isDisliked(f)) f = substituteFor(slot, k);
          if (!f || !passesPrefs(f) || isDisliked(f)) return;
          if (!mealAllowsFood(role, f)) return;
          if (f.powder && !POWDER_OK.includes(role)) return;
          if (!wanted.some(w=>w.f.key===f.key)) wanted.push({f, role});
        });
      });

      const chosen = [];
      const add = f => { if (!chosen.some(c=>c.key===f.key)) chosen.push(f); };

      /* The order `wanted` comes out in is fixed by the recipe definitions,
         so filling the allowance top-down handed back an identical palette
         on every shuffle. Draw in a random order instead, and let anything
         that isn't in last shuffle's palette go first. */
      let bench = wanted;
      /* A palette holding nothing but kefir and dry beans dooms every meal
         drawn from it, so the shopping list is steered to real protein
         sources before variety is considered. */
      if (slot === 'protein'){
        const carriers = wanted.filter(w => carriesProtein(w.f));
        if (carriers.length) bench = carriers;
      }
      const shuffled = bench.slice()
        .map(w => ({w, r: Math.random() + (LAST_DRAW.foods.has(w.f.key) ? 1 : 0)}))
        .sort((a,b)=>a.r-b.r).map(x=>x.w);

      // on-hand and starred foods first, if a dish can take them
      shuffled.filter(w => isMustUse(w.f)).forEach(w=>{
        if (chosen.length < allowance && !chosen.some(c=>familyClashPair(c,w.f))) add(w.f);
      });
      shuffled.filter(w => favKeys(slot).includes(w.f.key)).forEach(w=>{
        if (chosen.length < allowance && !chosen.some(c=>familyClashPair(c,w.f))) add(w.f);
      });

      // then make sure every dish has at least one option it can use
      picked.forEach(({recipe, role})=>{
        const opts = shuffled.filter(w =>
          recipeOptions(recipe, slot).includes(w.f.key) && mealAllowsFood(role, w.f));
        if (!opts.length) return;
        if (opts.some(o => chosen.some(c=>c.key===o.f.key))) return;
        const fresh = opts.filter(o => !chosen.some(c=>familyClashPair(c,o.f)));
        const from = fresh.length ? fresh : opts;
        add(randOf(from).f);
      });

      // fill any remaining allowance with other things the dishes could use
      let guard = 0;
      while (chosen.length < allowance && guard++ < 40){
        const rest = shuffled.filter(w =>
          !chosen.some(c=>c.key===w.f.key) && !chosen.some(c=>familyClashPair(c,w.f)));
        if (!rest.length) break;
        add(randOf(rest).f);
      }

      palette[slot] = chosen;
    });
    return palette;
  }

  /* ---------------------------------------------------------
     BREAKFAST DISCIPLINE
     Nobody wants an onion-and-tomato burrito bowl at 7am, and nobody
     serves cereal at dinner. These lists keep each end of the day
     recognisable — unless the person deliberately asks otherwise.
  --------------------------------------------------------- */
  const BREAKFAST_OK = new Set([
    'wholeegg','eggwhites','eggliquid','eggwhole6','yolks','turkbacon','bacon','canadian',
    'chicksaus','italsaus','yogurt0','yogurt2','yogurt5','skyr','cottage1','cottage4','queijo',
    'kefir','milk','ricotta','creamcheese','creamcheeselight','whey','protshake','smokedsalmon',
    'cheddar','cheddarred','cheddarff','jack','pepperjack','swisscheese','mozzarella','feta','goatcheese',
    'quarkcheese','labneh','cheesestick','eggwhitewrap','eggbeater','plantpro','casein',
    'tofu','tempeh','seitan','tvp','soycurls','edamame','natto','lentils','chickpeas',
    'peanuts','pumpkinseeds','sunflowerseeds','sesameseeds','pepitas','brazilnuts','pinenuts',
    'macadamiabutter','pecanbutter','pumpkinbutter','mayolight','avocadooil','oil','canola','grapeseed',
    'proteinoats','kodiakmix','protwaffle','proteinbar','muesli','oats','crackers','popcorn',
    'oats','steelcut','oatbran','cofw','granola','protgranola','cereal','protcereal','muesli',
    'grits','polenta','creamrice','bread','sourdough','ezekiel','protbread','sandthin','bagel',
    'protbagel','engmuffin','croissant','brioche','waffle','protwaffle','pancakemix','protpancake',
    'ricecakes','banana','bananamed','bananalg','honey','maple','hashbrown','potato','whitepot',
    'lowcarbtort6','lowcarbtort8','lowcarbtort10','flourtort6','flourtort8','corntort6','protwrap','lavash',
    'pb','almondbutter','sunbutter','cashewbutter','pistachiobutter','pbpowder','nutella','pbfit',
    'butter','ghee','avocado','hassavo','guac','almonds','walnuts','pecans','cashews','chia',
    'flaxseed','hemphearts','coconutflake','cacaonibs','darkchoc','halfhalf','creme','mascarpone','skyrfat',
    'spinach','babyspinach','mushrooms','cremini','peppers','roastedpeppers','onion','scallion',
    'tomatoes','cherrytom','zucchini','kale','arugula','poblano','jalapeno','sweetpotfries',
  ]);

  /* Things that read as breakfast-only and look odd at dinner */
  const BREAKFAST_ONLY = new Set([
    'cereal','protcereal','granola','protgranola','muesli','oats','steelcut','oatbran','cofw',
    'pancakemix','protpancake','waffle','protwaffle','croissant','turkbacon','bacon','canadian',
    'grits','maple','honey','nutella','skyrfat',
  ]);

  function mealAllowsFood(role, food){
    if (state.breakfastAllDay) return BREAKFAST_OK.has(food.key);  // eggs at every sitting
    if (state.breakfastForDinner) return true;      // deliberately mixed up
    if (role === 'snack') return true;              // snacks can be anything
    if (role === 'breakfast') return BREAKFAST_OK.has(food.key);
    // One dish covering both breakfast and dinner has to satisfy both ends:
    // recognisable in the morning, not porridge at night.
    if (role === 'universal'){
      return BREAKFAST_OK.has(food.key) && !BREAKFAST_ONLY.has(food.key);
    }
    return !BREAKFAST_ONLY.has(food.key);           // lunch and dinner
  }

  /* Calories a snack actually has to play with — used to keep bulky
     whole-unit foods out of them. */
  function snackKcal(){
    const snack = MEALS.find(m=>!m.required);
    return snack ? currentTargets().kcal * snack.share : null;
  }

  /* ---------------------------------------------------------
     UNIQUE DISH BUDGETS
     "How many meals do you want to make" is a variety dial, not a daily
     schedule. It counts distinct recipes across the WHOLE prep, so six
     meals over seven days is six recipes on rotation — not six sittings a
     day. Snacks are counted separately for the same reason: nobody thinks
     of an apple and peanut butter as one of their six meals.
  --------------------------------------------------------- */
  function mainSittings(){ return MEALS.filter(m=>m.required).length; }
  function snackSittings(){ return MEALS.filter(m=>!m.required).length; }
  function prepDays(){ return Math.max(1, state.prepServings || 1); }

  /* The ceiling is every sitting being different; the floor is one dish
     eaten over and over. */
  function maxUniqueMeals(){ return Math.max(1, mainSittings() * prepDays()); }
  function maxUniqueSnacks(){ return Math.max(0, snackSittings() * prepDays()); }

  function clampUniqueMeals(){
    const cap = maxUniqueMeals();
    let v = state.uniqueMeals;
    if (v == null) v = Math.min(cap, Math.max(mainSittings(), 3));
    return Math.max(1, Math.min(v, cap));
  }
  function clampUniqueSnacks(){
    const cap = maxUniqueSnacks();
    if (!cap) return 0;
    let v = state.uniqueSnacks;
    if (v == null) v = Math.min(cap, 2);
    return Math.max(1, Math.min(v, cap));
  }

  const VARIETY_SLOTS = ['protein','carb','fat','veg'];
  function varietyBudget(slot){
    const v = (state.variety || {})[slot];
    return Math.max(1, v != null ? v : 2);
  }

  /* Would these two foods clash if they shared a plate? */
  function familyClashPair(a, b){
    if (!a || !b) return false;
    const fa = strictFamilyOf(a), fb = strictFamilyOf(b);
    if (fa && fa === fb) return true;
    const ga = groupOf(a), gb = groupOf(b);
    return !!ga && ga === gb;
  }

  /* One meal, drawn only from the day's ingredient palette */
  function buildOneMeal(role, usedNames, palette, budgetKcal, recipe){
    /* A whole tortilla or bagel can't fit a snack — its smallest possible
       serving is one unit, and one unit may be the entire budget. */
    /* Same test the dish filter uses, so a dish is never offered for a
       sitting it cannot be built in. */
    const fitsBudget = (slot, f)=> foodFitsBudget(slot, f, budgetKcal);

    const sel = {protein:[], carb:[], fat:[], veg:[], fruit:[], sauce:[], dish:"", _recipe:""};
    if (recipe) sel._recipe = recipe.name;

    const wantVeg = role === 'snack' ? 0 : Math.min(2, varietyBudget('veg'));
    [['protein',1], ['carb',1], ['fat',1], ['veg', wantVeg]].forEach(([slot, want])=>{
      for (let i = 0; i < want; i++){
        /* Only ingredients this dish actually calls for. A burrito bowl asks
           for rice or tortillas — never a banana, however much of one the
           palette happens to hold. */
        const recipeKeys = recipe ? recipeOptions(recipe, slot) : null;
        let pool = palette[slot].filter(f =>
          !sel[slot].includes(f.key)
          && (!recipeKeys || recipeKeys.includes(f.key))
          && !familyClash(f, sel)
          && !(f.powder && !POWDER_OK.includes(role))
          && mealAllowsFood(role, f)
          && fitsBudget(slot, f));

        if (slot === 'protein' && sel.protein.some(k=>{
          const f = FOODS.protein.find(x=>x.key===k); return f && isMeat(f);
        })) pool = pool.filter(f => !isMeat(f));

        /* The first protein on the plate has to be one that can actually
           reach the target; a second one is free to be an accent. */
        if (slot === 'protein' && !sel.protein.length){
          pool = preferCarriers(pool);
          /* On a tight profile — a hard cut, or a plant-based day where the
             carb target is high — the difference between seitan and edamame
             decides whether the target is reachable at all. Lean on the
             efficient end without ever ruling the rest out. */
          if (pool.length > 1){
            const notLast2 = pool.filter(f => !LAST_DRAW.foods.has(f.key));
            const from = notLast2.length ? notLast2 : pool;
            const pick = weightedPick(from.map(f =>
              ({item:f, s: 1 / Math.max(proteinCostKcal(f), 0.5)})), 1.2);
            if (pick){ sel[slot].push(pick.key); continue; }
          }
        }

        /* Prefer options that plate at a sensible size. Shirataki and poblano
           are so light that hitting a macro target on them alone runs to a
           kilo, so they only get picked when nothing better is offered. */
        if (PORTION_CAP[slot]){
          const sane = pool.filter(f => servingFor(slot, f) <= PORTION_CAP[slot]);
          if (sane.length) pool = sane;
        }

        if (!pool.length && recipeKeys){
          // the dish wants something the palette can't supply — take it from
          // the recipe directly and add it to the palette so the shopping
          // list stays truthful
          const extra = recipeKeys.map(k=>{
            let f = listFor(slot).find(x=>x.key===k);
            if (f && isDisliked(f)) f = substituteFor(slot, k);
            return f;
          }).find(f => f && passesPrefs(f) && !isDisliked(f)
            && !sel[slot].includes(f.key) && !familyClash(f, sel)
            && mealAllowsFood(role, f) && fitsBudget(slot, f)
            && !(f.powder && !POWDER_OK.includes(role))
            && !(slot === 'protein' && isMeat(f) && sel.protein.some(k=>{
                 const p = FOODS.protein.find(x=>x.key===k); return p && isMeat(p); })));
          if (extra){
            if (!palette[slot].some(f=>f.key===extra.key)) palette[slot].push(extra);
            sel[slot].push(extra.key);
          }
          continue;
        }
        if (!pool.length) continue;
        const notLast = pool.filter(f => !LAST_DRAW.foods.has(f.key));
        if (notLast.length && Math.random() < 0.8) pool = notLast;
        sel[slot].push(randOf(pool).key);
      }
    });

    // fruit and sauce come from the dish, not the palette
    const fruitKeys = recipe ? recipeOptions(recipe, 'fruit') : [];
    if (fruitKeys.length && (role === 'snack' || Math.random() < 0.7)){
      const opts = fruitKeys.map(k=>FOODS.fruit.find(f=>f.key===k))
        .filter(f => f && passesPrefs(f) && !isDisliked(f)
          && !familyClash(f, sel) && fitsBudget('fruit', f) && mealAllowsFood(role, f));
      if (opts.length) sel.fruit.push(opts[Math.floor(Math.random()*opts.length)].key);
    }
    const sauceKeys = recipe ? recipeOptions(recipe, 'sauce') : [];
    const sauceCore = isCore(recipe, 'sauce');
    if (sauceKeys.length && (sauceCore || (role !== 'snack' && Math.random() < 0.7))){
      const base = sauceKeys.map(k=>FOODS.sauce.find(f=>f.key===k))
        .filter(f => f && passesPrefs(f) && !isDisliked(f)
          && !familyClash(f, sel) && mealAllowsFood(role, f));
      let opts = base.filter(sauceAllowed);
      if (!opts.length && sauceCore){
        /* Nothing survived the family or time-of-day rules. Those are
           preferences; the sauce is the dish. */
        const relaxed = sauceKeys.map(k=>FOODS.sauce.find(f=>f.key===k))
          .filter(f => f && passesPrefs(f) && !isDisliked(f));
        const allowed = relaxed.filter(sauceAllowed);
        if (allowed.length) opts = allowed;
        else if (relaxed.length) opts = [relaxed.slice().sort((a,b)=>a.kcal-b.kcal)[0]];
      }
      /* On a cut the richness gate can rule out every sauce the dish
         lists. For an ordinary dish that just means no sauce today. For a
         dish built on its sauce, take the lightest one it offers rather
         than serving a lie — the portion engine will keep it small. */
      if (!opts.length && sauceCore && base.length){
        opts = [base.slice().sort((a,b)=>a.kcal - b.kcal)[0]];
      }
      if (opts.length) sel.sauce.push(opts[Math.floor(Math.random()*opts.length)].key);
    }

    /* A single protein that can't carry the meal — either because it needs
       an absurd portion or because it charges too much per gram — gets a
       partner that can, rather than leaving the meal quietly short.
       Vegan cheese shreds are the extreme case: 1.4g of protein per 100g,
       so 280 kcal buys one gram of it. Left alone in the slot it makes the
       target unreachable however the portions are juggled. */
    const anyCarrier = () => sel.protein.some(k=>{
      const f = FOODS.protein.find(x=>x.key===k); return f && carriesProtein(f);
    });
    if (sel.protein.length && !anyCarrier()){
      const held = sel.protein.map(k=>FOODS.protein.find(x=>x.key===k)).filter(Boolean);
      const ok = f =>
        f && !sel.protein.includes(f.key) && carriesProtein(f)
        && passesPrefs(f) && !isDisliked(f) && !familyClash(f, sel)
        && !(f.powder && !POWDER_OK.includes(role))
        && fitsBudget('protein', f)
        && !held.some(h => familyClashPair(h, f))
        && !(held.some(isMeat) && isMeat(f));

      /* Give up as little of the dish as possible: something it already
         calls for, then anything in the day's shopping palette, and only
         then the wider inventory. */
      const recipeKeys = recipe ? recipeOptions(recipe, 'protein') : [];
      const partner =
           palette.protein.find(f => ok(f) && recipeKeys.includes(f.key) && mealAllowsFood(role, f))
        || palette.protein.find(f => ok(f) && mealAllowsFood(role, f))
        || pickFood(listFor('protein'), null, true, 'protein', f => ok(f) && mealAllowsFood(role, f))
        || pickFood(listFor('protein'), null, true, 'protein', ok);
      if (partner){
        sel.protein.push(partner.key);
        if (!palette.protein.some(f=>f.key===partner.key)) palette.protein.push(partner);
        /* An extra protein alongside the dish's own is not a different
           dish: the steak and the eggs are both still there. Recorded so
           the shopping list stays honest, but the dish keeps its name and
           its method. */
        if (!recipeKeys.includes(partner.key)) sel._augmented = true;
      }
    } else if (sel.protein.length === 1){
      const only = FOODS.protein.find(f=>f.key===sel.protein[0]);
      if (only && servingFor('protein', only) > PORTION_CAP.protein){
        const eligible = palette.protein.filter(f =>
          f.key !== only.key && !familyClashPair(only, f)
          && (!recipe || recipeOptions(recipe, 'protein').includes(f.key))
          && !(isMeat(only) && isMeat(f)) && mealAllowsFood(role, f));
        const partner = eligible.find(carriesProtein) || eligible[0];
        if (partner) sel.protein.push(partner.key);
      }
    }

    /* SAFETY NET
       A tight combination — a dish that must work at both breakfast and
       dinner, a small palette and a dietary filter — can leave a meal with
       no protein, carb or fat at all. That produced plates of nothing but
       mushrooms. If a core slot came up empty, fill it from the whole
       inventory with the time-of-day rule relaxed, preferring foods that
       still suit the meal. */
    ['protein','carb','fat'].forEach(slot=>{
      if (sel[slot].filter(Boolean).length) return;
      /* Give up constraints in order of least harm: first try the dish's own
         options, then anything that suits the time of day, and only as a last
         resort ignore the time-of-day rule. */
      const core = f =>
        !familyClash(f, sel)
        && !(f.powder && !POWDER_OK.includes(role))
        && !(slot === 'protein' && isMeat(f) && sel.protein.some(k=>{
             const p = FOODS.protein.find(x=>x.key===k); return p && isMeat(p); }));
      const base = f => core(f) && fitsBudget(slot, f);
      const recipeKeys = recipe ? recipeOptions(recipe, slot) : [];
      const f =
           pickFood(listFor(slot), null, true, slot, x => base(x) && recipeKeys.includes(x.key) && mealAllowsFood(role, x))
        || pickFood(listFor(slot), null, true, slot, x => base(x) && mealAllowsFood(role, x))
        || pickFood(listFor(slot), null, true, slot, base)
        /* Last resort, protein only. A sitting too small for anything to
           clear the budget test still gets a protein source: the portion
           engine floors and rescales whatever lands here, so the outcome is
           a small serving, which beats an empty slot and a dish named after
           a missing food. Unit foods stay out — they cannot be made smaller,
           and the other slots would only crowd out the protein. */
        || (slot === 'protein'
              ? pickFood(listFor(slot), null, true, slot,
                  x => core(x) && !(x.unit && !x.unit.soft))
              : null);
      // the dish no longer describes what's on the plate
      if (f && !recipeKeys.includes(f.key)) sel._improvised = true;
      if (f){
        sel[slot].push(f.key);
        if (palette[slot] && !palette[slot].some(x=>x.key===f.key)) palette[slot].push(f);
      }
    });

    SLOT_DEFS.forEach(d => { if (!sel[d.slot].length && d.slot !== 'sauce' && d.slot !== 'fruit') sel[d.slot] = [""]; });
    if (!sel.fruit.length) sel.fruit = [""];
    /* If the dish had to be improvised around a dietary filter, don't keep
       calling it by its original name — "Protein Pasta Primavera" made with
       a bagel is a lie. Fall back to a plain description of the plate. */
    if (recipe) sel.dish = sel._improvised ? plainTitle(sel) : dishTitle(recipe, sel);
    sel.season = seasoningFor(recipe);
    return sel;
  }

  /* Seasonings the dish is built around. They carry almost no calories at the
     amounts used, so they're listed as guidance rather than portioned like a
     macro source — but a stir-fry without ginger and garlic isn't a stir-fry. */
  /* Seasonings are usually sauces, but a few (nutritional yeast) live in
     another slot. Look everywhere so a seasoning never silently vanishes. */
  function findFoodAnySlot(key){
    for (const arr of Object.values(FOODS)){
      const hit = arr.find(f => f.key === key);
      if (hit) return hit;
    }
    return null;
  }

  function seasoningFor(recipe){
    if (!recipe || !recipe.season) return [];
    return recipe.season
      .map(k=>findFoodAnySlot(k))
      .filter(f=>f && passesPrefs(f) && !isDisliked(f))
      .map(f=>f.name);
  }

  /* An honest description when a recipe couldn't be followed */
  function plainTitle(sel){
    const nameOf = slot => {
      const k = sel[slot] && sel[slot].find(Boolean);
      return k ? shortName(listFor(slot).find(f=>f.key===k)) : '';
    };
    const P = nameOf('protein'), C = nameOf('carb'), V = nameOf('veg');
    const bits = [P, C].filter(Boolean).join(' & ');
    return tidyTitle(bits + (V ? ` with ${V}` : '') + ' Plate') || 'Custom Plate';
  }

  /* Preference-driven picking gets most on-hand food onto the plate, but it
     can't promise it. This pass is the guarantee: anything still unplaced is
     slotted into whichever meal suits it best, replacing that meal's existing
     pick for the same slot. */
  /* A stated quantity is a ceiling for the whole day. Split it across
     however many meals ended up using that food, so three meals sharing
     400g of chicken get roughly 133g each rather than 250g apiece. */
  function onHandCapFor(key){
    const total = (state.mustQty || {})[key];
    if (!total || total <= 0) return null;
    let uses = 0;
    MEALS.forEach(m=>{
      SLOT_DEFS.forEach(d=>{
        if ((state.selections[m.key][d.slot] || []).includes(key)) uses++;
      });
    });
    return uses > 0 ? total / uses : total;
  }

  function enforceOnHand(){
    /* On-hand items are a strong preference, not a licence to break every
       other rule. An item is only placed where it genuinely fits — right
       time of day, no clash with what's already on the plate, no dietary
       violation. Anything that can't be placed cleanly is reported as
       "didn't fit" on the review screen instead of being forced in. */
    const want = (state.mustUse || []).filter(k=>{
      const sl = slotOf(k);
      const f = sl && listFor(sl).find(x=>x.key===k);
      return f && passesPrefs(f) && !isDisliked(f);
    });
    if (!want.length) return;

    const placed = new Set();
    MEALS.forEach(m=>{
      const sel = state.selections[m.key];
      SLOT_DEFS.forEach(d=> sel[d.slot].filter(Boolean).forEach(k=>{
        if (want.includes(k)) placed.add(k);
      }));
    });

    const missing = want.filter(k => !placed.has(k));
    if (!missing.length) return;

    const roleOfMeal = (m, idx) => {
      if (!m.required) return 'snack';
      return m.name === 'BREAKFAST' ? 'breakfast' : 'dinner';
    };

    missing.forEach(key=>{
      const slot = slotOf(key);
      if (!slot) return;
      const food = listFor(slot).find(f=>f.key === key);
      if (!food) return;

      // every meal this could legitimately join, best fit first
      const options = [];
      MEALS.forEach((m, idx)=>{
        const role = roleOfMeal(m, idx);
        const sel0 = state.selections[m.key];
        const rec = RECIPES.find(r=>r.name === sel0._recipe);
        /* The dish has to want it. Veg and fruit are sides so they can join
           any main meal, but a protein, carb, fat or sauce only goes where
           the recipe calls for it — otherwise you get cabbage in a trail mix. */
        const isSide = (slot === 'veg');
        if (rec && !recipeOptions(rec, slot).includes(key)){
          if (!isSide || !m.required || !(rec.veg||[]).length) return;
        }
        if (!mealAllowsFood(role, food)) return;
        if (food.powder && !POWDER_OK.includes(role)) return;
        const sel = sel0;
        if (familyClash(food, sel)) return;
        if (slot === 'protein' && isMeat(food) && sel.protein.some(k=>{
          const f = k && FOODS.protein.find(x=>x.key===k); return f && isMeat(f);
        })) return;
        // a snack can't carry a whole bagel
        if (!m.required){
          const budget = currentTargets().kcal * m.share;
          const min = minPortion(slot, food);
          const g = (food.unit && !food.unit.soft) ? Math.max(food.unit.g * unitStep(food), min) : min;
          if (food.kcal * g / 100 > budget * 0.55) return;
        }
        options.push({m, count: sel[slot].filter(Boolean).length});
      });

      if (!options.length) return;   // reported as "didn't fit"
      options.sort((a,b)=>a.count - b.count);
      const sel = state.selections[options[0].m.key];
      if (sel[slot].includes(key)) return;
      const blank = sel[slot].indexOf("");
      if (blank >= 0) sel[slot][blank] = key;
      else sel[slot].push(key);
    });
  }

  /* After a day is built, note which on-hand items made it in and which
     didn't, so the review screen can be honest about it. */
  function recordOnHandOutcome(){
    const used = new Set();
    MEALS.forEach(m=>SLOT_DEFS.forEach(d=>
      (state.selections[m.key][d.slot]||[]).filter(Boolean).forEach(k=>used.add(k))));
    state.onHandUsed = (state.mustUse||[]).filter(k=>used.has(k));
    state.onHandUnused = (state.mustUse||[]).filter(k=>!used.has(k));
  }

  const STYLE_BLURB = {
    consistent: "Same four Food Blocks in every meal — cook once, portion it out.",
    balanced:   "Protein and carb stay put; fats and sides rotate to keep it interesting.",
    variety:    "A different pick in every slot, no repeats where the inventory allows.",
  };

  function slotFood(slot, key){
    if (!key) return null;
    return listFor(slot).find(f => f.key === key) || null;
  }

  /* Shop-shelf suggestions for whichever sauce landed on this meal, filtered
     to what the person's goal can afford. */
  function brandHint(mealKey){
    const keys = (state.selections[mealKey].sauce || []).filter(Boolean);
    if (!keys.length) return '';
    return keys.map(k=>{
      const f = FOODS.sauce.find(x=>x.key===k);
      if (!f || !f.brands || !f.brands.length) return '';
      const picks = f.brands.slice(0, 2).join(' · ');
      return `<div style="font-size:9px; color:var(--amber); margin-top:8px; line-height:1.6;">
        <svg class="px" aria-hidden="true"><use href="#i-tag"></use></svg> ${f.name} — look for: ${picks}</div>`;
    }).join('');
  }

  /* Honest report on the ingredients you said you had */
  function renderOnHandReview(){
    const host = document.getElementById('onHandReview');
    if (!host) return;
    const listed = (state.mustUse || []);
    if (!listed.length){ host.style.display = 'none'; return; }
    host.style.display = '';

    const nameOf = k => {
      const sl = slotOf(k);
      const f = sl && listFor(sl).find(x=>x.key===k);
      return f ? f.name : k;
    };
    const used = (state.onHandUsed || []).map(nameOf);
    const unused = (state.onHandUnused || []).map(nameOf);

    host.innerHTML = `
      <div class="eaten-head">
        <span class="eaten-title"><svg class="px" aria-hidden="true"><use href="#i-ice"></use></svg> YOUR INGREDIENTS</span>
        <span class="eaten-total">${used.length} of ${listed.length} used</span>
      </div>
      ${used.length ? `<div style="font-size:12px; line-height:1.7; margin-bottom:${unused.length?'10px':'0'};">
        <span style="color:var(--green)">Working into today:</span> ${used.join(' · ')}</div>` : ''}
      ${unused.length ? `<div style="font-size:12px; line-height:1.7;">
        <span style="color:var(--amber)">Didn't fit today:</span> ${unused.join(' · ')}
        <div class="season-hint" style="margin-top:6px;">
          These clashed with something already on the plate, or the day ran out of room.
          Shuffle for a different draw, add a meal, or save them for tomorrow.
        </div></div>` : ''}
    `;
  }

  /* ---------------------------------------------------------
     WHAT THE PREP ACTUALLY CONTAINS
     Each unique dish, the sitting it was built for, and every day it turns
     up on. The suggestion screen used to render state.selections, which is
     only ever one day's working copy — so asking for six meals and being
     shown three was the plan working correctly and reporting badly.
  --------------------------------------------------------- */
  function prepDishUsage(){
    if (!prepReady()) return null;
    const p = state.prep;
    const out = {meals:[], snacks:[]};
    p.meals.forEach((d,i)  => out.meals.push({dish:d,  index:i, store:'meals',  days:[], mealKey:null, day0:0}));
    p.snacks.forEach((d,i) => out.snacks.push({dish:d, index:i, store:'snacks', days:[], mealKey:null, day0:0}));

    p.schedule.forEach((row, d)=>{
      (row.mains || []).forEach((idx, sitting)=>{
        const rec = out.meals[idx]; if (!rec) return;
        rec.days.push(d + 1);
        // remember the first sitting it appears in, so portions are sized
        // against the budget it was actually built for
        if (rec.mealKey == null){ rec.mealKey = (p.mealKeys || [])[sitting]; rec.day0 = d; }
      });
      (row.snacks || []).forEach((idx, sitting)=>{
        const rec = out.snacks[idx]; if (!rec) return;
        rec.days.push(d + 1);
        if (rec.mealKey == null){ rec.mealKey = (p.snackKeys || [])[sitting]; rec.day0 = d; }
      });
    });
    return out;
  }

  /* "Days 1, 3, 5 and 7" — or "every day" when it never varies */
  function servedOnText(days, totalDays){
    if (!days.length) return 'not scheduled';
    if (days.length === totalDays) return totalDays === 1 ? 'today' : 'every day';
    if (days.length === 1) return 'day ' + days[0];
    return 'days ' + days.slice(0,-1).join(', ') + ' and ' + days[days.length-1];
  }

  function suggestionCard(rec, ordinal, total, totalDays){
    const tg = currentTargets();
    const meal = MEALS.find(m=>m.key === rec.mealKey);
    if (!meal) return null;
    const sel = state.selections[rec.mealKey];
    const plan = computeMealPlan(rec.mealKey);
    const selRecipe = sel && sel._recipe ? RECIPES.find(r => r.name === sel._recipe) : null;

    let rows = "";
    SLOT_DEFS.forEach(def=>{
      const parts = (sel[def.slot] || []).map((k,i)=>{
        const g = plan[def.slot][i];
        if (!k || g == null) return null;
        const food = def.list().find(f=>f.key === k);
        if (!food) return null;
        const ul = unitLabel(food, g);
        const tag = isMustUse(food) ? '<svg class="px" aria-hidden="true"><use href="#i-ice"></use></svg> ' : '';
        return `${tag}${food.name} <span style="color:var(--green)">${ul ? ul : g.toFixed(0)+'g'}</span>${ul ? ` <span style="color:var(--muted)">(${g.toFixed(0)}g)</span>` : ''}`;
      }).filter(Boolean);
      if (!parts.length){
        /* Saying "none available" about a slot the recipe never asked for
           reads as a fault. A charcuterie plate has no sauce because it is
           a charcuterie plate. Only flag a gap the dish actually wanted. */
        const wanted = selRecipe
          ? (selRecipe[def.slot] || []).length > 0
          : (def.slot !== 'sauce' && def.slot !== 'fruit');
        if (wanted){
          rows += `<div style="font-size:11px; color:var(--muted); margin-bottom:4px;">${ic(def.icon)} — none available</div>`;
        }
        return;
      }
      rows += `<div style="font-size:12px; margin-bottom:4px;">${ic(def.icon)} ${parts.join(' &nbsp;+&nbsp; ')}</div>`;
    });

    const servings = rec.days.length;
    const card = document.createElement('div');
    card.className = 'panel';
    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; gap:10px; align-items:baseline; margin-bottom:4px;">
        <span style="font-size:11px; color:var(--cyan); letter-spacing:1px;">
          ${rec.store === 'snacks' ? 'SNACK' : 'MEAL'} ${ordinal} OF ${total} · ${escapeHtml(meal.name)}</span>
        <span style="font-size:10px; color:var(--muted); white-space:nowrap;">×${servings}</span>
      </div>
      ${sel.dish ? `<div style="font-family:var(--font-body); font-size:15px; color:${dishColor(rec)}; margin-bottom:6px;"><svg class="px" aria-hidden="true"><use href="#i-plate"></use></svg> ${escapeHtml(sel.dish)}</div>` : ''}
      <div style="font-size:9px; color:var(--muted); margin-bottom:10px;">
        Served ${servedOnText(rec.days, totalDays)} · ~${Math.round(tg.kcal*meal.share)} kcal per serving</div>
      ${rows}
      ${brandHint(rec.mealKey)}
    `;
    return card;
  }

  function renderSuggestion(){
    renderOnHandReview();
    const tg = currentTargets();
    const bits = [];
    if (state.preferences.length) bits.push(`${state.preferences.length} dietary filter${state.preferences.length>1?'s':''}`);
    if (state.cravings.length){
      const names = CRAVINGS.filter(c=>state.cravings.includes(c.key)).map(c=>c.name);
      bits.push(names.join(" + "));
    }
    const favCount = FAV_CATS.reduce((n,c)=> n + favKeys(c.slot).length, 0);
    let modeLine = '';
    if (favCount){
      modeLine = state.discoveryMode === 'new'
        ? `<strong style="color:var(--cyan)">Try Something New:</strong> these are foods you didn't pick, chosen for eating like the ones you did. `
        : `<strong class="n-green">Your Favorites:</strong> built from the foods you starred. `;
    }

    const usage = prepDishUsage();
    const totalDays = prepReady() ? state.prep.schedule.length : 1;
    const nM = usage ? usage.meals.length : MEALS.filter(m=>m.required).length;
    const nS = usage ? usage.snacks.length : MEALS.filter(m=>!m.required).length;

    suggestIntro.innerHTML = modeLine + `${STYLE_BLURB[state.eatingStyle] || ''} ` +
      (bits.length ? `Built around ${bits.join(" and ")}. ` : '') +
      `Here is <strong class="n-green">everything you'd be cooking</strong> — ` +
      `${nM} meal${nM===1?'':'s'}${nS ? ` and ${nS} snack${nS===1?'':'s'}` : ''}` +
      (totalDays > 1 ? `, on rotation across ${totalDays} days` : '') +
      `. Portions are per serving, weighed <strong class="n-amber">raw or dry</strong>` +
      (hasSplit() && trainingDayCount() && trainingDayCount() < prepDayCount()
        ? `, and shown here at the day each dish first appears — the same dish is served bigger on a
           <strong class="n-green">training day</strong> (${targetsFor('train').kcal} kcal)
           than on a <strong style="color:var(--cyan)">rest day</strong> (${targetsFor('rest').kcal} kcal).`
        : `, sized to your <strong class="n-green">${tg.kcal} kcal</strong> target.`);

    suggestList.innerHTML = "";

    /* No prep built (a saved plan from before this existed) — fall back to
       showing the single day that does exist. */
    if (!usage){
      MEALS.forEach(meal=>{
        const card = suggestionCard(
          {dish:state.selections[meal.key], mealKey:meal.key, days:[1],
           store: meal.required ? 'meals' : 'snacks', index:0},
          1, 1, 1);
        if (card) suggestList.appendChild(card);
      });
      return;
    }

    /* Cards are rendered from the working copy, so the day each dish was
       first scheduled on is loaded before its portions are read. Whatever
       day the person was on is put back at the end. */
    const keep = state.activeDay;

    const heading = (text, note) => {
      const h = document.createElement('div');
      h.className = 'panel';
      h.style.padding = '12px 14px';
      h.innerHTML = `<div class="slot-label" style="margin:0;">${text}</div>
        ${note ? `<div style="font-size:11px; color:var(--muted); margin-top:6px; line-height:1.6;">${note}</div>` : ''}`;
      suggestList.appendChild(h);
    };

    if (usage.meals.length){
      heading(`<svg class="px" aria-hidden="true"><use href="#i-plate"></use></svg> ${usage.meals.length} MEAL${usage.meals.length===1?'':'S'} TO COOK`,
        totalDays > 1
          ? `Breakfast, lunch and dinner across ${totalDays} days, drawn from these ${usage.meals.length}.`
          : null);
      usage.meals.forEach((rec, i)=>{
        applyDayToSelections(rec.day0 + 1);
        const card = suggestionCard(rec, i+1, usage.meals.length, totalDays);
        if (card) suggestList.appendChild(card);
      });
    }

    if (usage.snacks.length){
      heading(`<svg class="px" aria-hidden="true"><use href="#i-snack"></use></svg> ${usage.snacks.length} SNACK${usage.snacks.length===1?'':'S'}`,
        'Counted separately from your meals — these fill the gaps between them.');
      usage.snacks.forEach((rec, i)=>{
        applyDayToSelections(rec.day0 + 1);
        const card = suggestionCard(rec, i+1, usage.snacks.length, totalDays);
        if (card) suggestList.appendChild(card);
      });
    }

    applyDayToSelections(keep);

    const foot = document.createElement('div');
    foot.className = 'panel';
    foot.innerHTML = `<div style="font-size:11px; color:var(--muted); line-height:1.7;">
      Weights are raw / dry. Season however you like — you can adjust every
      amount, and see the plan laid out day by day, once you take this loadout.</div>`;
    suggestList.appendChild(foot);
  }

  btnShuffle.addEventListener('click', ()=>{
    generateSuggestion();
    renderSuggestion();
  });
  btnUseSuggestion.addEventListener('click', ()=> proceedToLoadout(false));
  btnBuildOwn.addEventListener('click', ()=> proceedToLoadout(true));

