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
        if (f) bits.push(`<button class="chip on" data-fav="${cat.slot}|${f.key}"><svg class="px" aria-hidden="true"><use href="#i-star"></use></svg> ${escapeHtml(f.name)} <svg class="px" aria-hidden="true"><use href="#i-close"></use></svg></button>`);
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
      const onHandKeys = planPantryKeys();
      foods = foods.slice().sort((a,b)=>
        (onHandKeys.includes(b.key) ? 1 : 0) - (onHandKeys.includes(a.key) ? 1 : 0));

      const chips = foods.map(f=>{
        const on = chosen.includes(f.key);
        const locked = full && !on;
        const hand = onHandKeys.includes(f.key);
        return `<button class="chip${on?' on':''}${locked?' locked':''}${hand?' hashand':''}" data-fav="${cat.slot}|${f.key}">${on?'<svg class="px" aria-hidden="true"><use href="#i-star"></use></svg> ':''}${hand?'<svg class="px" aria-hidden="true"><use href="#i-ice"></use></svg> ':''}${escapeHtml(f.name)}</button>`;
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

  /* WHAT YOU ALREADY HAVE
     This screen used to carry a second, separate list of ingredients on
     hand — its own search box, its own weights — which is how the app came
     to hold two disagreeing accounts of one fridge. The pantry is the one
     account now, and this is a window onto it: what it holds, whether it is
     steering the plan, and a way through to edit it. */
  function renderMustUse(){
    const host = document.getElementById('mustSummary');
    if (!host) return;
    const items = pantryItems();
    const wanted = items.filter(i=>i.use);
    const toggle = document.getElementById('pantryUseToggle');
    if (toggle){
      toggle.classList.toggle('selected', !!state.pantryUse);
      toggle.setAttribute('aria-pressed', state.pantryUse ? 'true' : 'false');
    }

    if (!items.length){
      host.innerHTML = `<div class="fav-nores">Your pantry is empty. Add what you already
        have and the plan will build around it instead of ignoring it.</div>`;
      return;
    }

    const names = wanted.map(i=>i.food.name);
    host.innerHTML = `
      <div class="onhand-summary">
        <span class="onhand-count">${items.length} item${items.length === 1 ? '' : 's'} in the pantry</span>
        ${wanted.length
          ? `<span class="onhand-using">${names.length > 4
              ? names.slice(0,4).join(' · ') + ` and ${names.length - 4} more`
              : names.join(' · ')} — being worked in</span>`
          : `<span class="onhand-using muted">None of it is marked to use up, so the plan
             is being built from scratch.</span>`}
      </div>`;
    renderMustWarn(wanted);
  }

  /* The conflicts worth naming before a day is built around them. Same rules
     as before the merge, reading the pantry's `use` items rather than the
     old mustUse list. */
  function renderMustWarn(wanted){
    const mustWarn = document.getElementById('mustWarn');
    if (!mustWarn) return;
    if (!state.pantryUse || !wanted.length){ mustWarn.style.display = 'none'; return; }

    // Same-family items need a meal each — four breads can't share three
    // sittings without doubling up, which is exactly what we avoid elsewhere
    const famCount = {};
    wanted.forEach(i=>{
      const fam = strictFamilyOf(i.food);
      if (fam) famCount[fam] = (famCount[fam] || 0) + 1;
    });
    const crowded = Object.entries(famCount).filter(([,n]) => n > MEALS.length);

    // flag quantities too small to matter — 30g of chicken isn't a meal
    const skimpy = wanted.filter(i=>{
      const sl = i.slot;
      if (!i.grams || !sl) return false;
      return i.grams < (sl === 'protein' ? 80 : sl === 'carb' ? 40 : sl === 'fat' ? 10 : 50);
    });

    const n = wanted.length;
    const capacity = MEALS.length * 4;
    mustWarn.style.display = '';
    if (n > capacity){
      mustWarn.innerHTML = `<span style="color:var(--red)">${n} ingredients won't all fit into ${MEALS.length} sittings. Some will be left out — unmark a few or add another meal.</span>`;
    } else if (n > MEALS.length * 2){
      mustWarn.innerHTML = `<span style="color:var(--amber)">${n} ingredients across ${MEALS.length} sittings will fill most of your day, leaving little room for variety.</span>`;
    } else if (crowded.length){
      const [fam, cnt] = crowded[0];
      mustWarn.innerHTML = `<span style="color:var(--amber)">You've marked ${cnt} kinds of ${fam} for ${MEALS.length} sittings. Only one kind goes in a meal, so some will have to share a plate — unmark one or add a meal.</span>`;
    } else if (skimpy.length){
      const names = skimpy.map(i=>i.food.name);
      mustWarn.innerHTML = `<span style="color:var(--muted)">You've only got a little ${names.join(' and ')} — it'll be worked in, but the rest of the meal will carry the load.</span>`;
    } else {
      mustWarn.style.display = 'none';
    }
  }

  document.getElementById('pantryUseToggle').addEventListener('click', ()=>{
    state.pantryUse = !state.pantryUse;
    saveState();
    renderMustUse();
    renderFavPicker();
  });
  document.getElementById('mustOpen').addEventListener('click', ()=> showScreen('screen-pantry'));

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
        if (f) return `<button class="chip on" data-undislike="${k}"><svg class="px" aria-hidden="true"><use href="#i-ban"></use></svg> ${escapeHtml(f.name)} <svg class="px" aria-hidden="true"><use href="#i-close"></use></svg></button>`;
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
        `<button class="chip" data-dislike="${food.key}">${escapeHtml(food.name)}</button>`).join('') + `</div>`;
    dislikeResults.querySelectorAll('[data-dislike]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const k = btn.getAttribute('data-dislike');
        if (!state.dislikes.includes(k)) state.dislikes.push(k);
        // nor can it sit in the pantry waiting to be worked into a meal
        if (state.pantry) delete state.pantry[k];
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

