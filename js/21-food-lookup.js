'use strict';
/* ============================================================
   LOADOUT - OPEN FOOD FACTS LOOKUP + BARCODE
   From app.js lines 8818-9318 of the original single file.
   Loaded in order by index.html; all files share one global scope,
   so declarations here are visible to every file listed after it.
   ============================================================ */

  /* =========================================================
     OPEN FOOD FACTS LOOKUP
     Searches the public Open Food Facts database for packaged products so a
     branded item can be logged without typing four numbers by hand.

     No API key is needed, which is what makes this workable from a static
     page — there's no secret to leak in the repository.

     Three things this code has to be careful about, all of them documented
     behaviours of the service rather than edge cases:
       1. A miss still returns HTTP 200. The body carries the real answer, so
          the status line is never trusted on its own.
       2. The data is contributed by volunteers and is often incomplete —
          products with no name, no nutrition, or nonsense values are normal.
          Anything without usable numbers is filtered out before display.
       3. It's a live network call, so it can simply fail. Every path ends in
          a readable message rather than a silent nothing.
  ========================================================= */
  /* Two endpoints, because the old one is gone.

     The legacy Perl search (cgi/search.pl) has been returning 503 globally
     and is deprecated; Open Food Facts point people at Search-a-licious
     instead, which is what free-text search uses here.

     Barcode lookup goes to the v2 product endpoint, which is unaffected and
     is the most reliable path in the whole service — so if the search is
     having a bad day, typing the barcode off the packet still works. */
  const OFF_SEARCH   = 'https://search.openfoodfacts.org/search';
  const OFF_PRODUCT  = 'https://world.openfoodfacts.org/api/v2/product/';
  const OFF_FIELDS   = 'code,product_name,brands,quantity,serving_size,nutriments';

  /* Pull a usable per-100g profile out of a product record, or null */
  function offParseProduct(p){
    if (!p) return null;
    const n = p.nutriments || {};
    const num = v => {
      const x = typeof v === 'string' ? parseFloat(v) : v;
      return (typeof x === 'number' && isFinite(x) && x >= 0) ? x : null;
    };
    let kcal = num(n['energy-kcal_100g']);
    if (kcal == null){
      const kj = num(n['energy_100g']);          // some entries only carry kJ
      if (kj != null) kcal = kj / 4.184;
    }
    const protein = num(n['proteins_100g']);
    const carbs   = num(n['carbohydrates_100g']);
    const fat     = num(n['fat_100g']);
    const name    = (p.product_name || '').trim();

    // without a name or calories there's nothing worth showing
    if (!name || kcal == null) return null;
    // obviously wrong records: nothing edible exceeds ~900 kcal per 100g
    if (kcal > 950) return null;

    return {
      code: p.code || '',
      name,
      brand: (p.brands || '').split(',')[0].trim(),
      serving: (p.serving_size || '').trim(),
      kcal,
      protein: protein == null ? 0 : protein,
      carbs:   carbs   == null ? 0 : carbs,
      fat:     fat     == null ? 0 : fat,
      partial: (protein == null || carbs == null || fat == null),
    };
  }

  let offTimer = null, offSeq = 0;

  const looksLikeBarcode = q => /^\d{8,14}$/.test(q.replace(/\s/g,''));

  async function offFetchJson(url, seq){
    const ctrl = new AbortController();
    const bail = setTimeout(()=>ctrl.abort(), 12000);
    try{
      const res = await fetch(url, {signal: ctrl.signal, headers:{'Accept':'application/json'}});
      clearTimeout(bail);
      if (seq !== offSeq) return {stale:true};
      if (!res.ok) return {httpError:res.status};
      return {data: await res.json()};
    }catch(err){
      clearTimeout(bail);
      if (seq !== offSeq) return {stale:true};
      return {netError: (err && err.name === 'AbortError') ? 'timeout' : 'unreachable'};
    }
  }

  function offSearch(query){
    const results = document.getElementById('offResults');
    const raw = query.trim();
    const q = raw.replace(/[\s-]/g,'');
    clearTimeout(offTimer);

    if (!raw){ results.innerHTML = ''; return; }

    /* Only barcodes can be looked up. Open Food Facts' text-search endpoints
       don't send the header a browser needs to read a cross-site response,
       so a name search from a page like this one can't work at all — better
       to say so than to spin and fail. */
    if (!/^\d+$/.test(q)){
      results.innerHTML = `<div class="off-status">That looks like a name rather than a barcode. Name search isn't available here — enter the barcode digits from the packet, or add the item manually below.</div>`;
      return;
    }
    if (q.length < 8){
      results.innerHTML = `<div class="off-status">Keep going — barcodes are 8 to 14 digits (${q.length} so far).</div>`;
      return;
    }
    if (q.length > 14){
      results.innerHTML = `<div class="off-status">That's longer than any barcode. Check the number on the packet.</div>`;
      return;
    }

    results.innerHTML = '<div class="off-status">Looking up barcode…</div>';
    const seq = ++offSeq;
    offTimer = setTimeout(async ()=>{
      const r = await offFetchJson(`${OFF_PRODUCT}${q}.json?fields=${OFF_FIELDS}`, seq);
      if (r.stale) return;
      if (r.netError || r.httpError){ offShowFailure(r, results); return; }
      // a missing barcode still returns 200 — the real answer is in the body
      if (!r.data || r.data.status === 0 || !r.data.product){
        results.innerHTML = `<div class="off-status">No product with barcode ${escapeHtml(q)}. It may not be in the database yet — add it manually below, and consider adding it to Open Food Facts so the next person finds it.</div>`;
        return;
      }
      const hit = offParseProduct(r.data.product);
      if (!hit){
        results.innerHTML = '<div class="off-status">That product is listed but has no usable nutrition data — a common gap in a volunteer database. Add it manually below.</div>';
        return;
      }
      offRenderHits([hit]);
    }, 300);
  }

  /* ---------------------------------------------------------
     CONNECTION TEST
     Whether a browser can reach these endpoints depends on CORS headers the
     Open Food Facts servers send. This tries each and reports what happened,
     so the app can be pointed at whichever one works.
  --------------------------------------------------------- */
  const OFF_CANDIDATES = [
    {label:'Barcode lookup (v2 product)',
     url:'https://world.openfoodfacts.org/api/v2/product/3017624010701.json?fields=code,product_name'},
    {label:'Search-a-licious (text search)',
     url:'https://search.openfoodfacts.org/search?q=water&page_size=1'},
    {label:'Legacy search (deprecated)',
     url:'https://world.openfoodfacts.org/cgi/search.pl?search_terms=water&search_simple=1&action=process&json=1&page_size=1'},
  ];

  async function offTestConnection(){
    const results = document.getElementById('offResults');
    results.innerHTML = '<div class="off-status">Testing connections…</div>';
    const lines = [];
    for (const c of OFF_CANDIDATES){
      const started = Date.now();
      let verdict;
      try{
        const ctrl = new AbortController();
        const bail = setTimeout(()=>ctrl.abort(), 9000);
        const res = await fetch(c.url, {signal: ctrl.signal});
        clearTimeout(bail);
        if (!res.ok) verdict = '<span style="color:var(--amber)">HTTP ' + res.status + '</span>';
        else { await res.json(); verdict = '<span style="color:var(--green)">works</span> (' + (Date.now()-started) + 'ms)'; }
      }catch(err){
        verdict = (err && err.name === 'AbortError')
          ? '<span style="color:var(--amber)">timed out</span>'
          : '<span style="color:var(--red)">blocked or unreachable</span>';
      }
      lines.push('<div class="kv"><span>' + c.label + '</span><span>' + verdict + '</span></div>');
    }
    results.innerHTML = lines.join('') +
      '<div class="off-credit">\u201CBlocked or unreachable\u201D means the server didn\u2019t send the header a browser needs to allow cross-site requests \u2014 that\u2019s on their end, and nothing in this app can change it.</div>';
  }

  /* =========================================================
     BARCODE FROM AN UPLOADED PICTURE
     The app deliberately does not operate a camera. Live scanning is not
     available on iOS at all — WebKit has never implemented BarcodeDetector,
     and the flag that briefly enabled it in iOS 17 has been broken since
     iOS 18 — and a camera surface is a large amount of failure-prone code
     for something the phone's own camera app already does well.

     So the user takes the picture however they like and uploads it. A still
     also decodes more reliably than a video stream: no dropped frames, no
     autofocus race, one sharp image is enough.

     Two decoders: the browser's own where it exists, then ZXing fetched from
     a CDN only when actually needed, so nobody pays for the download unless
     they use the feature.
  ========================================================= */
  const ZXING_CDN = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';
  let zxingReady = null;

  function loadZxing(){
    if (zxingReady) return zxingReady;
    zxingReady = new Promise(function(resolve, reject){
      const tag = document.createElement('script');
      tag.src = ZXING_CDN;
      tag.onload = function(){ resolve(window.ZXing); };
      tag.onerror = function(){ zxingReady = null; reject(new Error('cdn')); };
      document.head.appendChild(tag);
      setTimeout(function(){ reject(new Error('timeout')); }, 15000);
    });
    return zxingReady;
  }

  /* Draw the photo to a canvas, capped so a 12MP image doesn't stall the
     decoder, and hand back the element both decoders can read. */
  function photoToCanvas(file){
    return new Promise(function(resolve, reject){
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = function(){
        const MAX = 1600;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const cv = document.getElementById('barcodeCanvas');
        cv.width  = Math.round(img.width  * scale);
        cv.height = Math.round(img.height * scale);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        resolve(cv);
      };
      img.onerror = function(){ URL.revokeObjectURL(url); reject(new Error('image')); };
      img.src = url;
    });
  }

  function toLuminance(imgData){
    const data = imgData.data, w = imgData.width, h = imgData.height;
    const out = new Uint8ClampedArray(w * h);
    for (let i = 0, p = 0; i < data.length; i += 4, p++){
      out[p] = (data[i]*0.299 + data[i+1]*0.587 + data[i+2]*0.114) | 0;
    }
    return out;
  }

  function tryDecode(reader, ZX, source){
    try{
      const bitmap = new ZX.BinaryBitmap(new ZX.HybridBinarizer(source));
      const res = reader.decode(bitmap);
      return res ? res.getText() : '';
    }catch(e){ return ''; }
  }

  function useScannedCode(code){
    const input = document.getElementById('offSearch');
    input.value = code;
    document.getElementById('offClear').style.display = '';
    offSearch(code);
  }

  async function decodeBarcodePhoto(file){
    const results = document.getElementById('offResults');
    results.innerHTML = '<div class="off-status">Reading the picture\u2026</div>';

    let canvas;
    try{ canvas = await photoToCanvas(file); }
    catch(e){
      results.innerHTML = '<div class="off-status">That file couldn\u2019t be read as an image. Try a different picture \u2014 JPEG or PNG works best.</div>';
      return;
    }

    // 1. the browser's own decoder, where it exists
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window){
      try{
        const det = new window.BarcodeDetector({formats:['ean_13','ean_8','upc_a','upc_e','code_128','itf']});
        const found = await det.detect(canvas);
        const code = (found && found.length) ? String(found[0].rawValue || '').replace(/\D/g,'') : '';
        if (code.length >= 8){ useScannedCode(code); return; }
      }catch(e){ /* fall through */ }
    }

    // 2. ZXing, loaded on demand
    results.innerHTML = '<div class="off-status">Reading the picture\u2026 (loading the barcode reader)</div>';
    let ZX;
    try{ ZX = await loadZxing(); }
    catch(e){
      results.innerHTML = '<div class="off-status">Couldn\u2019t load the barcode reader' +
        (e && e.message === 'timeout' ? ' in time' : '') +
        '. You can type the number from the packet instead.</div>';
      return;
    }
    if (!ZX || !ZX.MultiFormatReader){
      // a bad load must not be cached, or every retry fails the same way
      zxingReady = null;
      results.innerHTML = '<div class="off-status">The barcode reader did not load properly. Try once more, or type the number from the packet.</div>';
      return;
    }

    try{
      const hints = new Map();
      hints.set(ZX.DecodeHintType.POSSIBLE_FORMATS, [
        ZX.BarcodeFormat.EAN_13, ZX.BarcodeFormat.EAN_8,
        ZX.BarcodeFormat.UPC_A,  ZX.BarcodeFormat.UPC_E,
        ZX.BarcodeFormat.CODE_128, ZX.BarcodeFormat.ITF
      ]);
      hints.set(ZX.DecodeHintType.TRY_HARDER, true);
      const reader = new ZX.MultiFormatReader();
      reader.setHints(hints);

      const px = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
      const lum = new ZX.RGBLuminanceSource(toLuminance(px), canvas.width, canvas.height);

      let text = tryDecode(reader, ZX, lum);
      // barcodes photographed sideways are common
      if (!text && lum.isRotateSupported && lum.isRotateSupported()){
        try{ reader.reset(); text = tryDecode(reader, ZX, lum.rotateCounterClockwise()); }catch(e){}
      }
      const code = (text || '').replace(/\D/g,'');
      if (code.length >= 8){ useScannedCode(code); return; }

      results.innerHTML = '<div class="off-status">No barcode found in that picture. It works best when the barcode fills most of the frame and is in focus \u2014 or just type the number instead.</div>';
    }catch(e){
      results.innerHTML = '<div class="off-status">No barcode found in that picture. Try one where the barcode is larger and sharper, or type the number instead.</div>';
    }
  }

  function offShowFailure(r, results, offerBarcode){
    let msg;
    if (r.netError === 'timeout') msg = 'That search took too long.';
    else if (r.netError) msg = "Couldn't reach Open Food Facts. You may be offline, or the page may be running somewhere that blocks outside requests — it works on a normal web address.";
    else if (r.httpError === 503) msg = 'Open Food Facts search is temporarily unavailable (503).';
    else msg = `Open Food Facts returned an error (${r.httpError}).`;
    results.innerHTML = `<div class="off-status">${msg}${offerBarcode ? ' Barcode lookups usually still work — try pasting the number from the packet.' : ''} You can always add the item manually below.</div>`;
  }

  function offRenderHits(hits){
    const results = document.getElementById('offResults');
    window.__offHits = hits;
    results.innerHTML = hits.map((h,i)=>`
      <button class="off-hit" data-off="${i}">
        <span class="nm">${escapeHtml(h.name)}
          <small>${escapeHtml(h.brand || 'unbranded')}${h.serving ? ' · serving ' + escapeHtml(h.serving) : ''}${h.partial ? ' · macros incomplete' : ''}</small>
        </span>
        <span class="kc">${Math.round(h.kcal)} kcal<br>/100g</span>
      </button>`).join('')
      + `<div class="off-credit">Results from Open Food Facts, a volunteer-built open database.
           Entries are contributed by the public and are often incomplete or wrong —
           check against the packet before you rely on them.</div>`;

    results.querySelectorAll('[data-off]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const h = window.__offHits[parseInt(btn.getAttribute('data-off'),10)];
        if (!h) return;
        offAddToEaten(h);
      });
    });
  }

  function escapeHtml(str){
    return String(str).replace(/[&<>"']/g, c =>
      ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  /* Values arrive per 100g. Default to 100g so the numbers shown are the
     numbers stored, and let the person edit the amount afterwards. */
  function offAddToEaten(h){
    const grams = 100;
    const f = grams / 100;
    state.eaten.push({
      name: h.brand ? `${h.name} (${h.brand})` : h.name,
      kcal:    Math.round(h.kcal * f),
      protein: Math.round(h.protein * f),
      carbs:   Math.round(h.carbs * f),
      fat:     Math.round(h.fat * f),
      covers: '',
      grams,
      per100: {kcal:h.kcal, protein:h.protein, carbs:h.carbs, fat:h.fat},
    });
    document.getElementById('offSearch').value = '';
    document.getElementById('offClear').style.display = 'none';
    document.getElementById('offResults').innerHTML =
      '<div class="off-status">Added below — set the amount you actually ate.</div>';
    renderEatenPanel();
    refreshTargets();
    saveState();
  }

  const btnAddEaten = document.getElementById('btnAddEaten');
  const offSearchInput = document.getElementById('offSearch');
  const offClearBtn = document.getElementById('offClear');
  offSearchInput.addEventListener('input', ()=>{
    offClearBtn.style.display = offSearchInput.value ? '' : 'none';
    offSearch(offSearchInput.value);
  });
  document.getElementById('barcodePhoto').addEventListener('change', (e)=>{
    const file = e.target.files && e.target.files[0];
    if (file) decodeBarcodePhoto(file);
    e.target.value = '';   // so the same photo can be retried
  });
  /* ---- calendar controls ---- */
  document.getElementById('calMode').addEventListener('change', (e)=>{
    state.calMode = e.target.value; renderCalendar(); saveState();
  });
  const calStep = (dir)=>{
    const cur = calCursor();
    if ((state.calMode||'month') === 'week') cur.setDate(cur.getDate() + dir*7);
    else cur.setMonth(cur.getMonth() + dir);
    state.calDate = todayKey(cur);
    renderCalendar(); saveState();
  };
  document.getElementById('calPrev').addEventListener('click', ()=> calStep(-1));
  document.getElementById('calNext').addEventListener('click', ()=> calStep(1));

  /* ---- recipe search ---- */
  const recipeSearchEl = document.getElementById('recipeSearch');
  const recipeClearEl = document.getElementById('recipeClear');
  recipeSearchEl.addEventListener('input', ()=>{
    state.recipeQuery = recipeSearchEl.value;
    recipeClearEl.style.display = recipeSearchEl.value ? '' : 'none';
    renderRecipeBook();
  });
  recipeClearEl.addEventListener('click', ()=>{
    recipeSearchEl.value = ''; state.recipeQuery = '';
    recipeClearEl.style.display = 'none';
    renderRecipeBook(); recipeSearchEl.focus();
  });

  /* ---- system menu ---- */
  function renderSystemMenu(){
    const host = document.getElementById('sysThemeGrid');
    host.innerHTML = Object.entries(THEMES).map(([k,t])=>
      `<button class="theme-btn${state.theme===k?' selected':''}" data-systheme="${k}"
        aria-label="${t.name} theme"><span class="ic">${ic(t.icon)}</span><span class="nm">${t.name}</span></button>`).join('');
    host.querySelectorAll('[data-systheme]').forEach(b=>b.addEventListener('click', ()=>{
      applyTheme(b.getAttribute('data-systheme'));
      renderSystemMenu();
      renderTiers();
      saveState();
    }));
  }
  document.getElementById('btnSystem').addEventListener('click', ()=>{
    renderSystemMenu(); openModal('modalSystem');
  });
  document.getElementById('sysRecreate').addEventListener('click', ()=>{
    closeModal('modalSystem'); showScreen('screen-onboard');
  });
  document.getElementById('sysReprep').addEventListener('click', ()=>{
    closeModal('modalSystem'); renderPrefs(); showScreen('screen-prefs');
  });
  document.getElementById('sysReset').addEventListener('click', (e)=>{
    const btn = e.currentTarget;
    // a destructive action shouldn't fire on a single stray tap
    if (btn.dataset.armed !== '1'){
      btn.dataset.armed = '1';
      btn.innerHTML = ic('warn') + ' Tap again to wipe everything';
      setTimeout(()=>{ btn.dataset.armed=''; btn.innerHTML = ic('power') + ' Start over — wipes everything saved'; }, 5000);
      return;
    }
    clearSaved(); location.reload();
  });

  const foodPickSearchEl = document.getElementById('foodPickSearch');
  const foodPickClearEl = document.getElementById('foodPickClear');
  foodPickSearchEl.addEventListener('input', ()=>{
    foodPickClearEl.style.display = foodPickSearchEl.value ? '' : 'none';
    renderFoodPickList(foodPickSearchEl.value);
  });
  foodPickClearEl.addEventListener('click', ()=>{
    foodPickSearchEl.value = '';
    foodPickClearEl.style.display = 'none';
    renderFoodPickList('');
    foodPickSearchEl.focus();
  });

  document.getElementById('btnOffTest').addEventListener('click', offTestConnection);
  offClearBtn.addEventListener('click', ()=>{
    offSearchInput.value = '';
    offClearBtn.style.display = 'none';
    document.getElementById('offResults').innerHTML = '';
    offSearchInput.focus();
  });

  btnAddEaten.addEventListener('click', ()=>{
    state.eaten.push({name:"", kcal:"", protein:"", carbs:"", fat:"", covers:""});
    renderEatenPanel();
    refreshTargets();
  });

  function proceedToLoadout(reset){
    if (reset !== false){
      MEALS.forEach(m => state.selections[m.key] = blankMeal());
    }
    renderEatenPanel();
    renderMealTimeline();
    refreshTargets();
    showScreen('screen-loadout');
  }

  function goToStyle(){
    renderStyle();
    showScreen('screen-style');
  }

  btnConfirmCravings.addEventListener('click', goToStyle);
  btnSkipCravings.addEventListener('click', ()=>{
    state.cravings = [];
    state.favorites = {protein:[], carb:[], fat:[], veg:[], fruit:[], sauce:[]};
    state.discoveryMode = 'favorites';
    renderCravings();
    goToStyle();
  });

