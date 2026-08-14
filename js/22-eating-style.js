'use strict';
/* ============================================================
   LOADOUT - SCREEN 2.7: EATING STYLE
   From app.js lines 9319-9552 of the original single file.
   Loaded in order by index.html; all files share one global scope,
   so declarations here are visible to every file listed after it.
   ============================================================ */

  /* =========================================================
     SCREEN 2.7: EATING STYLE
  ========================================================= */
  const mealPlanGrid = document.getElementById('mealPlanGrid');
  const weightRows = document.getElementById('weightRows');
  const mealCountNote = document.getElementById('mealCountNote');
  const prepDaysGrid = document.getElementById('prepDaysGrid');
  const prepDaysNote = document.getElementById('prepDaysNote');
  const uniqueGrid = document.getElementById('uniqueGrid');
  const uniqueNote = document.getElementById('uniqueNote');
  const varietyRows = document.getElementById('varietyRows');
  const btnConfirmStyle = document.getElementById('btnConfirmStyle');

  const VARIETY_CATS = [
    {slot:'protein', icon:'protein', label:'Proteins', max:6},
    {slot:'carb',    icon:'carb', label:'Carbs',    max:6},
    {slot:'fat',     icon:'fat', label:'Fats',     max:5},
    {slot:'veg',     icon:'veg', label:'Veg',      max:8},
  ];

  /* The old three-button choice was abstract — "variety" meant nothing
     concrete. These numbers say exactly what you'll be shopping for and
     cooking, and the playstyle label is derived from them rather than
     driving them. */
  function varietyOf(slot){
    const v = (state.variety || {})[slot];
    const cat = VARIETY_CATS.find(c=>c.slot===slot);
    return v != null ? v : Math.min(2, cat ? cat.max : 2);
  }

  function derivedStyle(){
    const cap = maxUniqueMeals();
    const uniq = clampUniqueMeals();
    const mealRatio = cap > 1 ? (uniq - 1) / (cap - 1) : 0;
    const varRatio = VARIETY_CATS.reduce((a,c)=>
      a + (varietyOf(c.slot) - 1) / (c.max - 1), 0) / VARIETY_CATS.length;
    const score = mealRatio * 0.55 + varRatio * 0.45;
    if (score < 0.30) return 'consistent';
    if (score < 0.65) return 'balanced';
    return 'variety';
  }

  const STYLE_VERDICT = {
    consistent: {tag:'<svg class="px" aria-hidden="true"><use href="#i-reset"></use></svg> CONSISTENT', text:'Cook once, eat the same thing. Least effort, least waste, no decisions to make during the week.'},
    balanced:   {tag:'<svg class="px" aria-hidden="true"><use href="#i-scales"></use></svg> BALANCED',   text:'A couple of dishes on rotation with some rotating sides. The usual sweet spot for meal prep.'},
    variety:    {tag:'<svg class="px" aria-hidden="true"><use href="#i-dice"></use></svg> VARIETY',    text:"Plenty of different meals and ingredients. More shopping, more pans, more interesting — make sure you'll actually cook it all."},
  };

  /* ---- THE REST / TRAINING SPLIT ----
     This is the question that used to sit in character creation, where it
     couldn't work: a prep covers several days at once, so "is today a rest
     day" has no single answer once the cooking starts. Asked here it becomes
     "how many of each", which a prep can actually answer — and a character
     with one number never sees the panel at all. */
  function renderDayMix(days){
    const panel = document.getElementById('dayMixPanel');
    const grid  = document.getElementById('trainDaysGrid');
    const note  = document.getElementById('dayMixNote');
    if (!panel) return;

    if (!hasSplit()){ panel.hidden = true; return; }
    panel.hidden = false;

    clampTrainingDays();
    const t = trainingDayCount();
    const rest = days - t;
    const restKcal  = targetsFor('rest').kcal;
    const trainKcal = targetsFor('train').kcal;

    grid.innerHTML = Array.from({length:days + 1}, (_,n)=>
      `<button class="choice-btn${t===n?' selected':''}" data-trainday="${n}"
         style="min-height:52px; justify-content:center;"><span><strong>${n}</strong></span></button>`).join('');
    grid.querySelectorAll('[data-trainday]').forEach(b=>b.addEventListener('click',()=>{
      state.trainingDays = parseInt(b.getAttribute('data-trainday'),10);
      renderStyle();
    }));

    const line = (n, label, icon, kcal, col) => n
      ? `<div class="kv"><span>${ic(icon)} ${n} ${label}${n===1?'':'s'}</span>
           <span style="color:${col}">${kcal} kcal each</span></div>`
      : '';

    note.innerHTML =
      line(t, 'training day', DAY_KIND_ICON.train, trainKcal, 'var(--green)') +
      line(rest, 'rest day', DAY_KIND_ICON.rest, restKcal, 'var(--cyan)') +
      `<div class="season-hint" style="margin-top:10px;">` +
      (t === 0
        ? `Every prepped day is built at your rest-day number. Say how many you train on and the bigger portions get cooked for those days.`
        : t === days
        ? `Every prepped day is built at your training-day number.`
        : `Same dishes across both — the portions grow on training days rather than the recipes changing, so you still only cook once. Your shopping list totals the real mix.`) +
      `</div>`;
  }

  function renderStyle(){
    // days
    prepDaysGrid.innerHTML = [1,2,3,4,5,6,7].map(n=>
      `<button class="choice-btn${(state.prepServings||1)===n?' selected':''}" data-prepday="${n}"
         style="min-height:52px; justify-content:center;"><span><strong>${n}</strong></span></button>`).join('');
    prepDaysGrid.querySelectorAll('[data-prepday]').forEach(b=>b.addEventListener('click',()=>{
      state.prepServings = parseInt(b.getAttribute('data-prepday'),10);
      clampTrainingDays();
      renderStyle();
    }));
    const days = state.prepServings || 1;
    prepDaysNote.innerHTML = days === 1
      ? 'Planning a single day. Shopping quantities will match one day of food.'
      : `Cooking for <strong class="n-green">${days} days</strong>. Every one of them gets built and totalled — dishes rotate, so day 4 isn't just day 1 again.`;

    renderDayMix(days);

    // meal configuration
    mealPlanGrid.innerHTML = MEAL_PLANS.map(pl=>
      `<button class="choice-btn${state.mealPlan===pl.key?' selected':''}" data-plan="${pl.key}">
         <span><strong>${pl.label}</strong><span class="desc">${pl.desc}</span></span></button>`).join('');
    mealPlanGrid.querySelectorAll('[data-plan]').forEach(b=>b.addEventListener('click',()=>{
      setMealPlan(b.getAttribute('data-plan'));
      state.uniqueMeals = Math.min(state.uniqueMeals || 3, MEALS.length);
      renderStyle();
    }));

    // per-meal heft
    const mains = MEALS.filter(m=>m.required);
    weightRows.innerHTML = mains.map((m,i)=>`
      <div class="var-row">
        <span class="var-label">${m.name.charAt(0) + m.name.slice(1).toLowerCase()}</span>
        <div class="var-steps">
          ${['light','normal','heavy'].map(w=>
            `<button class="var-step wide${(state.mealWeights[i]||'normal')===w?' on':''}" data-weight="${i}|${w}">${w.charAt(0).toUpperCase()+w.slice(1)}</button>`).join('')}
        </div>
      </div>`).join('');
    weightRows.querySelectorAll('[data-weight]').forEach(b=>b.addEventListener('click',()=>{
      const [i,w] = b.getAttribute('data-weight').split('|');
      state.mealWeights[i] = w;
      rebuildMeals();
      renderStyle();
    }));

    const splitLine = (kind, col)=>{
      const k = targetsFor(kind).kcal;
      const parts = MEALS.map(m => `${m.required ? 'meal' : 'snack'} ~${Math.round(k * m.share)}`);
      return `<strong style="color:${col}">${parts.join(' · ')}</strong> kcal`;
    };
    const restK = targetsFor('rest').kcal;
    mealCountNote.innerHTML = !restK ? ''
      : hasSplit()
        ? `${ic(DAY_KIND_ICON.rest)} Your ${restK} kcal rest day splits into ${splitLine('rest','var(--cyan)')}.<br>` +
          `${ic(DAY_KIND_ICON.train)} Your ${targetsFor('train').kcal} kcal training day splits into ${splitLine('train','var(--green)')}.`
        : `Your ${restK} kcal splits into: ${splitLine('rest','var(--green)')}.`;

    /* ---- UNIQUE MEALS ----
       This is a variety dial for the whole prep, not a per-day schedule.
       Its ceiling is every main sitting across every day being different. */
    const mains2 = mainSittings();
    const capMeals = maxUniqueMeals();
    state.uniqueMeals = clampUniqueMeals();
    const u = state.uniqueMeals;
    uniqueGrid.innerHTML = Array.from({length:capMeals}, (_,i)=>i+1).map(n=>
      `<button class="choice-btn${u===n?' selected':''}" data-uniq="${n}"
         style="min-height:52px; justify-content:center;"><span><strong>${n}</strong></span></button>`).join('');
    uniqueGrid.querySelectorAll('[data-uniq]').forEach(b=>b.addEventListener('click',()=>{
      state.uniqueMeals = parseInt(b.getAttribute('data-uniq'),10);
      renderStyle();
    }));
    const totalMainServings = mains2 * days;
    uniqueNote.innerHTML =
      `<strong class="n-green">${u}</strong> different ${u===1?'dish':'dishes'} covering ` +
      `<strong>${totalMainServings}</strong> main sitting${totalMainServings>1?'s':''} ` +
      (days>1 ? `across ${days} days. ` : `today. `) +
      (u >= totalMainServings
        ? 'Nothing repeats — every sitting is its own recipe.'
        : `Each dish gets cooked about ${(totalMainServings/u).toFixed(1)} time${totalMainServings/u>=2?'s':''} over the prep.`) +
      (snackSittings() ? ' Snacks are counted separately below.' : '');

    /* ---- UNIQUE SNACKS ----
       Only asked when the day actually has snacks in it. */
    const snackPanel = document.getElementById('snackUniquePanel');
    const snackGrid  = document.getElementById('snackUniqueGrid');
    const snackNote  = document.getElementById('snackUniqueNote');
    const capSnacks = maxUniqueSnacks();
    if (!capSnacks){
      if (snackPanel) snackPanel.hidden = true;
    } else if (snackPanel){
      snackPanel.hidden = false;
      state.uniqueSnacks = clampUniqueSnacks();
      const su = state.uniqueSnacks;
      snackGrid.innerHTML = Array.from({length:capSnacks}, (_,i)=>i+1).map(n=>
        `<button class="choice-btn${su===n?' selected':''}" data-usnack="${n}"
           style="min-height:52px; justify-content:center;"><span><strong>${n}</strong></span></button>`).join('');
      snackGrid.querySelectorAll('[data-usnack]').forEach(b=>b.addEventListener('click',()=>{
        state.uniqueSnacks = parseInt(b.getAttribute('data-usnack'),10);
        renderStyle();
      }));
      snackNote.innerHTML =
        `<strong class="n-green">${su}</strong> different snack${su>1?'s':''} covering ` +
        `<strong>${capSnacks}</strong> snack slot${capSnacks>1?'s':''}` +
        (days>1 ? ` across ${days} days.` : ' today.') +
        ' These don\'t come out of your meal count.';
    }

    // ingredient variety
    varietyRows.innerHTML = VARIETY_CATS.map(c=>{
      const v = varietyOf(c.slot);
      return `<div class="var-row">
        <span class="var-label">${ic(c.icon)} ${c.label}</span>
        <div class="var-steps">
          ${Array.from({length:c.max},(_,i)=>i+1).map(n=>
            `<button class="var-step${v===n?' on':''}" data-var="${c.slot}|${n}" aria-label="${n} different ${c.label}">${n}</button>`).join('')}
        </div>
      </div>`;
    }).join('');
    varietyRows.querySelectorAll('[data-var]').forEach(b=>b.addEventListener('click',()=>{
      const [slot,n] = b.getAttribute('data-var').split('|');
      state.variety = state.variety || {};
      state.variety[slot] = parseInt(n,10);
      renderStyle();
    }));

    // derived verdict
    state.eatingStyle = derivedStyle();
    const v = STYLE_VERDICT[state.eatingStyle];
    document.getElementById('styleVerdictTag').innerHTML = v.tag;
    document.getElementById('styleVerdict').textContent = v.text;
    btnConfirmStyle.disabled = false;
  }



  btnConfirmStyle.addEventListener('click', ()=>{
    generateSuggestion();
    renderSuggestion();
    showScreen('screen-suggest');
  });

