'use strict';
/* ============================================================
   LOADOUT - SCREEN 2: TIER SELECT
   From app.js lines 7829-8284 of the original single file.
   Loaded in order by index.html; all files share one global scope,
   so declarations here are visible to every file listed after it.
   ============================================================ */

  /* =========================================================
     SCREEN 2: TIER SELECT
  ========================================================= */
  const btnConfirmTier = document.getElementById('btnConfirmTier');

  /* Full nutrition panel, laid out like a label: macros first with their
     sub-components indented, then minerals and vitamins.

     This shows the DAILY GOALS a person is reaching for — not a tally of what
     they have logged. The prep itself is still planned on calories, macros and
     fibre alone; everything below the macros is here to be read, not to steer
     what lands on the plate. */
  function renderFullStats(){
    const host = document.getElementById('fullStatsBody');
    if (!host) return;
    // opened from the sheet, so it follows whichever day the sheet is showing
    const tg = targetsFor(sheetViewKind());
    const g  = dailyGoals(tg);

    const row = (name, amt, note, sub) =>
      `<div class="nutri-row">
         <span class="nutri-name${sub ? ' sub' : ''}">${name}</span>
         <span class="nutri-amt">${amt}</span>
         <span class="nutri-pct">${note || ''}</span>
       </div>`;

    /* Whose figures these are, so the numbers aren't mistaken for universal */
    const who = (()=>{
      const sex  = state.sex === 'female' ? 'women' : state.sex === 'male' ? 'men' : 'adults';
      const age  = Number(state.age);
      return age ? `${sex} aged ${age}` : sex;
    })();

    host.innerHTML =
      `<div class="nutri-group">ENERGY &amp; MACROS</div>` +
      row('Calories', `${tg.kcal} kcal`, 'target') +
      row('Protein', `${tg.protein}g`, 'target') +
      row('Carbohydrate', `${tg.carbs}g`, 'target') +
      row('Fiber', `${g.fibre}g`, '14g / 1000 kcal', true) +
      row('Added sugar', `under ${g.addedSugar}g`, 'under 10% of kcal', true) +
      row('Fat', `${tg.fat}g`, 'target') +
      row('Saturated', `under ${g.satfat}g`, 'under 10% of kcal', true) +
      row('Cholesterol', `under ${g.chol}mg`, 'ceiling') +

      `<div class="nutri-group">MINERALS</div>` +
      row('Sodium', `under ${g.sodium}mg`, 'ceiling') +
      row('Potassium', `${g.potassium}mg`, 'goal') +
      row('Calcium', `${g.calcium}mg`, 'goal') +
      row('Iron', `${g.iron}mg`, g.ironNote ? 'goal &times;1.8' : 'goal') +
      row('Magnesium', `${g.magnesium}mg`, 'goal') +
      row('Zinc', `${g.zinc}mg`, 'goal') +

      `<div class="nutri-group">VITAMINS</div>` +
      row('Vitamin A', `${g.vita}mcg`, 'goal') +
      row('Vitamin C', `${g.vitc}mg`, 'goal') +
      row('Vitamin D', `${g.vitd}mcg`, 'goal') +

      `<div class="season-hint" style="margin-top:16px;">
         These are daily goals, not a count of what you've eaten. Fiber, added
         sugar and saturated fat scale with your calorie target; the vitamins
         and minerals are the reference intakes published for <strong>${who}</strong>
         and don't change with bodyweight.` +
      (g.ironNote
        ? ` Your iron goal is raised by the standard 1.8&times; for a meat-free
            diet, since plant iron is absorbed far less readily.`
        : '') +
      (g.zincNote
        ? ` Zinc absorbs poorly from plant foods too, so treat that figure as a
            floor rather than a comfortable target.`
        : '') +
      `  Pregnancy and breastfeeding change several of these a great deal and
         aren't accounted for here. Your prep is still built from calories,
         macros and fiber only &mdash; these figures are for reference, and
         aren't medical advice.
       </div>`;
  }

  /* Editable vitals. Changing any of these re-runs the whole calculation,
     the way a stat screen updates when you re-spec. */
  /* Built per render rather than held as a constant: two of the three carry
     a unit that the person can change, and the bounds move with it. Weight
     and height are stored in pounds and inches whatever is displayed —
     46-units.js converts at the edge and nothing else in the app knows. */
  function vitalDefs(){
    const w = (typeof weightBounds === 'function') ? weightBounds()
                                                   : {min:60, max:600, step:1};
    const metric = (typeof isMetric === 'function') && isMetric();
    return [
      {key:'bodyweight', label:'Weight',
       unit: (typeof weightUnitLabel === 'function') ? weightUnitLabel() : 'lb',
       min:w.min, max:w.max, step:w.step,
       show: v => (typeof showWeight === 'function') ? showWeight(v, metric ? 1 : 0) : v,
       store: n => (typeof storeWeight === 'function') ? storeWeight(n) : n},
      {key:'age', label:'Age', unit:'yrs', min:13, max:100, step:1,
       show: v => v, store: n => n},
      {key:'heightIn', label:'Height',
       unit: metric ? 'cm' : 'in',
       min: metric ? 120 : 48, max: metric ? 230 : 90, step:1,
       show: v => (typeof showHeight === 'function') ? showHeight(v) : v,
       store: n => (typeof storeHeight === 'function') ? storeHeight(n) : n},
    ];
  }

  /* ---- the two daily numbers, side by side on the hero panel ----
     A character sheet states what you are, not what today happens to be, so
     both targets live here permanently and are labelled. Which one a given
     prepped day uses is decided in the roadmap. */
  function renderSheetKcal(){
    const wrap = document.getElementById('sheetKcalWrap');
    if (!wrap) return;
    const rest = targetsFor('rest').kcal;
    if (!hasSplit()){
      wrap.className = 'hero-kcal';
      wrap.innerHTML = `<span id="sheetKcal">${rest}</span><small>kcal / day</small>`;
      return;
    }
    const train = targetsFor('train').kcal;
    wrap.className = 'kcal-split';
    wrap.innerHTML = `
      <div class="kcal-line rest">
        <span class="n" id="sheetKcal">${rest}</span><span class="u">kcal</span>
        <span class="l">${ic(DAY_KIND_ICON.rest)} ${DAY_KIND_LABEL.rest}</span>
      </div>
      <div class="kcal-line train">
        <span class="n">${train}</span><span class="u">kcal</span>
        <span class="l">${ic(DAY_KIND_ICON.train)} ${DAY_KIND_LABEL.train}</span>
      </div>`;
  }

  /* Macros differ between the two days, so the attributes panel gets a
     toggle rather than two cramped columns on a phone. */
  function renderSheetDaySeg(){
    const seg = document.getElementById('sheetDaySeg');
    if (!seg) return;
    if (!hasSplit()){ seg.hidden = true; seg.innerHTML = ''; return; }
    seg.hidden = false;
    const view = state.sheetDayView === 'train' ? 'train' : 'rest';
    seg.innerHTML = ['rest','train'].map(k=>
      `<button class="${view===k?'on':''}" data-sheetday="${k}">${ic(DAY_KIND_ICON[k])} ${DAY_KIND_LABEL[k]}</button>`).join('');
    seg.querySelectorAll('[data-sheetday]').forEach(b=>b.addEventListener('click', ()=>{
      state.sheetDayView = b.getAttribute('data-sheetday');
      renderSheetMacros();
      renderSheetDaySeg();
      saveState();
    }));
  }

  function sheetViewKind(){
    return hasSplit() && state.sheetDayView === 'train' ? 'train' : 'rest';
  }

  /* ---- rank pips and the class band --------------------------------------
     A class here is a calorie range, not a single number, so the sheet shows
     where inside its band the person actually sits. That answers the obvious
     question a bare class name raises: am I at the bottom of this or the top? */
  function renderSheetRank(){
    const tier = TIERS.find(t=>t.id === state.assignedTierId) || currentTier();
    const pips = document.getElementById('sheetPips');
    if (pips){
      pips.innerHTML = TIERS.map(t =>
        `<i class="${tier && t.id <= tier.id ? 'on' : ''}"></i>`).join('');
    }
    const band = document.getElementById('sheetBand');
    if (!band) return;
    if (!tier){ band.innerHTML = ''; return; }
    const kc   = targetsFor('rest').kcal;
    const span = Math.max(1, tier.max - tier.min);
    const pct  = Math.min(100, Math.max(0, Math.round((kc - tier.min) / span * 100)));
    const t    = THEMES[state.theme] || THEMES.cyberpunk;
    band.innerHTML = `
      <div class="cs-band-head">
        <span class="cs-band-lbl">${(t.words && t.words.tier) || 'TIER'} BAND</span>
        <span class="cs-band-pct">${pct}%</span>
      </div>
      <div class="cs-band-track"><span style="width:${pct}%"></span><b style="left:${pct}%"></b></div>
      <div class="cs-band-foot">
        <span>${tier.min}</span>
        <span class="cs-band-you">\u25B2 ${kc} kcal</span>
        <span>${tier.max}</span>
      </div>`;
  }

  /* ---- build shape ------------------------------------------------------
     A five-axis read of the same numbers already listed below it. Nothing new
     is being asserted — each spoke is one real figure scaled against a
     generous ceiling, so the shape shows the character's balance at a glance
     the way a stat web does in a game. */
  const RADAR_AXES = [
    {k:'fuel',  lbl:'FUEL'},
    {k:'rep',   lbl:'REPAIR'},
    {k:'nrg',   lbl:'ENERGY'},
    {k:'res',   lbl:'RESERVE'},
    {k:'vit',   lbl:'VITALITY'},
  ];

  function radarValues(tg){
    const bw = state.bodyweight || 0;
    const cl = v => Math.max(0.10, Math.min(1, v || 0));
    return [
      cl(tg.kcal / 3600),                                     // FUEL
      cl(bw ? (tg.protein / bw) / 1.2 : tg.protein / 220),    // REPAIR
      cl(tg.kcal ? (tg.carbs * 4 / tg.kcal) / 0.62 : 0),      // ENERGY
      cl(tg.kcal ? (tg.fat   * 9 / tg.kcal) / 0.45 : 0),      // RESERVE
      cl(fibreTarget() / 45),                                 // VITALITY
    ];
  }

  function renderSheetRadar(tg){
    const host = document.getElementById('sheetRadar');
    if (!host) return;
    tg = tg || targetsFor(sheetViewKind());
    const vals = radarValues(tg);
    const n = RADAR_AXES.length, cx = 120, cy = 104, R = 62;
    const pt = (i, r) => {
      const a = -Math.PI / 2 + i * 2 * Math.PI / n;
      return [ (cx + Math.cos(a) * r).toFixed(1), (cy + Math.sin(a) * r).toFixed(1) ];
    };
    const ring = f => Array.from({length:n}, (_, i) => pt(i, R * f).join(',')).join(' ');
    const rings  = [0.25, 0.5, 0.75, 1]
      .map(f => `<polygon points="${ring(f)}" fill="none" stroke="var(--line)" stroke-width="1"/>`).join('');
    const spokes = Array.from({length:n}, (_, i) =>
      `<line x1="${cx}" y1="${cy}" x2="${pt(i,R)[0]}" y2="${pt(i,R)[1]}" stroke="var(--line)" stroke-width="1"/>`).join('');
    const shape  = Array.from({length:n}, (_, i) => pt(i, R * vals[i]).join(',')).join(' ');
    const nodes  = Array.from({length:n}, (_, i) => {
      const [x,y] = pt(i, R * vals[i]);
      return `<circle cx="${x}" cy="${y}" r="2.6" fill="var(--cyan)"/>`;
    }).join('');
    const labels = RADAR_AXES.map((ax, i) => {
      const [x,y] = pt(i, R + 19);
      const anchor = Math.abs(x - cx) < 6 ? 'middle' : (x > cx ? 'start' : 'end');
      const dy = (+y < cy - 20) ? 0 : ((+y > cy + 20) ? 8 : 4);
      return `<text x="${x}" y="${+y + dy}" text-anchor="${anchor}" class="cs-radar-lbl">${ax.lbl}</text>`;
    }).join('');
    host.innerHTML = `
      <svg viewBox="0 0 240 208" role="img" aria-label="Build shape: relative balance of fuel, repair, energy, reserve and vitality">
        ${rings}${spokes}
        <polygon points="${shape}" fill="var(--accent-soft)" stroke="var(--cyan)" stroke-width="1.6"/>
        ${nodes}${labels}
      </svg>
      <div class="cs-radar-cap">BUILD SHAPE \u00b7 relative balance</div>`;
  }

  /* Each macro is drawn as an RPG attribute line: a rank glyph, the raw
     number on a plate, and a notched meter for its share of the day. The
     second word under each name is what that macro actually does — flavour
     that happens to be true, rather than invented stat names. */
  function renderSheetMacros(){
    const host = document.getElementById('sheetMacros');
    if (!host) return;
    const kind = sheetViewKind();
    const tg = targetsFor(kind);
    const rows = [
      {label:'Protein', flav:'REPAIR',  g:tg.protein, kcal:tg.protein*4, col:'var(--green)',   glyph:'\u25C6'},
      {label:'Carbs',   flav:'ENERGY',  g:tg.carbs,   kcal:tg.carbs*4,   col:'var(--magenta)', glyph:'\u25B2'},
      {label:'Fat',     flav:'RESERVE', g:tg.fat,     kcal:tg.fat*9,     col:'var(--amber)',   glyph:'\u25CF'},
    ];
    host.innerHTML = rows.map(r=>{
      const pct = tg.kcal ? Math.round(r.kcal / tg.kcal * 100) : 0;
      const perLb = (typeof perBodyweight === 'function')
        ? perBodyweight(r.g, state.bodyweight)
        : (state.bodyweight ? (r.g / state.bodyweight).toFixed(2) + ' g/lb' : '');
      return `<div class="stat-row attr-row" style="--c:${r.col}">
        <div class="stat-head attr-head">
          <span class="attr-glyph">${r.glyph}</span>
          <span class="stat-name attr-name">${r.label}<em>${r.flav}</em></span>
          <span class="stat-val attr-val">${r.g}<i>g</i></span>
        </div>
        <div class="stat-bar attr-bar"><span style="width:${pct}%; background:${r.col}"></span></div>
        <div class="stat-note attr-note">
          <span>${pct}% of calories</span>
          ${perLb ? `<span>${perLb}</span>` : ''}
          <span>${Math.round(r.kcal)} kcal</span>
        </div>
      </div>`;
    }).join('');
    renderSheetRadar(tg);

  }

  /* ---------------------------------------------------------
     CHARACTER PORTRAIT
     Art is looked up per theme and tier, so each class in each genre can
     have its own picture. Drop files in an `art/` folder next to this one,
     named <theme>-<tier>.png — e.g. art/fantasy-3.png for the Cleric,
     art/racing-5.png for the Legend. Anything missing quietly falls back to
     the genre emblem, so the sheet never looks broken while art is
     half-finished. Set ART_EXT below if you use .webp or .jpg instead.
  --------------------------------------------------------- */
  const ART_DIR = 'art';
  const ART_EXT = 'png';
  function portraitSrc(themeKey, tierId){
    return `${ART_DIR}/${themeKey}-${tierId}.${ART_EXT}`;
  }
  function applyPortrait(themeKey, tierId){
    const img = document.getElementById('portraitImg');
    const fallback = document.getElementById('sheetEmblem');
    if (!img) return;
    const src = portraitSrc(themeKey, tierId);
    img.onload  = ()=>{ img.hidden = false; if (fallback) fallback.style.display = 'none'; };
    img.onerror = ()=>{ img.hidden = true;  if (fallback) fallback.style.display = ''; };
    img.src = src;
    img.alt = `${(THEMES[themeKey]||{}).name || ''} tier ${tierId} portrait`;
  }

  function renderTiers(){
    const tg = currentTargets();
    const tier = TIERS.find(t=>t.id === state.assignedTierId) || currentTier();
    const t = THEMES[state.theme] || THEMES.cyberpunk;

    document.getElementById('sheetEyebrow').textContent = t.sheet || 'CHARACTER SHEET';
    document.getElementById('sheetTitle').textContent = t.sheetTitle || 'Your Character';
    document.getElementById('sheetEmblem').innerHTML =
      ch(state.theme || 'cyberpunk', tier ? tier.id : 1) || ic(t.icon || 'gamepad');
    applyPortrait(state.theme || 'cyberpunk', tier ? tier.id : 1);
    document.getElementById('sheetClass').textContent = tier ? tier.name : '—';
    document.getElementById('sheetRank').textContent =
      `${(t.words && t.words.tier) || 'TIER'} ${tier ? tier.id : '—'}`;
    renderSheetKcal();
    document.getElementById('sheetGoal').textContent =
      (GOAL_LABEL[state.goal] || 'Maintenance') +
      (state.activity ? ' · ' + activityLabel(state.activity) : '');

    /* ---- vitals ---- */
    const VITALS = vitalDefs();
    const unitSeg = document.getElementById('sheetUnitSeg');
    if (unitSeg && typeof setUnits === 'function'){
      const metric = isMetric();
      unitSeg.innerHTML = [['imperial','lb / ft'], ['metric','kg / cm']].map(([k,l])=>
        `<button class="${(metric ? 'metric' : 'imperial') === k ? 'on' : ''}" data-sheetunits="${k}">${l}</button>`).join('');
      unitSeg.querySelectorAll('[data-sheetunits]').forEach(b=>b.addEventListener('click', ()=>
        setUnits(b.getAttribute('data-sheetunits'))));
    }
    document.getElementById('sheetVitals').innerHTML = VITALS.map(v=>`
      <div class="vital">
        <span class="vital-lbl">${v.label}</span>
        <span class="vital-edit">
          <input type="number" id="vital-${v.key}" value="${state[v.key] != null ? (v.show(state[v.key]) ?? '') : ''}"
                 min="${v.min}" max="${v.max}" step="${v.step}" inputmode="decimal"
                 aria-label="${v.label} in ${v.unit}">
          <span class="vital-unit">${v.unit}</span>
        </span>
      </div>`).join('') + `
      <div class="vital vital-wide">
        <span class="vital-lbl">Goal</span>
        <select id="vital-goal" aria-label="Goal">
          ${Object.entries(GOAL_LABEL).map(([k,l])=>
            `<option value="${k}"${state.goal===k?' selected':''}>${l}</option>`).join('')}
        </select>
      </div>` + (state.mode === 'calc' ? `
      <div class="vital vital-wide">
        <span class="vital-lbl">Training session burn</span>
        <span class="vital-edit">
          <input type="number" id="vital-train" value="${rawExerciseKcal() || ''}"
                 min="0" max="3000" step="10" inputmode="numeric" placeholder="0"
                 aria-label="Calories burned in a typical training session">
          <span class="vital-unit">kcal</span>
        </span>
      </div>` : '');

    VITALS.forEach(v=>{
      const el = document.getElementById('vital-' + v.key);
      el.addEventListener('input', ()=>{
        const n = parseFloat(el.value);
        if (!(n >= v.min && n <= v.max)) return;   // ignore half-typed values
        /* Typed in whatever is on screen, stored in pounds or inches. */
        state[v.key] = v.store(n);
        /* Correcting the weight here IS a weigh-in — it is someone saying
           what they weigh today. Recording it keeps the history and the
           current figure from disagreeing, which they would the first
           time anybody edited this field instead of the panel below. */
        if (v.key === 'bodyweight' && typeof recordWeight === 'function') recordWeight(state[v.key]);
        recalcFromVitals();
      });
    });
    document.getElementById('vital-goal').addEventListener('change', (e)=>{
      state.goal = e.target.value;
      recalcFromVitals();
    });
    /* Editing the burn here is what creates (or removes) the second target,
       so someone who set up as "no training" can pick it up later. */
    const trainEl = document.getElementById('vital-train');
    if (trainEl){
      trainEl.addEventListener('input', ()=>{
        const n = Math.max(0, parseFloat(trainEl.value) || 0);
        state.exerciseRaw = n || null;
        state.exerciseMode = n > 0 ? 'custom' : 'none';
        state.exerciseKcal = creditedExerciseKcal();
        recalcFromVitals();
      });
    }

    /* ---- attributes (per day kind) ---- */
    renderSheetRank();
    renderSheetDaySeg();
    renderSheetMacros();

    /* ---- resistances ---- */
    const fT = fibreTarget();
    document.getElementById('sheetMicros').innerHTML = `
      <div class="res-row">
        <span class="res-ico">${ic('veg')}</span>
        <span class="res-name">Fiber<em>DIGESTIVE</em></span>
        <span class="res-val">${fT}<i>g / day</i></span>
      </div>
      <div class="res-row res-last">
        <span class="res-ico">${ic('season')}</span>
        <span class="res-name">Sodium<em>CEILING</em></span>
        <span class="res-val">&lt;${SODIUM_LIMIT}<i>mg / day</i></span>
      </div>`;

    /* ---- the working, behind the link ---- */
    const bits = [];
    if (state.mode === 'direct'){
      bits.push(['Entered target', `${targetsFor('rest').kcal} kcal`]);
    } else {
      if (state.tdee) bits.push(['Daily burn (TDEE)', `${Math.round(state.tdee)} kcal`]);
      bits.push(['Goal', GOAL_LABEL[state.goal] || state.goal]);
      bits.push(['Rest-day target', `${targetsFor('rest').kcal} kcal`]);
      if (hasSplit()){
        bits.push(['Training added back', `+${Math.round(state.exerciseKcal)} kcal`]);
        bits.push(['Training-day target', `${targetsFor('train').kcal} kcal`]);
      }
    }
    if (state.bodyweight) bits.push(['Bodyweight',
      (typeof showWeight === 'function')
        ? `${showWeight(state.bodyweight, isMetric() ? 1 : 0)} ${weightUnitLabel()}`
        : `${state.bodyweight} lb`]);
    bits.push(['Band', `${tier ? tier.min : ''}–${tier ? tier.max : ''} kcal`]);
    document.getElementById('sheetBreakdown').innerHTML =
      bits.map(([k,v])=>`<div class="kv"><span>${k}</span><span>${v}</span></div>`).join('') +
      `<div class="season-hint" style="margin-top:10px;">
         ${hasSplit()
           ? 'Your class is set by the rest-day number — training days are a bonus on top of it, not a different character. '
           : ''}Calories and the three macros drive the plan. Fuller nutrition is
         behind View Full Stats.
       </div>`;

    btnConfirmTier.disabled = false;
  }

  /* Re-run the calculation after an edit, without redrawing the inputs the
     person is currently typing into. */
  let vitalTimer = null;
  function recalcFromVitals(){
    syncTargets();
    assignTier();
    clearTimeout(vitalTimer);
    vitalTimer = setTimeout(()=>{
      refreshSheetReadouts();
      saveState();
    }, 120);
  }

  /* Only the derived numbers, so focus and caret position survive.
     The training-burn input is deliberately not redrawn here — editing it is
     what can create the second target, and rewriting the field mid-keystroke
     would fight the person typing into it. */
  function refreshSheetReadouts(){
    const tier = TIERS.find(t=>t.id === state.assignedTierId) || currentTier();
    const t = THEMES[state.theme] || THEMES.cyberpunk;
    renderSheetKcal();
    document.getElementById('sheetClass').textContent = tier ? tier.name : '—';
    document.getElementById('sheetRank').textContent =
      `${(t.words && t.words.tier) || 'TIER'} ${tier ? tier.id : '—'}`;
    document.getElementById('sheetGoal').textContent =
      (GOAL_LABEL[state.goal] || 'Maintenance') +
      (state.activity ? ' · ' + activityLabel(state.activity) : '');
    applyPortrait(state.theme || 'cyberpunk', tier ? tier.id : 1);
    renderSheetRank();
    renderSheetDaySeg();
    renderSheetMacros();
  }

  function openModal(id){
    const el = document.getElementById(id);
    if (!el) return;
    if (id === 'modalStats') renderFullStats();
    el.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeModal(id){
    const el = document.getElementById(id);
    if (el) el.hidden = true;
    document.body.style.overflow = '';
  }
  document.querySelectorAll('[data-close]').forEach(b=>
    b.addEventListener('click', ()=> closeModal(b.getAttribute('data-close'))));
  // tapping the dimmed area closes too
  /* modalDisclaimer is deliberately absent: the first-run health notice must not
     be dismissable by Escape or a backdrop tap. */
  const ALL_MODALS = ['modalHow','modalStats','modalSystem','modalRecipePlace','modalFoodPick',
                      'modalPrepDay','modalPortion','modalJournalFood','modalPantry',
                      'modalCookPlan','modalLegal'];
  ALL_MODALS.forEach(id=>{
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', e=>{ if (e.target === el) closeModal(id); });
  });
  document.addEventListener('keydown', e=>{
    if (e.key !== 'Escape') return;
    /* The scanner sits on top of whichever modal opened it and closes itself
       on Escape. Closing everything underneath at the same time would throw
       the person out of the picker they were halfway through. */
    const scan = document.getElementById('modalScan');
    if (scan && !scan.hidden) return;
    ALL_MODALS.forEach(closeModal);
  });
  document.getElementById('btnHowWorked').addEventListener('click', ()=> openModal('modalHow'));
  document.getElementById('btnFullStats').addEventListener('click', ()=> openModal('modalStats'));

  btnConfirmTier.addEventListener('click', ()=>{
    renderPrefs();
    showScreen('screen-prefs');
  });

