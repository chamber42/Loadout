'use strict';
/* ============================================================
   LOADOUT - PANTRY SCREEN
   Loaded in order by index.html; all files share one global scope,
   so declarations here are visible to every file listed after it.
   ============================================================ */

  /* =========================================================
     THE PANTRY SCREEN
     The store itself lives in 26-shopping-pantry.js, next to the shopping
     list that reads it. This is the place you go to tell the app what you
     own, which until now had no place at all: the only way in was to tap an
     ingredient the current shopping list happened to mention, so a freezer
     full of food the plan hadn't thought of was unrecordable.

     It is not a tab. The four destinations are things you do — who you are,
     what you'll cook, what you're eating, how it went — and a pantry is a
     thing you have, which is exactly the object-shaped navigation the tab
     bar was cut down from. It lives inside `prep`, reachable from the two
     screens that care: the shopping list and the kitchen questions.
  ========================================================= */

  const PANTRY_HEADINGS = {protein:'PROTEIN', carb:'CARBS', fat:'FATS',
                           veg:'VEGETABLES', fruit:'FRUIT', sauce:'SAUCES'};
  const PANTRY_ICONS    = {protein:'protein', carb:'carb', fat:'fat',
                           veg:'veg', fruit:'fruit', sauce:'sauce'};

  let pantryQuery = '';

  function renderPantry(){
    renderPantryToggle();
    renderPantryList();
    renderPantryCupboard();
    renderPantryResults();
  }

  /* The master switch. Owning food and cooking around it are two different
     statements, and a pantry that quietly rewrote every meal plan the moment
     you recorded a bag of rice would make people stop recording anything. */
  function renderPantryToggle(){
    const btn = document.getElementById('pantryPlanToggle');
    if (!btn) return;
    const on = !!state.pantryUse;
    btn.classList.toggle('selected', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    const n = pantryItems().filter(i=>i.use).length;
    const note = document.getElementById('pantryPlanNote');
    if (note){
      note.textContent = !on
        ? 'Meals are being built without reference to your pantry. The shopping list still subtracts it.'
        : n ? `${n} item${n === 1 ? '' : 's'} marked to use up will be worked into your meals.`
            : 'Nothing is marked to use up yet, so nothing is being forced into a meal.';
    }
  }

  function renderPantryList(){
    const host = document.getElementById('pantryList');
    if (!host) return;
    const items = pantryItems();

    if (!items.length){
      host.innerHTML = `<div class="panel"><div class="fav-nores">
        Nothing here yet. Scan or search above for what you already have — it comes
        off your shopping list, and anything marked to use up gets built into a meal.
      </div></div>`;
      return;
    }

    const bySlot = {};
    items.forEach(it=>{ (bySlot[it.slot] = bySlot[it.slot] || []).push(it); });

    host.innerHTML = ['protein','carb','fat','veg','fruit','sauce'].map(slot=>{
      const rows = bySlot[slot];
      if (!rows || !rows.length) return '';
      return `<div class="panel">
        <div class="slot-label" style="margin-bottom:10px;">${
          PANTRY_ICONS[slot] ? ic(PANTRY_ICONS[slot]) + ' ' : ''}${PANTRY_HEADINGS[slot]}</div>
        ${rows.map(it=>{
          const units = it.grams && it.food.unit
            ? ` ≈ ${(it.grams / it.food.unit.g).toFixed(1)} ${it.food.unit.many}` : '';
          return `<div class="pantry-edit">
            <span class="pe-name">${escapeHtml(it.food.name)}</span>
            <input type="number" class="onhand-qty" data-pantry-qty="${escapeHtml(it.key)}"
              value="${it.grams || ''}" placeholder="some" inputmode="numeric" min="0" max="100000"
              aria-label="Grams of ${escapeHtml(it.food.name)} you have">
            <span class="onhand-unit">g${units}</span>
            <button class="mini-btn use${it.use ? ' on' : ''}" data-pantry-use="${escapeHtml(it.key)}"
              aria-pressed="${it.use ? 'true' : 'false'}"
              aria-label="${it.use ? 'Stop working' : 'Work'} ${escapeHtml(it.food.name)} into meals">USE UP</button>
            <button class="mini-btn remove" data-pantry-del="${escapeHtml(it.key)}"
              aria-label="Remove ${escapeHtml(it.food.name)} from the pantry">${ic('close')}</button>
          </div>`;
        }).join('')}
      </div>`;
    }).join('');

    /* A weight is committed on blur rather than per keystroke: saving mid-number
       turns "400" into a pantry that briefly held 4g, and the shopping list
       reads these the moment they change. */
    host.querySelectorAll('[data-pantry-qty]').forEach(inp=>{
      const commit = ()=>{
        const key = inp.getAttribute('data-pantry-qty');
        const e = pantryEntry(key);
        pantryPut(key, inp.value, e ? e.use : false);
        renderPantry();
      };
      inp.addEventListener('change', commit);
      inp.addEventListener('blur', commit);
    });
    host.querySelectorAll('[data-pantry-use]').forEach(btn=>btn.addEventListener('click', ()=>{
      const key = btn.getAttribute('data-pantry-use');
      setPantryUse(key, !pantryWanted(key));
      renderPantry();
    }));
    host.querySelectorAll('[data-pantry-del]').forEach(btn=>btn.addEventListener('click', ()=>{
      pantryDrop(btn.getAttribute('data-pantry-del'));
      renderPantry();
    }));

    const cooked = document.getElementById('pantryCookedBtn');
    if (cooked) cooked.style.display = items.some(i=>i.grams) ? '' : 'none';
  }

  /* Seasonings: owned as a jar, so a yes/no rather than a weight. They are
     added by ticking them on the shopping list; here they can only be
     removed, which is the case that had nowhere to go. */
  function renderPantryCupboard(){
    const host = document.getElementById('pantryCupboard');
    if (!host) return;
    const cup = Object.keys(state.cupboard || {}).sort((a,b)=>a.localeCompare(b));
    if (!cup.length){ host.innerHTML = ''; return; }
    host.innerHTML = `<div class="panel">
      <div class="slot-label" style="margin-bottom:10px;">${ic('season')} IN THE CUPBOARD</div>
      <div class="fav-chosen">${cup.map(n=>
        `<button class="chip on" data-uncupboard="${escapeHtml(n)}">${escapeHtml(n)} ${ic('close')}</button>`
      ).join('')}</div>
    </div>`;
    host.querySelectorAll('[data-uncupboard]').forEach(b=>b.addEventListener('click', ()=>{
      setCupboard(b.getAttribute('data-uncupboard'), false);
      renderPantry();
    }));
  }

  function renderPantryResults(){
    const host = document.getElementById('pantryResults');
    if (!host) return;
    const q = pantryQuery.trim().toLowerCase();
    if (!q){ host.innerHTML = ''; return; }

    /* Strict match first, loose only if it found nothing — same two passes
       the other food searches make, so "chikn" still lands on chicken. */
    const gather = matcher => {
      const hits = [];
      ['protein','carb','fat','veg','fruit','sauce'].forEach(sl=>{
        listFor(sl).forEach(f=>{
          if (matcher(f.name, q) && !pantryHas(f.key) && !isDisliked(f) && passesPrefs(f)){
            hits.push(f);
          }
        });
      });
      return hits;
    };
    let hits = gather(matchesQuery);
    if (!hits.length) hits = gather(looseMatchesQuery);

    if (!hits.length){
      host.innerHTML = `<div class="fav-nores">Nothing matches “${escapeHtml(pantryQuery)}”.
        Check whether a dietary filter or a blocked food is hiding it.</div>`;
      return;
    }
    host.innerHTML = `<div class="fav-chips" style="padding:4px 0;">${
      hits.slice(0,40).map(f=>`<button class="chip" data-pantry-add="${escapeHtml(f.key)}">${
        escapeHtml(f.name)}</button>`).join('')}</div>`;
    host.querySelectorAll('[data-pantry-add]').forEach(b=>b.addEventListener('click', ()=>{
      /* Marked to use up, like a scanned packet: searching a food out by name
         and a barcode are the same act, and a person cannot be expected to
         know that one of them steers their meals and the other does not.
         The weight is still left unstated — that one really is unknown, and
         guessing it is how a pantry starts lying. */
      pantryPut(b.getAttribute('data-pantry-add'), 0, true);
      renderPantry();
    }));
  }

  const pantrySearch = document.getElementById('pantrySearch');
  const pantryClear  = document.getElementById('pantryClear');
  pantrySearch.addEventListener('input', ()=>{
    pantryQuery = pantrySearch.value;
    pantryClear.style.display = pantryQuery ? '' : 'none';
    renderPantryResults();
  });
  pantryClear.addEventListener('click', ()=>{
    pantryQuery = ''; pantrySearch.value = ''; pantryClear.style.display = 'none';
    renderPantryResults(); pantrySearch.focus();
  });

  document.getElementById('pantryPlanToggle').addEventListener('click', ()=>{
    state.pantryUse = !state.pantryUse;
    saveState();
    renderPantry();
  });

  document.getElementById('pantryCookedBtn').addEventListener('click', ()=>{
    const n = deductPrepFromPantry();
    renderPantry();
    toast(n ? 'Pantry updated — ' + n + ' item' + (n === 1 ? '' : 's') + ' used up'
            : 'Nothing in the pantry this prep uses', 'egg');
  });

  /* =========================================================
     SCANNING INTO THE PANTRY

     Stocking up is a bag of packets on the counter, and typing each of their
     names is the slowest possible way to describe something you are holding.
     The same scanner that fills a loadout slot fills the pantry instead.

     Nothing here is new machinery. The camera and both decoders come from
     29-scanner.js, the Open Food Facts lookup from 21-food-lookup.js, the
     product-to-food conversion from 36-slot-scan.js, and the registration of
     a scanned food from 24-daily-loadout.js. scanTarget decides that a
     decoded barcode belongs here.

     Two things are decided here that a slot scan never has to decide, because
     a slot scan is told which slot it is filling and this one is not:
     which slot a scanned product belongs in, and how much of it you now own.
  ========================================================= */

  function pantryScanStatus(msg){
    const host = document.getElementById('pantryScanResults');
    if (host) host.innerHTML = '<div class="off-status">' + msg + '</div>';
  }

  function resetPantryScanRow(){
    const host = document.getElementById('pantryScanResults');
    if (host) host.innerHTML = '';
    const input = document.getElementById('pantryBarcode');
    if (input) input.value = '';
    const clear = document.getElementById('pantryBarcodeClear');
    if (clear) clear.style.display = 'none';
  }

  /* ---- how much did you just buy? ----
     Open Food Facts records the pack size freehand in `quantity`, so this
     reads only the shapes it can be certain of — "500 g", "1.5 kg", and the
     multipack "6 x 40 g" — and gives up on everything else. Giving up costs
     one tap to type the weight; guessing wrong puts a number in an inventory
     that the shopping list will quietly trust. */
  function packGrams(quantity){
    const q = String(quantity || '').trim().toLowerCase().replace(/,/g, '.');
    if (!q) return 0;

    const unitGrams = u => u === 'kg' ? 1000 : u === 'g' ? 1 : 0;

    // "6 x 40 g" — a multipack states the count and the size of one
    const multi = q.match(/^(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)\s*(kg|g)\b/);
    if (multi){
      const mult = unitGrams(multi[3]);
      if (mult) return Math.round(parseFloat(multi[1]) * parseFloat(multi[2]) * mult);
    }

    // "500 g", "1.5 kg" — and nothing after it, so "500 g drained" is refused
    const one = q.match(/^(\d+(?:\.\d+)?)\s*(kg|g)$/);
    if (one){
      const mult = unitGrams(one[2]);
      if (mult) return Math.round(parseFloat(one[1]) * mult);
    }
    return 0;
  }

  /* ---- which slot does a scanned product belong in? ----
     A slot scan is opened from the slot it is filling. A pantry scan is not,
     so the label decides: whichever macro carries the most of the product's
     calories. Something with no macros at all is a side rather than a
     builder, and veg is where the app puts foods it sizes by calories. */
  function slotForScannedFood(hit){
    const p = (hit.protein || 0) * 4;
    const c = (hit.carbs   || 0) * 4;
    const f = (hit.fat     || 0) * 9;
    if (p <= 0 && c <= 0 && f <= 0) return 'veg';
    if (p >= c && p >= f) return 'protein';
    if (c >= f) return 'carb';
    return 'fat';
  }

  /* Put a scanned product on the shelf. It is registered as a food first, so
     that from here on it is indistinguishable from anything in the library:
     the planner can build with it, the shopping list can subtract it, and the
     journal can deplete it. */
  function pantryUseHit(hit){
    const slot = slotForScannedFood(hit);
    const food = slotFoodFromHit(hit, slot);
    addScannedFood(slot, food);

    const known = pantryHas(food.key);
    const already = pantryGrams(food.key);
    const pack = packGrams(hit.quantity);
    /* Scanning the same product twice is a second packet, not a correction,
       so the pack size adds rather than replaces. An unreadable pack size
       leaves the amount unstated rather than inventing one. */
    const grams = pack ? already + pack : already;
    /* Scanning something in means you have just bought it and intend to eat
       it, so it arrives marked to use up. A packet already on the shelf keeps
       whatever mark it has: unmarking a standing staple is a deliberate act
       and restocking it must not quietly undo that. */
    pantryPut(food.key, grams, known ? pantryWanted(food.key) : true);

    resetPantryScanRow();
    renderPantry();
    toast(pack
      ? food.name + ' — ' + pack + 'g added to your pantry'
      : food.name + ' added — set how much you have', 'home');
  }

  /* Called by useScannedCode() in 21-food-lookup.js when scanTarget is
     'pantry', and directly by the barcode text field below. */
  function pantryScanLookup(code){
    const q = String(code || '').replace(/[\s-]/g, '');
    if (!/^\d+$/.test(q)){
      pantryScanStatus('That looks like a name rather than a barcode. Search for it by name below.');
      return;
    }
    if (q.length < 8){ pantryScanStatus('Keep going — barcodes are 8 to 14 digits (' + q.length + ' so far).'); return; }
    if (q.length > 14){ pantryScanStatus('That’s longer than any barcode. Check the number on the packet.'); return; }

    /* Answer from what we already know before asking anybody. A barcode
       always means the same product, so a rescan needs no request at all. */
    const known = offCacheGet(q);
    if (known){
      if (!known.fresh) offCacheRefresh(q);
      pantryUseHit(known.hit);
      return;
    }

    pantryScanStatus('Looking up barcode…');
    /* Through the shared offSeq counter, not a private one: offFetchJson
       decides a response is stale by comparing against it, so a counter of
       our own would make every response come back stale. */
    const seq = ++offSeq;
    offFetchJson(OFF_PRODUCT + q + '.json?fields=' + OFF_FIELDS, seq).then(function(r){
      if (r.stale) return;
      if (r.netError || r.httpError){ offShowFailure(r, document.getElementById('pantryScanResults')); return; }
      if (!r.data || r.data.status === 0 || !r.data.product){
        pantryScanStatus('No product with barcode ' + escapeHtml(q) +
          '. Search for it by name below, and consider adding it to Open Food Facts so the next person finds it.');
        return;
      }
      const hit = offParseProduct(r.data.product);
      if (!hit){
        pantryScanStatus('That product is listed but has no usable nutrition data — a common gap in a volunteer database. Search for it by name below.');
        return;
      }
      offCachePut(q, hit);
      pantryUseHit(hit);
    }).catch(function(){
      pantryScanStatus('That lookup failed. Check your connection, or search for it by name below.');
    });
  }

  /* ---- wiring ---- */
  const pantryScanCam = document.getElementById('pantryScanCam');
  if (pantryScanCam && typeof cameraSupported === 'function' && cameraSupported()){
    pantryScanCam.hidden = false;            // only offered where it can work
    pantryScanCam.addEventListener('click', function(){
      scanTarget = 'pantry';
      startScan();
    });
  }

  const pantryBarcodePhoto = document.getElementById('pantryBarcodePhoto');
  if (pantryBarcodePhoto){
    pantryBarcodePhoto.addEventListener('change', function(e){
      const file = e.target.files && e.target.files[0];
      scanTarget = 'pantry';
      if (file){ pantryScanStatus('Reading the picture…'); decodeBarcodePhoto(file); }
      e.target.value = '';                   // so the same picture can be retried
    });
  }

  const pantryBarcode = document.getElementById('pantryBarcode');
  const pantryBarcodeClear = document.getElementById('pantryBarcodeClear');
  if (pantryBarcode){
    let typeTimer = null;
    pantryBarcode.addEventListener('input', function(){
      if (pantryBarcodeClear) pantryBarcodeClear.style.display = pantryBarcode.value ? '' : 'none';
      clearTimeout(typeTimer);
      const v = pantryBarcode.value.trim();
      if (!v){ resetPantryScanRow(); return; }
      typeTimer = setTimeout(function(){ pantryScanLookup(v); }, 300);
    });
  }
  if (pantryBarcodeClear){
    pantryBarcodeClear.addEventListener('click', function(){
      resetPantryScanRow();
      pantryBarcode.focus();
    });
  }
