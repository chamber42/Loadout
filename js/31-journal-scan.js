'use strict';
/* ============================================================
   LOADOUT - BARCODE SCANNING IN THE JOURNAL

   Scanning used to exist only on the loadout tab, which assumed
   you were assembling a day. Someone with a prep already built
   is usually doing the opposite: recording what they actually
   ate. That belongs in the journal, so the same scanner, photo
   decoder and Open Food Facts lookup are wired up here too.

   Nothing is duplicated. The camera and the decoders come from
   29-scanner.js, the lookup helpers from 21-food-lookup.js, and
   the result is handed to the journal's own amount step, so a
   scanned product is edited and logged exactly like a library
   food. scanTarget (declared in 21-food-lookup.js) decides which
   destination a decoded barcode belongs to.
   ============================================================ */

  const jfScanCamBtn   = document.getElementById('jfScanCam');
  const jfBarcodeInput = document.getElementById('jfBarcode');
  const jfBarcodeClear = document.getElementById('jfBarcodeClear');
  const jfBarcodePhoto = document.getElementById('jfBarcodePhoto');
  const jfScanResults  = document.getElementById('jfScanResults');

  function jfStatus(msg){
    if (jfScanResults) jfScanResults.innerHTML = '<div class="off-status">' + msg + '</div>';
  }

  /* ---- turn an Open Food Facts hit into the journal's own food shape ----
     addLibraryFoodToJournal() reads name/kcal/protein/carbs/fat as per-100g
     values plus unit and key, which is exactly what a hit already carries.
     unit:null keeps the amount step in grams, which is the only sensible
     unit for a packaged product whose serving size we cannot trust. */
  function jfFoodFromHit(h){
    return {
      name: h.brand ? (h.name + ' (' + h.brand + ')') : h.name,
      kcal: h.kcal,
      protein: h.protein,
      carbs: h.carbs,
      fat: h.fat,
      fibre: 0,
      sodium: 0,
      unit: null,
      key: null,
      _off: true
    };
  }

  /* Hand the product to the journal's existing amount step. From here it is
     indistinguishable from picking something out of the library: same stepper,
     same macro readout, same ADD button. */
  function jfUseHit(h){
    if (typeof jfoodTarget === 'undefined' || !jfoodTarget){
      jfStatus('Open a meal in the journal first, then scan.');
      return;
    }
    jfoodTarget.pick = { food: jfFoodFromHit(h), slot: 'protein' };
    jfoodTarget.freeGrams = true;
    jfoodTarget.grams = 100;
    if (jfScanResults) jfScanResults.innerHTML = '';
    if (jfBarcodeInput) jfBarcodeInput.value = '';
    if (jfBarcodeClear) jfBarcodeClear.style.display = 'none';
    renderJournalFoodAmount();
  }

  /* ---- lookup ----
     Called by useScannedCode() in 21-food-lookup.js when scanTarget is
     'journal', and directly by the barcode text field. */
  function journalScanLookup(code){
    const q = String(code || '').replace(/[\s-]/g, '');
    if (!/^\d+$/.test(q)){
      jfStatus('That looks like a name rather than a barcode. Name search isn’t available — use the library search below.');
      return;
    }
    if (q.length < 8){ jfStatus('Keep going — barcodes are 8 to 14 digits (' + q.length + ' so far).'); return; }
    if (q.length > 14){ jfStatus('That’s longer than any barcode. Check the number on the packet.'); return; }

    jfStatus('Looking up barcode…');
    /* offFetchJson marks a response stale by comparing against offSeq, the
       shared counter in 21-food-lookup.js. It has to be bumped through that
       same variable -- passing a private counter makes every response come
       back stale and the lookup silently does nothing. */
    const seq = ++offSeq;
    offFetchJson(OFF_PRODUCT + q + '.json?fields=' + OFF_FIELDS, seq).then(function(r){
      if (r.stale) return;
      if (r.netError || r.httpError){
        offShowFailure(r, jfScanResults);
        return;
      }
      if (!r.data || r.data.status === 0 || !r.data.product){
        jfStatus('No product with barcode ' + escapeHtml(q) + '. Add it by hand below, and consider adding it to Open Food Facts so the next person finds it.');
        return;
      }
      const hit = offParseProduct(r.data.product);
      if (!hit){
        jfStatus('That product is listed but has no usable nutrition data — a common gap in a volunteer database. Add it by hand below.');
        return;
      }
      jfUseHit(hit);
    }).catch(function(){
      jfStatus('That lookup failed. Check your connection, or add the item by hand below.');
    });
  }

  /* ---- wiring ---- */
  if (jfScanCamBtn && typeof cameraSupported === 'function' && cameraSupported()){
    jfScanCamBtn.hidden = false;
    jfScanCamBtn.addEventListener('click', function(){
      scanTarget = 'journal';
      startScan();
    });
  }

  if (jfBarcodePhoto){
    jfBarcodePhoto.addEventListener('change', function(e){
      const file = e.target.files && e.target.files[0];
      scanTarget = 'journal';
      if (file) decodeBarcodePhoto(file);
      e.target.value = '';        // so the same picture can be retried
    });
  }

  if (jfBarcodeInput){
    let jfTypeTimer = null;
    jfBarcodeInput.addEventListener('input', function(){
      if (jfBarcodeClear) jfBarcodeClear.style.display = jfBarcodeInput.value ? '' : 'none';
      clearTimeout(jfTypeTimer);
      const v = jfBarcodeInput.value.trim();
      if (!v){ if (jfScanResults) jfScanResults.innerHTML = ''; return; }
      jfTypeTimer = setTimeout(function(){ journalScanLookup(v); }, 300);
    });
  }

  if (jfBarcodeClear){
    jfBarcodeClear.addEventListener('click', function(){
      jfBarcodeInput.value = '';
      jfBarcodeClear.style.display = 'none';
      if (jfScanResults) jfScanResults.innerHTML = '';
      jfBarcodeInput.focus();
    });
  }

  /* Leaving the journal sheet hands the scanner back to the loadout tab, so a
     later scan started from there is not still pointed at the journal. */
  const jfCloseBtn = document.querySelector('[data-close="modalJournalFood"]');
  if (jfCloseBtn){
    jfCloseBtn.addEventListener('click', function(){
      scanTarget = 'eaten';
      if (jfScanResults) jfScanResults.innerHTML = '';
      if (jfBarcodeInput) jfBarcodeInput.value = '';
      if (jfBarcodeClear) jfBarcodeClear.style.display = 'none';
    });
  }
