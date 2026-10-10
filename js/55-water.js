'use strict';
/* ============================================================
   LOADOUT - WATER

   A running count of what was drunk today, kept on the day's log beside
   the meals so the calendar, the check-in and an export all see it.

   Stored in millilitres whatever the units, and converted at the edges,
   the same way weight is stored in pounds: one internal unit is the only
   version of this that cannot change a history's meaning when somebody
   flips a switch. A glass is 250 ml in metric and 8 fl oz in imperial,
   and the + and − step by one glass.

   Also home to openSimpleSheet(), the one small sheet the new trackers
   share for their forms.
   ============================================================ */

  const ML_PER_FLOZ = 29.5735;

  function waterUnits(){
    const imperial = (state.units || 'imperial') === 'imperial';
    return imperial
      ? { glass: 8 * ML_PER_FLOZ, show: ml => Math.round(ml / ML_PER_FLOZ) + '', unit: 'fl oz',
          goalStep: 8 * ML_PER_FLOZ, defaultGoal: 64 * ML_PER_FLOZ }
      : { glass: 250, show: ml => String(+(ml / 1000).toFixed(2)), unit: 'L',
          goalStep: 250, defaultGoal: 2000 };
  }

  function waterGoalMl(){
    const u = waterUnits();
    return state.waterGoalMl > 0 ? state.waterGoalMl : u.defaultGoal;
  }

  function waterOn(key){
    const day = (state.log || {})[key];
    return (day && +day.water > 0) ? +day.water : 0;
  }

  function addWater(key, glasses){
    const u = waterUnits();
    const log = dayLog(key);
    log.water = Math.max(0, Math.round((+log.water || 0) + glasses * u.glass));
    saveState();
  }

  /* One row inside Today's top card: what was drunk, against the goal, with
     a glass either way. The goal reads as a link because it is one. */
  function waterRowHtml(key){
    const u = waterUnits();
    const have = waterOn(key), goal = waterGoalMl();
    const done = have >= goal;
    return `<div class="jwater${done ? ' done' : ''}">
      <span class="jwater-ic" aria-hidden="true"><svg class="px"><use href="#i-droplet"></use></svg></span>
      <span class="jwater-v"><strong>${u.show(have)}</strong>
        <button class="jwater-goal" data-water-goal aria-label="Change water goal">of ${u.show(goal)} ${u.unit}</button></span>
      <button class="jwater-btn" data-water="-1" aria-label="One glass less"${have ? '' : ' disabled'}>−</button>
      <button class="jwater-btn add" data-water="1" aria-label="One glass more">+</button>
    </div>`;
  }

  function wireWater(root, key){
    root.querySelectorAll('[data-water]').forEach(b => b.addEventListener('click', ()=>{
      addWater(key, parseInt(b.getAttribute('data-water'), 10));
      renderJournal();
    }));
    const g = root.querySelector('[data-water-goal]');
    if (g) g.addEventListener('click', openWaterGoal);
  }

  function openWaterGoal(){
    const u = waterUnits();
    let goal = waterGoalMl();
    const draw = ()=>`
      <div class="ss-stepper">
        <button class="ss-step" data-ss-step="-1" aria-label="Less">−</button>
        <span class="ss-val"><strong>${u.show(goal)}</strong> ${u.unit} a day</span>
        <button class="ss-step" data-ss-step="1" aria-label="More">+</button>
      </div>
      <button class="btn-primary" data-ss-save>Save</button>`;
    openSimpleSheet('Water goal', draw(), function wire(body){
      body.querySelectorAll('[data-ss-step]').forEach(b => b.addEventListener('click', ()=>{
        goal = Math.max(u.goalStep * 2, goal + parseInt(b.getAttribute('data-ss-step'), 10) * u.goalStep);
        body.innerHTML = draw(); wire(body);
      }));
      body.querySelector('[data-ss-save]').addEventListener('click', ()=>{
        state.waterGoalMl = Math.round(goal);
        saveState(); closeModal('modalSimple'); renderJournal();
      });
    });
  }

  /* ---- the shared sheet --------------------------------------------------
     A title, a body and a wiring callback. Each tracker draws its own form
     into it rather than every form carrying a modal of its own. */
  function openSimpleSheet(title, html, wire){
    document.getElementById('simpleTitle').textContent = title;
    const body = document.getElementById('simpleBody');
    body.innerHTML = html;
    if (typeof wire === 'function') wire(body);
    openModal('modalSimple');
  }
