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
    /* Now that any day can be opened, a fixed "Log Today" would be a plain
       lie on every other one. Shortened month: the heading is set in the
       display face at title size, where "Log September 24" wraps badly. */
    const jTitle = document.getElementById('journalTitle');
    if (jTitle){
      jTitle.textContent = isToday
        ? 'Log Today'
        : `Log ${MONTHS[dt.getMonth()].slice(0,3)} ${dt.getDate()}`;
    }
    renderJournalDateStrip();

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

         Where a prep spans several days the chips replace the toggle rather
         than joining it: the schedule already says which of those days are
         training, and each chip carries that mark, so choosing the day has
         already answered the question. Offering both would let the two
         disagree about the same day.

           no prep, split exists   -> toggle only
           multi-day prep, split   -> chips only
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
        ${prepDays <= 1 ? `<label class="field-label">WAS THIS A REST OR TRAINING DAY?</label>
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
                    (it._food || it._foodData) ? ` · <button class="amt-tap tiny" data-jamtedit="${escapeHtml(sl.name)}|${i}">change amount <svg class="px" aria-hidden="true"><use href="#i-edit"></use></svg></button>` : ''}</small>
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

      /* Choosing the day answers the rest-or-training question too, since
         the schedule already marks which prep days are training. Stamped
         against the date here because on a multi-day prep the toggle is not
         offered — without this the journal would forget what kind of day a
         past date had been. */
      log.dayKind = dayKindAt(dayIndex());

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
          ${unit.abstract ? '' : `<div class="amt-grams">= <strong>${g.toFixed(0)}</strong>g
            <button class="text-link" id="jfSwitchG" style="display:inline; width:auto; margin:0 0 0 8px; padding:0; font-size:12px;">set grams instead</button>
          </div>`}
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
    const entry = {
      name: `${food.name} — ${amountText(food, grams)}`,
      kcal: Math.round(food.kcal * mult),
      protein: +(food.protein * mult).toFixed(1),
      carbs: +(food.carbs * mult).toFixed(1),
      fat: +(food.fat * mult).toFixed(1),
      _food: food.key, _grams: grams,
      /* A scanned or searched product is not in the library and has no key to
         look one up by, so the food travels with the entry. Without this the
         amount editor below bails out and a logged product can never be
         corrected — the one thing every other logged food allows. */
      _foodData: food.key ? undefined : food,
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
      /* Falls back to the bare row if the form is somehow not loaded, so the
         button can never become a dead end. */
      if (!mealName) return;
      if (typeof openCustomFood === 'function') openCustomFood({mode:'journal', mealName});
      else journalAddRow(mealName);
    });
  })();

  /* Change how much of an already-logged food you actually had */
  function openJournalAmountEditor(mealName, idx){
    const log = dayLog(state.journalDate || todayKey());
    const it = (log.meals[mealName] || [])[idx];
    if (!it) return;
    /* Library foods resolve through the index, so a corrected table reaches
       an old entry. A scanned one carries its own copy instead. */
    const entry = it._food
      ? foodIndex().find(x=>x.food.key === it._food)
      : (it._foodData ? {food: it._foodData, slot: 'protein'} : null);
    if (!entry) return;
    jfoodTarget = {mealName, pick:entry, grams: +it._grams || 100, editIndex: idx,
                   freeGrams: !entry.food.unit};
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
        log.meals[mealName].push({
          name: `${f.name} — ${amountText(f, g)}`,
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

  /* Which hand-entry editor is open, and on which day. The editor pushes a
     blank row into the log and then fills it in from the DOM, so an editor
     left open when the date changes is the one thing that can write onto the
     wrong day — state.log itself is already keyed by date and cannot leak. */
  let jEditing = null;

  /* Called before any day change. Anything actually typed is kept, on the day
     it was typed on; an untouched blank row is dropped the way CANCEL drops
     it, so swiping away from an empty editor does not litter the log. */
  function commitOrDiscardJournalEditor(){
    if (!jEditing) return;
    const {mealName, idx, key} = jEditing;
    jEditing = null;
    const day = (state.log || {})[key];
    const row = day && day.meals && day.meals[mealName] && day.meals[mealName][idx];
    if (!row) return;
    const val = id => { const el = document.getElementById(id); return el ? el.value : ''; };
    const num = id => parseFloat(val(id)) || 0;
    const name = (val('jeName') || '').trim();
    const k = num('jeK'), pr = num('jeP'), c = num('jeC'), f = num('jeF');
    if (!name && !k && !pr && !c && !f){
      day.meals[mealName].splice(idx, 1);       // nothing was entered
      return;
    }
    row.name = name || 'Unnamed item';
    row.kcal = k; row.protein = pr; row.carbs = c; row.fat = f;
  }

  /* Inline editor for a hand-entered item */
  function renderJournalEditor(mealName, idx){
    const key = state.journalDate || todayKey();
    jEditing = {mealName, idx, key};
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
      jEditing = null;
      const g = id => parseFloat((document.getElementById(id)||{}).value) || 0;
      it.name = (document.getElementById('jeName').value || '').trim() || 'Unnamed item';
      it.kcal = g('jeK'); it.protein = g('jeP'); it.carbs = g('jeC'); it.fat = g('jeF');
      renderJournal(); saveState();
    });
    document.getElementById('jeCancel').addEventListener('click', ()=>{
      jEditing = null;
      log.meals[mealName].splice(idx, 1);
      renderJournal();
    });
  }


  /* ---------------------------------------------------------
     THE DAY PICKER
     One function selects a day. The strip, the arrows, the swipe and the
     quest-log calendar all go through it, because the failure mode of two
     doors is that they drift: one sets state.journalDate, the other also
     moves the calendar's cursor, and after a while the two screens disagree
     about which day you are looking at.
  --------------------------------------------------------- */
  function journalDayHasEntries(key){
    /* Reads state.log directly rather than through dayLog(), which CREATES a
       day when asked about one — building the strip through it would seed an
       empty record for every date on screen. */
    const day = (state.log || {})[key];
    if (!day || !day.meals) return false;
    return Object.keys(day.meals).some(m => (day.meals[m] || []).length);
  }

  function journalShiftKey(key, delta){
    const [y, m, d] = key.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + delta);     // handles month and year ends itself
    return todayKey(dt);
  }

  /* THE door. Everything that changes the journal's day comes through here. */
  /* Any date, forwards or backwards. The journal is not only a record of what
     was eaten — planning tomorrow, or logging a meal you have already decided
     on, is a normal thing to want, so there is no wall at today. Today is
     still marked in the strip so it never gets lost. */
  function selectJournalDay(key){
    if (!key) return;
    commitOrDiscardJournalEditor();       // before the date moves, never after
    state.journalDate = key;
    /* Kept in step so the calendar opens on the day the journal is showing. */
    state.calSel  = key;
    state.calDate = key;
    renderJournal();
    if (typeof renderCalendar === 'function') renderCalendar();
    saveState();
  }

  function journalDayShift(delta){
    selectJournalDay(journalShiftKey(state.journalDate || todayKey(), delta));
  }

  /* The journal opens on today whenever it is reached from the tab bar. It is
     the day you are almost always logging, and coming back to find it still
     parked on whatever you were reading last week is a trap — you start typing
     breakfast onto the wrong date. The calendar's "open this day" route goes
     straight to goTab() instead, so it keeps the date it was asked for. */
  function resetJournalToToday(){
    selectJournalDay(todayKey());
  }

  /* A window around the selected day rather than a fixed range: the strip has
     to contain whatever is selected however far back you have walked, without
     growing a chip for every day since. */
  const JSTRIP_BACK = 10, JSTRIP_FWD = 10;

  function renderJournalDateStrip(){
    const strip = document.getElementById('journalDateStrip');
    if (!strip) return;
    const sel = state.journalDate || todayKey();
    const today = todayKey();

    let cursor = journalShiftKey(sel, -JSTRIP_BACK);
    const last = journalShiftKey(sel, JSTRIP_FWD);

    let html = '';
    for (let guard = 0; guard < 64 && cursor <= last; guard++){
      const [y, m, d] = cursor.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      const cls = 'day-chip'
        + (cursor === sel ? ' on' : '')
        + (cursor === today ? ' today' : '')
        + (journalDayHasEntries(cursor) ? ' has' : '');
      html += `<button class="${cls}${cursor > today ? ' ahead' : ''}" data-jdate="${cursor}"
          aria-label="${DOW[mondayIndex(dt)]} ${MONTHS[dt.getMonth()]} ${dt.getDate()}"
          aria-current="${cursor === sel ? 'date' : 'false'}">
          <span class="date-chip-dw">${DOW[mondayIndex(dt)].slice(0,3).toUpperCase()}</span>
          <span class="date-chip-dn">${dt.getDate()}</span>
          <span class="date-chip-dot" aria-hidden="true"></span>
        </button>`;
      cursor = journalShiftKey(cursor, 1);
    }
    strip.innerHTML = html;

    strip.querySelectorAll('[data-jdate]').forEach(b=>b.addEventListener('click', ()=>{
      selectJournalDay(b.getAttribute('data-jdate'));
    }));

    /* Centre the selection by setting scrollLeft rather than calling
       scrollIntoView, which would also scroll the PAGE to reach it. */
    const on = strip.querySelector('.day-chip.on');
    if (on) strip.scrollLeft = on.offsetLeft - (strip.clientWidth - on.offsetWidth) / 2;

  }

  (function(){
    const prev = document.getElementById('jDatePrev');
    const next = document.getElementById('jDateNext');
    if (prev) prev.addEventListener('click', ()=> journalDayShift(-1));
    if (next) next.addEventListener('click', ()=> journalDayShift(1));
  })();

  /* ---------------------------------------------------------
     SWIPING BETWEEN DAYS
     The journal's date could only be changed from the calendar, which is a
     long way round for "what did I eat yesterday". A horizontal swipe moves
     it, following the direction the page itself would move: dragging RIGHT
     pulls yesterday in from the left, dragging LEFT brings tomorrow in from
     the right.

     Exactly one day per gesture, whatever the distance. A fling and a flick
     both move a single day, so you can never overshoot the date you were
     aiming for — and because the step is taken on touchend, a long drag
     cannot ratchet through a week on the way past.
  --------------------------------------------------------- */
  const JSWIPE_MIN_X   = 55;   // shorter than this is a tap or a jitter
  const JSWIPE_MAX_Y   = 45;   // drifted too far vertically to be a sideways swipe
  const JSWIPE_RATIO   = 1.4;  // and must be clearly more sideways than up-down

  (function(){
    const screen = document.getElementById('screen-journal');
    if (!screen) return;

    let sx = 0, sy = 0, tracking = false;

    /* A gesture that starts on something the person is aiming at — a field,
       a button, a strip that scrolls sideways on its own — belongs to that
       control, not to the date. */
    function startsOnItsOwnControl(target){
      return !!(target.closest &&
        target.closest('input, textarea, select, button, a, [contenteditable], .day-strip'));
    }

    screen.addEventListener('touchstart', function(e){
      // a second finger means a pinch or a scroll, never a day change
      if (!e.touches || e.touches.length !== 1){ tracking = false; return; }
      if (startsOnItsOwnControl(e.target)){ tracking = false; return; }
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
      tracking = true;
    }, {passive: true});

    screen.addEventListener('touchmove', function(e){
      // a finger that became two mid-drag is no longer a swipe
      if (e.touches && e.touches.length > 1) tracking = false;
    }, {passive: true});

    screen.addEventListener('touchcancel', function(){ tracking = false; }, {passive: true});

    screen.addEventListener('touchend', function(e){
      if (!tracking) return;
      tracking = false;
      if (!screen.classList.contains('active')) return;
      const t = e.changedTouches && e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - sx;
      const dy = t.clientY - sy;
      if (Math.abs(dx) < JSWIPE_MIN_X) return;
      if (Math.abs(dy) > JSWIPE_MAX_Y) return;
      if (Math.abs(dx) < Math.abs(dy) * JSWIPE_RATIO) return;
      /* Math.sign, not the distance: one swipe is one day. Through the same
         door as the arrows and the calendar, so it obeys the same clamp. */
      journalDayShift(dx > 0 ? -1 : 1);
    }, {passive: true});
  })();
