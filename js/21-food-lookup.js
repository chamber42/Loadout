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
  const OFF_FIELDS   = 'code,product_name,brands,quantity,serving_size,serving_quantity,serving_quantity_unit,nutriments';

  /* Open Food Facts asks every caller to identify itself, and bans the ones
     that don't. Browsers forbid scripts from setting User-Agent and drop this
     silently; the native bridge sends it, which is where the searching
     happens anyway. */
  /* Open Food Facts asks callers to identify themselves as
     AppName/Version (ContactEmail) so they have somewhere to write if an
     app misbehaves, and they block callers they cannot reach.

     TODO BEFORE THE APP STORE BUILD: replace the repository URL with a real
     contact address. The URL is accepted today and nothing breaks without
     the change, but it is not what they ask for, and the same address has
     to exist anyway — Apple requires a public support contact on the store
     listing. See the launch-decisions note kept outside this repository. */
  const LOADOUT_CONTACT = 'https://github.com/chamber42/Loadout';   // <- email goes here
  const OFF_UA = 'Loadout/1.0 (' + LOADOUT_CONTACT + ')';

  /* Name search reaches a host that sends no access-control-allow-origin, so
     a WebView fetch of it is blocked before it leaves the page. Capacitor's
     native HTTP bridge does the request in Swift, where the same-origin
     policy does not exist, and hands back the body. Checked at call time
     rather than on load, because the Capacitor global is injected by the
     native shell and a module-level read can lose the race. */
  const offNative = () => !!(window.Capacitor &&
    typeof window.Capacitor.isNativePlatform === 'function' &&
    window.Capacitor.isNativePlatform());

  /* What one serving weighs, or null when the label never said.

     Open Food Facts computes serving_quantity for most products, so that is
     trusted first. Where it is missing the label text is read instead, which
     comes in shapes like "30 g", "125 ml" and "1 bar (55 g)" — hence matching
     a number that is followed by a unit rather than the first number present,
     so a bar count is not mistaken for its weight.

     Volumes are taken at face value because Open Food Facts states its
     nutriments per 100g and pairs them with millilitre servings itself; the
     two are the same basis in their data, whatever a density table says. */
  function offServingGrams(p){
    const q = parseFloat(p.serving_quantity);
    if (isFinite(q) && q > 0 && q <= 2000) return q;
    const m = String(p.serving_size || '').match(/(\d+(?:[.,]\d+)?)\s*(g|ml)\b/i);
    if (m){
      const n = parseFloat(m[1].replace(',', '.'));
      if (isFinite(n) && n > 0 && n <= 2000) return n;
    }
    /* Last resort: some records name no serving anywhere but still carry
       per-serving nutriments beside the per-100g ones. The ratio of the two
       energy figures is the serving weight the contributor was working from,
       so the record implies what it never states. */
    const nut = p.nutriments || {};
    const per = parseFloat(nut['energy-kcal_serving']);
    const hundred = parseFloat(nut['energy-kcal_100g']);
    if (isFinite(per) && per > 0 && isFinite(hundred) && hundred > 0){
      const g = per / hundred * 100;
      if (g >= 1 && g <= 2000) return Math.round(g * 10) / 10;
    }
    return null;
  }

  /* The two endpoints disagree on this one field: the product endpoint sends
     'Chobani,Danone', the search endpoint sends ['Chobani','Danone']. Both
     mean the same thing, and only the first name is ever shown. */
  function brandOf(p){
    const b = p.brands;
    if (Array.isArray(b)) return (b[0] || '').trim();
    return (b || '').split(',')[0].trim();
  }

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
    const fibre   = num(n['fiber_100g']);
    /* Open Food Facts records sodium in GRAMS per 100g, and many entries
       carry only salt. The app works in milligrams, and salt is 39.34%
       sodium by mass — the same conversion the packet itself uses. */
    let sodium = num(n['sodium_100g']);
    if (sodium == null){
      const salt = num(n['salt_100g']);
      if (salt != null) sodium = salt * 0.3934;
    }
    const name    = (p.product_name || '').trim();
    const partialMacros = (protein == null || carbs == null || fat == null);

    // without a name or calories there's nothing worth showing
    if (!name || kcal == null) return null;
    // obviously wrong records: nothing edible exceeds ~900 kcal per 100g
    if (kcal > 950) return null;

    /* Atwater cross-check: protein and carbohydrate carry 4 kcal a gram, fat
       9, so the macros imply a calorie figure of their own. A sound label
       agrees with itself to within a few percent — this product's stated
       237.9 kcal/100g against an implied 239.2 is what a good record looks
       like. A wide gap means someone mistyped a number, and since there is no
       way to tell which number, the honest move is to show both and say so
       rather than quietly trust either. Fibre and sugar alcohols legitimately
       shift the sum, hence a tolerance wide enough not to cry wolf. */
    const implied = (protein == null ? 0 : protein) * 4
                  + (carbs   == null ? 0 : carbs)   * 4
                  + (fat     == null ? 0 : fat)     * 9;
    const gap = Math.abs(implied - kcal);
    const suspect = !partialMacros && implied > 0 && gap > 30 && gap / kcal > 0.25;

    return {
      code: p.code || '',
      name,
      brand: brandOf(p),
      serving: (p.serving_size || '').trim(),
      servingG: offServingGrams(p),
      kcal,
      protein: protein == null ? 0 : protein,
      carbs:   carbs   == null ? 0 : carbs,
      fat:     fat     == null ? 0 : fat,
      /* null, not 0, when the label is silent: a missing figure must fall
         back to the app's own estimate rather than claim the product has
         none of it. */
      fibre:   fibre,
      sodium:  sodium == null ? null : sodium * 1000,
      partial: partialMacros,
      suspect,
      impliedKcal: implied,
    };
  }

  let offTimer = null, offSeq = 0;

  const looksLikeBarcode = q => /^\d{8,14}$/.test(q.replace(/\s/g,''));

  async function offFetchJson(url, seq){
    const ctrl = new AbortController();
    const bail = setTimeout(()=>ctrl.abort(), 12000);
    try{
      const res = await fetch(url, {signal: ctrl.signal,
        headers:{'Accept':'application/json', 'User-Agent':OFF_UA}});
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

    /* Digits go to the product endpoint, anything else is a name. The web
       build can still only do barcodes — see offNative above. */
    if (!/^\d+$/.test(q)){
      if (!offNative()){
        results.innerHTML = `<div class="off-status">Searching by name needs the installed app. Enter the barcode digits from the packet, or add the item manually below.</div>`;
        return;
      }
      if (raw.length < 3) { results.innerHTML = ''; return; }
      offSearchByName(raw, results);
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

  /* Open Food Facts allows ten searches a minute per address and bans
     callers that overrun it, so the keystroke debounce here is far longer
     than the barcode path's: a fast typist would otherwise spend the whole
     minute's budget before finishing a single word.

     The endpoint ranks by relevance and returns plenty of chaff, so the
     usual filter does the real work — anything with no name or no calories
     is dropped before display, and what survives is capped at a screenful. */
  function offSearchByName(term, results){
    /* The bundled USDA table answers before the network does — it is local,
       so there is nothing to wait for and no rate limit to spend. Rendering
       it straight away puts a whole food on screen while the Open Food
       Facts request is still in flight. */
    const local = (typeof usdaSearch === 'function') ? usdaSearch(term) : [];
    if (local.length) offRenderHits(local);
    else results.innerHTML = '<div class="off-status">Searching…</div>';

    const seq = ++offSeq;
    offTimer = setTimeout(async ()=>{
      const url = `${OFF_SEARCH}?q=${encodeURIComponent(term)}`
                + `&page_size=25&fields=${OFF_FIELDS}`;
      const r = await offFetchJson(url, seq);
      if (r.stale) return;
      if (r.netError || r.httpError){
        /* A failed lookup is only a failure when it leaves the person with
           nothing. With USDA hits already on screen, announcing that the
           network broke would be telling them their results are missing
           while they are looking at them. */
        if (!local.length) offShowFailure(r, results);
        return;
      }
      const hits = (r.data && Array.isArray(r.data.hits)) ? r.data.hits : [];
      const usable = hits.map(offParseProduct).filter(Boolean).slice(0, 12)
        .map(h => Object.assign(h, {_fromSearch: true}));
      if (!usable.length){
        if (!local.length){
          results.innerHTML = `<div class="off-status">Nothing usable for “${escapeHtml(term)}”. Try the brand name, or fewer words — or add the item manually below.</div>`;
        }
        return;
      }
      offRenderHits(local.concat(usable));
    }, 650);
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

  /* Turn a luminance buffer a quarter turn.

     RGBLuminanceSource reports isRotateSupported() === false and throws if
     asked, so ZXing's own rotation retry never fires and neither did the
     guarded call this used to sit beside. Rotating the pixels by hand is the
     only way to read a barcode held sideways, which is how people hold a
     tall packet. */
  function rotateLuminance(lum, w, h){
    const out = new Uint8ClampedArray(w * h);
    for (let y = 0; y < h; y++){
      const row = y * w;
      for (let x = 0; x < w; x++){
        out[x * h + (h - 1 - y)] = lum[row + x];
      }
    }
    return out;
  }

  /* hints MUST be passed to decode(), not merely set on the reader beforehand.
     MultiFormatReader.decode(image, hints) calls setHints(hints) on the way
     in, so decode(image) with no second argument overwrites whatever was
     configured with undefined — silently discarding POSSIBLE_FORMATS and
     TRY_HARDER. With TRY_HARDER lost, ZXing samples only fifteen rows around
     the middle of the frame, which is exactly why scanning used to demand the
     barcode be placed dead centre. */
  function tryDecode(reader, ZX, source, hints){
    try{
      const bitmap = new ZX.BinaryBitmap(new ZX.HybridBinarizer(source));
      const res = hints ? reader.decode(bitmap, hints) : reader.decode(bitmap);
      return res ? res.getText() : '';
    }catch(e){ return ''; }
  }

  /* Where a decoded barcode should land. One scanner and one photo decoder
     serve three destinations — the loadout tab's "already eaten" list, the
     journal, and a food slot on the loadout page — so the caller says which
     one it is rather than each growing its own copy of the pipeline.
     Set by whichever control started the scan; journalScanLookup() lives in
     31-journal-scan.js and slotScanLookup() in 36-slot-scan.js, both resolved
     at call time, after every file loads. */
  let scanTarget = 'eaten';

  function useScannedCode(code){
    if (scanTarget === 'journal'){ journalScanLookup(code); return; }
    if (scanTarget === 'slot'){ slotScanLookup(code); return; }
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
      const gray = toLuminance(px);
      const lum = new ZX.RGBLuminanceSource(gray, canvas.width, canvas.height);

      let text = tryDecode(reader, ZX, lum, hints);
      // barcodes photographed sideways are common
      if (!text){
        reader.reset();
        const turned = rotateLuminance(gray, canvas.width, canvas.height);
        text = tryDecode(reader, ZX,
          new ZX.RGBLuminanceSource(turned, canvas.height, canvas.width), hints);
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

  /* Built here rather than in each caller so the loadout panel and the
     journal sheet show the same list, and so the attribution the ODbL
     requires cannot go missing from one of them. */
  function offHitsHtml(hits){
    return hits.map((h,i)=>`
      <button class="off-hit" data-off="${i}">
        <span class="nm">${escapeHtml(h.name)}
          <small>${escapeHtml(h.brand || 'unbranded')}${h.serving ? ' · serving ' + escapeHtml(h.serving) : ''}${h.partial ? ' · macros incomplete' : ''}${h.suspect ? ` · macros suggest ${Math.round(h.impliedKcal)} kcal` : ''}</small>
        </span>
        <span class="kc">${Math.round(h.kcal)} kcal<br>/100g</span>
      </button>`).join('')
      /* The ODbL requires the source be named and linked wherever its data is
         shown. target=_blank matters: a bare external link would navigate the
         WebView away from the app with no way back, whereas Capacitor hands
         _blank to the system browser. */
      + `<div class="off-credit">Data from <a href="https://openfoodfacts.org" target="_blank" rel="noopener">Open Food Facts</a>, ODbL.
           Contributed by the public and often incomplete — check the packet.</div>`;
  }

  /* Search results never carry serving data — search-a-licious does not index
     it, even for products whose own record has it — so the full record is
     fetched at the moment one is picked. One request, and only for the single
     product someone actually chose. If it fails the hit is used as it stands
     and the amount simply falls back to 100g. */
  async function offEnrichHit(h){
    /* Only search results are short of data. A barcode hit already came from
       the product record, so if it has no serving there is none to find and
       a second request would just cost the person their rate limit. */
    if (!h || h.servingG || !h.code || !h._fromSearch) return h;
    const seq = ++offSeq;   // this fetch now owns the sequence
    const r = await offFetchJson(`${OFF_PRODUCT}${h.code}.json?fields=${OFF_FIELDS}`, seq);
    if (r && r.data && r.data.product){
      const full = offParseProduct(r.data.product);
      if (full && full.servingG){
        return Object.assign({}, h, {servingG: full.servingG, serving: full.serving || h.serving});
      }
    }
    return h;
  }

  /* One serving is the amount a label describes and very nearly always the
     amount a person means, so it is what both tabs open on. Counting in
     servings rather than grams is also the only way to log a Costco chicken
     bake without putting it on a scale. */
  function offServingUnit(h){
    return h.servingG ? {g: h.servingG, one: 'serving', many: 'servings'} : null;
  }

  function offRenderHits(hits){
    const results = document.getElementById('offResults');
    window.__offHits = hits;
    results.innerHTML = offHitsHtml(hits);

    results.querySelectorAll('[data-off]').forEach(btn=>{
      btn.addEventListener('click', async ()=>{
        const h = window.__offHits[parseInt(btn.getAttribute('data-off'),10)];
        if (!h) return;
        btn.disabled = true;
        offAddToEaten(await offEnrichHit(h));
      });
    });
  }

  function escapeHtml(str){
    return String(str).replace(/[&<>"']/g, c =>
      ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  /* Values arrive per 100g, but 100g is nobody's portion. Open on one serving
     where the label gave one, and fall back to 100g only when it did not. */
  function offAddToEaten(h){
    const unit = offServingUnit(h);
    const grams = h.servingG || 100;
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
      /* With a unit the amount box counts servings; without one it stays in
         grams, which is the honest reading when no serving was published. */
      unit,
      /* What was wrong with the label travels with the entry. These used to be
         shown once in the results list and then dropped, so a product missing
         its protein figure was logged as containing none and nothing on the
         screen ever said so again. undefined rather than false keeps the saved
         state small for the ordinary case. */
      partial: h.partial || undefined,
      suspect: h.suspect || undefined,
      impliedKcal: h.suspect ? h.impliedKcal : undefined,
    });
    document.getElementById('offSearch').value = '';
    document.getElementById('offClear').style.display = 'none';
    document.getElementById('offResults').innerHTML =
      `<div class="off-status">${unit
        ? `Added below as one serving (${Math.round(grams)}g) — change it if you had more or less.`
        : 'Added below at 100g — no serving size was published for this one, so set the amount you actually ate.'}</div>`;
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
    scanTarget = 'eaten';           // this control belongs to the loadout tab
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
  /* ---- export and import ----------------------------------------------

     Import is deliberately two taps and a confirmation. It replaces
     everything, and the one thing worse than losing a history is
     overwriting a live one by tapping the wrong row in a file picker. */
  (function wireDataButtons(){
    const note = document.getElementById('sysDataNote');
    const say = (msg, warn) => {
      if (!note) return;
      note.innerHTML = msg;
      note.style.color = warn ? 'var(--red)' : '';
    };

    const exportBtn = document.getElementById('sysExport');
    if (exportBtn) exportBtn.addEventListener('click', ()=>{
      if (typeof exportData !== 'function') return;
      exportBtn.disabled = true;
      exportData()
        .then(where => say(escapeHtml(where)))
        .catch(err => say(escapeHtml(err && err.message ? err.message : 'Export failed.'), true))
        .then(()=>{ exportBtn.disabled = false; });
    });

    const importBtn = document.getElementById('sysImport');
    const picker = document.getElementById('sysImportFile');
    if (importBtn && picker){
      importBtn.addEventListener('click', ()=>{
        if (importBtn.dataset.armed){
          importBtn.dataset.armed = '';
          importBtn.innerHTML = ic('back') + ' Import from a file';
          picker.click();
          return;
        }
        importBtn.dataset.armed = '1';
        importBtn.innerHTML = ic('warn') + ' Tap again — this replaces everything here';
        setTimeout(()=>{
          if (!importBtn.dataset.armed) return;
          importBtn.dataset.armed = '';
          importBtn.innerHTML = ic('back') + ' Import from a file';
        }, 5000);
      });

      picker.addEventListener('change', (e)=>{
        const file = e.target.files && e.target.files[0];
        e.target.value = '';                     // so the same file can be retried
        if (!file || typeof importData !== 'function') return;
        const reader = new FileReader();
        reader.onload = ()=>{
          const res = importData(String(reader.result || ''));
          if (!res.ok){ say(escapeHtml(res.why), true); return; }
          say('Imported. Reloading&hellip;');
          setTimeout(()=>location.reload(), 600);
        };
        reader.onerror = ()=> say('That file could not be read.', true);
        reader.readAsText(file);
      });
    }
  })();

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
    /* Wait for the wipe to finish before reloading. On native there is a
       backup file to delete too, and reloading first would race it — the
       app would come back up, find the file still there, and restore the
       data this button just deleted. */
    btn.innerHTML = ic('power') + ' Wiping…';
    clearSaved().then(function(){ location.reload(); });
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

  offClearBtn.addEventListener('click', ()=>{
    offSearchInput.value = '';
    offClearBtn.style.display = 'none';
    document.getElementById('offResults').innerHTML = '';
    offSearchInput.focus();
  });

  /* openCustomFood lives in 37-custom-food.js, which loads after this file.
     Only the click reaches for it, by which time every script has run. */
  btnAddEaten.addEventListener('click', ()=>{
    openCustomFood({mode:'eaten'});
  });

  function proceedToLoadout(reset){
    if (reset !== false){
      MEALS.forEach(m => state.selections[m.key] = blankMeal());
      /* Building from scratch starts with everything folded away, so the
         screen opens as a short list of sittings rather than every slot of
         every meal at once. */
      if (typeof collapseAllMeals === 'function') collapseAllMeals();
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

