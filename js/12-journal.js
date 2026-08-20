'use strict';
/* ============================================================
   LOADOUT - JOURNAL - what was actually eaten
   From app.js lines 5867-6315 of the original single file.
   Loaded in order by index.html; all files share one global scope,
   so declarations here are visible to every file listed after it.
   ============================================================ */

  /* =========================================================
     JOURNAL — what was actually eaten
  ========================================================= */
  function renderJournal(){
    const key = state.journalDate || todayKey();
    state.journalDate = key;
    const [y,m,d] = key.split('-').map(Number);
    const dt = new Date(y, m-1, d);
    const isToday = key === todayKey();
    document.getElementById('journalDateLbl').innerHTML =
      `${isToday ? 'Today · ' : ''}${DOW[mondayIndex(dt)]}, ${MONTHS[dt.getMonth()]} ${dt.getDate()}`;

    const slots = journalSlots();
    const setup = document.getElementById('journalSetup');
    const body = document.getElementById('journalBody');

    // no prep plan and no answer yet — ask how the day breaks down
    if (!slots){
      setup.hidden = false;
      document.getElementById('journalCountGrid').innerHTML =
        [2,3,4,5,6].map(n=>`<button class="choice-btn" data-jc="${n}"
          style="min-height:52px; justify-content:center;"><span><strong>${n}</strong></span></button>`).join('');
      document.getElementById('journalCountGrid').querySelectorAll('[data-jc]').forEach(b=>
        b.addEventListener('click', ()=>{
          state.journalMeals = parseInt(b.getAttribute('data-jc'),10);
          renderJournal(); saveState();
        }));
      body.innerHTML = '';
      return;
    }
    setup.hidden = true;

    const log = dayLog(key);

    /* Which kind of day THIS date was. Stamped into the log the moment
       anybody sets it, so scrolling back later still knows: the prep
       schedule only records which prep days are training, never which
       calendar dates were. A date nobody ever marked is taken as a rest
       day — it is the one the person did not go out of their way to
       record, and assuming training would quietly withhold both the
       training target and a step buff they may have earned. */
    const dayKind = log.dayKind || (isToday && typeof activeDayKind === 'function'
                                      ? activeDayKind() : 'rest');

    /* Targets for that kind, not for whatever kind today happens to be —
       otherwise a Tuesday marked as training is still scored against the
       rest-day number once the week moves on. */
    const tg = (typeof targetsFor === 'function') ? targetsFor(dayKind) : currentTargets();
    const t = dayTotals(key);
    const fromPlan = slots.length && slots[0].planned;
    const planned = characterExists() && Object.values(state.selections||{})
      .some(sel => SLOT_DEFS.some(dd => (sel[dd.slot]||[]).some(Boolean)));

    /* The journal is the one screen that is genuinely a tracker: a target,
       some objectives, and a running count of what is done. Drawing it as
       an open quest rather than four stacked totals panels is closer to
       what it actually is. */
    const done  = slots.filter(sl => (log.meals[sl.name] || []).length).length;

    /* STEP BUFF — walking beyond a usual day, credited to that day's
       allowance. Scoped to the journal on purpose: the prep is built from the
       plain plan targets, so a cook plan comes out the same however far
       anyone walked.

       Read for the day being VIEWED rather than for today, so an earlier
       day's log is scored against the steps actually taken on it. A finished
       day is the more trustworthy of the two — today is still being walked.

       Null on the web, before Health is connected, outside the window Health
       was asked for, and on training days where the session burn already
       covers the movement. */
    const daySteps   = (typeof stepsOn === 'function') ? stepsOn(key) : null;
    const buff       = (typeof stepBuffFor === 'function') ? stepBuffFor(key, dayKind) : null;
    const dayAverage = (typeof stepAverage === 'function') ? stepAverage() : null;

    /* Which prep day is being eaten, and whether it is a rest or training
       day. Both drive the target, and until now neither could be set from
       the screen where you actually log what you ate. */
    const prepDays  = (typeof prepReady === 'function' && prepReady())
                        ? state.prep.schedule.length : 0;
    const showSplit = (typeof hasSplit === 'function') && hasSplit();
    const goal     = tg.kcal + (buff ? buff.kcal : 0);
    const pct      = goal ? Math.round(t.kcal / goal * 100) : 0;
    const macro = (label, got, want, cls)=>{
      const p = want ? Math.min(100, Math.round(got / want * 100)) : 0;
      return `<div class="qbm">
        <span class="qbm-k">${label}</span>
        <span class="qbm-track"><i class="${cls}" style="width:${p}%"></i></span>
        <span class="qbm-v">${Math.round(got)}${want ? '/' + want : ''}g</span>
      </div>`;
    };

    body.innerHTML = `
      <div class="panel quest-brief">
        <div class="qb-top">
          <span class="qb-tag">ACTIVE</span>
          <span class="qb-count">${done} / ${slots.length} logged</span>
        </div>
        <div class="qb-title">${isToday ? 'Fuel today' : 'Fuel this day'}</div>
        ${fromPlan ? `<div class="qb-from">Following your prep — ${slots.length} ${slots.length === 1 ? 'sitting' : 'sittings'}
          (${escapeHtml(planFor(state.mealPlan).label)}). Change it in the Loadout tab and this follows.</div>` : ''}
        <div class="qb-bar${goal && t.kcal > goal ? ' over' : ''}">
          <i style="width:${Math.min(100, pct)}%"></i>
          <span>${Math.round(t.kcal)}${goal ? ' / ' + goal : ''} kcal</span>
        </div>
        ${daySteps != null ? `<div class="qb-buff${buff ? '' : ' flat'}">
          <span class="qb-buff-icon"><svg class="px" aria-hidden="true"><use href="#i-run"></use></svg></span>
          <span class="qb-buff-body">
            <span class="qb-buff-head">${buff
              ? `STEP BUFF <strong>+${buff.kcal} kcal</strong>`
              : `STEPS <strong>${daySteps.toLocaleString()}</strong>`}</span>
            <span class="qb-buff-sub">${buff
              ? (buff.source === 'energy'
                  ? `${daySteps != null ? daySteps.toLocaleString() + ' steps · ' : ''}measured from your activity, beyond a usual day`
                  : `${buff.extra != null ? buff.extra.toLocaleString() + ' past your usual ' + buff.average.toLocaleString() + ' · ' : ''}estimated from steps`)
              : `${dayAverage ? `Your usual is about ${dayAverage.toLocaleString()}. ` : ''}${
                  isToday ? 'Go past that and today\'s target goes up.'
                          : 'No further than usual, so no buff.'}`}</span>
          </span>
        </div>` : ''}
        <div class="qb-macros">
          ${macro('PROTEIN', t.protein, tg.protein, 'p')}
          ${macro('CARBS',   t.carbs,   tg.carbs,   'c')}
          ${macro('FAT',     t.fat,     tg.fat,     'f')}
        </div>
      </div>` +
      /* Shown only where the answer changes the target, which means only
         where a rest/training split exists at all. Without one every prep
         day carries the same number, so picking between them here would be
         a control that moves nothing — the loadout tab still has its day
         strip for changing which dishes are on the plate.

           no prep, split exists   -> toggle only
           multi-day prep, split   -> both
           single-day prep, split  -> toggle only
           no split                -> neither
      */
      (showSplit ? `<div class="panel jday">
        ${prepDays > 1 ? `<label class="field-label">WHICH PREP DAY ARE YOU EATING?</label>
          <div class="day-strip jday-strip">
            ${Array.from({length:prepDays}, (_,i)=>i+1).map(n=>{
              const k = dayKindAt(n - 1);
              return `<button class="day-chip${n === (dayIndex()+1) ? ' on' : ''}${
                showSplit && k === 'train' ? ' train' : ''}" data-jday="${n}">${n}${
                showSplit ? `<span class="kd">${ic(DAY_KIND_ICON[k])}</span>` : ''}</button>`;
            }).join('')}
          </div>` : ''}
        ${showSplit ? `<label class="field-label" style="margin-top:${prepDays > 1 ? '14px' : '0'};">WAS THIS A REST OR TRAINING DAY?</label>
          <div class="seg jday-seg">
            ${['rest','train'].map(k=>
              `<button class="${dayKind === k ? 'on' : ''}" data-jkind="${k}">${ic(DAY_KIND_ICON[k])} ${DAY_KIND_LABEL[k]}</button>`).join('')}
          </div>
          <p class="subtitle" style="font-size:11px; margin:10px 0 0;">
            ${isToday
              ? 'Sets today\'s target, and is remembered against this date.'
              : 'Remembered against this date — it does not change your plan.'}
          </p>` : ''}
      </div>` : '') +
      slots.map(sl=>{
        const items = log.meals[sl.name] || [];
        const sub = items.reduce((a,i)=>a + (+i.kcal||0), 0);
        return `<div class="panel obj${items.length ? ' done' : ''}">
          <div class="jmeal-head">
            <span class="obj-mark" aria-hidden="true"></span>
            <span class="eaten-title">${escapeHtml(sl.name)}</span>
            <span class="eaten-total">${Math.round(sub)} kcal</span>
          </div>
          ${items.length
            ? items.map((it,i)=>`<div class="jrow">
                <span class="jname">${escapeHtml(it.name)}
                  <small style="display:block;color:var(--muted);font-size:11px;">P${Math.round(+it.protein||0)} C${Math.round(+it.carbs||0)} F${Math.round(+it.fat||0)}${
                    it._food ? ` · <button class="amt-tap tiny" data-jamtedit="${escapeHtml(sl.name)}|${i}">change amount <svg class="px" aria-hidden="true"><use href="#i-edit"></use></svg></button>` : ''}</small>
                </span>
                <span class="jkcal">${Math.round(+it.kcal||0)}</span>
                <button class="mini-btn remove" data-jdel="${escapeHtml(sl.name)}|${i}" aria-label="Remove"><svg class="px" aria-hidden="true"><use href="#i-close"></use></svg></button>
              </div>`).join('')
            : '<div class="fav-nores">Nothing here yet. Add what you ate.</div>'}
          <button class="mini-btn add" data-jadd="${escapeHtml(sl.name)}">+ ADD FOOD</button>
          ${planned ? `<button class="mini-btn add" data-jplan="${escapeHtml(sl.key)}|${escapeHtml(sl.name)}" style="margin-top:6px;"><svg class="px" aria-hidden="true"><use href="#i-clipboard"></use></svg> COPY FROM MY PREP PLAN</button>` : ''}
        </div>`;
      }).join('');

    /* Switching prep day goes through the same path the loadout strip uses:
       write back whatever the current day was showing first, or the edits
       made to it are lost as the selections are rebuilt. */
    body.querySelectorAll('[data-jday]').forEach(b=>b.addEventListener('click', ()=>{
      writeBackActiveDay();
      applyDayToSelections(parseInt(b.getAttribute('data-jday'), 10));
      renderJournal();
      refreshTargets();
      saveState();
    }));

    body.querySelectorAll('[data-jkind]').forEach(b=>b.addEventListener('click', ()=>{
      const kind = b.getAttribute('data-jkind');

      /* Recorded against the date either way, so the journal still knows
         months later what kind of day this was. */
      log.dayKind = kind;

      /* Only today may change the plan itself. Editing the schedule from a
         date three weeks back would silently re-target the prep day that
         happens to sit at that index now, which is not what anyone means by
         "that Tuesday was a training day". */
      if (isToday && prepReady()){
        const row = state.prep.schedule[dayIndex()];
        if (row) row.kind = kind;
        state.prep.trainingDays = state.prep.schedule.filter(r=>r.kind === 'train').length;
        state.trainingDays = state.prep.trainingDays;
      }

      renderJournal();
      refreshTargets();
      saveState();
    }));

    body.querySelectorAll('[data-jadd]').forEach(b=>b.addEventListener('click', ()=>
      openJournalFoodPicker(b.getAttribute('data-jadd'))));
    // a logged library food keeps its amount editable — tap it to change
    body.querySelectorAll('[data-jamtedit]').forEach(b=>b.addEventListener('click', ()=>{
      const [meal, idx] = b.getAttribute('data-jamtedit').split('|');
      openJournalAmountEditor(meal, parseInt(idx,10));
    }));
    body.querySelectorAll('[data-jdel]').forEach(b=>b.addEventListener('click', ()=>{
      const [meal, idx] = b.getAttribute('data-jdel').split('|');
      (log.meals[meal] || []).splice(parseInt(idx,10), 1);
      renderJournal(); saveState();
    }));
    body.querySelectorAll('[data-jplan]').forEach(b=>b.addEventListener('click', ()=>{
      const [mealKey, mealName] = b.getAttribute('data-jplan').split('|');
      journalCopyFromPlan(mealKey, mealName);
    }));
  }

  /* ---------------------------------------------------------
     LOGGING FROM THE LIBRARY
     Typing four macro numbers by hand for a slice of bread you eat every
     day is busywork. The same inventory the planner draws on is searchable
     here: pick the food, say how much — in grams, or in slices/eggs/
     tortillas where the food comes that way — and the numbers follow.
     Hand entry is still there for anything the library doesn't know.
  --------------------------------------------------------- */
  const ALL_FOOD_SLOTS = [
    {slot:'protein', icon:'protein', label:'PROTEIN',    list:()=>FOODS.protein},
    {slot:'carb',    icon:'carb', label:'CARBS',      list:()=>FOODS.carbs},
    {slot:'fat',     icon:'fat', label:'FATS',       list:()=>FOODS.fat},
    {slot:'veg',     icon:'veg', label:'VEGETABLES', list:()=>FOODS.veg},
    {slot:'fruit',   icon:'fruit', label:'FRUIT',      list:()=>FOODS.fruit},
    {slot:'sauce',   icon:'sauce', label:'SAUCES',     list:()=>FOODS.sauce},
  ];

  /* Every food in one flat list, tagged with where it came from */
  let FOOD_INDEX = null;
  function foodIndex(){
    if (FOOD_INDEX) return FOOD_INDEX;
    FOOD_INDEX = [];
    ALL_FOOD_SLOTS.forEach(d=>{
      d.list().forEach(f => FOOD_INDEX.push({food:f, slot:d.slot, icon:d.icon, group:d.label}));
    });
    return FOOD_INDEX;
  }

  /* A sensible amount to open on: one unit for unit foods, otherwise the
     portion the planner would have suggested. */
  function defaultLogGrams(slot, food){
    if (food.unit) return food.unit.g * (food.unit.whole ? 1 : 1);
    const m = minPortion(slot, food);
    return Math.max(10, Math.round(m / 5) * 5);
  }

  let jfoodTarget = null;   // {mealName, pick:{food,slot}, grams}

  function openJournalFoodPicker(mealName){
    jfoodTarget = {mealName, pick:null, grams:0};
    document.getElementById('jfoodTitle').textContent = 'ADD TO ' + mealName;
    const box = document.getElementById('jfoodSearch');
    box.value = '';
    document.getElementById('jfoodClear').style.display = 'none';
    document.getElementById('jfoodPanel').innerHTML = '';
    renderJournalFoodList('');
    openModal('modalJournalFood');
    if (window.matchMedia && window.matchMedia('(min-width:640px)').matches && box.focus) box.focus();
  }

  function renderJournalFoodList(query){
    const host = document.getElementById('jfoodList');
    const q = (query || '').trim().toLowerCase();
    let items = foodIndex();
    // dietary filters are the person's own, so respect them here too
    items = items.filter(x => passesPrefs(x.food));
    if (q){
      const strict = items.filter(x => matchesQuery(x.food.name, q));
      // the loose pass only ever rescues an otherwise empty result
      items = strict.length ? strict : items.filter(x => looseMatchesQuery(x.food.name, q));
    }

    if (!q){
      host.innerHTML = `<div class="fav-nores">Start typing to search ${items.length} foods —
        “chicken”, “bread”, “rice”…</div>`;
      return;
    }
    if (!items.length){
      host.innerHTML = `<div class="fav-nores">Nothing matches “${escapeHtml(query)}”.
        You can still enter it by hand below.</div>`;
      return;
    }

    // names that start with what was typed come first
    const rank = name => {
      const at = name.toLowerCase().indexOf(q);
      return at < 0 ? 999 : at;   // matched on a word stem, not the literal text
    };
    items.sort((a,b)=>
      rank(a.food.name) - rank(b.food.name) || a.food.name.length - b.food.name.length);

    host.innerHTML = `<div class="fp-group">${items.length} MATCH${items.length===1?'':'ES'}</div>` +
      items.slice(0, 60).map((x,i)=>`
        <button class="fp-row" data-jf="${i}">
          <span class="nm">${ic(x.icon)} ${escapeHtml(x.food.name)}</span>
          <span class="kc">${x.food.kcal} kcal/100g${x.food.unit ? ' · per ' + escapeHtml(x.food.unit.one) : ''}</span>
        </button>`).join('');

    host.querySelectorAll('[data-jf]').forEach(b=>b.addEventListener('click', ()=>{
      const x = items[parseInt(b.getAttribute('data-jf'),10)];
      jfoodTarget.pick = x;
      jfoodTarget.grams = defaultLogGrams(x.slot, x.food);
      renderJournalFoodAmount();
    }));
  }

  /* Amount step for the chosen food, with the running macros underneath */
  function renderJournalFoodAmount(){
    if (!jfoodTarget || !jfoodTarget.pick) return;
    const {food, slot} = jfoodTarget.pick;
    const g = jfoodTarget.grams;
    const unit = food.unit;
    const units = unit ? g / unit.g : null;
    const macro = k => food[k] * g / 100;
    const panel = document.getElementById('jfoodPanel');

    panel.innerHTML = `
      <div class="panel" style="margin-bottom:14px;">
        <div style="font-family:var(--font-body); font-size:15px; color:var(--green); margin-bottom:10px;">
          ${escapeHtml(food.name)}</div>

        ${unit ? `
          <label class="field-label">HOW MANY ${escapeHtml(unit.many.toUpperCase())}?</label>
          <div class="amt-stepper">
            <button class="amt-btn" data-jamt="down" aria-label="Less">−</button>
            <div class="amt-value"><span>${formatUnits(units)}</span>
              <small>${escapeHtml(units <= 1 ? unit.one : unit.many)}</small></div>
            <button class="amt-btn" data-jamt="up" aria-label="More">+</button>
          </div>
          <div class="amt-grams">= <strong>${g.toFixed(0)}</strong>g
            <button class="text-link" id="jfSwitchG" style="display:inline; width:auto; margin:0 0 0 8px; padding:0; font-size:12px;">set grams instead</button>
          </div>
        ` : `
          <label class="field-label">GRAMS</label>
          <div class="amt-stepper">
            <button class="amt-btn" data-jamt="down" aria-label="Less">−</button>
            <input type="number" id="jfGrams" class="amt-input" inputmode="numeric" value="${g.toFixed(0)}" min="0" aria-label="Grams">
            <button class="amt-btn" data-jamt="up" aria-label="More">+</button>
          </div>
        `}

        <div class="kv" style="margin-top:12px;"><span>Calories</span><span>${Math.round(macro('kcal'))} kcal</span></div>
        <div class="kv"><span>Protein</span><span>${macro('protein').toFixed(1)}g</span></div>
        <div class="kv"><span>Carbs</span><span>${macro('carbs').toFixed(1)}g</span></div>
        <div class="kv"><span>Fat</span><span>${macro('fat').toFixed(1)}g</span></div>

        <button class="btn-primary" id="jfAdd" style="margin-top:12px;">ADD TO ${escapeHtml(jfoodTarget.mealName)}</button>
        <button class="btn-ghost" id="jfBack"><svg class="px" aria-hidden="true"><use href="#i-back"></use></svg> PICK SOMETHING ELSE</button>
      </div>`;

    const bump = dir=>{
      if (unit && !jfoodTarget.freeGrams){
        const s = unitStep(food) * unit.g;
        jfoodTarget.grams = Math.max(s, jfoodTarget.grams + dir * s);
      } else {
        const s = jfoodTarget.grams >= 100 ? 10 : 5;
        jfoodTarget.grams = Math.max(0, jfoodTarget.grams + dir * s);
      }
      renderJournalFoodAmount();
    };
    panel.querySelectorAll('[data-jamt]').forEach(b=>b.addEventListener('click', ()=>
      bump(b.getAttribute('data-jamt') === 'up' ? 1 : -1)));

    /* Typing must not rebuild the panel: on a phone, tapping ADD blurs the
       field first, and a rebuild would replace the button mid-tap so the
       press never lands. Commit on every keystroke and repaint the four
       macro rows in place instead. */
    const gi = document.getElementById('jfGrams');
    if (gi) gi.addEventListener('input', ()=>{
      const v = parseFloat(gi.value);
      if (!isFinite(v) || v < 0) return;
      jfoodTarget.grams = v;
      const m = k => food[k] * v / 100;
      const vals = panel.querySelectorAll('.kv span:last-child');
      if (vals.length >= 4){
        vals[0].textContent = Math.round(m('kcal')) + ' kcal';
        vals[1].textContent = m('protein').toFixed(1) + 'g';
        vals[2].textContent = m('carbs').toFixed(1) + 'g';
        vals[3].textContent = m('fat').toFixed(1) + 'g';
      }
    });
    const sw = document.getElementById('jfSwitchG');
    if (sw) sw.addEventListener('click', ()=>{
      jfoodTarget.freeGrams = true;
      jfoodTarget.pick = {food:{...food, unit:null}, slot};
      renderJournalFoodAmount();
    });

    document.getElementById('jfBack').addEventListener('click', ()=>{
      jfoodTarget.pick = null; jfoodTarget.freeGrams = false;
      panel.innerHTML = '';
      renderJournalFoodList(document.getElementById('jfoodSearch').value);
    });
    const addBtn = document.getElementById('jfAdd');
    if (jfoodTarget.editIndex != null) addBtn.textContent = 'SAVE THIS AMOUNT';
    addBtn.addEventListener('click', ()=>{
      addLibraryFoodToJournal(jfoodTarget.mealName, food, jfoodTarget.grams, jfoodTarget.editIndex);
      closeModal('modalJournalFood');
    });
  }

  function addLibraryFoodToJournal(mealName, food, grams, replaceIndex){
    const key = state.journalDate || todayKey();
    const log = dayLog(key);
    log.meals[mealName] = log.meals[mealName] || [];
    const mult = grams / 100;
    const ul = unitLabel(food, grams);
    const entry = {
      name: `${food.name} — ${ul ? ul + ' (' + grams.toFixed(0) + 'g)' : grams.toFixed(0) + 'g'}`,
      kcal: Math.round(food.kcal * mult),
      protein: +(food.protein * mult).toFixed(1),
      carbs: +(food.carbs * mult).toFixed(1),
      fat: +(food.fat * mult).toFixed(1),
      _food: food.key, _grams: grams,
    };
    if (replaceIndex != null && log.meals[mealName][replaceIndex]) log.meals[mealName][replaceIndex] = entry;
    else log.meals[mealName].push(entry);
    renderJournal();
    saveState();
  }

  /* Search box wiring for the journal food picker */
  (function wireJournalFoodSearch(){
    const box = document.getElementById('jfoodSearch');
    const clear = document.getElementById('jfoodClear');
    if (!box) return;
    box.addEventListener('input', ()=>{
      clear.style.display = box.value ? '' : 'none';
      if (jfoodTarget) jfoodTarget.pick = null;
      document.getElementById('jfoodPanel').innerHTML = '';
      renderJournalFoodList(box.value);
    });
    clear.addEventListener('click', ()=>{
      box.value = ''; clear.style.display = 'none';
      document.getElementById('jfoodPanel').innerHTML = '';
      renderJournalFoodList('');
      if (box.focus) box.focus();
    });
    document.getElementById('jfoodManual').addEventListener('click', ()=>{
      const mealName = jfoodTarget && jfoodTarget.mealName;
      closeModal('modalJournalFood');
      if (mealName) journalAddRow(mealName);
    });
  })();

  /* Change how much of an already-logged food you actually had */
  function openJournalAmountEditor(mealName, idx){
    const log = dayLog(state.journalDate || todayKey());
    const it = (log.meals[mealName] || [])[idx];
    if (!it || !it._food) return;
    const entry = foodIndex().find(x=>x.food.key === it._food);
    if (!entry) return;
    jfoodTarget = {mealName, pick:entry, grams: +it._grams || 100, editIndex: idx};
    document.getElementById('jfoodTitle').textContent = 'CHANGE AMOUNT';
    document.getElementById('jfoodSearch').value = '';
    document.getElementById('jfoodClear').style.display = 'none';
    document.getElementById('jfoodList').innerHTML = '';
    renderJournalFoodAmount();
    openModal('modalJournalFood');
  }

  /* An empty row the person fills in themselves */
  function journalAddRow(mealName){
    const key = state.journalDate || todayKey();
    const log = dayLog(key);
    log.meals[mealName] = log.meals[mealName] || [];
    log.meals[mealName].push({name:'', kcal:'', protein:'', carbs:'', fat:''});
    renderJournalEditor(mealName, log.meals[mealName].length - 1);
  }

  /* Pull a planned meal straight across, portions and all */
  function journalCopyFromPlan(mealKey, mealName){
    const key = state.journalDate || todayKey();
    const log = dayLog(key);
    log.meals[mealName] = log.meals[mealName] || [];
    const sel = state.selections[mealKey];
    if (!sel){
      // slot names may not line up — fall back to the meal in the same position
      const idx = journalSlots().findIndex(s2=>s2.name === mealName);
      const m = MEALS[idx];
      if (!m) return;
      mealKey = m.key;
    }
    const plan = computeMealPlan(mealKey);
    let added = 0;
    SLOT_DEFS.forEach(d=>{
      (state.selections[mealKey][d.slot] || []).forEach((k,i)=>{
        const g = plan[d.slot][i];
        if (!k || g == null) return;
        const f = d.list().find(x=>x.key === k);
        if (!f) return;
        const mult = g / 100;
        const ul = unitLabel(f, g);
        log.meals[mealName].push({
          name: `${f.name} — ${ul ? ul + ' (' + g.toFixed(0) + 'g)' : g.toFixed(0) + 'g'}`,
          kcal: Math.round(f.kcal * mult),
          protein: Math.round(f.protein * mult),
          carbs: Math.round(f.carbs * mult),
          fat: Math.round(f.fat * mult),
          _food: f.key, _grams: g,
        });
        added++;
      });
    });
    if (!added) log.meals[mealName].push({name:'(nothing planned for this meal)', kcal:0, protein:0, carbs:0, fat:0});
    renderJournal(); saveState();
  }

  /* Inline editor for a hand-entered item */
  function renderJournalEditor(mealName, idx){
    const key = state.journalDate || todayKey();
    const log = dayLog(key);
    const it = log.meals[mealName][idx];
    const wrap = document.getElementById('journalBody');
    const card = document.createElement('div');
    card.className = 'panel';
    card.innerHTML = `
      <div class="custom-head">
        <input type="text" class="custom-name" id="jeName" placeholder="What did you eat?" value="${escapeHtml(it.name||'')}">
      </div>
      <div class="custom-grid">
        <label>KCAL<input type="number" id="jeK" inputmode="numeric" value="${it.kcal||''}" placeholder="0"></label>
        <label>PROT<input type="number" id="jeP" inputmode="numeric" value="${it.protein||''}" placeholder="0"></label>
        <label>CARB<input type="number" id="jeC" inputmode="numeric" value="${it.carbs||''}" placeholder="0"></label>
        <label>FAT<input type="number" id="jeF" inputmode="numeric" value="${it.fat||''}" placeholder="0"></label>
      </div>
      <button class="btn-primary" id="jeSave" style="margin-top:12px;">SAVE TO ${escapeHtml(mealName)}</button>
      <button class="btn-ghost" id="jeCancel">CANCEL</button>`;
    wrap.prepend ? wrap.prepend(card) : wrap.insertBefore(card, wrap.firstChild);
    const nameEl = document.getElementById('jeName');
    if (nameEl && nameEl.focus) nameEl.focus();

    document.getElementById('jeSave').addEventListener('click', ()=>{
      const g = id => parseFloat((document.getElementById(id)||{}).value) || 0;
      it.name = (document.getElementById('jeName').value || '').trim() || 'Unnamed item';
      it.kcal = g('jeK'); it.protein = g('jeP'); it.carbs = g('jeC'); it.fat = g('jeF');
      renderJournal(); saveState();
    });
    document.getElementById('jeCancel').addEventListener('click', ()=>{
      log.meals[mealName].splice(idx, 1);
      renderJournal();
    });
  }

