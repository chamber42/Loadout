'use strict';
/* ============================================================
   LOADOUT - CHECKING A METHOD AGAINST THE ACTUAL PLATE

   A dish carries _recipe (which recipe it was built from) and
   _improvised (whether it still resembles that recipe). The
   flag is only set in two of the several places that can change
   a plate, and _recipe is never re-validated after the dish is
   edited. So a plate can drift away from its recipe while still
   claiming the recipe's name -- and the cook plan then prints a
   method describing food that is not on the plate.

   Rather than add the flag to every mutation path and hope none
   is missed later, divergence is COMPUTED here at render time by
   comparing what is actually on the plate against what the
   recipe allows. A computed check cannot drift.

   The second job here is disclosure. A method may legitimately
   call for something that is not a plate ingredient -- a yogurt
   marinade, a brine, oil for the pan. Those need not be counted
   in the day's macros, but they must not be silent: someone
   shopping for the prep needs to know they are required, and
   anything calorie-dense deserves saying out loud.
   ============================================================ */

  const MC_SLOTS = ['protein', 'carb', 'fat', 'veg', 'fruit', 'sauce'];

  /* A word matching many foods is a category ("cheese", "bread"), not an
     ingredient. Indexing only head nouns (below) makes matching precise enough
     that this can be generous -- "yogurt" legitimately covers several products
     and still needs reporting. */
  const MC_GENERIC_AT = 12;
  const MC_CALORIE_DENSE = 250;   // kcal/100g: worth calling out by name

  /* Words that only grade a food rather than name it. "Skim Milk" and "Whole
     Milk" are both what a step means by "milk"; "Egg White Wrap" is not what a
     step means by "egg", so wrap, chips, toast and their kind stay in. */
  const MC_GRADE = {
    'raw':1,'dry':1,'cooked':1,'uncooked':1,'fresh':1,'frozen':1,'canned':1,'plain':1,
    'unsweetened':1,'nonfat':1,'reduced':1,'low':1,'fat':1,'free':1,'light':1,'lite':1,
    'skim':1,'whole':1,'lean':1,'large':1,'medium':1,'small':1,'mini':1,'baby':1,
    'boneless':1,'skinless':1,'long':1,'style':1,'per':1,'the':1,'and':1,'with':1,
  };

  /* Words a method uses for a whole family rather than for one product.
     "Fold the nut butter through" means the peanut butter already on the
     plate, not a tub of dairy butter — but the only food phrase inside it is
     "butter", so without this the step buys you butter you do not need. */
  const MC_SYNONYM = [
    {p:'nut butter', fam:'nutbutter'},
    {p:'olive oil',  fam:'oil'},
    {p:'greek yogurt', fam:'yogurt'},
  ];

  /* ---- USED UP vs EATEN ----
     Not every ingredient a method names but the plate does not carry is the
     same kind of thing. A yogurt marinade or a pickle brine is thrown away:
     what clings to the food is a rounding error, and leaving it out of the
     macros is honest. Milk that oats are cooked in is not thrown away — the
     oats drink it, and it is eaten. So is the flour and breadcrumb on a piece
     of breaded chicken. Calling those "not counted" tells someone their bowl
     is 380 kcal when they just poured 200 ml of milk into it.

     These are the ingredients that end up inside the food. They are disclosed
     as counting, not as free. */
  const MC_ABSORBED = {
    milk:1, milkwhole:1, chocmilk:1, soymilk:1, condensed:1, evapmilk:1,
    heavycream:1, halfhalf:1, coconutmilk:1, coconutcream:1, creme:1,
    cashewcream:1, sourcream:1, sourcreamlt:1, creamcheese:1, creamcheeselight:1,
  };
  /* ...unless the method is marinating in it, which is the case that is
     genuinely thrown away. */
  const MC_DISCARD_CONTEXT = /marinat|marinade|brine|brining|discard/;

  let mcFoods = null;    // key -> food
  let mcPhrases = null;  // [{p, keys, re}] — a food's name as it would be written

  function mcIndex(){
    if (mcFoods) return;
    mcFoods = {};
    mcPhrases = [];
    Object.keys(FOODS).forEach(function(slot){
      (FOODS[slot] || []).forEach(function(f){ if (f && f.key) mcFoods[f.key] = f; });
    });
    /* Index the WHOLE NAME as a phrase, not its head noun.

       Head nouns were chosen so a modifier could not pull a food in — "dark"
       must not find Dark Chocolate in "cook until the edges are dark". But it
       fails the same way in the other direction, and far more often: an
       ordinary word in a sentence lands on whichever product happens to carry
       it as a head noun. "Grill until it has real char on the edges" bought
       Arctic Char. "Brown the meat" bought Goat Meat. "Fold the nut butter
       through" bought Pine Nuts. Across 450 dishes nearly every name this
       reported was one of those.

       A method that means Pine Nuts says "pine nuts". So the step has to
       contain the food's name, with the words that only grade it — skim,
       whole, raw, sliced — dropped, since "cook the oats in milk" plainly
       means the milk. */
    const byPhrase = {};
    Object.keys(mcFoods).forEach(function(k){
      /* Anything after the first comma grades the food — "Chicken Breast,
         skin-on", "Greek Yogurt, 0%", "Provolone, slices" — and a method
         naming it would not repeat that part. */
      const words = String(mcFoods[k].name || '').replace(/\([^)]*\)/g, ' ')
        .split(',')[0]
        .toLowerCase().split(/[^a-z]+/)
        .filter(function(w){ return w.length >= 3 && !MC_GRADE[w]; });
      if (!words.length) return;
      const phrase = words.join(' ');
      (byPhrase[phrase] = byPhrase[phrase] || {})[k] = 1;
    });
    Object.keys(byPhrase).forEach(function(phrase){
      mcPhrases.push({
        p: phrase,
        keys: byPhrase[phrase],
        /* trailing s optional on the last word, so "pine nut butter" still
           finds nothing but "toast the pine nut" finds Pine Nuts */
        re: new RegExp('(^|[^a-z])' + phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + 's?([^a-z]|$)')
      });
    });
  }

  /* Spices and seasonings are calorie-dense per 100g and used by the gram.
     Reporting cumin at 375 kcal/100g as something that could move a day would
     be noise, and noise is how a real warning gets ignored. */
  function mcIsSeasoning(key){
    mcIndex();
    return (FOODS.season || []).some(function(f){ return f && f.key === key; });
  }

  /* Every key the recipe lists anywhere. A food named in the steps that is one
     of the recipe's own alternatives is not an extra ingredient -- it is simply
     the option this plate did not take. */
  function mcRecipeKeys(recipe){
    const keys = {};
    MC_SLOTS.forEach(function(slot){
      (recipe[slot] || []).forEach(function(k){ keys[k] = 1; });
    });
    (recipe.season || []).forEach(function(k){ keys[k] = 1; });
    return keys;
  }

  /* Which slot's list a food came from. */
  function mcSlotOf(key){
    mcIndex();
    const named = {protein:'protein', carbs:'carb', fat:'fat', veg:'veg', fruit:'fruit', sauce:'sauce'};
    let out = null;
    Object.keys(FOODS).forEach(function(slot){
      if (out) return;
      if ((FOODS[slot] || []).some(function(f){ return f && f.key === key; })) out = named[slot] || slot;
    });
    return out;
  }

  /* Every food a step actually names, as {phrase: {key:1}}. */
  function mcNamesIn(text){
    mcIndex();
    const hit = mcPhrases.filter(function(entry){ return entry.re.test(text); });
    MC_SYNONYM.forEach(function(syn){
      if (text.indexOf(syn.p) < 0) return;
      const keys = {};
      Object.keys(mcFoods).forEach(function(k){ if (FAMILY[k] === syn.fam) keys[k] = 1; });
      if (Object.keys(keys).length) hit.push({p: syn.p, keys: keys});
    });
    const found = {};
    hit.forEach(function(entry){
      /* "Simmer in the coconut milk" names Coconut Milk, not Fresh Coconut.
         A phrase sitting inside a longer one that also matched is the same
         words being read twice. */
      const swallowed = hit.some(function(other){
        return other !== entry && (' ' + other.p + ' ').indexOf(' ' + entry.p + ' ') >= 0;
      });
      if (!swallowed) found[entry.p] = entry.keys;
    });
    return found;
  }

  /* Every key actually chosen for this plate. */
  function dishPlateKeys(sel){
    const keys = {};
    if (!sel) return keys;
    MC_SLOTS.forEach(function(slot){
      (sel[slot] || []).forEach(function(k){ if (k) keys[k] = slot; });
    });
    return keys;
  }

  function dishIngredients(sel){
    mcIndex();
    const out = [];
    const keys = dishPlateKeys(sel);
    Object.keys(keys).forEach(function(k){
      const f = mcFoods[k];
      if (f) out.push({ slot: keys[k], name: f.name });
    });
    return out;
  }

  /* Has the plate drifted from the recipe it claims? Computed, not trusted. */
  function dishDiverged(recipe, sel){
    if (!recipe || !sel) return { diverged: false, off: [], missing: [], score: 0 };
    mcIndex();
    const off = [], missing = [];
    MC_SLOTS.forEach(function(slot){
      const allowed = recipe[slot] || [];
      const chosen = (sel[slot] || []).filter(Boolean);
      chosen.forEach(function(k){
        if (allowed.indexOf(k) === -1){
          const f = mcFoods[k];
          off.push({ slot: slot, name: f ? f.name : k });
        }
      });
      /* The recipe defines this slot but the plate has nothing in it. Counting
         this matters: a bacon-and-sourdough plate still pointing at "Shrimp &
         Grits" only has ONE off-recipe item, because bacon happens to be in
         that recipe's protein list. Its empty veg and sauce slots are what
         reveal it is really a different dish. */
      if (allowed.length && !chosen.length) missing.push(slot);
    });
    return { diverged: off.length > 0, off: off, missing: missing,
             score: off.length + missing.length };
  }

  /* Foods the written method names that are NOT on this plate. Split so the
     ones that can actually move a day are reported separately from lemon and
     stock. Seasonings the recipe already declares are excluded. */
  function methodExtras(recipe, sel){
    const dense = [], light = [], absorbed = [];
    if (!recipe || !recipe.steps) return { dense: dense, light: light, absorbed: absorbed };
    mcIndex();
    const onPlate = dishPlateKeys(sel);
    const ofRecipe = mcRecipeKeys(recipe);
    const hasSauce = (sel && (sel.sauce || []).some(Boolean));
    const plateFams = {}, recipeFams = {};
    Object.keys(onPlate).forEach(function(k){ if (FAMILY[k]) plateFams[FAMILY[k]] = 1; });
    Object.keys(ofRecipe).forEach(function(k){ if (FAMILY[k]) recipeFams[FAMILY[k]] = 1; });

    const seenWord = {}, seenName = {};
    recipe.steps.forEach(function(step){
      const text = String(step).toLowerCase();
      const thrownAway = MC_DISCARD_CONTEXT.test(text);
      const named = mcNamesIn(text);
      Object.keys(named).forEach(function(w){
        if (seenWord[w]) return;
        seenWord[w] = 1;
        const keys = Object.keys(named[w]);
        if (keys.length > MC_GENERIC_AT) return;                                 // category word

        /* Matched by family as well as by key. A template lists ALTERNATIVES
           per slot, not a combined ingredient list, and an ordinary English
           word in a step lands on whichever branded product happens to carry
           it as a head noun: "oatmeal" finds Protein Oatmeal, "nuts" finds
           Pine Nuts. Neither is an extra anyone needs to buy when the plate
           already holds rolled oats and the recipe already offers walnuts —
           they are the same food by another name. Anything in a family the
           dish already has is the dish talking about itself. */
        if (keys.some(function(k){ return onPlate[k] !== undefined || plateFams[FAMILY[k]]; })) return;
        if (keys.every(mcIsSeasoning)) return;                                   // spice

        /* Asked before the alternatives test, because milk is an alternative
           protein on an oats recipe — so that test would file the milk the
           method cooks the oats in as one of the dish's own and say nothing,
           when it is the one thing here that changes the numbers. */
        if (!thrownAway && keys.some(function(k){ return MC_ABSORBED[k]; })){
          const eaten = keys.filter(function(k){ return MC_ABSORBED[k]; })
            .map(function(k){ return mcFoods[k]; }).filter(Boolean)
            .sort(function(a, b){ return String(a.name).length - String(b.name).length; })[0];
          if (eaten && !seenName[eaten.name]){
            seenName[eaten.name] = 1;
            absorbed.push({ name: eaten.name, kcal: eaten.kcal });
          }
          return;
        }

        /* Sauces are named loosely — a method says "the cheese sauce" and the
           plate carries High-Protein Cheddar Sauce. If the plate already has a
           sauce, a sauce in the method is that one, not a second bottle. */
        if (hasSauce && keys.every(function(k){ return mcSlotOf(k) === 'sauce'; })) return;

        if (keys.some(function(k){ return ofRecipe[k] || recipeFams[FAMILY[k]]; })) return;

        // the plainest candidate, not the most calorific, so the name reads right
        let best = null;
        keys.forEach(function(k){
          if (mcIsSeasoning(k)) return;
          const f = mcFoods[k];
          if (!f) return;
          if (!best || String(f.name).length < String(best.name).length) best = f;
        });
        if (!best || seenName[best.name]) return;
        seenName[best.name] = 1;
        (best.kcal >= MC_CALORIE_DENSE ? dense : light).push({ name: best.name, kcal: best.kcal });
      });
    });
    return { dense: dense, light: light, absorbed: absorbed };
  }

  /* The block the cook plan prints under a dish. */
  function methodNotesHtml(recipe, sel){
    const parts = [];
    const ing = dishIngredients(sel);
    if (ing.length){
      parts.push('<div class="mc-uses"><strong>This prep uses:</strong> ' +
        escapeHtml(ing.map(function(x){ return x.name; }).join(', ')) + '</div>');
    }

    const d = dishDiverged(recipe, sel);
    if (d.diverged){
      parts.push('<div class="mc-warn"><strong>Your plate differs from this recipe.</strong> ' +
        'It was rebuilt around ' +
        escapeHtml(d.off.map(function(x){ return x.name; }).join(', ')) +
        ', so treat the steps below as a guide and follow your own ingredients. ' +
        'Anything the method names that is not in the list above is not part of your prep.</div>');
    }

    const ex = methodExtras(recipe, sel);
    if (ex.absorbed.length){
      parts.push('<div class="mc-warn"><strong>Goes into the food, so it does count:</strong> ' +
        escapeHtml(ex.absorbed.map(function(x){ return x.name + ' (' + x.kcal + ' kcal/100g)'; }).join(', ')) +
        '. The method cooks it in rather than pouring it away, so it is eaten &mdash; and it is not in ' +
        'the macros above. Use water instead, or put it on the plate.</div>');
    }
    if (ex.dense.length){
      parts.push('<div class="mc-extra"><strong>Also needed, not counted:</strong> ' +
        escapeHtml(ex.dense.map(function(x){ return x.name + ' (' + x.kcal + ' kcal/100g)'; }).join(', ')) +
        '. These are cooking steps rather than plate ingredients, so they are not in your macros ' +
        '&mdash; but you do need them, and they are calorie-dense enough to matter if you are generous.</div>');
    }
    if (ex.light.length){
      parts.push('<div class="mc-aid"><strong>You will also need:</strong> ' +
        escapeHtml(ex.light.map(function(x){ return x.name; }).join(', ')) +
        ' &mdash; used in the cooking rather than served on the plate, so they are ' +
        'not counted in your macros. Buy them anyway; the method needs them.</div>');
    }
    return parts.join('');
  }
