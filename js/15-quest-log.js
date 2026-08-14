'use strict';
/* ============================================================
   LOADOUT - QUEST LOG (calendar) + DAY LOG
   From app.js lines 7032-7252 of the original single file.
   Loaded in order by index.html; all files share one global scope,
   so declarations here are visible to every file listed after it.
   ============================================================ */

  /* =========================================================
     QUEST LOG — calendar
  ========================================================= */
  const DOW = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const MONTHS = ['January','February','March','April','May','June','July',
                  'August','September','October','November','December'];

  /* Monday-first index, since the week view starts on Monday */
  const mondayIndex = d => (d.getDay() + 6) % 7;

  function calCursor(){
    if (!state.calDate) state.calDate = todayKey();
    const [y,m,d] = state.calDate.split('-').map(Number);
    return new Date(y, m-1, d);
  }

  /* How full a logged day was, as a 0–3 band. The calendar is the only
     screen that shows many days at once, so it is the only place a person
     can see a pattern — a row of thin marks is a week of under-eating. That
     is worth more than a dot saying merely "something happened here". */
  function dayLevel(key){
    if (!dayHasEntries(key)) return 0;
    const tg = currentTargets();
    const got = dayTotals(key).kcal;
    if (!tg || !tg.kcal) return 2;
    const r = got / tg.kcal;
    return r < 0.55 ? 1 : r < 0.85 ? 2 : 3;
  }

  function renderCalendar(){
    const mode = state.calMode || 'month';
    document.getElementById('calMode').value = mode;
    const cur = calCursor();
    const grid = document.getElementById('calGrid');
    const title = document.getElementById('calTitle');
    const nowKey = todayKey();

    let cells = [];
    if (mode === 'week'){
      const start = new Date(cur);
      start.setDate(cur.getDate() - mondayIndex(cur));
      const end = new Date(start); end.setDate(start.getDate() + 6);
      title.textContent = start.getMonth() === end.getMonth()
        ? `${MONTHS[start.getMonth()]} ${start.getDate()}–${end.getDate()}`
        : `${MONTHS[start.getMonth()].slice(0,3)} ${start.getDate()} – ${MONTHS[end.getMonth()].slice(0,3)} ${end.getDate()}`;
      for (let i = 0; i < 7; i++){
        const d = new Date(start); d.setDate(start.getDate() + i);
        cells.push(d);
      }
    } else {
      title.textContent = `${MONTHS[cur.getMonth()]} ${cur.getFullYear()}`;
      const first = new Date(cur.getFullYear(), cur.getMonth(), 1);
      const lead = mondayIndex(first);
      const days = new Date(cur.getFullYear(), cur.getMonth()+1, 0).getDate();
      for (let i = 0; i < lead; i++) cells.push(null);
      for (let i = 1; i <= days; i++) cells.push(new Date(cur.getFullYear(), cur.getMonth(), i));
      // finish the last week, or the leftover grid reads as one merged block
      while (cells.length % 7) cells.push(null);
    }

    grid.className = 'cal-grid' + (mode === 'week' ? ' wk' : '');
    /* Both spellings ship; the material decides which one shows. A pixel
       grid has room for one letter, parchment has room for three. */
    grid.innerHTML = DOW.map(d=>`<div class="cal-dow"><i>${d.charAt(0)}</i><b>${d}</b></div>`).join('') +
      cells.map(d=>{
        if (!d) return '<div class="cal-cell blank"></div>';
        const key = todayKey(d);
        const cls = ['cal-cell'];
        if (mode === 'week') cls.push('week');
        if (key === nowKey) cls.push('today');
        if (key === state.calSel) cls.push('sel');
        if (key < nowKey) cls.push('past');
        if (key > nowKey) cls.push('future');
        const lv = dayLevel(key);
        const kc = (mode === 'week' && lv)
          ? `<span class="cal-kcal">${Math.round(dayTotals(key).kcal)}</span>` : '';
        return `<button class="${cls.join(' ')}" data-day="${key}" data-level="${lv}">
            <span class="cal-num">${d.getDate()}</span>${kc}
            <span class="cal-mark" aria-hidden="true"></span>
          </button>`;
      }).join('');

    grid.querySelectorAll('[data-day]').forEach(b=>b.addEventListener('click', ()=>{
      state.calSel = b.getAttribute('data-day');
      renderCalendar(); saveState();
    }));

    const logged = cells.filter(d=>d && dayHasEntries(todayKey(d))).length;
    const legend = `<span class="cal-legend">
        <i data-level="1"></i><i data-level="2"></i><i data-level="3"></i>
        <span>light &rarr; on target</span></span>`;
    document.getElementById('calNote').innerHTML = logged
      ? `<strong class="n-green">${logged}</strong> day${logged>1?'s':''} logged in this ${mode}. The bar under each day shows how close it came to your target. ${legend}`
      : `Nothing logged in this ${mode} yet. Days you log in the Journal fill in here. ${legend}`;

    renderCalDay();
  }

  function renderCalDay(){
    const host = document.getElementById('calDayPanel');
    const key = state.calSel;
    if (!key){ host.innerHTML = ''; return; }
    const t = dayTotals(key);
    const [y,m,d] = key.split('-').map(Number);
    const dt = new Date(y, m-1, d);
    const tg = currentTargets();
    const log = (state.log || {})[key];

    let rows = '';
    if (log && Object.keys(log.meals || {}).length){
      Object.entries(log.meals).forEach(([mealName, items])=>{
        if (!items || !items.length) return;
        rows += `<div class="nutri-group">${escapeHtml(mealName)}</div>` +
          items.map(it=>`<div class="jrow"><span class="jname">${escapeHtml(it.name)}</span>
            <span class="jkcal">${Math.round(+it.kcal||0)} kcal</span></div>`).join('');
      });
    }

    host.innerHTML = `<div class="panel">
      <div class="eaten-head">
        <span class="eaten-title">${DOW[mondayIndex(dt)]}, ${MONTHS[dt.getMonth()]} ${dt.getDate()}</span>
        <span class="eaten-total">${Math.round(t.kcal)} kcal</span>
      </div>
      ${t.items
        ? `<div class="kv"><span>Protein</span><span>${Math.round(t.protein)}g</span></div>
           <div class="kv"><span>Carbs</span><span>${Math.round(t.carbs)}g</span></div>
           <div class="kv"><span>Fat</span><span>${Math.round(t.fat)}g</span></div>
           <div class="kv"><span>Against target</span><span>${tg.kcal ? Math.round(t.kcal/tg.kcal*100) : 0}%</span></div>
           ${rows}`
        : '<div class="fav-nores">Nothing logged for this day.</div>'}
      <button class="btn-ghost" id="calOpenJournal" style="margin-top:14px;"><svg class="px" aria-hidden="true"><use href="#i-journal"></use></svg> Open this day in the Journal</button>
      <div class="paper-fx" aria-hidden="true"></div><div class="paper-edge" aria-hidden="true"></div>
    </div>`;

    document.getElementById('calOpenJournal').addEventListener('click', ()=>{
      state.journalDate = key;
      goTab('journal');
    });
  }

  /* =========================================================
     DAY LOG
     What was actually eaten, keyed by date. Kept separate from the plan:
     the plan is what you intend, the log is what happened.
  ========================================================= */
  const todayKey = (d)=>{
    const x = d || new Date();
    return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;
  };
  function dayLog(key){
    state.log = state.log || {};
    if (!state.log[key]) state.log[key] = {meals:{}};
    return state.log[key];
  }
  function dayTotals(key){
    const log = (state.log || {})[key];
    const out = {kcal:0, protein:0, carbs:0, fat:0, items:0};
    if (!log) return out;
    Object.values(log.meals || {}).forEach(list=>{
      (list || []).forEach(it=>{
        out.kcal    += (+it.kcal    || 0);
        out.protein += (+it.protein || 0);
        out.carbs   += (+it.carbs   || 0);
        out.fat     += (+it.fat     || 0);
        out.items++;
      });
    });
    return out;
  }
  function dayHasEntries(key){ return dayTotals(key).items > 0; }

  /* Meal slots for the journal — mirrors the prep plan when there is one */
  function journalSlots(){
    /* The journal mirrors the prep plan: change the roadmap from 3 meals to
       "2 + 2 snacks" and the journal follows, keeping the names and the
       calorie split in step. The manual fallback is only for people who
       haven't built a plan at all. */
    if (MEALS && MEALS.length && state.mealPlan){
      /* Snacks all share the name "SNACK", and the journal files entries by
         name — so without numbering, three snacks would collapse into one. */
      const seen = {};
      return MEALS.map(m=>{
        const base = m.name || m.label;
        seen[base] = (seen[base] || 0) + 1;
        const total = MEALS.filter(x=>(x.name || x.label) === base).length;
        const name = total > 1 ? `${base} ${seen[base]}` : base;
        return {key:m.key, name, share:m.share, planned:true};
      });
    }
    const n = state.journalMeals || 0;
    if (!n) return null;                       // ask first
    const names = ['BREAKFAST','LUNCH','DINNER'];
    return Array.from({length:n}, (_,i)=>({
      key:'j'+(i+1),
      name: n <= 3 ? names[i] : (i < 3 ? names[i] : 'SNACK 0'+(i-2)),
      share: 1/n,
      planned:false,
    }));
  }

  /* When the plan changes, entries filed under meals that no longer exist
     would silently vanish from the journal. Move them somewhere visible
     rather than losing what someone logged. */
  function reconcileJournalSlots(){
    const slots = journalSlots();
    if (!slots) return;
    const valid = new Set(slots.map(s2=>s2.name));
    Object.values(state.log || {}).forEach(day=>{
      Object.keys(day.meals || {}).forEach(name=>{
        if (valid.has(name)) return;
        const items = day.meals[name] || [];
        if (!items.length){ delete day.meals[name]; return; }
        const target = slots[0].name;
        day.meals[target] = (day.meals[target] || []).concat(
          items.map(it=>({...it, name: it.name + ' (was ' + name.toLowerCase() + ')'})));
        delete day.meals[name];
      });
    });
  }


