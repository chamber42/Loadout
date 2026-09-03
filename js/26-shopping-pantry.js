'use strict';
/* ============================================================
   LOADOUT - SHOPPING LIST + PANTRY
   From app.js lines 12938-13348 of the original single file.
   Loaded in order by index.html; all files share one global scope,
   so declarations here are visible to every file listed after it.
   ============================================================ */

  /* =========================================================
     SHOPPING LIST
     Totals every ingredient across the whole day so you buy once, then
     multiplies by however many days you're prepping.
  ========================================================= */
  /* Every ingredient the prep needs, totalled across every day it's cooked
     for. Multiplying one day by N was only right when every day was
     identical — with dishes now rotating, day 3 can want salmon that day 1
     never touched, so each day is walked for real. */
  function aggregateIngredients(){
    const totals = {};   // key -> {food, slot, grams}
    const addDay = ()=>{
      MEALS.forEach(m=>{
        const plan = computeMealPlan(m.key);
        SLOT_DEFS.forEach(d=>{
          (state.selections[m.key][d.slot] || []).forEach((k, i)=>{
            const g = plan[d.slot][i];
            if (!k || g == null) return;
            const food = d.list().find(f=>f.key === k);
            if (!food) return;
            if (!totals[k]) totals[k] = {food, slot:d.slot, grams:0};
            totals[k].grams += g;
          });
        });
      });
    };

    if (!prepReady()){ addDay(); return totals; }

    writeBackActiveDay();
    const keep = state.activeDay;
    for (let d = 0; d < state.prep.schedule.length; d++){
      applyDayToSelections(d + 1);
      addDay();
    }
    applyDayToSelections(keep);
    return totals;
  }

  /* The shopping total already covers every day, so nothing gets multiplied
     a second time. */
  function shoppingMultiplier(){ return prepReady() ? 1 : (state.prepServings || 1); }

  const SHOP_HEADINGS = {protein:'PROTEIN', carb:'CARBS', fat:'FATS',
                         veg:'VEGETABLES', fruit:'FRUIT', sauce:'SAUCES'};
  const SHOP_ICONS    = {protein:'protein', carb:'carb', fat:'fat',
                         veg:'veg', fruit:'fruit', sauce:'sauce'};

  /* Seasonings are their own category: never weighed onto a plate, but you
     still have to own them. Gather what the day's dishes call for plus
     anything typed into the free-text box, de-duplicated. */
  function shoppingSeasonings(){
    const out = [];
    MEALS.forEach(m=>{
      const sel = state.selections[m.key] || {};
      (sel.season || []).forEach(n=>{ if (n && !out.includes(n)) out.push(n); });
      const note = (sel.notes || '').trim();
      if (note) note.split(/[,;]/).map(x=>x.trim()).filter(Boolean)
        .forEach(n=>{ if (!out.some(o=>o.toLowerCase() === n.toLowerCase())) out.push(n); });
    });
    return out;
  }

  /* =========================================================
     PANTRY
     The shopping list is built from the plan, which knows nothing about the
     half bag of rice already in the cupboard. So it says "buy 1200g rice"
     every week and you either overbuy or do the subtraction in your head.
     The pantry is what you own, in grams, kept between preps: the list
     subtracts it and asks you to buy only the difference.

     It is also what the planner builds around. Those used to be two
     separate stores — mustUse/mustQty for the planner, pantry for the
     shopping — so saying "I have 400g of chicken" on one screen left the
     other screen still telling you to buy chicken. One store now answers
     both, and each entry carries the bit that told them apart:

       g    grams held. 0 means "some, amount unknown" — worth knowing for
            the shopping list, not precise enough to portion against.
       use  work it into the plan, rather than merely own it. A carton of
            eggs going off next week is `use`; the standing bag of flour
            behind it is not, and the planner should not build dinner
            around either one just because you happen to have it.

     Seasonings are their own thing — they're bought as a jar and used to
     taste, so owning one is a yes/no rather than a weight. Those live in
     the cupboard, which is why paprika stops reappearing every week.
  ========================================================= */

  /* One entry, normalised. Saves written before the two stores merged hold
     a bare number of grams here, so read those as an owned-but-not-wanted
     amount rather than letting `.g` come back undefined. */
  function pantryEntry(key){
    const e = (state.pantry || {})[key];
    if (e == null) return null;
    if (typeof e === 'number'){
      const g = isFinite(e) && e > 0 ? Math.round(e) : 0;
      return {g, use:false};
    }
    const g = +e.g;
    return {g: isFinite(g) && g > 0 ? Math.round(g) : 0, use: !!e.use};
  }

  function pantryHas(key){ return !!pantryEntry(key); }

  /* Grams held, 0 for both "not in the pantry" and "in it, amount unknown".
     Callers that need to tell those apart ask pantryHas or pantryVague. */
  function pantryGrams(key){
    const e = pantryEntry(key);
    return e ? e.g : 0;
  }

  /* In the pantry, but without a weight against it */
  function pantryVague(key){
    const e = pantryEntry(key);
    return !!e && e.g === 0;
  }

  /* Marked to be worked into the plan */
  function pantryWanted(key){
    const e = pantryEntry(key);
    return !!e && e.use;
  }

  /* Add or update. `grams` of 0, null or nonsense means "some, unknown".
     `use` is left alone when omitted, so editing a weight on the shopping
     list can't quietly change what the planner does with it. */
  function pantryPut(key, grams, use){
    state.pantry = state.pantry || {};
    const prev = pantryEntry(key);
    const n = Math.round(+grams || 0);
    state.pantry[key] = {
      g: n > 0 ? n : 0,
      use: use === undefined ? (prev ? prev.use : false) : !!use,
    };
    saveState();
  }

  function pantryDrop(key){
    if (state.pantry) delete state.pantry[key];
    saveState();
  }

  function setPantryUse(key, on){
    const e = pantryEntry(key);
    if (!e) return;
    pantryPut(key, e.g, !!on);
  }

  /* Kept for the shopping list's editor, where a weight is the whole point:
     clearing it there means the food is gone, not that its amount became a
     mystery. Adding something you own without a weight is the pantry
     screen's job. */
  function setPantryGrams(key, grams){
    const g = Math.round(+grams || 0);
    if (g > 0) pantryPut(key, g); else pantryDrop(key);
  }

  function pantryItems(){
    /* Keys are resolved against the live food lists, so a food removed from
       the database in a later version drops out rather than rendering as a
       blank row with a weight next to it. */
    return Object.keys(state.pantry || {}).map(key=>{
      const hit = foodIndex().find(x => x.food.key === key);
      const e = pantryEntry(key);
      return hit && e ? {key, food:hit.food, slot:hit.slot, grams:e.g, use:e.use} : null;
    }).filter(Boolean).sort((a,b)=> a.food.name.localeCompare(b.food.name));
  }

  /* The keys the planner is allowed to build around: owned, marked to be
     used up, and only while the pantry is switched into the plan at all.
     Every planner-side read goes through here, so the master switch cannot
     be honoured in one place and forgotten in another. */
  function planPantryKeys(){
    if (!state.pantryUse) return [];
    return Object.keys(state.pantry || {}).filter(pantryWanted);
  }

  function hasCupboard(name){ return !!((state.cupboard || {})[name]); }

  function setCupboard(name, on){
    state.cupboard = state.cupboard || {};
    if (on) state.cupboard[name] = true; else delete state.cupboard[name];
    saveState();
  }

  /* What the list needs, what you own, and what's actually left to buy.
     An unknown amount is reported but never subtracted: "you have some
     rice" is a reason to look in the cupboard before shopping, not grounds
     for the app to decide you have enough. */
  function shopLine(food, needGrams){
    const e = pantryEntry(food.key);
    if (!e) return {need:needGrams, have:0, buy:needGrams, covered:false, vague:false};
    if (!e.g) return {need:needGrams, have:0, buy:needGrams, covered:false, vague:true};
    const buy = Math.max(0, needGrams - e.g);
    return {need:needGrams, have:e.g, buy, covered: buy < 1, vague:false};
  }

  /* ---------------------------------------------------------
     EATING OUT OF THE PANTRY

     A prep is not the only thing that empties a cupboard. Between one prep
     finishing and the next being built, people still eat, and that food comes
     out of the same pantry — so a meal logged in the journal that is not part
     of a prep depletes it, the way it does in the kitchen.

     Meals copied from the prep plan are the exception, and only because the
     prep already took its ingredients out at cook time. Depleting them again
     at eating time would charge the pantry twice for one purchase.

     Every take is recorded on the journal entry that caused it, in
     `_pantryTook`. That is what makes it reversible: deleting a mistyped row,
     or correcting its amount, hands the grams straight back. Without the
     record the only honest option would be to refuse to deplete at all,
     because a typo would quietly cost somebody real food.
  --------------------------------------------------------- */

  /* Take what this entry ate, but never more than the pantry actually holds.
     Eating food you were not tracking leaves the pantry alone rather than
     inventing a negative balance. */
  function pantryTakeForEntry(entry){
    if (!entry || entry._fromPlan) return 0;
    const key = entry._food;
    const want = Math.round(+entry._grams || 0);
    if (!key || want <= 0) return 0;
    const held = pantryGrams(key);
    if (!held) return 0;                       // untracked, or amount unknown
    const took = Math.min(held, want);
    const left = held - took;
    if (left >= 1) pantryPut(key, left); else pantryDrop(key);
    entry._pantryTook = took;
    return took;
  }

  /* Undo one take, for a row that was deleted or re-weighed. The food may have
     left the pantry entirely in the meantime, in which case it comes back
     carrying only what this entry had removed. */
  function pantryReturnForEntry(entry){
    if (!entry) return 0;
    const back = Math.round(+entry._pantryTook || 0);
    delete entry._pantryTook;
    if (!back || !entry._food) return 0;
    const e = pantryEntry(entry._food);
    /* A holding recorded as "some, amount unknown" stays unknown: adding a
       number to it would state a total nobody ever measured. */
    if (e && !e.g) return 0;
    pantryPut(entry._food, (e ? e.g : 0) + back);
    return back;
  }

  /* Shopping replenishes the pantry, which is what lets the next cook take the
     full amount back out of it. Only the shortfall is added: the grams already
     on the shelf are the reason the list asked for less than the prep needs. */
  function pantryReplenishFromList(){
    const mult = shoppingMultiplier();
    let added = 0, items = 0;
    Object.values(aggregateIngredients()).forEach(t=>{
      const L = shopLine(t.food, t.grams * mult);
      /* A holding nobody has weighed cannot be added to — "some plus 600g" is
         not a number. Those are left for the person to state on the pantry
         screen. */
      if (L.vague || L.buy < 1) return;
      pantryPut(t.food.key, pantryGrams(t.food.key) + Math.round(L.buy));
      added += Math.round(L.buy);
      items++;
    });
    return {items, added};
  }

  /* Cooking the prep eats into the pantry. Explicit rather than automatic:
     the app can't tell when you actually stood at the stove, and silently
     zeroing someone's inventory is worse than asking. */
  function deductPrepFromPantry(){
    const mult = shoppingMultiplier();
    let touched = 0;
    Object.values(aggregateIngredients()).forEach(t=>{
      const e = pantryEntry(t.food.key);
      // nothing to take away from an amount nobody has stated
      if (!e || !e.g) return;
      const left = e.g - t.grams * mult;
      if (left >= 1) pantryPut(t.food.key, left); else pantryDrop(t.food.key);
      touched++;
    });
    return touched;
  }

  /* ---- pantry editor ---- */
  let pantryTarget = null;

  function openPantryEditor(food, needGrams){
    pantryTarget = {food, need: needGrams};
    document.getElementById('pantryTitle').textContent = 'ALREADY HAVE SOME?';
    const have = pantryGrams(food.key);
    const ul = unitLabel(food, needGrams);
    document.getElementById('pantryBody').innerHTML = `
      <div class="panel">
        <div style="font-family:var(--font-body); font-size:15px; margin-bottom:6px;">${escapeHtml(food.name)}</div>
        <div class="ctn-count" style="margin-bottom:12px;">This prep needs
          <strong class="n-green">${needGrams.toFixed(0)}g</strong>${ul ? ' · ' + ul : ''}.${
          pantryVague(food.key) ? ' You\'ve got some, but haven\'t said how much.' : ''}</div>
        <label class="field-label">HOW MUCH DO YOU ALREADY HAVE? (GRAMS)</label>
        <input type="number" id="pantryInput" inputmode="numeric" min="0" max="100000"
          value="${have || ''}" placeholder="0">
        <p class="subtitle" style="font-size:11px; margin:10px 0 0;">
          Rough is fine — it only changes how much the list tells you to buy.</p>
        <button class="btn-primary" id="pantrySave" style="margin-top:12px;">SAVE</button>
        <button class="btn-ghost" id="pantryAll">I HAVE ENOUGH FOR THE WHOLE LIST</button>
        ${have ? `<button class="btn-ghost" id="pantryNone">I'VE RUN OUT — REMOVE IT</button>` : ''}
      </div>`;

    const done = ()=>{
      closeModal('modalPantry');
      renderShoppingList();
    };
    document.getElementById('pantrySave').addEventListener('click', ()=>{
      setPantryGrams(food.key, document.getElementById('pantryInput').value);
      done();
    });
    document.getElementById('pantryAll').addEventListener('click', ()=>{
      setPantryGrams(food.key, Math.ceil(needGrams));
      done();
    });
    const none = document.getElementById('pantryNone');
    if (none) none.addEventListener('click', ()=>{ pantryDrop(food.key); done(); });
    openModal('modalPantry');
  }

  function renderPantryPanel(){
    const host = document.getElementById('pantryPanel');
    if (!host) return;
    const items = pantryItems();
    const cup = Object.keys(state.cupboard || {});

    /* An empty pantry still gets a way in. Before there was a screen the
       only way to put anything in one was to tap an ingredient the current
       list happened to include, so a full cupboard of food the plan didn't
       mention was unrecordable. */
    if (!items.length && !cup.length){
      host.innerHTML = `<div class="panel">
        <div class="season-hint" style="margin:0;">
          Nothing in your pantry yet — anything you add is taken off this list.
        </div>
        <button class="mini-btn add" id="pantryOpen" style="margin-top:10px;">${ic('home')} OPEN PANTRY</button>
      </div>`;
      host.querySelector('#pantryOpen').addEventListener('click', ()=> showScreen('screen-pantry'));
      return;
    }

    const n = items.length + cup.length;
    host.innerHTML = `<div class="panel">
      <div class="eaten-head">
        <span class="eaten-title">${ic('home')} YOUR PANTRY</span>
        <span class="eaten-total">${n} item${n === 1 ? '' : 's'}</span>
      </div>
      ${items.map(it=>`<div class="pantry-row">
        <span class="pn">${escapeHtml(it.food.name)}</span>
        <span class="pq">${it.grams ? it.grams + 'g' : 'some'}</span>
        <button class="mini-btn remove" data-pantry-del="${escapeHtml(it.key)}"
          aria-label="Remove ${escapeHtml(it.food.name)} from the pantry">${ic('close')}</button>
      </div>`).join('')}
      ${cup.length ? `<div class="season-hint" style="margin-top:10px;">
        ${ic('season')} In the cupboard: <strong class="n-amber">${cup.map(escapeHtml).join(' · ')}</strong>
      </div>` : ''}
      ${items.some(it=>it.grams) ? `<button class="mini-btn add" id="pantryCooked">${ic('egg')} I'VE COOKED THIS PREP — TAKE IT OUT OF THE PANTRY</button>` : ''}
      <button class="mini-btn add" id="pantryOpen">${ic('home')} OPEN PANTRY</button>
    </div>`;

    host.querySelectorAll('[data-pantry-del]').forEach(b=>b.addEventListener('click', ()=>{
      pantryDrop(b.getAttribute('data-pantry-del'));
      renderShoppingList();
    }));
    host.querySelector('#pantryOpen').addEventListener('click', ()=> showScreen('screen-pantry'));
    const cooked = document.getElementById('pantryCooked');
    if (cooked) cooked.addEventListener('click', ()=>{
      const n = deductPrepFromPantry();
      renderShoppingList();
      toast(n ? 'Pantry updated — ' + n + ' item' + (n === 1 ? '' : 's') + ' used up'
              : 'Nothing in the pantry this prep uses', 'egg');
    });
  }

  function renderShoppingList(){
    const host = document.getElementById('shopList');
    const days = prepReady() ? state.prep.schedule.length : (state.prepServings || 1);
    const mult = shoppingMultiplier();
    const totals = aggregateIngredients();
    const bySlot = {};
    Object.values(totals).forEach(t=>{ (bySlot[t.slot] = bySlot[t.slot] || []).push(t); });

    const prepNote = document.getElementById('prepNote');
    if (prepNote){
      const nTrain = prepReady()
        ? state.prep.schedule.filter(r=>r.kind === 'train').length
        : trainingDayCount();
      prepNote.innerHTML = days === 1
        ? 'Quantities are for a single day.'
        : `Totalled across all <strong class="n-green">${days}</strong> prepped days, dish by dish` +
          (hasSplit() && nTrain ? ` (${nTrain} training, ${days - nTrain} rest)` : '') + '.';
    }

    /* Drawn before the empty-list bail, not after. The pantry panel is a way
       through to the pantry screen, and hiding it until meals exist meant
       the one screen that links there was blank exactly when somebody is
       stocking up before building anything. */
    renderPantryPanel();

    if (!Object.keys(totals).length){
      host.innerHTML = '<div class="panel"><div class="fav-nores">No ingredients selected yet. Build your meals first.</div></div>';
      return;
    }

    let covered = 0;
    host.innerHTML = SLOT_DEFS.map(d=>{
      const rows = (bySlot[d.slot] || []).sort((a,b)=>b.grams - a.grams);
      if (!rows.length) return '';
      return `<div class="panel">
        <div class="slot-label" style="margin-bottom:10px;">${SHOP_ICONS[d.slot] ? ic(SHOP_ICONS[d.slot]) + " " : ""}${SHOP_HEADINGS[d.slot] || d.label}</div>
        ${rows.map(t=>{
          const g = t.grams * mult;
          const L = shopLine(t.food, g);
          if (L.covered) covered++;
          const ul = unitLabel(t.food, L.buy || g);
          return `<div class="shop-row${L.covered ? ' covered' : ''}">
            <label class="shop-main">
              <input type="checkbox" class="shop-tick"${L.covered ? ' checked' : ''}>
              <span class="shop-name">${t.food.name}${L.vague
                ? `<span class="shop-have">you have some — check before you buy</span>`
                : L.have
                ? `<span class="shop-have">${L.covered
                    ? `already have ${L.have}g — needs ${g.toFixed(0)}g`
                    : `have ${L.have}g of ${g.toFixed(0)}g`}</span>` : ''}</span>
              <span class="shop-qty">${L.covered ? 'covered'
                : `${ul ? ul + ' · ' : ''}${L.buy.toFixed(0)}g`}</span>
            </label>
            <button class="pantry-tap${L.have || L.vague ? ' on' : ''}" data-pantry-set="${escapeHtml(t.food.key)}|${g.toFixed(1)}"
              aria-label="Say how much ${escapeHtml(t.food.name)} you already have"><svg class="px" aria-hidden="true"><use href="#i-home"></use></svg></button>
          </div>`;
        }).join('')}
      </div>`;
    }).join('');

    // Seasonings the dishes call for, plus anything typed in. No weights —
    // these are bought as a jar and used to taste.
    const seasonings = shoppingSeasonings();
    if (seasonings.length){
      /* Ticking a seasoning is remembered. A jar of paprika lasts months,
         so being told to buy it every week is just noise. */
      host.innerHTML += `<div class="panel">
        <div class="slot-label" style="margin-bottom:10px;"><svg class="px" aria-hidden="true"><use href="#i-season"></use></svg> SEASONINGS &amp; EXTRAS</div>
        ${seasonings.map(n=>`<div class="shop-row${hasCupboard(n) ? ' covered' : ''}">
            <label class="shop-main">
              <input type="checkbox" class="shop-tick" data-cupboard="${escapeHtml(n)}"${hasCupboard(n) ? ' checked' : ''}>
              <span class="shop-name">${escapeHtml(n)}</span>
              <span class="shop-qty">${hasCupboard(n) ? 'in the cupboard' : 'to taste'}</span>
            </label>
          </div>`).join('')}
      </div>`;
    }

    if (covered){
      host.innerHTML += `<div class="panel"><div class="season-hint" style="margin:0; color:var(--green);">
        <svg class="px" aria-hidden="true"><use href="#i-home"></use></svg> ${covered} item${covered === 1 ? '' : 's'} already covered by your pantry — nothing to buy for
        ${covered === 1 ? 'it' : 'them'}.
      </div></div>`;
    }

    host.querySelectorAll('[data-pantry-set]').forEach(b=>b.addEventListener('click', ()=>{
      const [key, need] = b.getAttribute('data-pantry-set').split('|');
      const hit = foodIndex().find(x => x.food.key === key);
      if (hit) openPantryEditor(hit.food, parseFloat(need));
    }));
    host.querySelectorAll('[data-cupboard]').forEach(b=>b.addEventListener('change', ()=>{
      setCupboard(b.getAttribute('data-cupboard'), b.checked);
      renderShoppingList();
    }));
  }

  function shoppingListText(){
    const days = prepReady() ? state.prep.schedule.length : (state.prepServings || 1);
    const mult = shoppingMultiplier();
    const totals = aggregateIngredients();
    const bySlot = {};
    Object.values(totals).forEach(t=>{ (bySlot[t.slot] = bySlot[t.slot] || []).push(t); });
    const nTrain = prepReady()
      ? state.prep.schedule.filter(r=>r.kind === 'train').length
      : trainingDayCount();
    let out = `SHOPPING LIST — ${days} day${days>1?'s':''}`;
    out += (hasSplit() && nTrain ? ` (${nTrain} training, ${days - nTrain} rest)` : '') + '\n';
    out += hasSplit() && nTrain
      ? `Rest days ${targetsFor('rest').kcal} kcal · training days ${targetsFor('train').kcal} kcal\n`
      : `Daily target ${targetsFor('rest').kcal} kcal\n`;
    out += `Weights are raw / dry\n\n`;
    SLOT_DEFS.forEach(d=>{
      const rows = (bySlot[d.slot] || []).sort((a,b)=>b.grams - a.grams);
      if (!rows.length) return;
      /* Anything the pantry already covers is left off the list entirely —
         a shopping list you have to mentally filter is not a shopping list. */
      const buying = rows.map(t=>({t, L: shopLine(t.food, t.grams * mult)}))
                         .filter(x => !x.L.covered);
      if (!buying.length) return;
      out += (SHOP_HEADINGS[d.slot] || d.label).replace(/[^\w\s/&]/g,'').trim() + '\n';
      buying.forEach(({t, L})=>{
        const ul = unitLabel(t.food, L.buy);
        out += `  [ ] ${t.food.name} — ${ul ? ul + ' (' + L.buy.toFixed(0) + 'g)' : L.buy.toFixed(0) + 'g'}` +
               (L.have ? ` (have ${L.have}g of ${(t.grams * mult).toFixed(0)}g)` : '') + '\n';
      });
      out += '\n';
    });
    const seasonings = shoppingSeasonings().filter(n => !hasCupboard(n));
    if (seasonings.length){
      out += 'SEASONINGS\n';
      seasonings.forEach(n=>{ out += `  [ ] ${n} — to taste\n`; });
    }
    const held = pantryItems();
    if (held.length) out += `\nAlready in the pantry: ${held.map(i=>
      i.food.name + (i.grams ? ' ' + i.grams + 'g' : '')).join(', ')}\n`;
    return out;
  }

  /* ---- shopping list wiring ---- */
  const prepGrid = document.getElementById('prepGrid');
  function renderPrepGrid(){
    /* Once a prep exists the day count belongs to it — the list is totalled
       from the real schedule, so a second day picker here could only
       disagree with it. Show what's being cooked for and send changes back
       to the roadmap, where changing it actually rebuilds the plan. */
    if (prepReady()){
      const n = state.prep.schedule.length;
      prepGrid.innerHTML = `<div style="grid-column:1/-1;">
        <div class="season-hint" style="margin:0;">
          Totalled for the <strong class="n-green">${n} day${n===1?'':'s'}</strong> in your prep.
        </div></div>`;
      return;
    }
    prepGrid.innerHTML = [1,2,3,4,5,6,7].slice(0,4).concat([5,7]).filter((v,i,a)=>a.indexOf(v)===i)
      .map(n=>`<button class="choice-btn${(state.prepServings||1)===n?' selected':''}" data-prep="${n}"
        style="min-height:52px; justify-content:center;"><span><strong>${n} ${n===1?'day':'days'}</strong></span></button>`).join('');
    prepGrid.querySelectorAll('[data-prep]').forEach(b=>b.addEventListener('click',()=>{
      state.prepServings = parseInt(b.getAttribute('data-prep'),10);
      renderPrepGrid(); renderShoppingList(); saveState();
    }));
  }

  document.getElementById('btnShopping').addEventListener('click', ()=>{
    renderPrepGrid(); renderShoppingList(); showScreen('screen-shop');
  });

  document.getElementById('btnPrepShopping').addEventListener('click', ()=>{
    renderPrepGrid(); renderShoppingList(); showScreen('screen-shop');
  });

  /* The recipe book and the prepped days lost their own tabs when the six
     destinations became four. Both are part of planning, so they are reached
     from the planning screens rather than from the bar. */
  ['btnPrepRecipes', 'btnLoadoutRecipes'].forEach(id=>{
    const b = document.getElementById(id);
    if (b) b.addEventListener('click', ()=>{ renderRecipeBook(); showScreen('screen-recipes'); });
  });
  (function(){
    const b = document.getElementById('btnLoadoutPrepDays');
    if (b) b.addEventListener('click', ()=>{
      writeBackActiveDay(); renderPrepDays(); showScreen('screen-prep');
    });
  })();

  document.getElementById('btnCookPlan').addEventListener('click', ()=>{
    renderCookPlan();
    openModal('modalCookPlan');
  });

  document.getElementById('btnPrepReshuffle').addEventListener('click', ()=>{
    generateSuggestion();
    renderPrepDays();
    saveState();
  });

  document.getElementById('btnCopyList').addEventListener('click', async (e)=>{
    const btn = e.currentTarget;
    const txt = shoppingListText();
    try{
      await navigator.clipboard.writeText(txt);
      btn.innerHTML = ic('check') + ' COPIED';
    }catch(err){
      // clipboard API needs https and permission — fall back to a selectable box
      const ta = document.createElement('textarea');
      ta.value = txt; ta.className = 'copy-fallback';
      btn.parentNode.insertBefore(ta, btn.nextSibling);
      ta.select();
      btn.innerHTML = ic('hand') + ' SELECT &amp; COPY';
    }
    setTimeout(()=>{ btn.innerHTML = ic('clipboard') + ' COPY LIST'; }, 2500);
  });

  document.getElementById('btnPrintList').addEventListener('click', ()=> window.print());

  /* Buying is what puts the shortfall on the shelf. Without it the pantry can
     only ever go down, and the cook would find 500g where the prep needs 1050
     however recently somebody had been to the shop. */
  document.getElementById('btnBoughtList').addEventListener('click', ()=>{
    const r = pantryReplenishFromList();
    renderShoppingList();
    toast(r.items
      ? 'Pantry stocked — ' + r.added + 'g across ' + r.items + ' item' + (r.items === 1 ? '' : 's')
      : 'Nothing left to buy — your pantry already covers this list', 'home');
  });

  /* One way in. START and SELECT both opened the library, which is two
     controls for one outcome.

     The health notice sits here rather than at launch: by this point somebody
     has decided to use the app, and nothing it warns about has happened yet.
     showDisclaimerIfNeeded returns false once it has been acknowledged, so
     this is a straight-through call on every run after the first. */
  document.getElementById('btnStart').addEventListener('click', ()=>{
    const go = ()=> showScreen('screen-library');
    if (typeof showDisclaimerIfNeeded === 'function' && showDisclaimerIfNeeded(go)) return;
    go();
  });
  document.getElementById('attractContinue').addEventListener('click', ()=>{
    renderTiers(); renderEatenPanel(); renderMealTimeline(); refreshTargets();
    showScreen('screen-loadout');
  });

