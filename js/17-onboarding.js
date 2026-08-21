'use strict';
/* ============================================================
   LOADOUT - SCREEN 1: ONBOARDING
   From app.js lines 7358-7828 of the original single file.
   Loaded in order by index.html; all files share one global scope,
   so declarations here are visible to every file listed after it.
   ============================================================ */

  /* =========================================================
     SCREEN 1: ONBOARDING
  ========================================================= */

  /* Each theme rendered as a game on a shelf, using its own palette so the
     card previews what you're picking. */
  function renderLibrary(){
    const host = document.getElementById('libraryGrid');
    host.innerHTML = Object.entries(THEMES).map(([k,t])=>{
      const c = t.colors;
      return `<button class="game-case" data-game="${k}">
        <span class="case-body" style="--plastic:${c['panel']}; --edge:${c['line']};">
          <span class="case-spine" style="background:${c['bg-1']};">
            <span class="spine-txt" style="font-family:${t.fonts.display}; color:${c['muted']};">${t.name}</span>
          </span>
          <span class="case-cover" style="background:${t.wash || c['bg-1']};">
            <span class="cover-rule" style="color:${c['cyan']};"></span>
            <span class="cover-mark" style="font-family:${t.fonts.body};"><i></i>LOADOUT</span>
            <span class="cover-logo" style="color:${c['cyan']};">${ic(t.icon)}</span>
            <span class="cover-txt">
              <span class="cover-ttl" style="font-family:${t.fonts.display}; color:${c['text']};">${t.name}</span>
              <span class="cover-dsc" style="font-family:${t.fonts.body}; color:${c['muted']};">${t.blurb}</span>
              <span class="cover-band">
                <span class="rating" style="color:${c['text']};">${t.tiers.length}</span>
                <span class="band-txt" style="font-family:${t.fonts.body}; color:${c['muted']};">CLASSES</span>
              </span>
            </span>
          </span>
        </span>
        <span class="case-gloss" aria-hidden="true"></span>
      </button>`;
    }).join('');
    host.querySelectorAll('[data-game]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        applyTheme(btn.getAttribute('data-game'));
        showScreen('screen-onboard');
      });
    });
  }

  const modeGrid = document.getElementById('modeGrid');
  const directPanel = document.getElementById('directPanel');
  const calcPanel = document.getElementById('calcPanel');

  const directKcalInput = document.getElementById('directKcalInput');
  const directPInput = document.getElementById('directPInput');
  const directCInput = document.getElementById('directCInput');
  const directFInput = document.getElementById('directFInput');
  const directBwInput = document.getElementById('directBwInput');
  const btnUseDirect = document.getElementById('btnUseDirect');

  const goalGrid = document.getElementById('goalGrid');
  const activityGrid = document.getElementById('activityGrid');
  const sexGrid = document.getElementById('sexGrid');
  const bwInput = document.getElementById('bodyweightInput');
  const ftInput = document.getElementById('heightFtInput');
  const inInput = document.getElementById('heightInInput');
  const ageInput = document.getElementById('ageInput');
  const exerciseGrid = document.getElementById('exerciseGrid');
  const exerciseInput = document.getElementById('exerciseInput');
  const calcPreview = document.getElementById('calcPreview');
  const btnRecommend = document.getElementById('btnRecommend');

  /* ---- mode switch ---- */
  modeGrid.addEventListener('click', (e)=>{
    const btn = e.target.closest('.choice-btn');
    if(!btn) return;
    modeGrid.querySelectorAll('.choice-btn').forEach(c=>c.classList.remove('selected'));
    btn.classList.add('selected');
    state.mode = btn.getAttribute('data-mode');
    directPanel.style.display = state.mode === 'direct' ? '' : 'none';
    calcPanel.style.display   = state.mode === 'calc'   ? '' : 'none';
    if (state.mode === 'calc'){ syncExerciseKcal(); renderExerciseOptions(); validateOnboard(); }
  });

  /* ---- direct entry ---- */
  [directKcalInput, directPInput, directCInput, directFInput, directBwInput].forEach(el=>{
    el.addEventListener('input', ()=>{
      state.directKcal = parseFloat(directKcalInput.value) || null;
      state.directP = parseFloat(directPInput.value) || null;
      state.directC = parseFloat(directCInput.value) || null;
      state.directF = parseFloat(directFInput.value) || null;
      state.bodyweight = parseFloat(directBwInput.value) || null;
      btnUseDirect.disabled = !(state.directKcal > 0);
    });
  });

  btnUseDirect.addEventListener('click', ()=>{
    state.goal = state.goal || 'maintain';
    state.finalKcal = state.directKcal;
    /* "I have my number" means one number, full stop — no rest/training
       split, and the roadmap never asks about the mix. */
    state.exerciseMode = 'none';
    state.exerciseKcal = 0;
    state.trainingDays = 0;
    syncTargets();
    assignTier();
    renderTiers();
    showScreen('screen-tiers');
  });

  /* ---- calculator ---- */
  function wireSingleSelect(grid, attr, key){
    grid.addEventListener('click', (e)=>{
      const btn = e.target.closest('.choice-btn');
      if(!btn) return;
      grid.querySelectorAll('.choice-btn').forEach(c=>c.classList.remove('selected'));
      btn.classList.add('selected');
      const raw = btn.getAttribute(attr);
      state[key] = (key === 'activity') ? parseFloat(raw) : raw;
      validateOnboard();
    });
  }
  wireSingleSelect(goalGrid, 'data-goal', 'goal');
  goalGrid.addEventListener('click', ()=>{ syncExerciseKcal(); renderExerciseOptions(); });
  wireSingleSelect(activityGrid, 'data-activity', 'activity');
  wireSingleSelect(sexGrid, 'data-sex', 'sex');

  const exerciseNote = document.getElementById('exerciseNote');
  const targetPairPreview = document.getElementById('targetPairPreview');

  /* Raw estimated burn at the user's current bodyweight, before crediting.
     Read from state rather than the input so the character sheet can edit
     the same figure without the onboarding DOM being on screen. */
  function rawExerciseKcal(){
    if (state.exerciseMode === 'none') return 0;
    if (state.exerciseMode === 'custom'){
      return Math.max(0, parseFloat(state.exerciseRaw) || 0);
    }
    if (!state.bodyweight) return 0;
    const kg = state.bodyweight * 0.453592;
    return Math.round((AUTO_SESSION.met * 3.5 * kg / 200) * AUTO_SESSION.mins);
  }

  function creditRate(){
    return EXERCISE_CREDIT[state.goal] !== undefined ? EXERCISE_CREDIT[state.goal] : 0.85;
  }

  /* What gets added on a training day. No longer gated on a day-type choice —
     it's simply the size of the gap between the two targets. */
  function creditedExerciseKcal(){
    return Math.round(rawExerciseKcal() * creditRate());
  }

  function syncExerciseKcal(){
    state.exerciseKcal = creditedExerciseKcal();
    syncTargets();
  }

  function renderExerciseOptions(){
    const rate = creditRate();
    const pct = Math.round(rate * 100);

    // auto button shows the credited figure, since that's what gets added
    let autoCredited = 0;
    if (state.bodyweight){
      const kg = state.bodyweight * 0.453592;
      const raw = Math.round((AUTO_SESSION.met * 3.5 * kg / 200) * AUTO_SESSION.mins);
      autoCredited = Math.round(raw * rate);
    }

    exerciseGrid.innerHTML = `
      <button class="choice-btn${state.exerciseMode==='none'?' selected':''}" data-exmode="none">
        <span><strong>None</strong><span class="desc">I don't train</span></span><span class="tag"><svg class="px" aria-hidden="true"><use href="#i-sleep"></use></svg></span>
      </button>
      <button class="choice-btn${state.exerciseMode==='auto'?' selected':''}" data-exmode="auto">
        <span><strong>Auto${autoCredited ? ` +${autoCredited}` : ''}</strong><span class="desc">Typical 45 min</span></span><span class="tag"><svg class="px" aria-hidden="true"><use href="#i-bolt"></use></svg></span>
      </button>
      <button class="choice-btn${state.exerciseMode==='custom'?' selected':''}" data-exmode="custom">
        <span><strong>Custom</strong><span class="desc">My own number</span></span><span class="tag"><svg class="px" aria-hidden="true"><use href="#i-edit"></use></svg></span>
      </button>`;
    exerciseInput.style.display = state.exerciseMode === 'custom' ? '' : 'none';

    if (state.exerciseMode === 'none'){
      exerciseNote.textContent = "One target then — the same number every day.";
      exerciseNote.style.color = "var(--muted)";
      renderTargetPair();
      return;
    }
    if (!state.goal){
      exerciseNote.textContent = "Pick a goal above and the add-in will scale to it.";
      exerciseNote.style.color = "var(--muted)";
      renderTargetPair();
      return;
    }
    const raw = rawExerciseKcal();
    const credited = creditedExerciseKcal();
    if (!raw){
      exerciseNote.textContent = state.exerciseMode === 'custom'
        ? "Enter the calories your tracker reported for one session."
        : "Enter your bodyweight and the auto estimate will fill in.";
      exerciseNote.style.color = "var(--muted)";
      renderTargetPair();
      return;
    }
    exerciseNote.innerHTML = `${raw} kcal burned → training days add <strong class="n-green">+${credited}</strong> ` +
      `(${pct}% for ${GOAL_LABEL[state.goal].split(' (')[0]} — ${CREDIT_NOTE[state.goal]}).`;
    exerciseNote.style.color = "var(--muted)";
    renderTargetPair();
  }

  /* The pair of numbers, shown live while the calculator is being filled in */
  function renderTargetPair(){
    if (!targetPairPreview) return;
    const ready = !!(state.goal && state.activity && state.sex &&
      state.bodyweight > 0 && state.heightIn > 0 && state.age > 0);
    if (!ready){ targetPairPreview.innerHTML = ''; return; }
    const rest = computeCalcKcal('rest');
    const train = computeCalcKcal('train');
    if (train <= rest){
      targetPairPreview.innerHTML = `<div class="season-hint" style="margin-top:12px;">
        Your target is <strong style="color:var(--cyan)">${rest} kcal</strong> every day.</div>`;
      return;
    }
    targetPairPreview.innerHTML = `<div class="season-hint" style="margin-top:12px; line-height:1.8;">
      <svg class="px" aria-hidden="true"><use href="#i-sleep"></use></svg> Rest days — <strong style="color:var(--cyan)">${rest} kcal</strong><br>
      <svg class="px" aria-hidden="true"><use href="#i-lift"></use></svg> Training days — <strong class="n-green">${train} kcal</strong></div>`;
  }

  exerciseGrid.addEventListener('click', (e)=>{
    const btn = e.target.closest('.choice-btn');
    if(!btn) return;
    state.exerciseMode = btn.getAttribute('data-exmode');
    syncExerciseKcal();
    renderExerciseOptions();
    validateOnboard();
  });

  exerciseInput.addEventListener('input', ()=>{
    state.exerciseRaw = parseFloat(exerciseInput.value) || null;
    syncExerciseKcal();
    renderExerciseOptions();
    validateOnboard();
  });

  [bwInput, ftInput, inInput, ageInput].forEach(el=>{
    el.addEventListener('input', ()=>{
      state.bodyweight = parseFloat(bwInput.value) || null;
      const ft = parseFloat(ftInput.value) || 0;
      const inch = parseFloat(inInput.value) || 0;
      state.heightIn = (ft*12 + inch) || null;
      state.age = parseFloat(ageInput.value) || null;
      syncExerciseKcal();
      renderExerciseOptions();
      validateOnboard();
    });
  });

  function validateOnboard(){
    const ready = !!(state.goal && state.activity && state.sex &&
      state.bodyweight > 0 && state.heightIn > 0 && state.age > 0);
    btnRecommend.disabled = !ready;
    calcPreview.innerHTML = ready ? previewText() : "";
    renderTargetPair();
  }

  /* Recompute both daily targets from whatever the state currently holds.
     Called from the calculator, from the character sheet's live edits, and
     after a saved plan is loaded, so the pair is never stale. */
  function syncTargets(){
    if (state.mode === 'calc'){
      if (state.bodyweight > 0 && state.heightIn > 0 && state.age > 0 && state.sex){
        state.tdee = computeTDEE();
        state.restKcal  = computeCalcKcal('rest');
        state.trainKcal = computeCalcKcal('train');
      }
    } else {
      const k = Math.round(state.directKcal || state.finalKcal || 0);
      state.restKcal = k;
      state.trainKcal = k;
    }
    if (state.restKcal != null) state.finalKcal = state.restKcal;
    clampTrainingDays();
  }

  /* You can't prep more training days than days, and a character with no
     training session on file doesn't get the question at all. */
  function clampTrainingDays(){
    if (!hasSplit()){ state.trainingDays = 0; return; }
    state.trainingDays = Math.min(Math.max(state.trainingDays || 0, 0), prepDayCount());
  }

  /* Mifflin-St Jeor BMR × daily-life activity factor (NEAT only) */
  function computeTDEE(){
    const kg = state.bodyweight * 0.453592;
    const cm = state.heightIn * 2.54;
    const base = (10*kg) + (6.25*cm) - (5*state.age);
    const bmr = state.sex === 'male' ? base + 5 : base - 161;
    return bmr * state.activity;
  }

  /* Base + goal adjustment, floored for safety. Training days add the
     credited burn on top; rest days are the base on its own. */
  function computeCalcKcal(kind){
    const add = kind === 'train' ? (state.exerciseKcal || 0) : 0;
    const raw = computeTDEE() + GOAL_ADJUST[state.goal] + add;
    return Math.round(Math.max(raw, KCAL_FLOOR[state.sex]));
  }

  function previewText(){
    const tdee = Math.round(computeTDEE());
    const rest = computeCalcKcal('rest');
    const train = computeCalcKcal('train');
    const base = `Daily burn before training: <strong style="color:var(--cyan)">${tdee}</strong> · ${GOAL_LABEL[state.goal]}`;
    return train > rest
      ? `${base} → <strong style="color:var(--cyan)">${rest}</strong> resting, ` +
        `<strong class="n-green">${train} kcal</strong> training`
      : `${base} → <strong class="n-green">${rest} kcal</strong>`;
  }

  btnRecommend.addEventListener('click', ()=>{
    syncTargets();
    assignTier();
    renderTiers();
    showScreen('screen-tiers');
  });

  /* ---- tier is a LABEL derived from the number; it never changes it ---- */
  function assignTier(){
    const k = state.finalKcal;
    const hit = TIERS.find(t => k >= t.min && k < t.max);
    const tier = hit || (k < TIERS[0].min ? TIERS[0] : TIERS[TIERS.length-1]);
    state.assignedTierId = tier.id;
    state.selectedTierId = tier.id;
  }

  /* ---------------------------------------------------------
     TWO TARGETS, NOT ONE
     A character has a rest-day number and a training-day number. Which one
     applies is a property of the DAY being cooked, so it's answered in the
     roadmap rather than at character creation — a single prep can hold both.

     When there's no training session on file (or the target was pasted in
     from another app) the two numbers are identical and everything below
     collapses back to the old single-number behaviour.
  --------------------------------------------------------- */
  function hasSplit(){
    const r = Math.round(state.restKcal || 0);
    const t = Math.round(state.trainKcal || 0);
    return state.mode === 'calc' && r > 0 && t > r;
  }

  function prepDayCount(){ return Math.max(1, state.prepServings || 1); }

  function trainingDayCount(){
    if (!hasSplit()) return 0;
    return Math.min(Math.max(state.trainingDays || 0, 0), prepDayCount());
  }

  /* Training days spread evenly through the block rather than bunching at the
     front, so "3 of 5" reads as Mon/Wed/Fri rather than Mon/Tue/Wed. */
  function dayKinds(){
    const n = prepDayCount();
    const t = trainingDayCount();
    const kinds = Array(n).fill('rest');
    if (t <= 0) return kinds;
    if (t >= n) return Array(n).fill('train');
    let placed = 0;
    for (let i = 0; i < t; i++){
      let at = Math.floor(i * n / t + n / (2 * t));
      at = Math.min(Math.max(at, 0), n - 1);
      while (kinds[at] === 'train' && at < n - 1) at++;
      while (kinds[at] === 'train' && at > 0) at--;
      if (kinds[at] !== 'train'){ kinds[at] = 'train'; placed++; }
    }
    // guard: if collisions ate a slot, fill the first rest day going
    for (let i = 0; placed < t && i < n; i++){
      if (kinds[i] === 'rest'){ kinds[i] = 'train'; placed++; }
    }
    return kinds;
  }

  function dayKindAt(dayIdx){
    if (!hasSplit()) return 'rest';
    if (prepReady()){
      const row = state.prep.schedule[dayIdx];
      return (row && row.kind === 'train') ? 'train' : 'rest';
    }
    return dayKinds()[dayIdx] || 'rest';
  }

  /* The kind of day the app is currently looking at. Every screen that shows
     numbers goes through currentTargets(), so setting the active day is all
     it takes to move the whole app onto that day's target. */
  function activeDayKind(){
    if (!hasSplit()) return 'rest';
    const idx = prepReady() ? dayIndex() : Math.max((state.activeDay || 1) - 1, 0);
    return dayKindAt(idx);
  }

  const DAY_KIND_LABEL = {rest:'REST DAY', train:'TRAINING DAY'};
  const DAY_KIND_ICON  = {rest:'sleep', train:'lift'};

  /* 'rest' | 'train' | 'avg' — avg is the blended number used while CHOOSING
     dishes, so a mixed prep isn't sized as though every day were the same.
     Portions are recomputed per day afterwards, so this only steers the pick. */
  function targetKcalFor(kind){
    const rest  = Math.round(state.restKcal != null ? state.restKcal : (state.finalKcal || 0));
    const train = Math.round(state.trainKcal != null ? state.trainKcal : rest);
    if (!hasSplit()) return rest;
    if (kind === 'train') return train;
    if (kind === 'avg'){
      const n = prepDayCount(), t = trainingDayCount();
      return Math.round((train * t + rest * (n - t)) / n);
    }
    return rest;
  }

  /* Set while the suggester is picking dishes, so a mixed prep is built
     against the average day rather than whichever day happens to be active. */
  let targetOverride = null;
  function withTargetKind(kind, fn){
    const prev = targetOverride;
    targetOverride = kind;
    try { return fn(); } finally { targetOverride = prev; }
  }

  /* Targets always come from the exact calorie number — no band clamping. */
  function computeTargets(kind){
    const k = kind || targetOverride || activeDayKind();
    const kcal = targetKcalFor(k);
    if (!kcal) return {kcal:0, protein:0, carbs:0, fat:0};

    // If the user typed macros straight from another app, honor them exactly.
    if (state.mode === 'direct' && state.directP && state.directC && state.directF){
      return {kcal, protein:Math.round(state.directP), carbs:Math.round(state.directC), fat:Math.round(state.directF)};
    }

    const goal = state.goal || 'maintain';
    const L = MACRO_LIMITS;
    let protein, fat;

    if (state.bodyweight > 0){
      // 1. Protein is the protected macro — hit the g/lb target, but it can't
      //    swallow the whole budget
      protein = Math.min(
        Math.round(state.bodyweight * PROTEIN_PER_LB[goal]),
        Math.round((kcal * L.proteinMaxPct) / 4)
      );
      // 2. Fat sits at its target, lifted to the per-lb floor if calories are
      //    low, but capped so it can't take over as the budget shrinks
      fat = Math.round((kcal * L.fatTargetPct) / 9);
      fat = Math.max(fat, Math.round(state.bodyweight * L.fatMinPerLb));
      fat = Math.min(fat, Math.round((kcal * L.fatMaxPct) / 9));
    } else {
      protein = Math.round((kcal * 0.30) / 4);
      fat     = Math.round((kcal * L.fatTargetPct) / 9);
    }

    // 3. Carbs take the remainder — but never less than their minimum share.
    //    If they'd fall short, the room comes out of fat first.
    let carbs = Math.round((kcal - protein*4 - fat*9) / 4);
    const carbMin = Math.round((kcal * L.carbMinPct) / 4);
    if (carbs < carbMin){
      const fatFloor = state.bodyweight > 0
        ? Math.max(Math.round(state.bodyweight * L.fatFloorPerLb), Math.round((kcal * 0.18) / 9))
        : Math.round((kcal * 0.18) / 9);
      fat = Math.max(fatFloor, Math.round((kcal - protein*4 - carbMin*4) / 9));
      carbs = Math.round((kcal - protein*4 - fat*9) / 4);
    }
    // 4. Last resort — an extreme deficit on a large frame can still squeeze;
    //    give protein back a little rather than leave carbs at zero
    if (carbs < 0){
      protein = Math.round((kcal - fat*9) / 4 * 0.7);
      carbs = Math.round((kcal - protein*4 - fat*9) / 4);
    }
    return {kcal, protein, carbs:Math.max(carbs,0), fat:Math.max(fat,0)};
  }

