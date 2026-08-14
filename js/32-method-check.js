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

  const MC_STOP = {
    'and':1,'with':1,'the':1,'raw':1,'dry':1,'cooked':1,'fresh':1,'low':1,'fat':1,'free':1,
    'plain':1,'whole':1,'white':1,'red':1,'green':1,'light':1,'skim':1,'lean':1,'style':1,
    'powder':1,'ground':1,'canned':1,'frozen':1,'mix':1,'baby':1,'sweet':1,'hot':1,'mini':1,
    'large':1,'small':1,'per':1,'cup':1,'nonfat':1,'reduced':1,'thin':1,'protein':1,'carb':1,
    'veg':1,'fruit':1,'sauce':1,'breast':1,'thigh':1,'fillet':1,'slice':1,'sliced':1,
    'spread':1,'toast':1,'roll':1,'stick':1,'sticks':1,'chips':1,'bites':1,'cut':1,'cuts':1,
    /* Head nouns that are also cooking verbs. "Roast at 220C" must not pull in
       Chuck Roast, and "Chop the salad" must not pull in Pork Loin Chop. */
    'roast':1,'roasts':1,'chop':1,'chops':1,'grill':1,'bake':1,'bakes':1,'steam':1,
    'mince':1,'dice':1,'press':1,'wrap':1,'wraps':1,'stock':1,'water':1,'rest':1,
    'fries':1,'blend':1,'melt':1
    /* butter, cream and oil are deliberately NOT here. They read as verbs
       occasionally, but they are exactly the calorie-dense extras a method can
       call for without them appearing on the plate, which is the whole point
       of this check. A rare false positive is the right trade. */
  };

  let mcFoods = null;    // key -> food
  let mcTokens = null;   // word -> {key:1}

  function mcIndex(){
    if (mcFoods) return;
    mcFoods = {};
    mcTokens = {};
    Object.keys(FOODS).forEach(function(slot){
      (FOODS[slot] || []).forEach(function(f){ if (f && f.key) mcFoods[f.key] = f; });
    });
    /* Index the HEAD NOUN only -- the last real word of the name. A modifier
       is not the ingredient: "dark" must not pull in Dark Chocolate when a step
       says "cook until the edges are dark", and "grain" must not pull in Whole
       Grain Crackers from "warm the grain". The head noun is what a step is
       actually naming. */
    Object.keys(mcFoods).forEach(function(k){
      const words = String(mcFoods[k].name || '').replace(/\([^)]*\)/g, ' ')
        .split(/[^A-Za-z]+/).filter(function(w){ return w.length >= 3; });
      if (!words.length) return;
      const head = words[words.length - 1].toLowerCase();
      if (head.length < 4 || MC_STOP[head]) return;
      (mcTokens[head] = mcTokens[head] || {})[k] = 1;
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

  function mcLookup(w){
    mcIndex();
    if (mcTokens[w]) return mcTokens[w];
    if (w.length > 4 && w.charAt(w.length - 1) === 's' && mcTokens[w.slice(0, -1)]) return mcTokens[w.slice(0, -1)];
    if (mcTokens[w + 's']) return mcTokens[w + 's'];
    return null;
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
    const dense = [], light = [];
    if (!recipe || !recipe.steps) return { dense: dense, light: light };
    mcIndex();
    const onPlate = dishPlateKeys(sel);
    const ofRecipe = mcRecipeKeys(recipe);

    const seenWord = {}, seenName = {};
    recipe.steps.forEach(function(step){
      String(step).toLowerCase().split(/[^a-z]+/).forEach(function(w){
        if (seenWord[w]) return;
        const hits = mcLookup(w);
        if (!hits) return;
        seenWord[w] = 1;
        const keys = Object.keys(hits);
        if (keys.length > MC_GENERIC_AT) return;                                 // category word
        if (keys.some(function(k){ return onPlate[k] !== undefined; })) return;  // it IS on the plate
        if (keys.every(function(k){ return ofRecipe[k]; })) return;              // a slot alternative
        if (keys.every(mcIsSeasoning)) return;                                   // spice

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
    return { dense: dense, light: light };
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
