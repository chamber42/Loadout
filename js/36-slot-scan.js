'use strict';
/* ============================================================
   LOADOUT - BARCODE SCANNING INTO A LOADOUT SLOT

   Scanning could already do two things: drop a product into the
   "already eaten" list on the loadout tab, or log one in the
   journal. Both of those are records of the past — you tell the
   app what you ate and how much. Neither helps with the far more
   common case of standing in the kitchen holding a bag of
   breaded chicken tenders and wanting the app to answer the
   question it exists to answer: how much of this do I cook?

   So the same scanner is wired into the food picker, which every
   slot on the loadout page opens — protein, carb, fat, veg,
   fruit and sauce alike. A scanned product becomes a food in
   that slot's list (see addScannedFood in 24-daily-loadout.js),
   and from that point on it is indistinguishable from something
   chosen out of the library: the same portion maths sizes it
   against the meal's target, the same cook plan and shopping
   list pick it up, the same HUD counts it.

   Nothing is duplicated. The camera and both decoders come from
   29-scanner.js, the Open Food Facts lookup from 21-food-lookup.js,
   and the commit step from 24-daily-loadout.js. scanTarget
   (declared in 21-food-lookup.js) decides where a decoded
   barcode belongs.
   ============================================================ */

  const fpScanCamBtn   = document.getElementById('fpScanCam');
  const fpBarcodeInput = document.getElementById('fpBarcode');
  const fpBarcodeClear = document.getElementById('fpBarcodeClear');
  const fpBarcodePhoto = document.getElementById('fpBarcodePhoto');
  const fpScanResults  = document.getElementById('fpScanResults');

  function fpStatus(msg){
    if (fpScanResults) fpScanResults.innerHTML = '<div class="off-status">' + msg + '</div>';
  }

  /* Clear the row when the picker opens on a different slot, so a message
     about the last scan is not left sitting under a fresh one. */
  function resetSlotScanRow(){
    if (fpScanResults) fpScanResults.innerHTML = '';
    if (fpBarcodeInput) fpBarcodeInput.value = '';
    if (fpBarcodeClear) fpBarcodeClear.style.display = 'none';
  }

  /* ---- serving size -> a countable unit -------------------------------
     "3 tenders (84 g)" is worth far more on the plan line than "112g" is,
     because it is the thing you actually do: put four tenders on the tray.
     Open Food Facts fills serving_size freehand, so this only fires on an
     unambiguous "<count> <word> (<n> g)" and gives up otherwise — grams are
     always correct, a wrong unit is not.

     The unit is marked soft, which is what keeps it honest: the count is
     shown to the nearest half with a "~", the gram figure beside it stays
     authoritative, and the portion is never rounded to fit a whole tender at
     the cost of the meal's calorie target. */
  const NOT_A_UNIT = /^(g|gram|grams|kg|mg|ml|l|oz|onz|ounce|ounces|fl|floz|serving|servings|portion|portions)$/i;

  function unitFromServing(serving){
    const txt = String(serving || '').trim();
    if (!txt) return null;
    const gram = txt.match(/([\d.]+)\s*g\b/i);
    if (!gram) return null;
    const grams = parseFloat(gram[1]);
    if (!(grams > 0)) return null;

    const lead = txt.match(/^\s*([\d.]+)\s+([A-Za-z][A-Za-z. -]{1,18}?)\s*[(,]/);
    if (!lead) return null;
    const count = parseFloat(lead[1]);
    if (!(count >= 1)) return null;
    const word = lead[2].trim().replace(/\.$/, '');
    if (!word || NOT_A_UNIT.test(word)) return null;

    const per = grams / count;
    /* A "unit" under 5g or over 500g is a parse that went wrong, not a
       piece of food someone counts out. */
    if (per < 5 || per > 500) return null;

    const many = /s$/i.test(word) ? word : word + 's';
    const one  = /s$/i.test(word) ? word.replace(/s$/i, '') : word;
    return {g: per, one: one.toLowerCase(), many: many.toLowerCase(), soft: true};
  }

  /* ---- an Open Food Facts hit as a library food ----------------------
     Same shape the FOODS tables use, so nothing downstream has to know where
     it came from. tags is empty because a barcode says nothing about whether
     something is vegan or contains gluten — guessing would silently break
     someone's dietary filter, and an empty list means "unknown", which is the
     truth. crave is empty for the same reason. */
  function slotFoodFromHit(hit, slot){
    const food = {
      key: scannedKeyFor(slot, hit.code),
      name: hit.brand ? (hit.name + ' (' + hit.brand + ')') : hit.name,
      kcal: hit.kcal,
      protein: hit.protein,
      carbs: hit.carbs,
      fat: hit.fat,
      tags: [],
      crave: [],
      /* null where the label was silent, so fibreOf()/sodiumOf() fall back to
         their own estimate rather than claiming the product contains none. */
      fibre: hit.fibre == null ? null : hit.fibre,
      sodium: hit.sodium == null ? null : hit.sodium,
      _scanned: true,
      code: hit.code,
    };
    const unit = unitFromServing(hit.serving);
    if (unit) food.unit = unit;
    return food;
  }

  /* Which macro this slot sizes its portion against, in words. */
  const MACRO_WORD = {protein:'protein', carbs:'carbohydrate', fat:'fat'};

  /* Seat the scanned product in the slot the picker was opened for. */
  function fpUseHit(hit){
    if (typeof pickTarget === 'undefined' || !pickTarget){
      fpStatus('Open a slot on the loadout page first, then scan.');
      return;
    }
    const slot = pickTarget.slot;
    const food = slotFoodFromHit(hit, slot);

    /* Protein, carb and fat slots size their portion by dividing the meal's
       target for that macro by what the food carries. A label reading zero
       there gives no portion at all, so say so instead of seating something
       that renders as 0g. Veg, fruit and sauce are sized by calories, which
       every product has, so they never hit this. */
    const macro = macroKeyFor(slot);
    if (MACRO_WORD[macro] && !(food[macro] > 0)){
      fpStatus('That label lists no ' + MACRO_WORD[macro] + ', so there is nothing to size a ' +
        escapeHtml(slot) + ' portion against. Try it in another slot, or add it under “already eaten”.');
      return;
    }

    addScannedFood(slot, food);
    resetSlotScanRow();
    commitFoodPick(food.key);
  }

  /* ---- lookup ----
     Called by useScannedCode() in 21-food-lookup.js when scanTarget is
     'slot', and directly by the barcode text field. */
  function slotScanLookup(code){
    const q = String(code || '').replace(/[\s-]/g, '');
    if (!/^\d+$/.test(q)){
      fpStatus('That looks like a name rather than a barcode. Name search isn’t available — use the food search below.');
      return;
    }
    if (q.length < 8){ fpStatus('Keep going — barcodes are 8 to 14 digits (' + q.length + ' so far).'); return; }
    if (q.length > 14){ fpStatus('That’s longer than any barcode. Check the number on the packet.'); return; }

    fpStatus('Looking up barcode…');
    /* offFetchJson decides a response is stale by comparing against offSeq,
       the shared counter in 21-food-lookup.js. It has to be bumped through
       that same variable — a private counter makes every response come back
       stale and the lookup silently does nothing. */
    const seq = ++offSeq;
    offFetchJson(OFF_PRODUCT + q + '.json?fields=' + OFF_FIELDS, seq).then(function(r){
      if (r.stale) return;
      if (r.netError || r.httpError){ offShowFailure(r, fpScanResults); return; }
      if (!r.data || r.data.status === 0 || !r.data.product){
        fpStatus('No product with barcode ' + escapeHtml(q) + '. Pick something from the list below, and consider adding it to Open Food Facts so the next person finds it.');
        return;
      }
      const hit = offParseProduct(r.data.product);
      if (!hit){
        fpStatus('That product is listed but has no usable nutrition data — a common gap in a volunteer database. Pick something from the list below.');
        return;
      }
      fpUseHit(hit);
    }).catch(function(){
      fpStatus('That lookup failed. Check your connection, or pick something from the list below.');
    });
  }

  /* ---- wiring ---- */
  if (fpScanCamBtn && typeof cameraSupported === 'function' && cameraSupported()){
    fpScanCamBtn.hidden = false;             // only offered where it can work
    fpScanCamBtn.addEventListener('click', function(){
      scanTarget = 'slot';
      startScan();
    });
  }

  if (fpBarcodePhoto){
    fpBarcodePhoto.addEventListener('change', function(e){
      const file = e.target.files && e.target.files[0];
      scanTarget = 'slot';
      /* decodeBarcodePhoto() writes its progress into the loadout tab's own
         results box, which is behind this modal. Say something here too, or
         the picker looks frozen while the picture is read. */
      if (file){ fpStatus('Reading the picture…'); decodeBarcodePhoto(file); }
      e.target.value = '';        // so the same picture can be retried
    });
  }

  if (fpBarcodeInput){
    let fpTypeTimer = null;
    fpBarcodeInput.addEventListener('input', function(){
      if (fpBarcodeClear) fpBarcodeClear.style.display = fpBarcodeInput.value ? '' : 'none';
      clearTimeout(fpTypeTimer);
      const v = fpBarcodeInput.value.trim();
      if (!v){ if (fpScanResults) fpScanResults.innerHTML = ''; return; }
      fpTypeTimer = setTimeout(function(){ slotScanLookup(v); }, 300);
    });
  }

  if (fpBarcodeClear){
    fpBarcodeClear.addEventListener('click', function(){
      fpBarcodeInput.value = '';
      fpBarcodeClear.style.display = 'none';
      if (fpScanResults) fpScanResults.innerHTML = '';
      fpBarcodeInput.focus();
    });
  }

  /* Leaving the picker hands the scanner back to the loadout tab, so a later
     scan started from there is not still pointed at a slot that has closed. */
  const fpCloseBtn = document.querySelector('[data-close="modalFoodPick"]');
  if (fpCloseBtn){
    fpCloseBtn.addEventListener('click', function(){
      scanTarget = 'eaten';
      resetSlotScanRow();
    });
  }
