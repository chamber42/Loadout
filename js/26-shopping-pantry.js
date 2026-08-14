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

     Seasonings are their own thing — they're bought as a jar and used to
     taste, so owning one is a yes/no rather than a weight. Those live in
     the cupboard, which is why paprika stops reappearing every week.
  ========================================================= */
  function pantryGrams(key){
    const g = +((state.pantry || {})[key]);
    return isFinite(g) && g > 0 ? g : 0;
  }

  function setPantryGrams(key, grams){
    state.pantry = state.pantry || {};
    const g = Math.max(0, Math.round(+grams || 0));
    if (g > 0) state.pantry[key] = g; else delete state.pantry[key];
    saveState();
  }

  function pantryItems(){
    /* Keys are resolved against the live food lists, so a food removed from
       the database in a later version drops out rather than rendering as a
       blank row with a weight next to it. */
    return Object.keys(state.pantry || {}).map(key=>{
      const hit = foodIndex().find(x => x.food.key === key);
      return hit ? {key, food:hit.food, grams: pantryGrams(key)} : null;
    }).filter(Boolean).sort((a,b)=> a.food.name.localeCompare(b.food.name));
  }

  function hasCupboard(name){ return !!((state.cupboard || {})[name]); }

  function setCupboard(name, on){
    state.cupboard = state.cupboard || {};
    if (on) state.cupboard[name] = true; else delete state.cupboard[name];
    saveState();
  }

  /* What the list needs, what you own, and what's actually left to buy */
  function shopLine(food, needGrams){
    const have = pantryGrams(food.key);
    const buy = Math.max(0, needGrams - have);
    return {need:needGrams, have, buy, covered: buy < 1};
  }

  /* Cooking the prep eats into the pantry. Explicit rather than automatic:
     the app can't tell when you actually stood at the stove, and silently
     zeroing someone's inventory is worse than asking. */
  function deductPrepFromPantry(){
    const mult = shoppingMultiplier();
    let touched = 0;
    Object.values(aggregateIngredients()).forEach(t=>{
      const have = pantryGrams(t.food.key);
      if (!have) return;
      setPantryGrams(t.food.key, have - t.grams * mult);
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
          <strong class="n-green">${needGrams.toFixed(0)}g</strong>${ul ? ' · ' + ul : ''}.</div>
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
    if (none) none.addEventListener('click', ()=>{ setPantryGrams(food.key, 0); done(); });
    openModal('modalPantry');
  }

  function renderPantryPanel(){
    const host = document.getElementById('pantryPanel');
    if (!host) return;
    const items = pantryItems();
    const cup = Object.keys(state.cupboard || {});
    if (!items.length && !cup.length){ host.innerHTML = ''; return; }

    host.innerHTML = `<div class="panel">
      <div class="eaten-head">
        <span class="eaten-title"><svg class="px" aria-hidden="true"><use href="#i-home"></use></svg> YOUR PANTRY</span>
        <span class="eaten-total">${items.length + cup.length} item${items.length + cup.length === 1 ? '' : 's'}</span>
      </div>
      ${items.map(it=>`<div class="pantry-row">
        <span class="pn">${escapeHtml(it.food.name)}</span>
        <span class="pq">${it.grams}g</span>
        <button class="mini-btn remove" data-pantry-del="${escapeHtml(it.key)}"
          aria-label="Remove ${escapeHtml(it.food.name)} from the pantry"><svg class="px" aria-hidden="true"><use href="#i-close"></use></svg></button>
      </div>`).join('')}
      ${cup.length ? `<div class="season-hint" style="margin-top:10px;">
        <svg class="px" aria-hidden="true"><use href="#i-season"></use></svg> In the cupboard: <strong class="n-amber">${cup.map(escapeHtml).join(' · ')}</strong>
      </div>` : ''}
      ${items.length ? `<button class="mini-btn add" id="pantryCooked"><svg class="px" aria-hidden="true"><use href="#i-egg"></use></svg> I'VE COOKED THIS PREP — TAKE IT OUT OF THE PANTRY</button>` : ''}
      <div class="season-hint" style="margin-top:10px;">
        Kept between preps. The list below only asks you to buy the difference.
      </div>
    </div>`;

    host.querySelectorAll('[data-pantry-del]').forEach(b=>b.addEventListener('click', ()=>{
      setPantryGrams(b.getAttribute('data-pantry-del'), 0);
      renderShoppingList();
    }));
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

    if (!Object.keys(totals).length){
      host.innerHTML = '<div class="panel"><div class="fav-nores">No ingredients selected yet. Build your meals first.</div></div>';
      return;
    }

    renderPantryPanel();

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
              <span class="shop-name">${t.food.name}${L.have
                ? `<span class="shop-have">${L.covered
                    ? `already have ${L.have}g — needs ${g.toFixed(0)}g`
                    : `have ${L.have}g of ${g.toFixed(0)}g`}</span>` : ''}</span>
              <span class="shop-qty">${L.covered ? 'covered'
                : `${ul ? ul + ' · ' : ''}${L.buy.toFixed(0)}g`}</span>
            </label>
            <button class="pantry-tap${L.have ? ' on' : ''}" data-pantry-set="${escapeHtml(t.food.key)}|${g.toFixed(1)}"
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
        <div class="season-hint" style="margin-top:10px;">
          Tick what you already own — it stays ticked next time you shop.
        </div>
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
    const pantryCovered = pantryItems().length;
    if (pantryCovered) out += `\nAlready in the pantry: ${pantryItems().map(i=>i.food.name + ' ' + i.grams + 'g').join(', ')}\n`;
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
          Totalled for the <strong class="n-green">${n} day${n===1?'':'s'}</strong>
          in your prep. To cook for more or fewer days, change it in the Loadout and rebuild.
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

  document.getElementById('btnStart').addEventListener('click', ()=> showScreen('screen-library'));
  document.getElementById('btnSelect').addEventListener('click', ()=> showScreen('screen-library'));
  document.getElementById('attractContinue').addEventListener('click', ()=>{
    renderTiers(); renderEatenPanel(); renderMealTimeline(); refreshTargets();
    showScreen('screen-loadout');
  });

