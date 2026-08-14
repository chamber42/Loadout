'use strict';
/* ============================================================
   LOADOUT - SCREEN 2.6: CRAVINGS
   From app.js lines 8378-8817 of the original single file.
   Loaded in order by index.html; all files share one global scope,
   so declarations here are visible to every file listed after it.
   ============================================================ */

  /* =========================================================
     SCREEN 2.6: CRAVINGS
  ========================================================= */
  const CRAVINGS = [
    {key:"savory",    name:"Savory & Hearty",   icon:"meat", ex:"Chicken, ground beef, seitan, mushrooms"},
    {key:"sweet",     name:"Something Sweet",   icon:"honey", ex:"Greek yogurt, banana, dates, berries, oats"},
    {key:"spicy",     name:"Spicy & Bold",      icon:"chili", ex:"Chicken, shrimp, black beans, corn tortillas"},
    {key:"fresh",     name:"Fresh & Crisp",     icon:"salad", ex:"Cucumber, greens, tomatoes, watermelon, shrimp"},
    {key:"creamy",    name:"Creamy & Rich",     icon:"spoon", ex:"Cottage cheese, avocado, tahini, cream of rice"},
    {key:"comfort",   name:"Comfort Food",      icon:"pot", ex:"White potato, rice, bread, ground beef"},
    {key:"grilled",   name:"Grilled & Smoky",   icon:"fire", ex:"Salmon, steak, tempeh, asparagus, zucchini"},
    {key:"light",     name:"Light & Clean",     icon:"droplet", ex:"Tilapia, egg whites, spinach, cauliflower"},
    {key:"crunchy",   name:"Salty & Crunchy",   icon:"snack", ex:"Almonds, pistachios, rice cakes, carrots"},
    {key:"warmbowl",  name:"Warm Bowl",         icon:"noodle", ex:"Oats, quinoa, farro, lentils, chickpeas"},
    {key:"nocook",    name:"No-Cook / Fast",    icon:"bolt", ex:"Yogurt, whey, banana, rice cakes, nut butter"},
    {key:"carbheavy", name:"Carb Loading",      icon:"carb", ex:"Rice, bread, couscous, tortillas, dates"},
  ];

  const favPicker = document.getElementById('favPicker');
  const discoveryGrid = document.getElementById('discoveryGrid');
  const discoveryNote = document.getElementById('discoveryNote');
  const FAV_MAX = 6;
  const FAV_CATS = [
    {slot:'protein', icon:'protein', label:'PROTEIN'},
    {slot:'carb',    icon:'carb', label:'CARBS'},
    {slot:'fat',     icon:'fat', label:'FATS'},
    {slot:'veg',     icon:'veg', label:'VEGETABLES'},
    {slot:'fruit',   icon:'fruit', label:'FRUIT'},
    {slot:'sauce',   icon:'sauce', label:'SAUCES'},
  ];
  const favOpen = {protein:true, carb:false, fat:false, veg:false, fruit:false, sauce:false};

  let favQuery = '';

  /* Everything the person has starred, shown above the picker so their
     choices stay visible while they search deeper in the list. */
  function renderChosen(){
    const host = document.getElementById('favChosen');
    if (!host) return;
    const bits = [];
    FAV_CATS.forEach(cat=>{
      favKeys(cat.slot).forEach(k=>{
        const f = listFor(cat.slot).find(x=>x.key===k);
        if (f) bits.push(`<button class="chip on" data-fav="${cat.slot}|${f.key}"><svg class="px" aria-hidden="true"><use href="#i-star"></use></svg> ${f.name} <svg class="px" aria-hidden="true"><use href="#i-close"></use></svg></button>`);
      });
    });
    host.innerHTML = bits.join('');
    host.querySelectorAll('[data-fav]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const [slot, key] = btn.getAttribute('data-fav').split('|');
        const arr = state.favorites[slot];
        const at = arr.indexOf(key);
        if (at >= 0) arr.splice(at, 1);
        renderFavPicker(); renderDiscovery();
      });
    });
  }

  function renderFavPicker(){
    const q = favQuery.trim().toLowerCase();
    const searching = q.length > 0;
    let totalMatches = 0;

    favPicker.innerHTML = FAV_CATS.map(cat=>{
      const chosen = favKeys(cat.slot);
      let foods = listFor(cat.slot).filter(passesPrefs).filter(f => !isDisliked(f));
      if (searching) foods = searchFoods(foods, q);
      totalMatches += foods.length;

      // while searching, hide categories with no hits and open the ones with
      if (searching && !foods.length) return '';
      const open = searching ? true : favOpen[cat.slot];
      const full = chosen.length >= FAV_MAX;

      // anything already flagged as on hand sorts to the front of its
      // category, so you can star it without hunting for it
      const onHandKeys = (state.mustUse || []);
      foods = foods.slice().sort((a,b)=>
        (onHandKeys.includes(b.key) ? 1 : 0) - (onHandKeys.includes(a.key) ? 1 : 0));

      const chips = foods.map(f=>{
        const on = chosen.includes(f.key);
        const locked = full && !on;
        const hand = onHandKeys.includes(f.key);
        return `<button class="chip${on?' on':''}${locked?' locked':''}${hand?' hashand':''}" data-fav="${cat.slot}|${f.key}">${on?'<svg class="px" aria-hidden="true"><use href="#i-star"></use></svg> ':''}${hand?'<svg class="px" aria-hidden="true"><use href="#i-ice"></use></svg> ':''}${f.name}</button>`;
      }).join('');

      return `
        <div class="fav-cat">
          <button class="fav-head" data-favtoggle="${cat.slot}">
            <span>${ic(cat.icon)} ${cat.label}${searching ? ` (${foods.length})` : ''}</span>
            <span class="fav-count${full?' full':''}">${chosen.length}/${FAV_MAX} ${open?'<svg class="px" aria-hidden="true"><use href="#i-chevron-d"></use></svg>':'<svg class="px" aria-hidden="true"><use href="#i-chevron-r"></use></svg>'}</span>
          </button>
          <div class="fav-chips${open?'':' hidden'}">${chips || '<span class="fav-nores">Nothing here matches your dietary filters.</span>'}</div>
        </div>`;
    }).join('');

    if (searching && !totalMatches){
      favPicker.innerHTML = `<div class="fav-nores">No foods match “${favQuery}”. Try a shorter word, or check whether a dietary filter is hiding it.</div>`;
    }

    favPicker.querySelectorAll('[data-favtoggle]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const slot = btn.getAttribute('data-favtoggle');
        favOpen[slot] = !favOpen[slot];
        renderFavPicker();
      });
    });
    favPicker.querySelectorAll('[data-fav]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const [slot, key] = btn.getAttribute('data-fav').split('|');
        const arr = state.favorites[slot];
        const at = arr.indexOf(key);
        if (at >= 0) arr.splice(at, 1);
        else if (arr.length < FAV_MAX) arr.push(key);
        renderFavPicker();
        renderDiscovery();
      });
    });
    renderChosen();
  }

  function totalFavs(){
    return FAV_CATS.reduce((n,c)=> n + favKeys(c.slot).length, 0);
  }

  function renderDiscovery(){
    discoveryGrid.querySelectorAll('.choice-btn').forEach(b=>{
      b.classList.toggle('selected', b.getAttribute('data-discovery') === state.discoveryMode);
    });
    const n = totalFavs();
    if (!n){
      discoveryNote.textContent = "No favorites picked yet — either mode will just use the full inventory.";
      discoveryNote.style.color = "var(--muted)";
      return;
    }
    if (state.discoveryMode === 'favorites'){
      discoveryNote.innerHTML = `Meals will be built from your <strong class="n-green">${n} favorite${n>1?'s':''}</strong>.`;
      discoveryNote.style.color = "var(--muted)";
      return;
    }
    const examples = [];
    FAV_CATS.forEach(cat=>{
      if (!favKeys(cat.slot).length) return;
      const avail = listFor(cat.slot).filter(passesPrefs);
      const pool = discoveryPool(cat.slot, avail);
      if (pool && pool.length) examples.push(pool[0].name);
    });
    discoveryNote.innerHTML = examples.length
      ? `Looking for foods like your favorites but new to you — e.g. <strong style="color:var(--cyan)">${examples.slice(0,4).join(', ')}</strong>.`
      : `Looking for foods like your favorites but new to you.`;
    discoveryNote.style.color = "var(--muted)";
  }

  const mustSearch = document.getElementById('mustSearch');
  const mustClear = document.getElementById('mustClear');
  const mustResults = document.getElementById('mustResults');
  const mustChosen = document.getElementById('mustChosen');
  const mustWarn = document.getElementById('mustWarn');
  let mustQuery = '';

  function renderMustUse(){
    mustChosen.innerHTML = (state.mustUse || []).map(k=>{
      const sl = slotOf(k);
      const f = sl && listFor(sl).find(x=>x.key===k);
      if (!f) return '';
      const qty = (state.mustQty || {})[k] ?? '';
      const unitHint = f.unit ? f.unit.many : 'g';
      const asUnits = (f.unit && qty) ? ` ≈ ${(qty / f.unit.g).toFixed(1)} ${unitHint}` : '';
      return `
        <div class="onhand-row">
          <span class="onhand-name"><svg class="px" aria-hidden="true"><use href="#i-ice"></use></svg> ${f.name}</span>
          <input type="number" class="onhand-qty" data-mustqty="${k}" value="${qty}" placeholder="any" inputmode="numeric" min="0" max="5000">
          <span class="onhand-unit">g${asUnits}</span>
          <button class="mini-btn remove" aria-label="Remove ${f.name}" data-unmust="${k}"><svg class="px" aria-hidden="true"><use href="#i-close"></use></svg></button>
        </div>`;
    }).join('');
    mustChosen.querySelectorAll('[data-unmust]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const k = btn.getAttribute('data-unmust');
        state.mustUse = state.mustUse.filter(x=>x !== k);
        delete state.mustQty[k];
        renderMustUse();
      });
    });
    mustChosen.querySelectorAll('[data-mustqty]').forEach(inp=>{
      inp.addEventListener('input', ()=>{
        const k = inp.getAttribute('data-mustqty');
        const v = parseFloat(inp.value);
        if (v > 0) state.mustQty[k] = v; else delete state.mustQty[k];
      });
    });

    // Same-family items need a meal each — four breads can't share three
    // sittings without doubling up, which is exactly what we avoid elsewhere
    const famCount = {};
    (state.mustUse || []).forEach(k=>{
      const sl = slotOf(k);
      const f = sl && listFor(sl).find(x=>x.key===k);
      const fam = f && strictFamilyOf(f);
      if (fam) famCount[fam] = (famCount[fam] || 0) + 1;
    });
    const crowded = Object.entries(famCount).filter(([,n]) => n > MEALS.length);

    // flag quantities too small to matter — 30g of chicken isn't a meal
    const skimpy = (state.mustUse || []).filter(k=>{
      const q = (state.mustQty || {})[k];
      const sl = slotOf(k);
      if (!q || !sl) return false;
      return q < (sl === 'protein' ? 80 : sl === 'carb' ? 40 : sl === 'fat' ? 10 : 50);
    });

    // more on-hand items than the day has slots is a real conflict — say so
    const n = (state.mustUse || []).length;
    const capacity = MEALS.length * 4;
    if (n > capacity){
      mustWarn.style.display = '';
      mustWarn.innerHTML = `<span style="color:var(--red)">${n} ingredients won't all fit into ${MEALS.length} sittings. Some will be left out — remove a few or add another meal.</span>`;
    } else if (n > MEALS.length * 2){
      mustWarn.style.display = '';
      mustWarn.innerHTML = `<span style="color:var(--amber)">${n} ingredients across ${MEALS.length} sittings will fill most of your day, leaving little room for variety.</span>`;
    } else if (crowded.length){
      const [fam, cnt] = crowded[0];
      mustWarn.style.display = '';
      mustWarn.innerHTML = `<span style="color:var(--amber)">You've listed ${cnt} kinds of ${fam} for ${MEALS.length} sittings. Only one kind goes in a meal, so some will have to share a plate — drop one or add a meal.</span>`;
    } else if (skimpy.length){
      const names = skimpy.map(k=>{ const sl=slotOf(k); const f=sl&&listFor(sl).find(x=>x.key===k); return f?f.name:k; });
      mustWarn.style.display = '';
      mustWarn.innerHTML = `<span style="color:var(--muted)">You've only got a little ${names.join(' and ')} — it'll be worked in, but the rest of the meal will carry the load.</span>`;
    } else {
      mustWarn.style.display = 'none';
    }

    const q = mustQuery.trim().toLowerCase();
    if (!q){ mustResults.innerHTML = ''; return; }
    const hits = [];
    ALL_SLOTS.forEach(sl=>{
      listFor(sl).forEach(f=>{
        if (matchesQuery(f.name, q)
            && !(state.mustUse||[]).includes(f.key)
            && !isDisliked(f) && passesPrefs(f)) hits.push(f);
      });
    });
    if (!hits.length){
      // strict pass found nothing — try the loose one before giving up
      ALL_SLOTS.forEach(sl=>{
        listFor(sl).forEach(f=>{
          if (looseMatchesQuery(f.name, q)
              && !(state.mustUse||[]).includes(f.key)
              && !isDisliked(f) && passesPrefs(f)) hits.push(f);
        });
      });
    }
    if (!hits.length){
      mustResults.innerHTML = `<div class="fav-nores">Nothing matches “${mustQuery}”. Check whether a dietary filter or a blocked food is hiding it.</div>`;
      return;
    }
    mustResults.innerHTML = `<div class="fav-chips" style="padding:4px 0;">` +
      hits.slice(0,40).map(f=>`<button class="chip" data-must="${f.key}">${f.name}</button>`).join('') + `</div>`;
    mustResults.querySelectorAll('[data-must]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const k = btn.getAttribute('data-must');
        if (!state.mustUse.includes(k)) state.mustUse.push(k);
        renderMustUse();
      });
    });
  }

  mustSearch.addEventListener('input', ()=>{
    mustQuery = mustSearch.value;
    mustClear.style.display = mustQuery ? '' : 'none';
    renderMustUse();
  });
  mustClear.addEventListener('click', ()=>{
    mustQuery=''; mustSearch.value=''; mustClear.style.display='none';
    renderMustUse(); mustSearch.focus();
  });

  const dislikeSearch = document.getElementById('dislikeSearch');
  const dislikeClear = document.getElementById('dislikeClear');
  const dislikeResults = document.getElementById('dislikeResults');
  const dislikeChosen = document.getElementById('dislikeChosen');
  let dislikeQuery = '';

  const ALL_SLOTS = ['protein','carb','fat','veg','fruit','sauce'];

  function renderDislikes(){
    // current blocks
    dislikeChosen.innerHTML = (state.dislikes || []).map(k=>{
      for (const sl of ALL_SLOTS){
        const f = listFor(sl).find(x=>x.key===k);
        if (f) return `<button class="chip on" data-undislike="${k}"><svg class="px" aria-hidden="true"><use href="#i-ban"></use></svg> ${f.name} <svg class="px" aria-hidden="true"><use href="#i-close"></use></svg></button>`;
      }
      return '';
    }).join('');
    dislikeChosen.querySelectorAll('[data-undislike]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const k = btn.getAttribute('data-undislike');
        state.dislikes = state.dislikes.filter(x=>x !== k);
        renderDislikes(); renderFavPicker();
      });
    });

    // search results
    const q = dislikeQuery.trim().toLowerCase();
    if (!q){ dislikeResults.innerHTML = ''; return; }
    const hits = [];
    ALL_SLOTS.forEach(sl=>{
      listFor(sl).forEach(f=>{
        if (matchesQuery(f.name, q) && !(state.dislikes||[]).includes(f.key)){
          hits.push({slot:sl, food:f});
        }
      });
    });
    if (!hits.length){
      ALL_SLOTS.forEach(sl=>{
        listFor(sl).forEach(f=>{
          if (looseMatchesQuery(f.name, q) && !(state.dislikes||[]).includes(f.key)){
            hits.push({slot:sl, food:f});
          }
        });
      });
    }
    if (!hits.length){
      dislikeResults.innerHTML = `<div class="fav-nores">Nothing matches “${dislikeQuery}”.</div>`;
      return;
    }
    dislikeResults.innerHTML = `<div class="fav-chips" style="padding:4px 0;">` +
      hits.slice(0, 40).map(({food}) =>
        `<button class="chip" data-dislike="${food.key}">${food.name}</button>`).join('') + `</div>`;
    dislikeResults.querySelectorAll('[data-dislike]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const k = btn.getAttribute('data-dislike');
        if (!state.dislikes.includes(k)) state.dislikes.push(k);
        state.mustUse = (state.mustUse||[]).filter(x=>x !== k);
        state.mustUse = state.mustUse.filter(x=>x !== k);
        // a blocked food can't also be a favourite
        ALL_SLOTS.forEach(sl=>{
          state.favorites[sl] = state.favorites[sl].filter(x=>x !== k);
        });
        renderDislikes(); renderFavPicker();
      });
    });
  }

  dislikeSearch.addEventListener('input', ()=>{
    dislikeQuery = dislikeSearch.value;
    dislikeClear.style.display = dislikeQuery ? '' : 'none';
    renderDislikes();
  });
  dislikeClear.addEventListener('click', ()=>{
    dislikeQuery=''; dislikeSearch.value=''; dislikeClear.style.display='none';
    renderDislikes(); dislikeSearch.focus();
  });

  const favSearch = document.getElementById('favSearch');
  const favClear = document.getElementById('favClear');
  favSearch.addEventListener('input', ()=>{
    favQuery = favSearch.value;
    favClear.style.display = favQuery ? '' : 'none';
    renderFavPicker();
  });
  favClear.addEventListener('click', ()=>{
    favQuery = ''; favSearch.value = ''; favClear.style.display = 'none';
    renderFavPicker(); favSearch.focus();
  });

  discoveryGrid.addEventListener('click', (e)=>{
    const btn = e.target.closest('.choice-btn');
    if(!btn) return;
    state.discoveryMode = btn.getAttribute('data-discovery');
    renderDiscovery();
  });

  const craveGrid = document.getElementById('craveGrid');
  const craveSummary = document.getElementById('craveSummary');
  const btnConfirmCravings = document.getElementById('btnConfirmCravings');
  const btnSkipCravings = document.getElementById('btnSkipCravings');

  const mealRuleGrid = document.getElementById('mealRuleGrid');
  function renderMealRules(){
    mealRuleGrid.querySelectorAll('[data-rule]').forEach(b=>{
      b.classList.toggle('selected', !!state[b.getAttribute('data-rule')]);
    });
  }
  mealRuleGrid.addEventListener('click', (e)=>{
    const btn = e.target.closest('.choice-btn');
    if(!btn) return;
    const rule = btn.getAttribute('data-rule');
    state[rule] = !state[rule];
    // only one rule can apply — they contradict each other
    const RULES = ['skipBreakfast','breakfastForDinner','breakfastAllDay'];
    if (state[rule]) RULES.forEach(r=>{ if (r !== rule) state[r] = false; });
    rebuildMeals();
    renderMealRules();
  });

  function renderCravings(){
    renderMealRules();
    renderMustUse();
    renderDislikes();
    renderFavPicker();
    renderDiscovery();
    craveGrid.innerHTML = "";
    CRAVINGS.forEach(c=>{
      const btn = document.createElement('button');
      btn.className = 'choice-btn' + (state.cravings.includes(c.key) ? ' selected' : '');
      btn.setAttribute('data-crave', c.key);
      btn.innerHTML = `<span><strong>${c.name}</strong><span class="desc">${c.ex}</span></span><span class="tag">${ic(c.icon)}</span>`;
      craveGrid.appendChild(btn);
    });
    updateCraveSummary();
  }

  function updateCraveSummary(){
    if (!state.cravings.length){
      craveSummary.textContent = "No cravings selected — dropdowns will show the full inventory in standard order.";
      craveSummary.style.color = "var(--muted)";
      return;
    }
    const names = CRAVINGS.filter(c=>state.cravings.includes(c.key)).map(c=>c.name);
    const matchCount = ['protein','carbs','fat','veg','fruit','sauce']
      .reduce((n,cat)=> n + FOODS[cat].filter(f=>passesPrefs(f) && matchesCraving(f)).length, 0);
    craveSummary.textContent = `${names.join(" · ")} — ${matchCount} Food Blocks will be pinned to the top of your dropdowns.`;
    craveSummary.style.color = "var(--green)";
  }

  craveGrid.addEventListener('click', (e)=>{
    const btn = e.target.closest('.choice-btn');
    if(!btn) return;
    const crave = btn.getAttribute('data-crave');
    btn.classList.toggle('selected');
    if (state.cravings.includes(crave)){
      state.cravings = state.cravings.filter(c=>c!==crave);
    } else {
      state.cravings.push(crave);
    }
    updateCraveSummary();
  });

