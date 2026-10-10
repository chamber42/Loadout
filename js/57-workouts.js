'use strict';
/* ============================================================
   LOADOUT - WORKOUTS

   A record of the sessions themselves. Training days have always carried
   a calorie figure for the session; until now nothing said what the
   session was, so there was no history of training at all.

   Two sources, kept apart:

     logged here   — what the person typed: kind, a name, minutes, notes.
                     Stored on the day's log beside the meals.
     from Health   — what a Watch or another app recorded. Read, like steps,
                     and never copied into the save file: it belongs to
                     Health and would go stale the moment it was edited there.

   Neither one changes the day's targets. Whether a day is a training day
   stays the person's call on Today, and the session burn stays what they
   set on their profile — a record of training is not a reason to move
   the calories under somebody's feet.
   ============================================================ */

  const WORKOUT_KINDS = [['strength', 'Strength'], ['cardio', 'Cardio'], ['other', 'Other']];
  const WORKOUT_ICON = { strength: 'lift', cardio: 'run', other: 'bolt' };

  let hkWorkouts = [];          // newest first, from Health

  function hkPlugin(){
    const cap = window.Capacitor;
    return (cap && cap.Plugins && cap.Plugins.HealthKit) || null;
  }

  function loggedWorkouts(key){
    const day = (state.log || {})[key];
    return (day && Array.isArray(day.workouts)) ? day.workouts : [];
  }

  /* Everything on a day, both sources, in one list. */
  function workoutsOn(key){
    const own = loggedWorkouts(key).map(w => ({...w, source: 'you'}));
    const hk  = hkWorkouts.filter(w => w.day === key).map(w => ({...w, source: 'health'}));
    return own.concat(hk);
  }

  /* readOnly: a row in the history, which is for reading, not editing */
  function workoutRow(w, i, readOnly){
    const meta = [w.minutes ? w.minutes + ' min' : '', w.kcal ? w.kcal + ' kcal' : '',
                  w.source === 'health' ? 'from Health' : ''].filter(Boolean).join(' · ');
    const inner = `<span class="wk-ic" aria-hidden="true"><svg class="px"><use href="#i-${WORKOUT_ICON[w.kind] || 'bolt'}"></use></svg></span>
      <span class="wk-t"><span class="wk-n">${escapeHtml(w.name || (WORKOUT_KINDS.find(k => k[0] === w.kind) || [0, 'Workout'])[1])}</span>
        ${meta ? `<small>${meta}</small>` : ''}${w.notes ? `<small class="wk-notes">${escapeHtml(w.notes)}</small>` : ''}</span>`;
    return (w.source === 'you' && !readOnly)
      ? `<button class="wk-row" data-wk-edit="${i}">${inner}<svg class="px jname-ed" aria-hidden="true"><use href="#i-edit"></use></svg></button>`
      : `<div class="wk-row">${inner}</div>`;
  }

  /* Today's card: the sessions, and one way to add another. */
  function workoutCardHtml(key){
    const list = workoutsOn(key);
    const own = loggedWorkouts(key);
    return `<div class="panel wk-card">
      <div class="jnode-head">
        <span class="jmeal-name wk-title">Workout</span>
        <span class="jmeal-kcal">${list.length ? list.length + ' logged' : ''}</span>
        <button class="jmeal-add" data-wk-add aria-label="Log a workout"><svg class="px" aria-hidden="true"><use href="#i-plus"></use></svg></button>
      </div>
      ${list.map(w => workoutRow(w, w.source === 'you' ? own.indexOf(own.find(o => o.id === w.id)) : -1)).join('')}
    </div>`;
  }

  function wireWorkouts(root, key){
    const add = root.querySelector('[data-wk-add]');
    if (add) add.addEventListener('click', ()=> openWorkoutForm(key, -1));
    root.querySelectorAll('[data-wk-edit]').forEach(b => b.addEventListener('click', ()=>
      openWorkoutForm(key, parseInt(b.getAttribute('data-wk-edit'), 10))));
  }

  /* ---- the form ---------------------------------------------------------- */
  function openWorkoutForm(key, idx){
    const own = loggedWorkouts(key);
    const was = idx >= 0 ? own[idx] : null;
    let kind = was ? was.kind : 'strength';
    const draw = ()=>`
      <div class="seg">${WORKOUT_KINDS.map(([k, l]) =>
        `<button class="${k === kind ? 'on' : ''}" data-wk-kind="${k}">${l}</button>`).join('')}</div>
      <label class="field-label" style="margin-top:16px;">Name</label>
      <input type="text" id="wkName" placeholder="${kind === 'strength' ? 'e.g. Push day' : kind === 'cardio' ? 'e.g. Treadmill' : 'e.g. Football'}"
             value="${escapeHtml(was ? was.name || '' : '')}" autocomplete="off">
      <label class="field-label" style="margin-top:14px;">Minutes</label>
      <input type="number" id="wkMin" inputmode="numeric" min="0" placeholder="60" value="${was && was.minutes ? was.minutes : ''}">
      <label class="field-label" style="margin-top:14px;">Notes</label>
      <textarea id="wkNotes" rows="3" placeholder="Lifts, sets, how it went">${escapeHtml(was ? was.notes || '' : '')}</textarea>
      <button class="btn-primary" data-ss-save style="margin-top:16px;">${was ? 'Save changes' : 'Log workout'}</button>
      ${was ? '<button class="text-link danger-link" data-ss-del>Delete this workout</button>' : ''}`;
    openSimpleSheet(was ? 'Edit workout' : 'Log a workout', draw(), function wire(body){
      body.querySelectorAll('[data-wk-kind]').forEach(b => b.addEventListener('click', ()=>{
        /* Keep what was typed while switching kind */
        const keep = { n: body.querySelector('#wkName').value, m: body.querySelector('#wkMin').value, t: body.querySelector('#wkNotes').value };
        kind = b.getAttribute('data-wk-kind');
        body.innerHTML = draw(); wire(body);
        body.querySelector('#wkName').value = keep.n; body.querySelector('#wkMin').value = keep.m; body.querySelector('#wkNotes').value = keep.t;
      }));
      body.querySelector('[data-ss-save]').addEventListener('click', ()=>{
        const entry = {
          id: was ? was.id : Date.now().toString(36),
          kind,
          name: body.querySelector('#wkName').value.trim(),
          minutes: Math.max(0, parseInt(body.querySelector('#wkMin').value, 10) || 0),
          notes: body.querySelector('#wkNotes').value.trim(),
        };
        const log = dayLog(key);
        log.workouts = Array.isArray(log.workouts) ? log.workouts : [];
        if (was) log.workouts[idx] = entry; else log.workouts.push(entry);
        saveState(); closeModal('modalSimple'); refreshWorkoutViews();
      });
      const del = body.querySelector('[data-ss-del]');
      if (del) del.addEventListener('click', ()=>{
        const log = dayLog(key);
        log.workouts.splice(idx, 1);
        saveState(); closeModal('modalSimple'); refreshWorkoutViews();
      });
    });
  }

  function refreshWorkoutViews(){
    if (typeof renderJournal === 'function') renderJournal();
    renderWorkoutHistory();
  }

  /* ---- history, on Progress --------------------------------------------- */
  function allWorkouts(){
    const out = [];
    Object.keys(state.log || {}).forEach(k => loggedWorkouts(k).forEach(w => out.push({...w, day: k, source: 'you'})));
    hkWorkouts.forEach(w => out.push({...w, source: 'health'}));
    return out.sort((a, b) => (b.day + (b.start || '')).localeCompare(a.day + (a.start || '')));
  }

  function renderWorkoutHistory(){
    const host = document.getElementById('workoutHistory');
    if (!host) return;
    const list = allWorkouts();
    const now = new Date();
    const monthKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    const thisMonth = list.filter(w => w.day.slice(0, 7) === monthKey).length;
    const hk = hkPlugin();
    const offerHealth = hk && !state.healthWorkouts;
    host.innerHTML = `
      <div class="wk-sum"><strong>${thisMonth}</strong> session${thisMonth === 1 ? '' : 's'} this month</div>
      ${list.length ? list.slice(0, 8).map(w => `<div class="wk-hist">
          <span class="wk-day">${shortDay(w.day)}</span>${workoutRow(w, -1, true)}
        </div>`).join('')
        : '<div class="jm-empty">No workouts yet. Log one on Today.</div>'}
      ${offerHealth ? '<button class="text-link" id="wkConnect">Bring in workouts from Health</button>' : ''}`;
    const c = document.getElementById('wkConnect');
    if (c) c.addEventListener('click', ()=>{
      hk.requestWorkoutAuthorization().then(()=>{
        state.healthWorkouts = true; saveState();
        return readHealthWorkouts();
      }).catch(()=>{});
    });
  }

  function shortDay(key){
    const p = key.split('-').map(Number), d = new Date(p[0], p[1] - 1, p[2]);
    return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()] + ' ' + d.getDate();
  }

  function readHealthWorkouts(){
    const hk = hkPlugin();
    if (!hk || !hk.readWorkouts) return Promise.resolve();
    return hk.readWorkouts().then(res => {
      hkWorkouts = (res && Array.isArray(res.workouts)) ? res.workouts : [];
      refreshWorkoutViews();
    }).catch(()=>{});
  }

  /* Read quietly at launch and on return to the app, but only once the
     person has asked for Health workouts — never as a surprise prompt. */
  if (state.healthWorkouts) readHealthWorkouts();
  document.addEventListener('visibilitychange', ()=>{
    if (document.visibilityState === 'visible' && state.healthWorkouts) readHealthWorkouts();
  });
