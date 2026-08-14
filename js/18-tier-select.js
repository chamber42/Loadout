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
     sub-components indented, then minerals and vitamins. */
  function renderFullStats(){
    const host = document.getElementById('fullStatsBody');
    if (!host) return;
    // opened from the sheet, so it follows whichever day the sheet is showing
    const tg = targetsFor(sheetViewKind());
    const n = fullNutrition();

    const row = (name, amt, pct, sub) =>
      `<div class="nutri-row">
         <span class="nutri-name${sub ? ' sub' : ''}">${name}</span>
         <span class="nutri-amt">${amt}</span>
         <span class="nutri-pct">${pct != null ? pct + '%' : ''}</span>
       </div>`;
    const pctOf = (v, dv) => dv ? Math.round(v / dv * 100) : null;

    host.innerHTML =
      `<div class="nutri-group">ENERGY &amp; MACROS</div>` +
      row('Calories', `${tg.kcal} kcal`, null) +
      row('Protein', `${tg.protein}g`, pctOf(tg.protein, 50)) +
      row('Carbohydrate', `${tg.carbs}g`, pctOf(tg.carbs, 275)) +
      row('Fiber', `${Math.round(n.fibre)}g`, pctOf(n.fibre, DV.fibre), true) +
      row('Sugars', `${Math.round(n.sugar)}g`, null, true) +
      row('Fat', `${tg.fat}g`, pctOf(tg.fat, 78)) +
      row('Saturated', `${Math.round(n.satfat)}g`, pctOf(n.satfat, DV.satfat), true) +
      row('Cholesterol', `${Math.round(n.chol)}mg`, pctOf(n.chol, DV.chol)) +

      `<div class="nutri-group">MINERALS</div>` +
      row('Sodium', `${Math.round(n.sodium)}mg`, pctOf(n.sodium, DV.sodium)) +
      row('Potassium', `${Math.round(n.potassium)}mg`, pctOf(n.potassium, DV.potassium)) +
      row('Calcium', `${Math.round(n.calcium)}mg`, pctOf(n.calcium, DV.calcium)) +
      row('Iron', `${n.iron.toFixed(1)}mg`, pctOf(n.iron, DV.iron)) +
      row('Magnesium', `${Math.round(n.magnesium)}mg`, pctOf(n.magnesium, DV.magnesium)) +
      row('Zinc', `${n.zinc.toFixed(1)}mg`, pctOf(n.zinc, DV.zinc)) +

      `<div class="nutri-group">VITAMINS</div>` +
      row('Vitamin A', `${Math.round(n.vita)}mcg`, pctOf(n.vita, DV.vita)) +
      row('Vitamin C', `${Math.round(n.vitc)}mg`, pctOf(n.vitc, DV.vitc)) +
      row('Vitamin D', `${n.vitd.toFixed(1)}mcg`, pctOf(n.vitd, DV.vitd)) +

      `<div class="season-hint" style="margin-top:16px;">
         Percentages are of general adult reference intakes. Micronutrients are
         modelled from food class rather than read off individual products, so
         they're a useful steer on whether a day looks short — not a substitute
         for a label or for medical advice. Items you logged by hand count
         toward calories and macros only.
       </div>`;
  }

  /* Editable vitals. Changing any of these re-runs the whole calculation,
     the way a stat screen updates when you re-spec. */
  const VITALS = [
    {key:'bodyweight', label:'Weight', unit:'lb',  min:60,  max:600, step:1},
    {key:'age',        label:'Age',    unit:'yrs', min:13,  max:100, step:1},
    {key:'heightIn',   label:'Height', unit:'in',  min:48,  max:90,  step:1},
  ];

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
      const perLb = state.bodyweight ? (r.g / state.bodyweight).toFixed(2) + ' g/lb' : '';
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

    const note = document.getElementById('sheetMacroNote');
    if (note){
      note.innerHTML = hasSplit()
        ? `Showing your <strong style="color:${kind==='train'?'var(--green)':'var(--cyan)'}">${DAY_KIND_LABEL[kind].toLowerCase()}</strong> split (${tg.kcal} kcal). Both are live — you'll choose how many of each you're cooking for in the Loadout.`
        : '';
    }
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
    document.getElementById('sheetVitals').innerHTML = VITALS.map(v=>`
      <div class="vital">
        <span class="vital-lbl">${v.label}</span>
        <span class="vital-edit">
          <input type="number" id="vital-${v.key}" value="${state[v.key] ?? ''}"
                 min="${v.min}" max="${v.max}" step="${v.step}" inputmode="numeric"
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
        state[v.key] = n;
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
      </div>
      <div class="season-hint" style="margin-top:12px;">
        Tracked live on your loadout. Estimated from food class rather than
        package labels, so treat them as a steer rather than a measurement.
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
    if (state.bodyweight) bits.push(['Bodyweight', `${state.bodyweight} lb`]);
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
    if (e.key === 'Escape'){ ALL_MODALS.forEach(closeModal); }
  });
  document.getElementById('btnHowWorked').addEventListener('click', ()=> openModal('modalHow'));
  document.getElementById('btnFullStats').addEventListener('click', ()=> openModal('modalStats'));

  btnConfirmTier.addEventListener('click', ()=>{
    renderPrefs();
    showScreen('screen-prefs');
  });

