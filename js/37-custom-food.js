'use strict';
/* ============================================================
   LOADOUT - ADD A FOOD BY HAND

   The three ways into the log used to be a barcode, the built-in
   library, and a blank row. The blank row asked for four numbers
   and nothing else: no brand, no serving size, and no way to say
   "the packet is 60g but I ate half of it". Anyone logging a
   protein bar had to do that arithmetic themselves.

   This form takes the packet as it is written — a serving size
   and the macros for that serving — and then asks separately how
   much was actually eaten. The maths in between is the app's job.

   One form serves both tabs. The loadout tab pushes the result
   into state.eaten; the journal hands it to the same amount step
   a library food goes through, so a hand-entered food behaves
   like every other food from the moment it exists.
   ============================================================ */

  const CF_FIELDS = ['Name','Brand','Serving','ServingUnit','ItemName',
                    'Kcal','Protein','Carbs','Fat','Amount'];
  const cfEls = {};
  CF_FIELDS.forEach(function(k){ cfEls[k] = document.getElementById('cf' + k); });
  const cfItemNameRow = document.getElementById('cfItemNameRow');
  const cfAmountUnit  = document.getElementById('cfAmountUnit');

  /* What one of each unit is worth in internal grams, and what to call it.

     Mass converts honestly: an ounce is 28.349523125g wherever it is used.
     Volume does not. A millilitre of oil and a millilitre of honey weigh
     different amounts, and a packet stating "1 tbsp" never says which — so
     the volume units carry the same abstract basis an item does. Their bases
     are all in millilitres, which keeps them exact relative to each other and
     to themselves: two tablespoons of a thing really is twice one tablespoon
     of it, whatever it weighs. What is never claimed is the weight, which is
     why nothing built on an abstract basis ever displays grams. */
  const CF_UNITS = {
    g:    {g: 1,               one:'g',    many:'g'},
    oz:   {g: 28.349523125,    one:'oz',   many:'oz'},
    ml:   {g: 1,               one:'ml',   many:'ml',    abstract:true},
    tsp:  {g: 4.92892159375,   one:'tsp',  many:'tsp',   abstract:true},
    tbsp: {g: 14.78676478125,  one:'tbsp', many:'tbsp',  abstract:true},
    cup:  {g: 236.5882365,     one:'cup',  many:'cups',  abstract:true},
    item: {g: 100,             one:'item', many:'items', abstract:true},
  };
  const cfStatus  = document.getElementById('cfStatus');
  const cfReadout = document.getElementById('cfReadout');
  const cfSave    = document.getElementById('cfSave');

  /* Where the finished food is going: {mode:'eaten'} from the loadout tab,
     {mode:'journal', mealName} from a meal in the journal. */
  let cfTarget = null;

  const cfNum = el => {
    const v = parseFloat((el && el.value) || '');
    return (isFinite(v) && v >= 0) ? v : null;
  };

  function cfMode(){
    return (cfEls.ServingUnit && cfEls.ServingUnit.value) || 'g';
  }

  /* An item's basis of 100g is picked so the per-100g figures come out as
     exactly the macros of one item — a Culver's chicken sandwich states a
     calorie count and no weight anywhere, and inventing one would be a lie
     the rest of the app would then repeat. */
  function cfGramsPerUnit(){
    return (CF_UNITS[cfMode()] || CF_UNITS.g).g;
  }

  /* The serving is what the macros were typed against, so without it there is
     nothing to scale and the amount row has no meaning. Everything else may
     be left blank and reads as zero. */
  function cfServingGrams(){
    const n = cfNum(cfEls.Serving);
    return (n && n > 0) ? n * cfGramsPerUnit() : null;
  }

  function cfAmountGrams(){
    const a = cfNum(cfEls.Amount);
    if (a != null && a > 0) return a * cfGramsPerUnit();
    return cfServingGrams();
  }

  /* Enough English to get the log line right for the words people actually
     type here — sandwich, patty, box, slice. Anything stranger reads a little
     off in one label and nothing else depends on it. */
  function cfPlural(one){
    if (!one) return 'items';
    if (/(s|x|z|ch|sh)$/i.test(one)) return one + 'es';
    if (/[^aeiou]y$/i.test(one)) return one.slice(0, -1) + 'ies';
    return one + 's';
  }

  /* The shape the rest of the app already understands for eggs, slices and
     sticks. Grams need no unit at all — they are the base. */
  function cfFoodUnit(){
    const m = cfMode();
    if (m === 'g') return null;
    const u = CF_UNITS[m] || CF_UNITS.g;
    if (m === 'item'){
      const one = ((cfEls.ItemName && cfEls.ItemName.value) || '').trim() || 'item';
      return {g: u.g, one: one, many: cfPlural(one), abstract: true};
    }
    return {g: u.g, one: u.one, many: u.many, abstract: !!u.abstract};
  }

  /* Macros for the amount actually eaten, or null when there is not yet
     enough typed in to say anything honest. */
  function cfComputed(){
    const serving = cfServingGrams();
    const kcal = cfNum(cfEls.Kcal);
    if (serving == null || kcal == null) return null;
    const amount = cfAmountGrams();
    const f = amount / serving;
    const per = k => (cfNum(cfEls[k]) || 0);
    return {
      serving, amount,
      per100: {
        kcal:    kcal          / serving * 100,
        protein: per('Protein') / serving * 100,
        carbs:   per('Carbs')   / serving * 100,
        fat:     per('Fat')     / serving * 100,
      },
      kcal:    kcal * f,
      protein: per('Protein') * f,
      carbs:   per('Carbs')   * f,
      fat:     per('Fat')     * f,
    };
  }

  /* The readout is the whole point of the amount row: it shows what will
     actually be logged, so nobody has to trust the arithmetic unseen. */
  function cfRender(){
    const mode = cfMode();
    if (cfItemNameRow) cfItemNameRow.hidden = (mode !== 'item');
    if (cfAmountUnit){
      const u = cfFoodUnit();
      cfAmountUnit.textContent = mode === 'g' ? 'g'
        : (cfNum(cfEls.Amount) === 1 ? u.one : u.many);
    }

    const c = cfComputed();
    const named = !!(cfEls.Name && cfEls.Name.value.trim());
    if (cfSave) cfSave.disabled = !(named && c);

    if (!cfReadout) return;
    if (!c){
      cfReadout.innerHTML = '';
      return;
    }
    const same = Math.abs(c.amount - c.serving) < 0.5;
    cfReadout.innerHTML =
      '<div class="kv"><span>Calories</span><span>' + Math.round(c.kcal) + ' kcal</span></div>' +
      '<div class="kv"><span>Protein</span><span>' + c.protein.toFixed(1) + 'g</span></div>' +
      '<div class="kv"><span>Carbs</span><span>' + c.carbs.toFixed(1) + 'g</span></div>' +
      '<div class="kv"><span>Fat</span><span>' + c.fat.toFixed(1) + 'g</span></div>' +
      (same ? '' : '<div class="off-status" style="margin-top:8px;">That is ' +
        (c.amount / c.serving).toFixed(2).replace(/\.?0+$/, '') + ' servings.</div>');
  }

  function cfDisplayName(){
    const n = (cfEls.Name.value || '').trim();
    const b = (cfEls.Brand.value || '').trim();
    return b ? n + ' (' + b + ')' : n;
  }

  /* Which slot a hand-entered food belongs in, judged the only way the form
     can judge it: whichever macro carries most of its calories. Foods are
     stored per slot, and the slot decides how the planner would portion it
     if it is ever used in a build. */
  function cfSlot(per100){
    const p = per100.protein * 4, c = per100.carbs * 4, f = per100.fat * 9;
    if (p >= c && p >= f) return 'protein';
    return c >= f ? 'carb' : 'fat';
  }

  function cfSlug(s){
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  }

  /* Saved the same way a scanned product is, so it can be found again in the
     journal's library search and its amount edited after the fact. Re-adding
     the same name and brand updates that entry rather than growing a second
     copy the person then has to choose between. */
  function cfPersist(per100){
    const slot = cfSlot(per100);
    const food = {
      key: 'own-' + slot + '-' + cfSlug(cfDisplayName()),
      name: cfDisplayName(),
      kcal: per100.kcal,
      protein: per100.protein,
      carbs: per100.carbs,
      fat: per100.fat,
      /* Deliberately carries no fibre or sodium: the form does not ask, and a
         hard zero would tell the rest of the app this food contains none of
         either instead of letting it fall back to an estimate. */
      unit: cfFoodUnit(),
      _own: true,
    };
    if (typeof addScannedFood === 'function') addScannedFood(slot, food);
    return food;
  }

  function cfCommit(){
    const c = cfComputed();
    if (!c || !cfEls.Name.value.trim()) return;
    const food = cfPersist(c.per100);

    if (cfTarget && cfTarget.mode === 'journal' && cfTarget.mealName){
      /* Straight through the journal's own path, so the entry carries _food
         and _grams and stays editable from the log afterwards. */
      addLibraryFoodToJournal(cfTarget.mealName, food, c.amount);
    } else {
      state.eaten.push({
        name: cfDisplayName(),
        kcal:    Math.round(c.kcal),
        protein: Math.round(c.protein),
        carbs:   Math.round(c.carbs),
        fat:     Math.round(c.fat),
        covers: '',
        grams: c.amount,
        per100: c.per100,
        /* Carried so the panel's amount box counts in whatever was typed —
           sandwiches, ounces — instead of silently reverting to grams. */
        unit: food.unit,
      });
      renderEatenPanel();
      refreshTargets();
    }
    if (typeof saveState === 'function') saveState();
    closeModal('modalCustomFood');
  }

  function openCustomFood(target){
    cfTarget = target || {mode:'eaten'};
    CF_FIELDS.forEach(function(k){ if (cfEls[k]) cfEls[k].value = ''; });
    if (cfEls.ServingUnit) cfEls.ServingUnit.value = 'g';
    if (cfStatus) cfStatus.innerHTML = '';
    document.getElementById('cfoodTitle').textContent =
      cfTarget.mode === 'journal' ? 'ADD TO ' + cfTarget.mealName : 'ADD A FOOD';
    cfRender();
    openModal('modalCustomFood');
  }

  /* ---- wiring ---- */
  CF_FIELDS.forEach(function(k){
    if (!cfEls[k]) return;
    cfEls[k].addEventListener(cfEls[k].tagName === 'SELECT' ? 'change' : 'input', cfRender);
  });
  /* Left blank, the amount follows the serving size, so the readout is right
     the moment the packet has been typed in and only differs once someone
     says they ate something other than one serving. */
  if (cfEls.Amount) cfEls.Amount.setAttribute('placeholder', 'one serving');
  cfRender();
  if (cfSave) cfSave.addEventListener('click', cfCommit);
