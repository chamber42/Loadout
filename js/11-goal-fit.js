'use strict';
/* ============================================================
   LOADOUT - GOAL FIT
   From app.js lines 5332-5866 of the original single file.
   Loaded in order by index.html; all files share one global scope,
   so declarations here are visible to every file listed after it.
   ============================================================ */

  /* =========================================================
     GOAL FIT
     The same dish is not equally useful to everyone. A hard cut needs a
     plate that lands under about 450 kcal and still carries 30g of protein;
     a bulk needs one that can reach 1100 without asking you to eat two
     kilos of vegetables. Most dishes stretch further than they look, but
     not all of them stretch in both directions, and the ones that only go
     one way are exactly what someone on the wrong side of them needs to
     know about.

     A recipe may declare `goals` explicitly. Where it doesn't, the fit is
     derived from what its own ingredient lists can be dialled to at that
     goal's portion sizes.
  ========================================================= */
  const GOAL_ORDER = ['extreme_loss','loss','maintain','gain'];
  const GOAL_SHORT = {
    extreme_loss:'Cut hard', loss:'Fat loss', maintain:'Maintain', gain:'Bulk',
  };
  const GOAL_NOTE = {
    extreme_loss:'Lands light and still carries its protein.',
    loss:'Comfortable inside a moderate deficit.',
    maintain:'Sits naturally around maintenance portions.',
    gain:'Takes the calories a gaining phase needs without doubling the volume.',
  };

  /* Portion sizes each goal actually eats, in grams of the raw item */
  const GOAL_PORTION = {
    extreme_loss:{protein:150, carb:45,  fat:8,  fruit:80,  sauce:20},
    loss:        {protein:150, carb:65,  fat:12, fruit:100, sauce:25},
    maintain:    {protein:160, carb:85,  fat:18, fruit:120, sauce:30},
    gain:        {protein:200, carb:130, fat:30, fruit:150, sauce:40},
  };
  const SPAN_SLOTS = ['protein','carb','fat','fruit','sauce'];

  /* ---------------------------------------------------------
     SNACK-SIZED DISHES
     GOAL_PORTION is a main-meal serving, and it was being applied to
     everything. A trail mix came out at 1519 kcal and a protein shake at
     148g of protein — a whole day's eating quoted as a snack, which is
     exactly the error that wrecks a deficit for anyone who believes it.

     Worse, the quote and the goal tags were describing different servings:
     recipeLeanBuild sizes the protein down to 15g but still loaded a main
     meal's carb, fat and fruit, so Protein Shake carried an "extreme cut"
     tag while the card beside it read 1151 kcal.

     The app already prices a snack at 0.4 of a main when it builds a prep
     (SNACK_WEIGHT), so that is the factor used here rather than a new one
     invented for the book. A dish counts as snack-sized when snack is the
     only substantial role it claims — breakfast counts as light company,
     lunch and dinner do not.
  --------------------------------------------------------- */
  const SNACK_PORTION = 0.4;

  function isSnackDish(r){
    const slots = (r && r.slots) || [];
    return slots.includes('snack')
        && !slots.includes('lunch')
        && !slots.includes('dinner');
  }

  const SCALED_PORTIONS = {};
  function scalePortions(portions, f){
    const out = {};
    Object.keys(portions).forEach(k=>{ out[k] = portions[k] * f; });
    return out;
  }

  /* The serving this dish is actually eaten at, for the goal being browsed. */
  function portionsFor(r, portions){
    if (!isSnackDish(r)) return portions;
    const id = Object.keys(portions).map(k=>k + portions[k]).join('|');
    if (!SCALED_PORTIONS[id]) SCALED_PORTIONS[id] = scalePortions(portions, SNACK_PORTION);
    return SCALED_PORTIONS[id];
  }

  /* Only what the recipe itself lists. Family expansion is right when the
     builder is hunting a substitute and wrong here: it would let every dish
     claim every goal because some cousin of some ingredient is dense enough.
     The question is what the dish is, not what it could become. */
  function recipeSlotFoods(r, slot){
    return (r[slot] || [])
      .map(k => listFor(slot).find(f => f.key === k))
      .filter(Boolean);
  }

  /* Leanest and richest the dish can be built, at one goal's portions */
  function recipeSpan(r, portions){
    portions = portionsFor(r, portions);
    let lo = 0, hi = 0, loProt = 0, hiProt = 0;
    SPAN_SLOTS.forEach(slot=>{
      const o = recipeSlotFoods(r, slot);
      if (!o.length) return;
      const g = portions[slot];
      let lean = o[0], rich = o[0];
      o.forEach(f=>{ if (f.kcal < lean.kcal) lean = f; if (f.kcal > rich.kcal) rich = f; });
      lo += lean.kcal * g / 100;  loProt += lean.protein * g / 100;
      hi += rich.kcal * g / 100;  hiProt += rich.protein * g / 100;
    });
    return {lo, hi, loProt, hiProt};
  }

  /* The densest thing a slot is allowed to hold. A dish with no starch and
     no real fat can be scaled up on paper and not in a kitchen. */
  function slotCeiling(r, slot){
    return recipeSlotFoods(r, slot).reduce((m,f)=>Math.max(m, f.kcal), 0);
  }

  /* Everything but the protein, at its leanest, at one goal's portions.
     Carbs and fats are largely fixed cost — a plate of fries is a plate of
     fries — so this is the floor the protein has to fit above. */
  function recipeBaseLoad(r, portions){
    portions = portionsFor(r, portions);
    let kcal = 0;
    ['carb','fat','fruit','sauce'].forEach(slot=>{
      const o = recipeSlotFoods(r, slot);
      if (!o.length) return;
      let lean = o[0];
      o.forEach(f=>{ if (f.kcal < lean.kcal) lean = f; });
      kcal += lean.kcal * portions[slot] / 100;
    });
    return kcal;
  }

  /* What the dish costs when it is built as written and the protein is
     sized to actually hit a target rather than to a fixed weight.

     This is the test that matters in a deficit and it took two wrong turns
     to get right. Sizing protein at a flat 150g punished egg whites and
     cottage cheese, which are exactly what a hard cut lives on. Letting the
     leanest option in *every* slot stand in went too far the other way and
     had carbonara passing as a cutting dish on the grounds that it could be
     made with egg whites and no cream — at which point it isn't carbonara.
     So: the dish's own first-choice ingredients, with only the protein
     resized. What the dish is, priced honestly. */
  function recipeLeanBuild(r, portions, targetProtein){
    const o = recipeSlotFoods(r, 'protein').filter(f=>f.protein > 0);
    if (!o.length) return Infinity;
    const f = o[0];
    const grams = targetProtein / (f.protein / 100);
    if (grams > 420) return Infinity;   // nobody is eating that much of it
    return f.kcal * grams / 100 + recipeBaseLoad(r, portions);
  }

  /* The dish as written, at a gaining phase's portions */
  function recipeDefaultAt(r, portions){
    portions = portionsFor(r, portions);
    let kcal = 0;
    SPAN_SLOTS.forEach(slot=>{
      const o = recipeSlotFoods(r, slot);
      if (o.length) kcal += o[0].kcal * portions[slot] / 100;
    });
    return kcal;
  }

  const GOAL_FIT_CACHE = {};

  function derivedGoals(r){
    const snackOnly = isSnackDish(r);
    const mid = recipeSpan(r, GOAL_PORTION.maintain);
    const big = recipeSpan(r, GOAL_PORTION.gain);
    // a bulk needs somewhere for the calories to go
    const carries = slotCeiling(r,'carb') >= 200 || slotCeiling(r,'fat') >= 400;
    const bigDefault = recipeDefaultAt(r, GOAL_PORTION.gain);
    const out = [];
    if (snackOnly){
      /* These are a snack's budget, not a meal's. goalFitScore holds what a
         main meal is worth at each goal — 420, 520, 640, 900 — and a snack
         is priced at SNACK_PORTION of a main when the prep is built, so its
         budget is around 170, 210, 260 and 360 kcal. The tests sit just
         above those, which is what stops a 600 kcal trail mix from being
         offered to someone on a hard cut as though it were a snack. */
      if (recipeLeanBuild(r, GOAL_PORTION.extreme_loss, 15) <= 190) out.push('extreme_loss');
      if (recipeLeanBuild(r, GOAL_PORTION.loss, 15) <= 250)         out.push('loss');
      if (mid.lo <= 340 && mid.hi >= 150)                           out.push('maintain');
      if (big.hi >= 460 && carries && bigDefault >= 240)            out.push('gain');
    } else {
      if (recipeLeanBuild(r, GOAL_PORTION.extreme_loss, 32) <= 470) out.push('extreme_loss');
      if (recipeLeanBuild(r, GOAL_PORTION.loss, 30) <= 620)         out.push('loss');
      if (mid.lo <= 840 && mid.hi >= 430)                           out.push('maintain');
      if (big.hi >= 1150 && big.hiProt >= 38 && carries && bigDefault >= 600) out.push('gain');
    }
    // nothing here is useless — anything that fits nowhere is a maintenance dish
    if (!out.length) out.push('maintain');
    return out;
  }

  function recipeGoals(r){
    if (Array.isArray(r.goals) && r.goals.length) return r.goals;
    if (!GOAL_FIT_CACHE[r.name]) GOAL_FIT_CACHE[r.name] = derivedGoals(r);
    return GOAL_FIT_CACHE[r.name];
  }
  function recipeFitsGoal(r, goal){
    return !goal || goal === 'any' || recipeGoals(r).includes(goal);
  }

  /* What the card should quote. Reading "~450 kcal" on every dish is what
     made the book feel like a cutting book: the number was a fixed portion,
     not the reader's portion. Quote it at the goal being browsed. */
  function recipeProfileAt(r, goal){
    const portions = portionsFor(r, GOAL_PORTION[goal] || GOAL_PORTION.maintain);
    let kcal = 0, protein = 0, carbs = 0;
    SPAN_SLOTS.forEach(slot=>{
      const o = recipeSlotFoods(r, slot);
      if (!o.length) return;
      const f = o[0], g = portions[slot];
      kcal += f.kcal * g / 100;
      protein += f.protein * g / 100;
      carbs += f.carbs * g / 100;
    });
    return {kcal:Math.round(kcal), protein:Math.round(protein), carbs:Math.round(carbs)};
  }

  /* How well the dish's natural landing point matches the goal, used only
     to order the list so the best fits are at the top. */
  function goalFitScore(r, goal){
    if (!goal || goal === 'any') return 0;
    const p = recipeProfileAt(r, goal);
    const want = {extreme_loss:420, loss:520, maintain:640, gain:900}[goal] || 640;
    let score = Math.abs(p.kcal - want);
    // in a deficit, protein per calorie is the thing that decides it
    if (goal === 'extreme_loss' || goal === 'loss'){
      const share = p.kcal ? (p.protein * 4 / p.kcal) : 0;
      score -= share * 900;
    }
    return score;
  }

  /* ---------------------------------------------------------
     HEARTIER SWAPS
     The mirror of lighterSwaps. Every card offered a way down and none
     offered a way up, which reads as a cutting book even when the dish is
     perfectly good at 3000 kcal. Same rules — same family only, so it stays
     the dish you chose rather than a different meal wearing its name.
  --------------------------------------------------------- */
  function heartierSwaps(recipe){
    const swaps = [];
    let added = 0;
    const per = {protein:150, carb:70, fat:15, sauce:30};

    SWAP_SLOTS.forEach(slot=>{
      const all = recipeOptions(recipe, slot)
        .map(k=>listFor(slot).find(f=>f.key===k))
        .filter(f=>f && passesPrefs(f) && !isDisliked(f));
      if (all.length < 2) return;

      const base = all.find(f=>(recipe[slot]||[]).includes(f.key)) || all[0];
      const fam = FAMILY[base.key];
      if (!fam) return;
      const opts = all.filter(f=>FAMILY[f.key] === fam);
      if (opts.length < 2) return;

      const rich = opts.reduce((a,b)=> b.kcal > a.kcal ? b : a, base);
      if (rich.key === base.key) return;

      /* Calories are the point, but not at any price: a protein swap that
         halves the protein is a fat swap wearing a protein's name. */
      if (slot === 'protein' && rich.protein < base.protein * 0.6) return;
      const diff = (rich.kcal - base.kcal) * per[slot] / 100;
      if (diff < 25) return;
      added += diff;
      const nm = swapNames(base, rich);
      swaps.push({slot, from: nm.from, to: nm.to, fromKey:base.key, toKey:rich.key});
    });

    return {added: Math.round(added), swaps};
  }

  /* A copy of the recipe with the richer option promoted to first choice */
  function heartenRecipe(recipe){
    const {swaps} = heartierSwaps(recipe);
    const copy = {...recipe, name: recipe.name + ' (heartier)'};
    swaps.forEach(sw=>{
      const list = (recipe[sw.slot] || []).slice();
      const without = list.filter(k=>k !== sw.toKey);
      copy[sw.slot] = [sw.toKey, ...without];
    });
    return copy;
  }

  function recipeMatchesFilter(r, filter){
    if (filter === 'all') return true;
    const p = recipeProfile(r);
    if (filter === 'highprot') return p.kcal > 0 && (p.protein * 4 / p.kcal) >= 0.32;
    if (filter === 'highcarb') return p.kcal > 0 && (p.carbs * 4 / p.kcal) >= 0.45;
    if (filter === 'treat')    return (r.crave || []).includes('treat')
                                   || ((r.crave || []).includes('sweet') && r.form === 'Treat');
    if (filter === 'lowcal')   return p.kcal > 0 && p.kcal <= 500;
    if (filter === 'quick')    return (r.crave || []).includes('nocook');
    if (filter === 'veg')      return !(r.protein || []).some(k=>{
      const f = FOODS.protein.find(x=>x.key===k); return f && isMeat(f);
    });
    if (filter === 'breakfast') return (r.slots || []).includes('breakfast');
    return true;
  }

  /* How a dish relates to what was typed.
       tier 1 — the name says it, or it is the dish's default ingredient:
                this is a chicken recipe.
       tier 2 — the ingredient is one of the alternatives further down a
                slot: the dish can be made with it, but isn't built on it.
       tier 0 — nothing to do with it.
     Seasonings count for tier 1: a dish built around garlic is a garlic
     dish even though garlic is never the headline ingredient. */
  const RECIPE_SEARCH_SLOTS = ['protein','carb','fat','veg','fruit','sauce'];

  function recipeQueryHit(r, q){
    if (matchesQuery(r.name, q)) return {tier:1, names:[]};

    let primary = false;
    const alts = [];
    RECIPE_SEARCH_SLOTS.forEach(slot=>{
      (r[slot] || []).forEach((k, i)=>{
        const f = listFor(slot).find(x=>x.key===k);
        if (!f || !matchesQuery(f.name, q)) return;
        if (i === 0) primary = true;
        else alts.push(shortName(f));
      });
    });
    if (primary) return {tier:1, names:[]};

    // seasonings the dish is built around
    if ((r.season || []).some(k=>{
      const f = findFoodAnySlot(k);
      return f && matchesQuery(f.name, q);
    })) return {tier:1, names:[]};

    if (alts.length) return {tier:2, names:[...new Set(alts)]};
    return {tier:0, names:[]};
  }

  function renderRecipeBook(){
    const q = (state.recipeQuery || '').trim().toLowerCase();
    const filter = state.recipeFilter || 'all';
    const course = state.recipeCourse || 'all';

    /* Course first: people arrive with a meal in mind before a dish. */
    const courseHost = document.getElementById('recipeCourses');
    if (courseHost){
      courseHost.innerHTML = RECIPE_COURSES.map(c=>
        `<button class="choice-btn${course===c.key?' selected':''}" data-rc="${c.key}"
          style="min-height:42px; justify-content:center;"><span><strong>${c.label}</strong></span></button>`).join('');
      courseHost.querySelectorAll('[data-rc]').forEach(b=>
        b.addEventListener('click', ()=>{ state.recipeCourse = b.getAttribute('data-rc'); renderRecipeBook(); }));
    }

    document.getElementById('recipeFilters').innerHTML = RECIPE_FILTERS.map(f=>
      `<button class="choice-btn${filter===f.key?' selected':''}" data-rf="${f.key}"
        style="min-height:46px; justify-content:center;"><span><strong>${f.label}</strong></span></button>`).join('');
    document.getElementById('recipeFilters').querySelectorAll('[data-rf]').forEach(b=>
      b.addEventListener('click', ()=>{ state.recipeFilter = b.getAttribute('data-rf'); renderRecipeBook(); }));

    /* The goal band is a separate axis from the filters above: "high protein"
       and "for a bulk" are different questions and people ask both. */
    const goal = state.recipeGoal || 'any';
    const myGoal = state.goal || null;
    const goalBtns = [{key:'any', label:'All goals'}]
      .concat(GOAL_ORDER.map(g=>({key:g, label:GOAL_SHORT[g] + (g === myGoal ? ' <svg class="px" aria-hidden="true"><use href="#i-star"></use></svg>' : '')})));
    document.getElementById('recipeGoals').innerHTML = goalBtns.map(g=>
      `<button class="choice-btn${goal===g.key?' selected':''}" data-rg="${g.key}"
        style="min-height:46px; justify-content:center;"><span><strong>${g.label}</strong></span></button>`).join('');
    document.getElementById('recipeGoals').querySelectorAll('[data-rg]').forEach(b=>
      b.addEventListener('click', ()=>{ state.recipeGoal = b.getAttribute('data-rg'); renderRecipeBook(); }));

    /* Portions quoted on the cards follow whichever goal is being browsed,
       falling back to the character's own. */
    const quoteGoal = (goal !== 'any') ? goal : (myGoal || 'maintain');

    let list = (course === 'sauce') ? [] : RECIPES
      .filter(r=>recipeInCourse(r, course))
      .filter(r=>recipeMatchesFilter(r, filter))
      .filter(r=>recipeFitsGoal(r, goal));
    if (goal !== 'any') list = list.slice().sort((a,b)=>goalFitScore(a,goal) - goalFitScore(b,goal));
    /* Searching an ingredient used to return anything that merely allowed it
       somewhere down its list of alternatives — so "chicken" turned up dishes
       whose card read "Ground Beef · Tortilla". Dishes actually built on the
       ingredient come first; ones that can only take it as a swap are held
       back under their own heading, and say which swap made them match. */
    let swaps = [];
    if (q){
      const built = [], optional = [];
      list.forEach(r=>{
        const hit = recipeQueryHit(r, q);
        if (hit.tier === 1) built.push(r);
        else if (hit.tier === 2) optional.push({r, names: hit.names});
      });
      list = built;
      swaps = optional;
    }

    /* Sauces are made in a batch and kept, so they live alongside the dishes
       rather than inside them. They are a course of their own, and also show
       under "Everything" below the dishes. */
    const sauceHits = (course === 'sauce' || course === 'all')
      ? SAUCE_RECIPES.filter(s=>{
          if (!q) return true;
          return matchesQuery(s.name, q)
              || s.ingredients.some(x=>matchesQuery(x, q));
        })
      : [];

    document.getElementById('recipeCount').innerHTML = ((list.length || swaps.length || sauceHits.length)
      ? `<strong class="n-green">${list.length}</strong> of ${RECIPES.length} recipes`
        + (swaps.length ? ` · <strong style="color:var(--muted)">${swaps.length}</strong> that can take it as a swap` : '')
        + (sauceHits.length ? ` · <strong class="n-amber">${sauceHits.length}</strong> sauces` : '')
      : `Nothing matches. Try a different word, or clear the filter.`)
      + `<span class="rgoal-hint">${goal === 'any'
          ? (myGoal ? `Calories below are quoted at ${escapeHtml(GOAL_SHORT[myGoal] || 'maintenance')} portions — your goal. Pick a different goal above to see the same dishes sized for it.`
                    : 'Calories below are quoted at maintenance portions. Pick a goal above to see the same dishes sized for it.')
          : escapeHtml(GOAL_NOTE[goal] || '') + ' Portions and calories below are sized for it.'}</span>`;

    // one array behind every group so the buttons keep pointing at the right dish
    const shown = list.concat(swaps.map(s=>s.r));
    const swapNames = swaps.map(s=>s.names);

    /* One card. Shut, it is a name and the two numbers worth comparing;
       open, it is the whole recipe. */
    function cardHtml(r, i){
      const asSwap = i >= list.length ? swapNames[i - list.length] : null;
      const p = recipeProfileAt(r, quoteGoal);
      const fits = recipeGoals(r);
      const ings = recipeIngredients(r);
      const seasons = recipeSeasonings(r);
      const tags = [];
      if (p.kcal && p.protein*4/p.kcal >= 0.32) tags.push('high protein');
      if (p.kcal && p.carbs*4/p.kcal >= 0.45) tags.push('high carb');
      if ((r.crave || []).includes('treat') || r.form === 'Treat') tags.push('sweet treat');
      if ((r.crave || []).includes('nocook')) tags.push('no cooking');
      if ((r.slots || []).includes('breakfast')) tags.push('breakfast');
      const light = lighterSwaps(r);
      const hearty = heartierSwaps(r);
      const ct = cookTime(r, 1);
      return `<details class="rcard">
        <summary class="rsum">
          <span class="rname">${escapeHtml(r.name)}</span>
          <span class="rmeta rsum-meta">~${p.kcal} kcal · ${p.protein}g protein</span>
        </summary>
        <div class="rbody">
        <ul class="ringred">${ings.map(g=>
          `<li>${escapeHtml(g.primary)}${g.alts.length
            ? `<span class="ralt">or ${escapeHtml(g.alts.join(' · '))}</span>` : ''}</li>`).join('')}</ul>
        ${seasons.length ? `<div class="rmeta">Season with ${escapeHtml(seasons.join(' · '))}.</div>` : ''}
        ${asSwap ? `<div class="rmeta" style="color:var(--muted);">Not built on it — swap in ${escapeHtml(asSwap.join(' or '))}.</div>` : ''}
        ${ct ? `<div class="rmeta">
          ${ic(GEAR[ct.gear].icon)} ${mins(ct.active)} hands-on${ct.total > ct.active
            ? ` · ${mins(ct.total)} start to finish` : ''}</div>` : ''}
        <div>${GOAL_ORDER.filter(g=>fits.includes(g)).map(g=>
            `<span class="rtag goal${g === myGoal ? ' mine' : ''}">${escapeHtml(GOAL_SHORT[g])}</span>`).join('')}</div>
        <div>${tags.map(t=>`<span class="rtag">${t}</span>`).join('')}</div>
        ${light.saving > 40 ? `<div class="rmeta" style="color:var(--green); margin-top:8px;">
          <svg class="px" aria-hidden="true"><use href="#i-feather"></use></svg> Lighter version saves about ${light.saving} kcal —
          ${escapeHtml(light.swaps.map(sw=>sw.from + ' → ' + sw.to).join(', '))}
        </div>` : ''}
        ${hearty.added > 60 ? `<div class="rmeta" style="color:var(--amber); margin-top:8px;">
          <svg class="px" aria-hidden="true"><use href="#i-meat"></use></svg> Heartier version adds about ${hearty.added} kcal —
          ${escapeHtml(hearty.swaps.map(sw=>sw.from + ' → ' + sw.to).join(', '))}
        </div>` : ''}
        ${(r.steps && r.steps.length) ? `<details class="rsteps">
          <summary>METHOD — ${r.steps.length} steps</summary>
          <ol>${r.steps.map(s=>`<li>${escapeHtml(s)}</li>`).join('')}</ol>
        </details>` : ''}
        <button class="mini-btn add" data-rmake="${i}" style="margin-top:10px;"><svg class="px" aria-hidden="true"><use href="#i-plate"></use></svg> PUT THIS ON A MEAL</button>
        ${light.saving > 40 ? `<button class="mini-btn add" data-rlight="${i}" style="margin-top:6px;"><svg class="px" aria-hidden="true"><use href="#i-feather"></use></svg> PUT ON A MEAL, LIGHTER</button>` : ''}
        ${hearty.added > 60 ? `<button class="mini-btn add" data-rhearty="${i}" style="margin-top:6px;"><svg class="px" aria-hidden="true"><use href="#i-meat"></use></svg> PUT ON A MEAL, HEARTIER</button>` : ''}
        </div>
      </details>`;
    }

    /* Gather into families, keeping the flat index each card was given. */
    const groups = new Map();
    shown.forEach((r, i)=>{
      const fam = (i >= list.length) ? `Can be made with ${q}` : recipeFamily(r);
      if (!groups.has(fam)) groups.set(fam, []);
      groups.get(fam).push(i);
    });
    const order = FAMILY_ORDER.concat(['Everything Else'])
      .filter(f=>groups.has(f))
      .concat([...groups.keys()].filter(f=>!FAMILY_ORDER.includes(f) && f !== 'Everything Else'));

    /* A short book has nothing to hide behind, and a search has already
       narrowed things, so both open on arrival. */
    const openAll = !!q || shown.length <= 12 || order.length <= 1;

    const sections = order.map(fam=>{
      const idxs = groups.get(fam);
      return `<details class="panel rfam"${openAll ? ' open' : ''}>
        <summary>
          <span class="rfam-name">${escapeHtml(fam)}</span>
          <span class="rfam-count">${idxs.length}</span>
        </summary>
        <div class="rfam-body">${idxs.map(i=>cardHtml(shown[i], i)).join('')}</div>
      </details>`;
    }).join('');

    const host = document.getElementById('recipeList');
    host.innerHTML = sections;

    document.getElementById('sauceList').innerHTML = sauceHits.length
      ? `<details class="panel rfam"${(openAll || course === 'sauce') ? ' open' : ''}>
          <summary>
            <span class="rfam-name">Batch Sauces</span>
            <span class="rfam-count">${sauceHits.length}</span>
          </summary>
          <div class="rfam-body">` + sauceHits.map(s=>{
          const food = FOODS.sauce.find(f=>f.key === s.key);
          return `<details class="rcard">
            <summary class="rsum">
              <span class="rname">${escapeHtml(s.name)}</span>
              <span class="rmeta rsum-meta">${escapeHtml(s.per)} · makes ${escapeHtml(s.yield)}</span>
            </summary>
            <div class="rbody">
            <ul class="ringred">${s.ingredients.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul>
            <details class="rsteps">
              <summary>METHOD — ${s.steps.length} steps</summary>
              <ol>${s.steps.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ol>
            </details>
            ${food ? `<div class="rmeta" style="margin-top:8px; color:var(--muted);">
              In the food list as <strong>${escapeHtml(food.name)}</strong> — pick it as a sauce on any meal.</div>` : ''}
            </div>
          </details>`;
        }).join('') + `</div></details>`
      : '';

    host.querySelectorAll('[data-rmake]').forEach(b=>b.addEventListener('click', ()=>{
      const r = shown[parseInt(b.getAttribute('data-rmake'),10)];
      if (r) openRecipePlacer(r);
    }));
    host.querySelectorAll('[data-rlight]').forEach(b=>b.addEventListener('click', ()=>{
      const r = shown[parseInt(b.getAttribute('data-rlight'),10)];
      if (r) openRecipePlacer(lightenRecipe(r));
    }));
    host.querySelectorAll('[data-rhearty]').forEach(b=>b.addEventListener('click', ()=>{
      const r = shown[parseInt(b.getAttribute('data-rhearty'),10)];
      if (r) openRecipePlacer(heartenRecipe(r));
    }));
  }

  /* A recipe is no use until it's on a particular meal, so ask which. */
  function openRecipePlacer(recipe){
    const slots = (characterExists() && MEALS && MEALS.length) ? MEALS : null;
    const host = document.getElementById('recipePlaceBody');
    document.getElementById('recipePlaceTitle').textContent = recipe.name.toUpperCase();

    if (!slots){
      host.innerHTML = `<div class="fav-nores">Build a prep plan first and your meals will appear here to choose from.</div>
        <button class="btn-primary" id="rpGoRoadmap" style="margin-top:14px;">GO TO THE LOADOUT</button>`;
      openModal('modalRecipePlace');
      document.getElementById('rpGoRoadmap').addEventListener('click', ()=>{
        closeModal('modalRecipePlace'); goTab('prep');
      });
      return;
    }

    const usable = slots.map((m, idx)=>{
      const role = !m.required ? 'snack' : (m.name === 'BREAKFAST' ? 'breakfast' : 'dinner');
      return {m, idx, ok: recipeUsable(recipe, role), role};
    });

    host.innerHTML = `
      <p class="subtitle" style="font-size:var(--fs-body); margin:0 0 14px;">
        Which meal should this go on? It replaces whatever is planned there.
      </p>` +
      usable.map(u=>`
        <button class="choice-btn${u.ok ? '' : ' locked'}" data-rpslot="${u.m.key}" ${u.ok ? '' : 'disabled'}
          style="width:100%; margin-bottom:8px;">
          <span><strong>${escapeHtml(u.m.name || u.m.label)}</strong>
          <span class="desc">${u.ok
            ? 'Currently: ' + escapeHtml((state.selections[u.m.key] || {}).dish || 'nothing planned')
            : "Doesn't suit this time of day"}</span></span>
        </button>`).join('');

    openModal('modalRecipePlace');
    host.querySelectorAll('[data-rpslot]').forEach(b=>b.addEventListener('click', ()=>{
      placeRecipeOnMeal(recipe, b.getAttribute('data-rpslot'));
      closeModal('modalRecipePlace');
      renderEatenPanel(); renderMealTimeline(); refreshTargets();
      showScreen('screen-loadout');
    }));
  }

  /* Build just this one meal from the recipe, leaving the rest of the day
     alone, then re-price the whole day around it. */
  function placeRecipeOnMeal(recipe, mealKey){
    const meal = MEALS.find(m=>m.key === mealKey);
    if (!meal) return;
    const role = !meal.required ? 'snack' : (meal.name === 'BREAKFAST' ? 'breakfast' : 'dinner');

    /* Choosing a dish by name is a literal request. Family expansion is
       right when the app is picking for you — chicken breast or thigh, either
       is a stir-fry — but wrong here: it turned "Butter Chicken" into butter
       halloumi and "Beef Chili" into navy bean chili. So a hand-picked recipe
       uses only what its author listed, in the order they listed it. */
    const sel = {protein:[], carb:[], fat:[], veg:[], fruit:[], sauce:[],
                 dish:'', _recipe:recipe.name};

    const firstUsable = (slot, want)=>{
      const out = [];
      for (const k of (recipe[slot] || [])){
        if (out.length >= want) break;
        let f = listFor(slot).find(x=>x.key === k);
        if (f && isDisliked(f)) f = substituteFor(slot, k);
        if (!f || !passesPrefs(f) || isDisliked(f)) continue;
        if (f.powder && !POWDER_OK.includes(role)) continue;
        if (out.some(o=>familyClashPair(o, f))) continue;
        if (slot === 'protein' && isMeat(f) && out.some(isMeat)) continue;
        out.push(f);
      }
      return out;
    };

    [['protein',1], ['carb',1], ['fat',1],
     ['veg', role === 'snack' ? 0 : 2], ['fruit',1], ['sauce',1]].forEach(([slot, want])=>{
      if (!want) return;
      sel[slot] = firstUsable(slot, want).map(f=>f.key);
    });

    /* If a dietary filter emptied a core slot, fall back to the family so the
       meal is still buildable — and say so in the title rather than pretending
       it's the original dish. */
    ['protein','carb','fat'].forEach(slot=>{
      if (sel[slot].length) return;
      const f = pickFood(listFor(slot), null, true, slot, x =>
        recipeOptions(recipe, slot).includes(x.key)
        && !familyClash(x, sel) && mealAllowsFood(role, x)
        && !(x.powder && !POWDER_OK.includes(role)));
      if (f){ sel[slot].push(f.key); sel._improvised = true; }
    });

    SLOT_DEFS.forEach(d => { if (!sel[d.slot].length && d.slot !== 'sauce' && d.slot !== 'fruit') sel[d.slot] = [""]; });
    if (!sel.fruit.length) sel.fruit = [""];
    sel.dish = sel._improvised ? plainTitle(sel) : dishTitle(recipe, sel);
    sel.season = seasoningFor(recipe);

    const prev = state.selections[mealKey] || {};
    sel.notes = prev.notes || '';
    state.selections[mealKey] = sel;
    pruneUnservedItems();
    saveState();
  }


