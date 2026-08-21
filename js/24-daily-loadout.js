'use strict';
/* ============================================================
   LOADOUT - SCREEN 3: DAILY LOADOUT
   From app.js lines 11335-12820 of the original single file.
   Loaded in order by index.html; all files share one global scope,
   so declarations here are visible to every file listed after it.
   ============================================================ */

  /* =========================================================
     SCREEN 3: DAILY LOADOUT
  ========================================================= */
  const mealTimeline = document.getElementById('mealTimeline');

  function passesPrefs(food){
    const tags = food.tags || [];
    const prefs = state.preferences;
    const has = t => tags.includes(t);

    /* Honey is an animal product: vegans exclude it, vegetarians don't. */
    if (prefs.includes("vegan") && (has("meat")||has("pork")||has("fish")||has("shellfish")||has("dairy")||has("egg")||has("honey"))) return false;
    if (prefs.includes("vegetarian") && (has("meat")||has("pork")||has("fish")||has("shellfish"))) return false;
    if (prefs.includes("pescatarian") && (has("meat")||has("pork")||has("poultry"))) return false;
    if (prefs.includes("wholefoods") && has("supplement")) return false;

    if (prefs.includes("dairyfree") && has("dairy")) return false;
    if (prefs.includes("glutenfree") && has("gluten")) return false;
    if (prefs.includes("nutfree") && has("nuts")) return false;
    if (prefs.includes("eggfree") && has("egg")) return false;
    if (prefs.includes("soyfree") && has("soy")) return false;
    if (prefs.includes("shellfishfree") && has("shellfish")) return false;
    if (prefs.includes("legumefree") && has("legume")) return false;
    if (prefs.includes("nightshadefree") && has("nightshade")) return false;

    if (prefs.includes("porkfree") && has("pork")) return false;
    if (prefs.includes("redmeatfree") && has("redmeat")) return false;
    if (prefs.includes("poultryfree") && has("poultry")) return false;
    if (prefs.includes("fishfree") && (has("fish")||has("shellfish"))) return false;

    return true;
  }

  function matchesCraving(food){
    if (!state.cravings.length) return false;
    const cr = food.crave || [];
    return state.cravings.some(c => cr.includes(c));
  }

  /* ---------------------------------------------------------
     SEARCHABLE FOOD PICKER
     617 foods is far too many to scroll. Browsing still works — the full
     list is grouped and ordered the way it always was — but typing
     narrows it immediately.
  --------------------------------------------------------- */
  let pickTarget = null;

  function openFoodPicker(mealKey, slot, index){
    pickTarget = {mealKey, slot, index};
    const def = SLOT_DEFS.find(d=>d.slot === slot);
    document.getElementById('foodPickTitle').textContent =
      (def ? def.label : 'CHOOSE') + ' — ' + ((MEALS.find(m=>m.key===mealKey) || {}).name || '');
    const box = document.getElementById('foodPickSearch');
    box.value = '';
    document.getElementById('foodPickClear').style.display = 'none';
    renderFoodPickList('');
    openModal('modalFoodPick');
    // a keyboard springing up on a phone hides the list, so don't autofocus
    if (window.matchMedia && window.matchMedia('(min-width:640px)').matches && box.focus) box.focus();
  }

  function renderFoodPickList(query){
    if (!pickTarget) return;
    const {mealKey, slot, index} = pickTarget;
    const def = SLOT_DEFS.find(d=>d.slot === slot);
    const current = (state.selections[mealKey][slot] || [])[index] || '';
    const q = (query || '').trim().toLowerCase();

    let list = def.list().filter(passesPrefs);
    if (q) list = searchFoods(list, q);

    const host = document.getElementById('foodPickList');
    if (!list.length){
      host.innerHTML = `<div class="fav-nores">Nothing matches “${escapeHtml(query)}”${
        state.preferences.length ? ' within your dietary filters' : ''}.</div>`;
      return;
    }

    const row = f => `<button class="fp-row${f.key===current?' on':''}" data-fp="${f.key}">
        <span class="nm">${escapeHtml(f.name)}</span>
        <span class="kc">${f.kcal} kcal/100g</span>
      </button>`;

    let html = `<button class="fp-row${current?'':' on'}" data-fp=""><span class="nm">— None —</span></button>`;

    if (!q){
      // unsearched, keep the grouping that made browsing useful
      const fav = favKeys(slot);
      const starred = list.filter(f=>fav.includes(f.key));
      const craved  = list.filter(f=>!fav.includes(f.key) && state.cravings.length && matchesCraving(f));
      const rest    = list.filter(f=>!fav.includes(f.key) && !(state.cravings.length && matchesCraving(f)));
      if (starred.length) html += `<div class="fp-group"><svg class="px" aria-hidden="true"><use href="#i-star"></use></svg> YOUR FAVORITES</div>` + starred.map(row).join('');
      if (craved.length)  html += `<div class="fp-group">MATCHES YOUR CRAVINGS</div>` + craved.map(row).join('');
      html += `<div class="fp-group">${starred.length || craved.length ? 'EVERYTHING ELSE' : 'ALL ' + def.label}</div>` + rest.map(row).join('');
    } else {
      html += `<div class="fp-group">${list.length} MATCH${list.length===1?'':'ES'}</div>` + list.map(row).join('');
    }

    host.innerHTML = html;
    host.querySelectorAll('[data-fp]').forEach(b=>b.addEventListener('click', ()=>{
      const key = b.getAttribute('data-fp');
      state.selections[mealKey][slot][index] = key;
      // a hand-set amount belonged to the food that was there before
      setOverride(mealKey, slot, index, null);
      writeBackActiveDay();
      closeModal('modalFoodPick');
      renderMealTimeline();
      refreshTargets();
      saveState();
    }));
  }

  function foodOptions(list, selectedKey){
    const filtered = list.filter(passesPrefs);
    let opts = `<option value="">— None —</option>`;
    if (!filtered.length){
      return `<option value="">— No matches for your preferences —</option>`;
    }
    if (state.cravings.length){
      const picks = filtered.filter(matchesCraving);
      const rest  = filtered.filter(f=>!matchesCraving(f));
      if (picks.length){
        opts += `<optgroup label="★ CRAVING PICKS">`;
        picks.forEach(f=>{
          opts += `<option value="${f.key}" ${f.key===selectedKey?'selected':''}>${f.name}</option>`;
        });
        opts += `</optgroup>`;
      }
      if (rest.length){
        opts += `<optgroup label="EVERYTHING ELSE">`;
        rest.forEach(f=>{
          opts += `<option value="${f.key}" ${f.key===selectedKey?'selected':''}>${f.name}</option>`;
        });
        opts += `</optgroup>`;
      }
      return opts;
    }
    filtered.forEach(f=>{
      opts += `<option value="${f.key}" ${f.key===selectedKey?'selected':''}>${f.name}</option>`;
    });
    return opts;
  }

  function currentTier(){
    return TIERS.find(t=>t.id === state.selectedTierId);
  }

  /* The exact daily targets for whichever day is in view — never band-clamped */
  function currentTargets(){
    return computeTargets();
  }
  function targetsFor(kind){
    return computeTargets(kind);
  }

  function gramsFor(food, macroKey, targetGrams){
    const per100 = food && food[macroKey];
    if (!per100 || per100 <= 0) return 0;   // guard: never divide by zero
    return (targetGrams / per100) * 100;
  }

  /* slot name -> the food list and the macro its portion is sized against */
  function listFor(slot){
    return slot === 'protein' ? FOODS.protein
         : slot === 'carb'    ? FOODS.carbs
         : slot === 'veg'     ? FOODS.veg
         : slot === 'fruit'   ? FOODS.fruit
         : slot === 'sauce'   ? FOODS.sauce
         : FOODS.fat;
  }
  function macroKeyFor(slot){
    return slot === 'protein' ? 'protein'
         : slot === 'carb'    ? 'carbs'
         : slot === 'fat'     ? 'fat'
         : 'kcal';   // veg, fruit and sauce are sized by calories
  }

  /* Slots sized by a calorie slice rather than a macro target */
  const SIDE_SLOTS = ['veg','fruit','sauce'];

  const SLOT_DEFS = [
    {slot:'protein', icon:'protein', label:'PROTEIN',    list:()=>FOODS.protein},
    {slot:'carb',    icon:'carb', label:'CARB',       list:()=>FOODS.carbs},
    {slot:'fat',     icon:'fat', label:'FAT',        list:()=>FOODS.fat},
    {slot:'veg',     icon:'veg', label:'VEGETABLES', list:()=>FOODS.veg},
    {slot:'fruit',   icon:'fruit', label:'FRUIT',      list:()=>FOODS.fruit},
    {slot:'sauce',   icon:'sauce', label:'SAUCE',      list:()=>FOODS.sauce},
  ];

  /* ---------------------------------------------------------
     MANUAL ENTRIES
     A custom entry is food already eaten (or already decided) with known
     numbers — a restaurant item, a packaged meal, a recipe you've logged.
     It's subtracted from the DAY, and whatever is left gets re-spread over
     the occasions that still have slots to fill. So logging an 840 kcal
     lunch shrinks breakfast, dinner and snacks to fit the remainder.
  --------------------------------------------------------- */
  const ZERO = {kcal:0, protein:0, carbs:0, fat:0};

  function allCustomTotals(){
    return (state.eaten || []).reduce((a,c)=>({
      kcal:    a.kcal    + (parseFloat(c.kcal)    || 0),
      protein: a.protein + (parseFloat(c.protein) || 0),
      carbs:   a.carbs   + (parseFloat(c.carbs)   || 0),
      fat:     a.fat     + (parseFloat(c.fat)     || 0),
    }), {...ZERO});
  }

  /* An entry can be marked as covering a specific sitting ("that WAS my
     lunch"), which takes that meal out of the planning pool entirely.
     Left on "spread across day", it just shrinks every remaining meal. */
  function coveredMeals(){
    const set = new Set();
    (state.eaten || []).forEach(c=>{ if (c.covers) set.add(c.covers); });
    return set;
  }

  function mealParticipates(mealKey){
    return !coveredMeals().has(mealKey);
  }

  /* What this meal's food slots are allowed to spend */
  function mealBudget(mealKey){
    const tg = currentTargets();
    const spent = allCustomTotals();
    const remaining = {
      kcal:    Math.max(tg.kcal    - spent.kcal,    0),
      protein: Math.max(tg.protein - spent.protein, 0),
      carbs:   Math.max(tg.carbs   - spent.carbs,   0),
      fat:     Math.max(tg.fat     - spent.fat,     0),
    };
    const meal = MEALS.find(m=>m.key === mealKey);
    if (!meal || !mealParticipates(mealKey)) return {...ZERO};
    const totalShare = MEALS.filter(m=>mealParticipates(m.key)).reduce((a,m)=>a+m.share, 0);
    if (totalShare <= 0) return {...ZERO};
    const w = meal.share / totalShare;
    return {
      kcal:    remaining.kcal    * w,
      protein: remaining.protein * w,
      carbs:   remaining.carbs   * w,
      fat:     remaining.fat     * w,
    };
  }

  /* Build a meal's portions.

     You can't hit four targets exactly with four arbitrary foods — 266g of
     ribeye delivers the protein but triple the fat. So we rank what matters:
       1. Protein is protected (it's the macro people pick a plan for)
       2. Calories are exact (the number that decides weight change)
       3. Carbs and fat are the flex that absorbs the difference
     Produce is a fixed small slice; carbs and fat are then scaled to land
     the meal precisely on its calorie target. */
  function computeMealPlan(mealKey){
    const sel = state.selections[mealKey];
    const grams = {protein:{}, carb:{}, fat:{}, veg:{}, fruit:{}, sauce:{}};
    /* A saved plan can outlive the meal it belonged to — change from "3 + a
       snack" to plain "3 meals" and snack1 is gone. Hand back an empty plan
       rather than throwing halfway through a render. */
    if (!sel) return grams;
    const bud = mealBudget(mealKey);
    const mealKcal = bud.kcal;
    let usedP = 0, usedC = 0, usedF = 0, usedKcal = 0;

    /* An amount the person set by hand is a fact, not a suggestion. It's
       taken off the top and left out of the sizing passes, so the rest of
       the plate scales around it exactly as it would around anything else
       already spoken for. */
    const fixed = overridesFor(mealKey);
    const isFixed = (slot,i) => fixed[slot] && fixed[slot][i] != null;

    const live = slot => sel[slot].map((k,i)=>({k,i}))
      .filter(x => x.k && !isFixed(slot, x.i));
    const foodOf = (slot,k) => listFor(slot).find(f=>f.key===k);

    SLOT_DEFS.forEach(d=>{
      sel[d.slot].forEach((k,i)=>{
        if (!k || !isFixed(d.slot, i)) return;
        const food = foodOf(d.slot, k); if (!food) return;
        const g = Math.max(0, fixed[d.slot][i]);
        grams[d.slot][i] = g;
        usedP += food.protein*g/100; usedC += food.carbs*g/100;
        usedF += food.fat*g/100;     usedKcal += food.kcal*g/100;
      });
    });

    // 1. Sides first — veg, fruit and sauce each take a slice of the meal's
    //    calories. They're never asked to hit a macro target, so nobody ends
    //    up trying to make broccoli their carb source.
    const selRecipe = sel._recipe ? RECIPES.find(r=>r.name === sel._recipe) : null;
    const sauceShare = (!sel._improvised && isCore(selRecipe, 'sauce'))
      ? SAUCE_KCAL_CORE : SAUCE_KCAL_CAP;
    const sideShare = {veg:VEG_KCAL_SHARE, fruit:FRUIT_KCAL_SHARE, sauce:sauceShare};
    SIDE_SLOTS.forEach(slotName=>{
      const items = live(slotName);
      if (!items.length) return;
      let budget = mealKcal * sideShare[slotName];
      // a sauce is used at its real serving size, capped so it can't take over
      if (slotName === 'sauce'){
        const want = items.reduce((a,{k})=>{
          const f = foodOf('sauce',k);
          return a + (f ? f.kcal * (f.serving || 30) / 100 : 0);
        }, 0);
        budget = Math.min(want, budget);
      }
      const each = budget / items.length;
      /* A core sauce starts at a real serving rather than at whatever slice
         of the budget happens to be left. Without this it starts small and
         the later passes have nothing to work back up from. */
      const preFloors = buildFloors(sel, mealKcal);
      items.forEach(({k,i})=>{
        const food = foodOf(slotName,k); if(!food) return;
        let g = gramsFor(food, 'kcal', each);
        const floor = floorAt(preFloors, slotName, i);
        if (floor > g) g = floor;
        grams[slotName][i] = g;
        usedP += food.protein*g/100; usedC += food.carbs*g/100;
        usedF += food.fat*g/100;     usedKcal += food.kcal*g/100;
      });
    });

    /* 2 & 3. Protein, then carbs and fat.
       Bread, pasta and oats carry real protein — a 150g serving of pasta is
       20g of it. Sizing the protein slot against the full target as if they
       carried none overshot by about a fifth, and the calories that
       overshoot cost came straight out of the carbs. The two passes feed
       into each other, so they're run a few times: size protein, see what
       the carbs and fat actually contribute, size protein again knowing it. */
    const prot = live('protein');
    const carb = live('carb'), fat = live('fat');
    const baseP = usedP, baseC = usedC, baseF = usedF, baseKcal = usedKcal;

    let flexProtein = 0;   // protein the carb and fat slots will deliver
    let flex = [], flexKcal = 0, scale = 1;

    for (let pass = 0; pass < 3; pass++){
      usedP = baseP; usedC = baseC; usedF = baseF; usedKcal = baseKcal;

      // --- protein, discounting what the rest of the plate already brings
      if (prot.length){
        const need = Math.max(bud.protein - usedP - flexProtein, 0);
        /* Splitting the target equally across the protein slot assumes every
           item is equally good at supplying it. Put cheddar next to chicken,
           or vegan cheese next to TVP, and the accent gets asked for a third
           of the protein — which costs hundreds of calories and delivers
           almost none, starving the ingredient that could have done the job.
           Each item's share is weighted by what it charges per gram instead,
           so the carrier does the carrying and the accent stays an accent. */
        const wOf = f => { const c = proteinCostKcal(f); return isFinite(c) && c > 0 ? 1/c : 0; };
        let wTotal = 0;
        prot.forEach(({k})=>{ const f = foodOf('protein',k); if (f) wTotal += wOf(f); });

        let pKcal = 0;
        const tmp = [];
        prot.forEach(({k,i})=>{
          const food = foodOf('protein',k); if(!food) return;
          const share = wTotal > 0 ? wOf(food) / wTotal : 1 / prot.length;
          const g = gramsFor(food, 'protein', need * share);
          tmp.push({food, i, g});
          pKcal += food.kcal*g/100;
        });
        const room = Math.max(mealKcal - usedKcal, 0);
        const shrink = (pKcal > room && pKcal > 0) ? room / pKcal : 1;
        tmp.forEach(({food, i, g})=>{
          const gg = g * shrink;
          grams.protein[i] = gg;
          usedP += food.protein*gg/100;
          usedC += food.carbs*gg/100; usedF += food.fat*gg/100; usedKcal += food.kcal*gg/100;
        });
      }

      // --- carbs and fat, sized against what's left of each macro...
      flex = []; flexKcal = 0;
      if (carb.length){
        const each = Math.max(bud.carbs - usedC, 0) / carb.length;
        carb.forEach(({k,i})=>{
          const food = foodOf('carb',k); if(!food) return;
          const g = gramsFor(food, 'carbs', each);
          flex.push({slot:'carb', i, food, g}); flexKcal += food.kcal*g/100;
        });
      }
      if (fat.length){
        const each = Math.max(bud.fat - usedF, 0) / fat.length;
        fat.forEach(({k,i})=>{
          const food = foodOf('fat',k); if(!food) return;
          const g = gramsFor(food, 'fat', each);
          flex.push({slot:'fat', i, food, g}); flexKcal += food.kcal*g/100;
        });
      }

      // ...then scaled together so the meal lands on its calorie target
      const remain = Math.max(mealKcal - usedKcal, 0);
      scale = flexKcal > 0 ? remain / flexKcal : 1;

      const nextFlexProtein = flex.reduce((a,x)=> a + x.food.protein * x.g * scale / 100, 0);
      if (Math.abs(nextFlexProtein - flexProtein) < 0.5){ flexProtein = nextFlexProtein; break; }
      flexProtein = nextFlexProtein;
    }

    /* 3b. Spend the surplus on protein, not on more rice.
       When a plate falls short on protein there are usually calories going
       spare — `scale` above 1 means the carbs and fat are being inflated
       past their own targets purely to fill the calorie budget. That
       surplus buys more of the protein instead. It's capped at exactly the
       overspill, so carbs and fat are never pushed below what they were
       asked for; on a plate that's already on target nothing moves. */
    if (prot.length && flexKcal > 0){
      const shortfall = bud.protein - (usedP + flexProtein);
      const surplus = Math.max(mealKcal - usedKcal, 0) - flexKcal;   // kcal about to inflate carbs
      if (shortfall > 1 && surplus > 1){
        let spend = 0;
        const wOf2 = f => { const c = proteinCostKcal(f); return isFinite(c) && c > 0 ? 1/c : 0; };
        let wT = 0;
        prot.forEach(({k})=>{ const f = foodOf('protein',k); if (f) wT += wOf2(f); });
        prot.forEach(({k,i})=>{
          const food = foodOf('protein',k);
          if (!food || grams.protein[i] == null) return;
          const room = Math.max(surplus - spend, 0);
          if (room <= 0) return;
          const share = wT > 0 ? wOf2(food) / wT : 1 / prot.length;
          let extra = gramsFor(food, 'protein', shortfall * share);
          const cost = food.kcal * extra / 100;
          if (cost > room) extra = food.kcal > 0 ? (room / food.kcal) * 100 : 0;
          const cap = HARD_CAP.protein;
          if (cap && grams.protein[i] + extra > cap) extra = Math.max(cap - grams.protein[i], 0);
          if (extra <= 0) return;
          grams.protein[i] += extra;
          spend    += food.kcal    * extra / 100;
          usedP    += food.protein * extra / 100;
          usedC    += food.carbs   * extra / 100;
          usedF    += food.fat     * extra / 100;
          usedKcal += food.kcal    * extra / 100;
        });
        scale = flexKcal > 0 ? Math.max(mealKcal - usedKcal, 0) / flexKcal : 1;
      }
    }

    flex.forEach(({slot, i, g})=>{ grams[slot][i] = g * scale; });

    // If a food is on the plate it needs a real portion. Pure macro maths will
    // happily answer "0g of olive oil" when a fatty steak already covered the
    // fat target — true, but useless. Every selected item gets a floor, then
    // everything is rebalanced back onto the calorie target.
    // Settle the whole-unit foods first, then let the flexible foods
    // rebalance around them so the meal still lands on its calorie target.
    // Settle the whole-unit foods, then rebalance the flexible foods around
    // them. Snapping is re-asserted last so a portion is never left mid-unit;
    // enforceMinimums is then re-run to soak up the rounding.
    const floors = buildFloors(sel, mealKcal);
    capOnHandPortions(grams, sel);
    capAbsurdPortions(grams, sel);
    snapToUnits(grams, sel, floors);
    enforceMinimums(grams, sel, mealKcal, floors);
    snapToUnits(grams, sel, floors);
    /* Snapping and the minimum-portion floor would happily "correct" an
       amount somebody typed in themselves. Put those back last — if you
       said one slice of bread, you get one slice of bread. */
    SLOT_DEFS.forEach(d=>{
      sel[d.slot].forEach((k,i)=>{
        if (k && isFixed(d.slot, i)) grams[d.slot][i] = Math.max(0, fixed[d.slot][i]);
      });
    });
    // anything dropped for being too small to serve is removed outright
    SLOT_DEFS.forEach(d=>{
      Object.keys(grams[d.slot]).forEach(i=>{
        if (grams[d.slot][i] === 0) delete grams[d.slot][i];
      });
    });
    return grams;
  }

  /* ---------------------------------------------------------
     HAND-SET AMOUNTS
     Two slices of bread is a normal thing to want, and adding a second
     bread row to say so is silly. Every portion on the plan can be tapped
     and changed — in units where the food comes in units, in grams where it
     doesn't — and everything else re-sizes around it.
     Overrides are keyed by the dish itself rather than the meal slot, so an
     amount set on Tuesday's lunch holds every day that dish is served.
  --------------------------------------------------------- */
  function overrideKeyFor(mealKey){
    const ref = dishRefFor(mealKey, dayIndex());
    return ref ? `${ref.store}#${ref.index}` : `meal#${mealKey}`;
  }

  function overridesFor(mealKey){
    state.portionOverrides = state.portionOverrides || {};
    return state.portionOverrides[overrideKeyFor(mealKey)] || {};
  }

  function setOverride(mealKey, slot, index, grams){
    state.portionOverrides = state.portionOverrides || {};
    const k = overrideKeyFor(mealKey);
    const bag = state.portionOverrides[k] = state.portionOverrides[k] || {};
    bag[slot] = bag[slot] || {};
    if (grams == null) delete bag[slot][index];
    else bag[slot][index] = grams;
    if (!Object.keys(bag[slot]).length) delete bag[slot];
    if (!Object.keys(bag).length) delete state.portionOverrides[k];
  }

  /* Overrides are stored against a position in the list. Removing an item
     would silently shift every amount after it onto the wrong food. */
  function clearOverrides(mealKey, slot){
    const bag = state.portionOverrides && state.portionOverrides[overrideKeyFor(mealKey)];
    if (bag && slot) delete bag[slot];
  }

  let portionTarget = null;

  function openPortionEditor(mealKey, slot, index, onDone){
    const sel = state.selections[mealKey];
    if (!sel) return;
    const key = (sel[slot] || [])[index];
    const def = SLOT_DEFS.find(d=>d.slot === slot);
    const food = key && def ? def.list().find(f=>f.key === key) : null;
    if (!food) return;

    const plan = computeMealPlan(mealKey);
    const current = plan[slot] && plan[slot][index] != null
      ? plan[slot][index] : minPortion(slot, food);

    portionTarget = {mealKey, slot, index, food, grams:current, onDone};
    document.getElementById('portionTitle').textContent = 'AMOUNT';
    renderPortionEditor();
    openModal('modalPortion');
  }

  function renderPortionEditor(){
    if (!portionTarget) return;
    const {food, grams, mealKey, slot, index} = portionTarget;
    const host = document.getElementById('portionBody');
    const unit = food.unit;
    const step = unit ? unitStep(food) : null;
    const units = unit ? grams / unit.g : null;
    const macro = k => (food[k] * grams / 100);
    const overridden = overridesFor(mealKey)[slot] &&
                       overridesFor(mealKey)[slot][index] != null;

    host.innerHTML = `
      <div style="font-family:var(--font-body); font-size:15px; color:var(--green); margin-bottom:4px;">${escapeHtml(food.name)}</div>
      ${unit ? `<div class="season-hint" style="margin-bottom:14px;">
        Comes as ${escapeHtml(unit.many)} — about ${unit.g}g each.
      </div>` : ''}

      ${unit ? `
        <label class="field-label">HOW MANY ${escapeHtml(unit.many.toUpperCase())}?</label>
        <div class="amt-stepper">
          <button class="amt-btn" data-amt="down" aria-label="Less">−</button>
          <div class="amt-value"><span id="amtUnits">${formatUnits(units)}</span>
            <small>${escapeHtml(units <= 1 ? unit.one : unit.many)}</small></div>
          <button class="amt-btn" data-amt="up" aria-label="More">+</button>
        </div>
        <div class="amt-grams">= <strong id="amtGrams">${grams.toFixed(0)}</strong>g</div>
      ` : `
        <label class="field-label">GRAMS</label>
        <div class="amt-stepper">
          <button class="amt-btn" data-amt="down" aria-label="Less">−</button>
          <input type="number" id="amtInput" class="amt-input" inputmode="numeric"
                 value="${grams.toFixed(0)}" min="0" aria-label="Grams">
          <button class="amt-btn" data-amt="up" aria-label="More">+</button>
        </div>
      `}

      <div class="panel" style="margin-top:16px;">
        <div class="kv"><span>Calories</span><span>${Math.round(macro('kcal'))} kcal</span></div>
        <div class="kv"><span>Protein</span><span>${macro('protein').toFixed(1)}g</span></div>
        <div class="kv"><span>Carbs</span><span>${macro('carbs').toFixed(1)}g</span></div>
        <div class="kv"><span>Fat</span><span>${macro('fat').toFixed(1)}g</span></div>
      </div>

      <button class="btn-primary" id="amtSave" style="margin-top:14px;">SET THIS AMOUNT</button>
      ${overridden ? '<button class="btn-ghost" id="amtReset"><svg class="px" aria-hidden="true"><use href="#i-reset"></use></svg> Back to the calculated amount</button>' : ''}
    `;

    const bump = dir=>{
      if (unit){
        const s = step * unit.g;
        portionTarget.grams = Math.max(s, portionTarget.grams + dir * s);
      } else {
        const s = portionTarget.grams >= 100 ? 10 : 5;
        portionTarget.grams = Math.max(0, portionTarget.grams + dir * s);
      }
      renderPortionEditor();
    };
    host.querySelectorAll('[data-amt]').forEach(b=>b.addEventListener('click', ()=>
      bump(b.getAttribute('data-amt') === 'up' ? 1 : -1)));

    /* Same reasoning as the journal amount field: commit as the person
       types, and never rebuild the panel out from under the SAVE button. */
    const input = document.getElementById('amtInput');
    if (input) input.addEventListener('input', ()=>{
      const v = parseFloat(input.value);
      if (!isFinite(v) || v <= 0) return;
      portionTarget.grams = v;
      const f = portionTarget.food;
      if (!f) return;
      const m = k => f[k] * v / 100;
      const vals = host.querySelectorAll('.kv span:last-child');
      if (vals.length >= 4){
        vals[0].textContent = Math.round(m('kcal')) + ' kcal';
        vals[1].textContent = m('protein').toFixed(1) + 'g';
        vals[2].textContent = m('carbs').toFixed(1) + 'g';
        vals[3].textContent = m('fat').toFixed(1) + 'g';
      }
    });

    document.getElementById('amtSave').addEventListener('click', ()=>{
      setOverride(mealKey, slot, index, portionTarget.grams);
      finishPortionEdit();
    });
    const reset = document.getElementById('amtReset');
    if (reset) reset.addEventListener('click', ()=>{
      setOverride(mealKey, slot, index, null);
      finishPortionEdit();
    });
  }

  function finishPortionEdit(){
    const done = portionTarget && portionTarget.onDone;
    closeModal('modalPortion');
    portionTarget = null;
    if (done) done();
    saveState();
  }

  function formatUnits(n){
    const r = Math.round(n * 2) / 2;
    if (Number.isInteger(r)) return String(r);
    return r < 1 ? '½' : `${Math.floor(r)}½`;
  }

  /* Smallest portion worth putting on a plan, per slot */
  /* A flat gram floor per slot doesn't work — 15g is half a slice of bread
     but only a tablespoon of dry rice. Floors are set in calories instead,
     so they scale with how dense the food is, with a small gram floor as a
     secondary guard for very light items. */
  const MIN_KCAL  = {protein:80, carb:140, fat:45, veg:12, fruit:40, sauce:6};
  const MIN_GRAMS = {protein:25, carb:20, fat:5, veg:25, fruit:30, sauce:8};

  /* Meat, poultry and seafood are the centrepiece of a meal — 53g of ground
     beef isn't a portion, it's a garnish. They get a substantial floor in
     both calories and raw weight. Cheese, eggs, powders and legumes are
     accents or are eaten in smaller amounts by nature, so they keep the
     lighter floor: 50g of cheddar is a genuine serving. */
  const CENTREPIECE_KCAL  = 140;
  const CENTREPIECE_GRAMS = 100;   // raw weight

  function minPortion(slot, food){
    if (slot === 'protein' && isMeat(food)){
      const byKcal = food.kcal > 0 ? (CENTREPIECE_KCAL / food.kcal) * 100 : 0;
      return Math.max(byKcal, CENTREPIECE_GRAMS);
    }
    const byKcal = food.kcal > 0 ? (MIN_KCAL[slot] / food.kcal) * 100 : 0;
    return Math.max(byKcal, MIN_GRAMS[slot] || 0);
  }

  /* Pre-portioned foods come in units. Nobody weighs out 63g of tortilla —
     they grab two. Snap these to whole units (halves for the bigger single
     items) and let the flexible foods absorb the difference. */
  /* One rule for how finely a unit food can be divided, used everywhere */
  function unitStep(food){
    return (food.unit.whole || food.unit.g < 45) ? 1 : 0.5;
  }

  /* ---------------------------------------------------------
     BUILD UNITS
     Macro maths sizes a portion by calories, which is the right answer
     for rice and the wrong answer for a sandwich. Two slices of bread
     is not "about 62g of bread" — it is the thing itself, and one slice
     with a burger patty on it is not a burger. Forms that you pick up
     with your hands get a floor on how many units of their carb they
     need before the dish exists at all; the rest of the plate then
     sizes itself around that floor rather than eroding it.
  --------------------------------------------------------- */
  const HANDHELD_FORMS = new Set([
    'Sandwich','Burger','Sub','Hero','Melt','Toast','Bagel','Wrap','Wraps',
    'Burrito','Quesadilla','Tacos','Roll','Roll-Ups','Croissant','Hoagie'
  ]);

  /* How many units of this carb the dish needs before it counts as built */
  function buildUnitsFor(food, recipe){
    if (!food || !food.unit || food.unit.soft) return 0;
    if (!recipe) return 0;
    if (recipe.carbUnits) return recipe.carbUnits;      // explicit wins
    const form = recipe.form || '';
    if (!HANDHELD_FORMS.has(form)) return 0;
    const one = (food.unit.one || '').toLowerCase();
    if (one === 'slice') return 2;                       // top and bottom
    if (form === 'Tacos') return 2;                      // one taco is a snack
    return 1;                                            // a whole bun, roll, bagel
  }

  /* Gram floors for the current plate, keyed slot -> index. The carb slot
     gets them because a sandwich is made of discrete pieces; a core sauce
     gets one because the rebalancing pass would otherwise shave it away to
     nothing and then prune it off the dish. */
  function buildFloors(sel, mealKcal){
    const out = {};
    const recipe = sel && sel._recipe ? RECIPES.find(r => r.name === sel._recipe) : null;
    if (!recipe || sel._improvised) return out;
    if (isCore(recipe, 'sauce')){
      (sel.sauce || []).forEach((k, i)=>{
        if (!k) return;
        const f = FOODS.sauce.find(x=>x.key === k);
        if (!f) return;
        /* One real serving — what the jar or the recipe calls a portion —
           unless that would swallow the meal, in which case take as much as
           a fifth of it and let the rest of the plate keep the difference. */
        let g = f.serving || 40;
        const roof = mealKcal ? mealKcal * 0.20 : 0;
        if (roof && f.kcal > 0 && f.kcal * g / 100 > roof) g = (roof / f.kcal) * 100;
        g = Math.max(g, MIN_GRAMS.sauce);
        const cap = onHandCapFor(k);
        if (cap != null) g = Math.min(g, cap);
        if (g > 0) (out.sauce = out.sauce || {})[i] = g;
      });
    }
    (sel.carb || []).forEach((k, i)=>{
      if (!k) return;
      const food = FOODS.carbs.find(f=>f.key === k);
      const n = buildUnitsFor(food, recipe);
      if (!n) return;
      /* Never plan past a stated on-hand quantity, even to finish a
         sandwich — if you have one slice left, you have one slice. */
      let g = n * food.unit.g;
      const cap = onHandCapFor(k);
      if (cap != null) g = Math.min(g, cap);
      if (g > 0) (out.carb = out.carb || {})[i] = g;
    });
    return out;
  }
  const floorAt = (floors, slot, i) =>
    (floors && floors[slot] && floors[slot][i]) || 0;

  /* ---------------------------------------------------------
     CARB PAIRING
     Sizing one carb to carry a meal's entire carbohydrate load is how a
     BLT ends up asking for seven slices of bread. Real plates split it
     across two - curry with rice and naan, bolognese with garlic bread,
     a burrito bowl with rice and tortillas, a roast with potatoes and a
     roll. What nobody eats is two breads or two grains, so a pair is
     always one starch base plus one bread.

     The ceilings are the FDA reference amounts customarily consumed
     (21 CFR 101.12(b)): breads and rolls 50g, tortillas and English
     muffins 55g, bagels 110g, plain grains 45g dry, plain pasta 55g dry.
     One reference amount is a serving; two is a generous plate.
  --------------------------------------------------------- */
  const CARB_UNIT_MAX = {
    slice:3, roll:2, bun:2, bagel:1.5, muffin:2, crumpet:2, biscuit:2,
    croissant:2, tortilla:3, wrap:2, roti:3, arepa:2, pita:2, naan:2,
    waffle:3, pancake:3, cake:4, piece:3, bar:1
  };
  const CARB_UNIT_DEFAULT = 3;

  /* Which bread goes with which base. Deliberately narrow: these are the
     combinations people actually eat, not everything that is technically
     two carbohydrates.
       bread    - garlic bread with pasta, a roll with stew, beans on toast
       bun      - a burger with fries, a hot dog with beans
       subroll  - a sub with fries, garlic bread with pasta
       tortilla - rice and beans, tacos with rice
     Breakfast cereal, oats, granola, crisps, noodles, pastries and syrups
     are all carbs and none of them is a side dish, so none of them appear. */
  const CARB_PAIRINGS = {
    bread:    ['potato','pasta','rice','grain','beans'],
    bun:      ['potato','beans'],
    subroll:  ['potato','pasta'],
    tortilla: ['rice','beans','potato']
  };
  const CARB_BASE_FAMS = new Set(['rice','potato','pasta','grain','beans']);

  function carbUnitMax(food){
    if (!food || !food.unit) return Infinity;
    const one = (food.unit.one || '').toLowerCase();
    return CARB_UNIT_MAX[one] != null ? CARB_UNIT_MAX[one] : CARB_UNIT_DEFAULT;
  }

  /* A carb is either the base of the plate or the bread beside it.
     Anything that is neither - a waffle, a bowl of granola, a drizzle of
     honey - pairs with nothing and is held to the ceiling instead. */
  function carbClass(food){
    if (!food) return null;
    const fam = FAMILY[food.key];
    if (!fam) return null;
    if (CARB_PAIRINGS[fam]) return 'bread';
    return CARB_BASE_FAMS.has(fam) ? 'base' : null;
  }

  /* Is this an actual pairing anyone would serve? */
  function carbPairOK(breadFood, baseFood){
    const bf = breadFood && FAMILY[breadFood.key];
    const sf = baseFood  && FAMILY[baseFood.key];
    if (!bf || !sf) return false;
    return (CARB_PAIRINGS[bf] || []).indexOf(sf) !== -1;
  }

  /* Choose the partner by family first, then by food.
     Picking straight from the whole pool lets the anti-repetition rule
     decide: the rices and pastas are already on the plate as primary
     carbs, so the one family nothing else uses wins every time and every
     sandwich comes with chickpeas. Families are drawn instead, weighted
     so the listed order means something - fries with a burger before
     beans with a burger. */
  function pickCarbPartner(food, cls, sel, role){
    const fam = FAMILY[food.key];
    const wants = cls === 'bread'
      ? (CARB_PAIRINGS[fam] || []).slice()
      : Object.keys(CARB_PAIRINGS).filter(bf => (CARB_PAIRINGS[bf] || []).indexOf(fam) !== -1);
    if (!wants.length) return null;
    const bag = [];
    wants.forEach((w, i)=>{ for (let n = wants.length - i; n > 0; n--) bag.push(w); });
    const tried = {};
    for (let guard = 0; guard < 14; guard++){
      const want = bag[Math.floor(Math.random() * bag.length)];
      if (tried[want]) continue;
      const hit = pickFood(listFor('carb'), null, true, 'carb', x =>
        x.key !== food.key && FAMILY[x.key] === want
        && mealAllowsFood(role, x) && !familyClash(x, sel));
      if (hit) return hit;
      tried[want] = 1;
    }
    return null;
  }

  /* Add the missing half of the pair when one carb is being asked to do
     too much. computeMealPlan divides the carb budget across whatever is
     selected, so the portions halve on the next pass by themselves. */
  function balanceCarbLoad(){
    MEALS.forEach((m, idx)=>{
      const sel = state.selections[m.key];
      if (!sel || !Array.isArray(sel.carb)) return;
      const chosen = sel.carb.filter(Boolean);
      if (chosen.length !== 1) return;              // already paired, or empty
      /* An amount somebody set by hand is not ours to rebalance. */
      const fixed = overridesFor(m.key);
      if (fixed && fixed.carb) return;

      const i = sel.carb.indexOf(chosen[0]);
      const food = listFor('carb').find(f=>f.key === chosen[0]);
      if (!food || !food.unit) return;              // only unit foods read as absurd
      const plan = computeMealPlan(m.key);
      const g = plan.carb ? plan.carb[i] : null;
      if (g == null) return;
      if (g / food.unit.g <= carbUnitMax(food)) return;

      const cls = carbClass(food);
      if (!cls) return;
      const role = mealRole(m, idx);
      const partner = pickCarbPartner(food, cls, sel, role);
      if (!partner) return;
      sel.carb.push(partner.key);
    });
  }

  /* Never plan more of an ingredient than the person says they have */
  /* Nobody serves 1.5kg of shirataki. Trim anything past a plausible plate. */
  function capAbsurdPortions(grams, sel){
    SLOT_DEFS.forEach(def=>{
      sel[def.slot].forEach((key, i)=>{
        if (!key || grams[def.slot][i] == null) return;
        const cap = HARD_CAP[def.slot];
        if (cap && grams[def.slot][i] > cap) grams[def.slot][i] = cap;
        /* Whole-unit ceiling. Held back while a single pairable carb is
           still on its own, so balanceCarbLoad can see that it is being
           overworked and bring in a partner; once a pair exists, or the
           food pairs with nothing, the ceiling applies. */
        if (def.slot !== 'carb') return;
        const food = def.list().find(f=>f.key === key);
        if (!food || !food.unit || food.unit.soft) return;
        const pairable = carbClass(food) !== null;
        const paired = sel.carb.filter(Boolean).length > 1;
        if (pairable && !paired) return;
        const ceiling = carbUnitMax(food) * food.unit.g;
        if (isFinite(ceiling) && grams[def.slot][i] > ceiling) grams[def.slot][i] = ceiling;
      });
    });
  }

  function capOnHandPortions(grams, sel){
    if (!state.mustQty || !Object.keys(state.mustQty).length) return;
    SLOT_DEFS.forEach(def=>{
      sel[def.slot].forEach((key, i)=>{
        if (!key || grams[def.slot][i] == null) return;
        const cap = onHandCapFor(key);
        if (cap != null && grams[def.slot][i] > cap) grams[def.slot][i] = cap;
      });
    });
  }

  function snapToUnits(grams, sel, floors){
    SLOT_DEFS.forEach(def=>{
      sel[def.slot].forEach((key, i)=>{
        if (!key || grams[def.slot][i] == null) return;
        const food = def.list().find(f=>f.key === key);
        if (!food || !food.unit || food.unit.soft) return;   // produce portions freely
        const per = food.unit.g;
        const raw = grams[def.slot][i] / per;
        const step = unitStep(food);
        let n = Math.round(raw / step) * step;
        if (n < step) n = step;              // never suggest zero of something chosen
        // a sandwich needs both slices whatever the calorie maths says
        const floorN = floorAt(floors, def.slot, i) / per;
        if (floorN > n) n = Math.ceil(floorN / step) * step;
        /* Rounding up must not push past a stated on-hand quantity — if you
           only have two tortillas, the plan can't call for three. */
        const cap = onHandCapFor(key);
        if (cap != null && n * per > cap){
          const down = Math.floor((cap / per) / step) * step;
          n = Math.max(down, 0);
          if (n <= 0){ grams[def.slot][i] = 0; return; }
        }
        grams[def.slot][i] = n * per;
      });
    });
  }

  /* "2 tortillas (90g)" reads better than "90g" */
  function unitLabel(food, g){
    if (!food || !food.unit) return null;
    const n = g / food.unit.g;
    const rounded = (food.unit.whole && !food.unit.soft) ? Math.round(n) : Math.round(n * 2) / 2;
    if (rounded <= 0) return null;
    let txt;
    if (Number.isInteger(rounded)) txt = String(rounded);
    else if (rounded < 1) txt = '½';
    else txt = `${Math.floor(rounded)}½`;
    const word = rounded <= 1 ? food.unit.one : food.unit.many;
    return `${food.unit.soft ? '~' : ''}${txt} ${word}`;
  }

  /* Rounding up to whole units can push a small meal over its calorie budget.
     Where a food has more than one unit, give one back. */
  function trimUnitOvershoot(grams, sel, mealKcal, floors){
    for (let pass = 0; pass < 4; pass++){
      let total = 0;
      const unitItems = [];
      SLOT_DEFS.forEach(def=>{
        sel[def.slot].forEach((key, i)=>{
          if (!key || grams[def.slot][i] == null) return;
          const food = def.list().find(f=>f.key === key);
          if (!food) return;
          total += food.kcal * grams[def.slot][i] / 100;
          if (food.unit && !food.unit.soft) unitItems.push({def, i, food});
        });
      });
      if (total <= mealKcal * 1.02 || !unitItems.length) return;
      // shed one step from whichever unit food costs the most per unit
      unitItems.sort((a,b) => b.food.kcal*b.food.unit.g - a.food.kcal*a.food.unit.g);
      let trimmed = false;
      for (const it of unitItems){
        const per = it.food.unit.g;
        const step = (it.food.unit.whole || per < 45) ? per : per/2;
        const cur = grams[it.def.slot][it.i];
        const units = Math.round(cur / step);
        const floorU = Math.ceil(floorAt(floors, it.def.slot, it.i) / step);
        if (units > Math.max(1, floorU)){
          grams[it.def.slot][it.i] = (units - 1) * step;
          trimmed = true; break;
        }
      }
      if (!trimmed) return;
    }
  }

  function enforceMinimums(grams, sel, mealKcal, floors){
    const items = [];
    SLOT_DEFS.forEach(def=>{
      sel[def.slot].forEach((key, i)=>{
        if (!key || grams[def.slot][i] == null) return;
        const food = def.list().find(f=>f.key === key);
        if (!food || !food.kcal) return;
        // a hard unit food (tortilla, slice of bread) is already at a sensible
        // whole portion — leave it fixed and let everything else flex around it
        if (food.unit && !food.unit.soft) return;
        const floor = Math.max(minPortion(def.slot, food), floorAt(floors, def.slot, i));
        items.push({slot:def.slot, i, food, g:grams[def.slot][i], floor});
      });
    });
    // Calories already committed to unit foods come off the budget. If
    // rounding up pushed them past what the meal can hold, drop back a unit
    // — better to serve one tortilla than to blow the target by 200 kcal.
    const unitItems = [];
    SLOT_DEFS.forEach(def=>{
      sel[def.slot].forEach((key, i)=>{
        if (!key || grams[def.slot][i] == null) return;
        const food = def.list().find(f=>f.key === key);
        if (food && food.unit && !food.unit.soft) unitItems.push({slot:def.slot, i, food});
      });
    });
    const unitKcal = () => unitItems.reduce((a,u)=> a + u.food.kcal * grams[u.slot][u.i] / 100, 0);
    let guard = 0;
    while (unitKcal() > mealKcal * 0.92 && guard++ < 12){
      // trim whichever unit food is costing the most, if it can spare one
      const trim = unitItems
        .filter(u => {
          const per = u.food.unit.g;
          const step = unitStep(u.food);
          // the build floor is the last thing to go — a bun-less burger is
          // not a cheaper burger, it is a different meal
          const floor = Math.max(per * step, floorAt(floors, u.slot, u.i));
          return grams[u.slot][u.i] > floor + 1e-6;
        })
        .sort((a,b) => (b.food.kcal * grams[b.slot][b.i]) - (a.food.kcal * grams[a.slot][a.i]))[0];
      if (!trim) break;
      const per = trim.food.unit.g;
      const step = unitStep(trim.food);
      grams[trim.slot][trim.i] -= per * step;
    }
    mealKcal = Math.max(mealKcal - unitKcal(), 0);
    if (!items.length) return;
    if (mealKcal <= 0){
      // Budget fully spent by unit foods — still give everything else a real
      // portion. A 0g drizzle of oil helps nobody; a slight overshoot is the
      // lesser evil and the HUD will show it.
      items.forEach(it => { grams[it.slot][it.i] = Math.max(it.g, it.floor); });
      return;
    }

    // A small snack may not have room for every item at a sensible size.
    // Shrinking them all produces slivers (3g of tahini), so instead drop
    // the least essential extras until what remains can be served properly.
    /* A core sauce is the last thing to go, not the first — dropping it
       leaves the dish unrecognisable while dropping the fruit does not. */
    const coreSauce = (()=>{
      const r = sel._recipe ? RECIPES.find(x=>x.name === sel._recipe) : null;
      return !sel._improvised && isCore(r, 'sauce');
    })();
    const DROP_ORDER = coreSauce
      ? ['fruit','fat','veg','sauce']
      : ['sauce','fruit','fat','veg'];
    let floorKcal = () => items.reduce((a,it)=>a + it.food.kcal*it.floor/100, 0);
    for (const slot of DROP_ORDER){
      if (floorKcal() <= mealKcal) break;
      for (let i = items.length - 1; i >= 0; i--){
        if (items[i].slot !== slot) continue;
        grams[items[i].slot][items[i].i] = 0;
        items.splice(i, 1);
        if (floorKcal() <= mealKcal) break;
      }
    }
    // if even the essentials don't fit, scale the remaining floors down
    if (items.length && floorKcal() > mealKcal){
      const f = mealKcal / floorKcal();
      items.forEach(it => it.floor *= f);
    }

    items.forEach(it => { if (it.g < it.floor) it.g = it.floor; });
    // ceilings outrank the minimum portion: a stated on-hand quantity, and
    // the plausibility cap that stops 1.3kg of poblano
    items.forEach(it=>{
      const stated = onHandCapFor(it.food.key);
      const plate  = HARD_CAP[it.slot];
      const cap = (stated != null) ? Math.min(stated, plate || Infinity) : plate;
      if (cap != null && isFinite(cap)){
        it.cap = cap;
        if (it.g > cap) it.g = cap;
        if (it.floor > cap) it.floor = cap;
      }
    });

    // Rebalance onto the calorie target, never pushing anything back under
    for (let iter = 0; iter < 8; iter++){
      const total = items.reduce((a,it)=>a + it.food.kcal*it.g/100, 0);
      const diff = mealKcal - total;
      if (Math.abs(diff) < 0.5) break;
      /* Coming down, carbs, fat and sides give way first. Scaling everything
         together took protein down with it — the meal landed on its calorie
         target by quietly surrendering the macro the plan was chosen for. */
      let movable;
      if (diff < 0){
        const above = items.filter(it => it.g > it.floor + 1e-9);
        const spare = above.filter(it => it.slot !== 'protein');
        const spareKcal = spare.reduce((a,it)=>a + it.food.kcal*it.g/100, 0);
        const spareFloor = spare.reduce((a,it)=>a + it.food.kcal*it.floor/100, 0);
        // only touch protein if the rest genuinely can't absorb the overage
        movable = (spare.length && spareKcal + diff >= spareFloor) ? spare : above;
      } else {
        movable = items;
      }
      const movKcal = movable.reduce((a,it)=>a + it.food.kcal*it.g/100, 0);
      if (movKcal <= 0) break;
      const scale = (movKcal + diff) / movKcal;
      if (!isFinite(scale) || scale <= 0) break;
      movable.forEach(it => { let v = Math.max(it.g * scale, it.floor); if (it.cap != null) v = Math.min(v, it.cap); it.g = v; });
    }

    items.forEach(it => { grams[it.slot][it.i] = it.g; });
  }

  function mealSubText(mealKey){
    const bud = mealBudget(mealKey);
    if (!mealParticipates(mealKey)){
      return `<span style="color:var(--amber)">Already covered by something you logged above.</span>`;
    }
    if (bud.kcal <= 0){
      return `<span style="color:var(--muted)">No budget left — the day is fully accounted for.</span>`;
    }
    return `Plan ~${Math.round(bud.kcal)} kcal · P ${bud.protein.toFixed(0)}g · C ${bud.carbs.toFixed(0)}g · F ${bud.fat.toFixed(0)}g`;
  }

  function eatenRowsHtml(){
    const list = state.eaten || [];
    if (!list.length){
      return '';
    }
    const mealOpts = m => MEALS.map(x=>
      `<option value="${x.key}" ${m === x.key ? 'selected' : ''}>${x.label}</option>`).join('');
    return list.map((c, i)=>`
      <div class="custom-card">
        <div class="custom-head">
          <input type="text" class="custom-name" data-ef="${i}|name" value="${(c.name||'').replace(/"/g,'&quot;')}" placeholder="Item name — e.g. Costco chicken bake">
          <button class="mini-btn remove" data-rmeaten="${i}"><svg class="px" aria-hidden="true"><use href="#i-close"></use></svg></button>
        </div>
        <div class="custom-grid">
          <label>KCAL<input type="number" inputmode="numeric" data-ef="${i}|kcal"    value="${c.kcal ?? ''}"    placeholder="0"></label>
          <label>PROT<input type="number" inputmode="numeric" data-ef="${i}|protein" value="${c.protein ?? ''}" placeholder="0"></label>
          <label>CARB<input type="number" inputmode="numeric" data-ef="${i}|carbs"   value="${c.carbs ?? ''}"   placeholder="0"></label>
          <label>FAT<input type="number" inputmode="numeric" data-ef="${i}|fat"      value="${c.fat ?? ''}"     placeholder="0"></label>
        </div>
        ${c.per100 ? `<div class="covers-row">
          <span class="covers-label">AMOUNT</span>
          <input type="number" class="onhand-qty" data-ef="${i}|grams" value="${c.grams ?? 100}"
                 inputmode="numeric" min="1" max="5000" aria-label="Grams eaten">
          <span class="onhand-unit">g</span>
        </div>` : ''}
        <div class="covers-row">
          <span class="covers-label">THIS WAS MY</span>
          <select data-ef="${i}|covers">
            <option value="" ${!c.covers ? 'selected' : ''}>— spread across the day —</option>
            ${mealOpts(c.covers)}
          </select>
        </div>
      </div>`).join('');
  }

  function renderEatenPanel(){
    const host = document.getElementById('eatenList');
    if (!host) return;
    host.innerHTML = eatenRowsHtml();

    host.querySelectorAll('[data-rmeaten]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        state.eaten.splice(parseInt(btn.getAttribute('data-rmeaten'),10), 1);
        renderEatenPanel(); renderMealTimeline(); refreshTargets();
      });
    });
    host.querySelectorAll('[data-ef]').forEach(inp=>{
      const [idx, field] = inp.getAttribute('data-ef').split('|');
      const handler = ()=>{
        const row = state.eaten[parseInt(idx,10)];
        row[field] = inp.value;
        // a looked-up product knows its per-100g values, so changing the
        // amount rescales the macros instead of making you redo the maths
        if (field === 'grams' && row.per100){
          const g = parseFloat(inp.value);
          if (g > 0){
            const f = g / 100;
            row.kcal    = Math.round(row.per100.kcal * f);
            row.protein = Math.round(row.per100.protein * f);
            row.carbs   = Math.round(row.per100.carbs * f);
            row.fat     = Math.round(row.per100.fat * f);
            renderEatenPanel();
          }
        }
        if (field === 'covers'){ renderMealTimeline(); }
        refreshTargets();
      };
      inp.addEventListener(inp.tagName === 'SELECT' ? 'change' : 'input', handler);
    });
  }

  /* Update targets in place — a full re-render would steal focus mid-typing */
  function refreshTargets(){
    MEALS.forEach(meal=>{
      const sub = document.getElementById(`sub-${meal.key}`);
      if (sub) sub.innerHTML = mealSubText(meal.key);
      const plan = computeMealPlan(meal.key);
      SLOT_DEFS.forEach(def=>{
        state.selections[meal.key][def.slot].forEach((key, i)=>{
          const el = document.getElementById(`gram-${meal.key}-${def.slot}-${i}`);
          if (!el) return;
          const g = plan[def.slot][i];
          const food = key ? def.list().find(f=>f.key===key) : null;
          const ul = (food && g != null) ? unitLabel(food, g) : null;
          el.innerHTML = (food && g != null)
            ? `→ <span class="val">${ul ? ul : g.toFixed(0)+'g'}</span> ${food.name}${ul ? ` <span style="color:var(--muted)">(${g.toFixed(0)}g)</span>` : ''}` : '';
        });
      });
    });
    const spent = allCustomTotals();
    const tg = currentTargets();
    const totalEl = document.getElementById('eatenTotal');
    if (totalEl){
      totalEl.textContent = spent.kcal > 0
        ? `${Math.round(spent.kcal)} kcal · P${Math.round(spent.protein)} C${Math.round(spent.carbs)} F${Math.round(spent.fat)}`
        : '0 kcal';
    }
    const banner = document.getElementById('customBanner');
    if (banner){
      banner.style.display = spent.kcal > 0 ? '' : 'none';
      banner.innerHTML = spent.kcal > 0
        ? `Logged: <strong class="n-amber">${Math.round(spent.kcal)} kcal</strong> · Left to plan: <strong class="n-green">${Math.max(Math.round(tg.kcal - spent.kcal),0)} kcal</strong> across ${MEALS.filter(m=>mealParticipates(m.key)).length} of ${MEALS.length} sittings`
        : '';
    }
    updateHUD();
  }

  /* Listed, not weighed — a teaspoon of paprika is a rounding error against
     a 700 kcal meal, and pretending otherwise would clutter the plan. */
  function seasonHint(mealKey){
    const list = (state.selections[mealKey] || {}).season || [];
    if (!list.length) return '';
    return `<div class="season-hint"><svg class="px" aria-hidden="true"><use href="#i-season"></use></svg> Season with: <strong class="n-amber">${
      list.map(escapeHtml).join(' · ')}</strong> — to taste, not weighed.</div>`;
  }

  function sauceHint(mealKey){
    const keys = (state.selections[mealKey].sauce || []).filter(Boolean);
    if (!keys.length) return '';
    const lines = keys.map(k=>{
      const f = FOODS.sauce.find(x=>x.key===k);
      if (!f || !f.brands) return '';
      return `<div style="color:var(--amber); margin-top:4px;"><svg class="px" aria-hidden="true"><use href="#i-tag"></use></svg> ${f.brands.slice(0,3).join('<br><svg class="px" aria-hidden="true"><use href="#i-tag"></use></svg> ')}</div>`;
    }).join('');
    return `<div class="season-hint">${lines}<div style="margin-top:6px;">Label values vary by brand — check the jar if you want exact numbers.</div></div>`;
  }

  /* The loadout screen edits one prepped day at a time */
  function renderLoadoutDayStrip(){
    const panel = document.getElementById('loadoutDayPanel');
    if (!panel) return;
    const days = prepReady() ? state.prep.schedule.length : 1;
    if (!prepReady() || days < 2){ panel.hidden = true; return; }
    panel.hidden = false;
    const active = dayIndex() + 1;
    const activeKind = dayKindAt(active - 1);
    document.getElementById('loadoutDayLbl').textContent =
      `Day ${active} of ${days}` + (hasSplit() ? ` · ${DAY_KIND_LABEL[activeKind]}` : '');
    document.getElementById('loadoutDayStrip').innerHTML =
      Array.from({length:days}, (_,i)=>i+1).map(n=>{
        const k = dayKindAt(n - 1);
        return `<button class="day-chip${n===active?' on':''}${hasSplit() && k==='train'?' train':''}" data-loadday="${n}">${n}` +
          (hasSplit() ? `<span class="kd">${ic(DAY_KIND_ICON[k])}</span>` : '') + `</button>`;
      }).join('');
    document.getElementById('loadoutDayStrip').querySelectorAll('[data-loadday]').forEach(b=>
      b.addEventListener('click', ()=>{
        writeBackActiveDay();
        applyDayToSelections(parseInt(b.getAttribute('data-loadday'),10));
        renderMealTimeline();
        refreshTargets();
        saveState();
      }));
  }

  function renderMealTimeline(){
    const tier = currentTier();
    const tg = currentTargets();
    renderLoadoutDayStrip();
    mealTimeline.innerHTML = "";

    const produceNote = document.getElementById('produceNote');
    if (produceNote){
      produceNote.innerHTML = `Tier ${tier.id} — ${tier.name}. <strong class="n-amber">All weights are dry unless specified by packaging.</strong>`;
    }

    MEALS.forEach((meal, mealIdx)=>{
      const sel = state.selections[meal.key];

      const bud = mealBudget(meal.key);
      const plan = computeMealPlan(meal.key);
      let slotsHtml = "";
      SLOT_DEFS.forEach(def=>{
        const arr = sel[def.slot];
        let rows = "";
        arr.forEach((val, i)=>{
          const food = val ? def.list().find(f=>f.key===val) : null;
          const g = plan[def.slot][i];
          const ulab = (food && g != null) ? unitLabel(food, g) : null;
          const ov = overridesFor(meal.key)[def.slot];
          const isSet = !!(ov && ov[i] != null);
          const readout = (food && g != null)
            ? `→ <button class="amt-tap${isSet ? ' set' : ''}" data-amt-edit="${meal.key}|${def.slot}|${i}"
                 aria-label="Change the amount of ${escapeHtml(food.name)}">${ulab ? ulab : g.toFixed(0) + 'g'} <svg class="px" aria-hidden="true"><use href="#i-edit"></use></svg></button>
               ${food.name}${ulab ? ` <span style="color:var(--muted)">(${g.toFixed(0)}g)</span>` : ''}` : "";
          rows += `
            <div class="socket${val && food ? ' seated' : ''}">
            <div class="slot-row">
              <span class="slot-icon">${ic(i === 0 ? def.icon : 'plus')}</span>
              <button class="slot-pick" aria-label="${meal.label} ${def.label} choice"
                      data-pick="${meal.key}|${def.slot}|${i}">
                <span class="${val ? '' : 'ph'}">${val && food ? escapeHtml(food.name) : '— Choose ' + def.label.toLowerCase() + ' —'}</span>
                <span class="chev"><svg class="px" aria-hidden="true"><use href="#i-chevron-d"></use></svg></span>
              </button>
              ${arr.length > 1 ? `<button class="mini-btn remove" aria-label="Remove this ${def.label.toLowerCase()}" data-remove="${meal.key}|${def.slot}|${i}"><svg class="px" aria-hidden="true"><use href="#i-close"></use></svg></button>` : ''}
            </div>
            <div class="gram-readout" id="gram-${meal.key}-${def.slot}-${i}">${readout}</div>
            </div>`;
        });
        slotsHtml += `
          <div class="slot-group">
            <div class="slot-label">${def.label}</div>
            ${rows}
            <button class="mini-btn add" data-add="${meal.key}|${def.slot}">+ ADD ${def.label}</button>
            ${def.slot === 'sauce' ? sauceHint(meal.key) + seasonHint(meal.key) : ''}
          </div>`;
      });

      /* One pip per component category, lit when that category has anything
         in it. Six sockets is the whole recipe, so the meter is a real
         readout of how far the build has got — not a decoration. */
      const pips = SLOT_DEFS.map(d=>
        `<i class="${(sel[d.slot] || []).some(Boolean) ? 'on' : ''}"></i>`).join('');

      const quest = document.createElement('div');
      quest.className = 'quest';
      quest.innerHTML = `
        <div class="bench-head">
          <span class="bench-no">${String(mealIdx + 1).padStart(2,'0')}</span>
          <div class="quest-node" id="node-${meal.key}"></div>
          <div class="quest-title">${meal.label}${meal.required ? '' : ' <span class="opt">optional</span>'}</div>
          <span class="bench-pips">${pips}</span>
        </div>
        <div class="bench-req">
          <div class="quest-sub" id="sub-${meal.key}">${mealSubText(meal.key)}</div>
          ${sel.dish ? `<div class="bench-dish"><svg class="px" aria-hidden="true"><use href="#i-plate"></use></svg> ${sel.dish}</div>` : ''}
        </div>
        ${slotsHtml}
        <div class="slot-group last">
          <div class="slot-label">SEASONINGS &amp; EXTRAS</div>
          <input type="text" class="season-input" data-notes="${meal.key}" value="${(sel.notes||'').replace(/"/g,'&quot;')}" placeholder="garlic, soy sauce, chili flakes, lime…">
        </div>
      `;
      mealTimeline.appendChild(quest);
    });

    mealTimeline.querySelectorAll('[data-pick]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const [mealKey, slot, index] = btn.getAttribute('data-pick').split('|');
        openFoodPicker(mealKey, slot, parseInt(index, 10));
      });
    });
    // any selects left in a meal card (the "covers" dropdown) still work
    mealTimeline.querySelectorAll('select').forEach(sel=>{
      sel.addEventListener('change', onSlotChange);
    });
    mealTimeline.querySelectorAll('[data-amt-edit]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const [mealKey, slot, idx] = btn.getAttribute('data-amt-edit').split('|');
        openPortionEditor(mealKey, slot, parseInt(idx,10), ()=>{
          renderMealTimeline(); updateHUD();
        });
      });
    });
    mealTimeline.querySelectorAll('[data-add]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const [mealKey, slot] = btn.getAttribute('data-add').split('|');
        state.selections[mealKey][slot].push("");
        writeBackActiveDay();
        renderMealTimeline();
        updateHUD();
      });
    });
    mealTimeline.querySelectorAll('[data-remove]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const [mealKey, slot, idx] = btn.getAttribute('data-remove').split('|');
        state.selections[mealKey][slot].splice(parseInt(idx,10), 1);
        // amounts are stored by position, so they no longer line up
        clearOverrides(mealKey, slot);
        writeBackActiveDay();
        renderMealTimeline();
        updateHUD();
      });
    });
    mealTimeline.querySelectorAll('[data-notes]').forEach(inp=>{
      inp.addEventListener('input', ()=>{
        state.selections[inp.getAttribute('data-notes')].notes = inp.value;
        writeBackActiveDay();
      });
    });

    updateNodes();
  }

  function onSlotChange(e){
    const sel = e.target;
    const mealKey = sel.getAttribute('data-meal');
    const slot = sel.getAttribute('data-slot');
    const idx = parseInt(sel.getAttribute('data-index'), 10);
    state.selections[mealKey][slot][idx] = sel.value;
    // adding/clearing an item changes how the target splits — repaint the meal
    renderMealTimeline();
    updateHUD();
  }

  function updateNodes(){
    MEALS.forEach(meal=>{
      const node = document.getElementById(`node-${meal.key}`);
      if (!node) return;
      const sel = state.selections[meal.key];
      const filled = SLOT_DEFS.some(d => sel[d.slot].some(Boolean));
      node.classList.toggle('filled', filled);
    });
  }

  function computeTotals(){
    const totals = {kcal:0, protein:0, carbs:0, fat:0};
    if (!currentTier()) return totals;

    const eaten = allCustomTotals();
    totals.kcal += eaten.kcal; totals.protein += eaten.protein;
    totals.carbs += eaten.carbs; totals.fat += eaten.fat;

    MEALS.forEach(meal=>{
      const plan = computeMealPlan(meal.key);
      SLOT_DEFS.forEach(def=>{
        const arr = state.selections[meal.key][def.slot];
        arr.forEach((key, i)=>{
          const g = plan[def.slot][i];
          if (!key || g == null) return;
          const food = def.list().find(f=>f.key === key);
          if (!food) return;
          const m = g / 100;
          totals.kcal    += food.kcal * m;
          totals.protein += food.protein * m;
          totals.carbs   += food.carbs * m;
          totals.fat     += food.fat * m;
        });
      });
    });
    return totals;
  }

  /* Paint one HUD bar: fill width, remaining/over readout, red when past target */
  function setBar(barEl, valEl, numEl, value, target, unit){
    if (!barEl || !valEl) return;
    const v = Math.round(value), t = Math.round(target);
    const pct = t > 0 ? Math.min((v / t) * 100, 100) : 0;
    barEl.style.width = pct + '%';
    const over = t > 0 && v > t;
    barEl.classList.toggle('over', over);
    if (numEl) numEl.textContent = `${v}${unit} / ${t}${unit}`;
    valEl.textContent = over ? `${v - t}${unit} OVER` : `${t - v}${unit} left`;
    valEl.style.color = over ? 'var(--red)' : '';
  }

  function updateHUD(){
    const tier = currentTier();
    if (!tier) return;
    const tg = currentTargets();
    const totals = computeTotals();

    document.getElementById('hudTierBadge').textContent = `LV.${tier.id}`;
    document.getElementById('hudTierName').textContent = tier.name.toUpperCase();
    document.getElementById('hudKcalReadout').textContent = `${Math.round(totals.kcal)} / ${tg.kcal} kcal`;

    setBar(document.getElementById('barKcal'), document.getElementById('valKcal'), document.getElementById('numKcal'), totals.kcal, tg.kcal, '');
    setBar(document.getElementById('barProtein'), document.getElementById('valProtein'), document.getElementById('numProtein'), totals.protein, tg.protein, 'g');
    setBar(document.getElementById('barCarbs'), document.getElementById('valCarbs'), document.getElementById('numCarbs'), totals.carbs, tg.carbs, 'g');
    setBar(document.getElementById('barFat'), document.getElementById('valFat'), document.getElementById('numFat'), totals.fat, tg.fat, 'g');

    // fibre and sodium sit below the macro bars as plain readouts
    const micro = microTotals();
    const fEl = document.getElementById('hudFibre');
    const sEl = document.getElementById('hudSodium');
    if (fEl){
      const target = fibreTarget();
      fEl.textContent = `FIBER ${Math.round(micro.fibre)} / ${target}g`;
      fEl.style.color = micro.fibre >= target ? 'var(--green)' : 'var(--muted)';
    }
    if (sEl){
      const over = micro.sodium > SODIUM_LIMIT;
      sEl.textContent = `SODIUM ${Math.round(micro.sodium)}mg`;
      sEl.style.color = over ? 'var(--red)' : 'var(--muted)';
    }
  }

