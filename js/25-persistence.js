'use strict';
/* ============================================================
   LOADOUT - PERSISTENCE
   From app.js lines 12821-12937 of the original single file.
   Loaded in order by index.html; all files share one global scope,
   so declarations here are visible to every file listed after it.
   ============================================================ */

  /* =========================================================
     PERSISTENCE
     Everything is kept in the browser on the device — nothing is uploaded.
     Wrapped in try/catch because private-browsing modes and some embedded
     viewers block storage entirely; when that happens the app simply runs
     without saving rather than breaking.
  ========================================================= */
  const SAVE_KEY = 'gfl.state.v1';
  const SAVE_FIELDS = ['theme','mode','directKcal','directP','directC','directF','goal',
    'activity','sex','bodyweight','heightIn','age','exerciseMode','exerciseRaw','exerciseKcal',
    'tdee','finalKcal','restKcal','trainKcal','trainingDays','sheetDayView',
    'assignedTierId','selectedTierId','preferences','cravings','mealCount',
    'favorites','discoveryMode','dislikes','mustUse','mustQty','eatingStyle','selections',
    'mealPlan','mealWeights','skipBreakfast','breakfastForDinner','breakfastAllDay',
    'uniqueMeals','uniqueSnacks','prep','activeDay','portionOverrides','variety',
    'log','journalMeals','calMode','calSel','calDate',
    'eaten','prepServings','pantry','cupboard','customFoods'];

  let saveTimer = null;
  /* Whether the last attempt to write to storage failed. Read by nothing yet;
     the honest next step is telling the person, rather than letting them
     believe a day was recorded when it was not. */
  let saveBroken = false;
  function saveState(){
    clearTimeout(saveTimer);
    saveTimer = setTimeout(()=>{
      /* Deliberately outside the storage try/catch below. This used to sit
         inside it, so any bug in the write-back — or in any of the day and
         portion maths it calls — threw before localStorage was ever reached
         and silently disabled saving for the rest of the session, reported by
         that catch as "storage unavailable". A failure here should cost the
         active day's edits, not the entire save. */
      try{
        // whatever the loadout screen is showing belongs to a dish, not a day
        writeBackActiveDay();
      }catch(e){
        console.error('Loadout: writing back the active day failed; saving the rest anyway', e);
      }
      try{
        const out = {};
        SAVE_FIELDS.forEach(k => { if (state[k] !== undefined) out[k] = state[k]; });
        out._savedAt = Date.now();
        localStorage.setItem(SAVE_KEY, JSON.stringify(out));
        saveBroken = false;
      }catch(e){
        /* Genuinely unable to store: private browsing, a blocked embedded
           viewer, or a full quota. Logged rather than swallowed, because the
           alternative is a person who thinks their day is saved and finds it
           gone. */
        saveBroken = true;
        console.error('Loadout: could not save state', e);
      }
    }, 400);
  }

  /* Plans saved before the split existed hold ONE number, whose meaning
     depended on a rest/exercise toggle that no longer exists. Unpick it:
       - saved on an exercise day → that number was base + training
       - saved on a rest day      → that number was the base, and the burn
                                    was zeroed out, so nothing can be recovered
     Either way the person lands on a coherent pair rather than a target that
     silently means something different from what it used to. */
  /* Seasonings used to live in the sauce list, so an older saved plan can
     hold something like "blackpepper" in a sauce slot. It is no longer a
     portionable sauce, so drop it rather than leave a slot that resolves to
     nothing. The dish's own "season with" line still names it. */
  function migrateSeasonings(){
    const seasonKeys = new Set(FOODS.season.map(f=>f.key));
    Object.values(state.selections || {}).forEach(sel=>{
      if (!sel || !Array.isArray(sel.sauce)) return;
      sel.sauce = sel.sauce.filter(k=>!seasonKeys.has(k));
    });
    /* state.prep.days is a COUNT; the dishes live in .meals and .snacks. */
    const prep = state.prep || {};
    [].concat(prep.meals || [], prep.snacks || []).forEach(sel=>{
      if (sel && Array.isArray(sel.sauce)) sel.sauce = sel.sauce.filter(k=>!seasonKeys.has(k));
    });
    ['favorites','dislikes','mustUse'].forEach(k=>{
      if (Array.isArray(state[k])) state[k] = state[k].filter(x=>!seasonKeys.has(x));
    });
  }

  function migrateDayType(data){
    if (state.restKcal != null) return;          // already on the new model
    const saved = Math.round(state.finalKcal || 0);
    if (!saved){ return; }
    const ex = Math.round(state.exerciseKcal || 0);
    if (state.mode === 'calc' && data.dayType === 'exercise' && ex > 0){
      state.restKcal  = Math.max(saved - ex, 0);
      state.trainKcal = saved;
      state.finalKcal = state.restKcal;
      // they were already training — assume the whole prep was training days
      state.trainingDays = Math.max(1, state.prepServings || 1);
    } else {
      state.restKcal  = saved;
      state.trainKcal = saved + ex;
      state.trainingDays = 0;
      if (!ex) state.exerciseMode = 'none';
    }
    if (state.exerciseMode === 'custom' && state.exerciseRaw == null && ex > 0){
      state.exerciseRaw = Math.round(ex / creditRate());
    }
    // stamp the existing schedule so the prep and the new model agree
    if (state.prep && Array.isArray(state.prep.schedule)){
      const kinds = dayKinds();
      state.prep.schedule.forEach((row, d)=>{ if (!row.kind) row.kind = kinds[d] || 'rest'; });
      state.prep.trainingDays = state.prep.schedule.filter(r=>r.kind === 'train').length;
    }
  }

  function loadState(){
    try{
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      SAVE_FIELDS.forEach(k => { if (data[k] !== undefined) state[k] = data[k]; });
      /* Before anything reads a selection: a saved day can name a scanned
         product, and until it is back in its slot's list that key resolves
         to nothing and the slot renders empty. */
      mergeCustomFoods();
      migrateDayType(data);
      migrateSeasonings();
      // after migrateDayType: it is what decides whether this prep has a split
      migratePortionOverrides();
      // meal flags have to be restored before the meals are rebuilt
      MEAL_FLAGS.skipBreakfast = !!state.skipBreakfast;
      MEAL_FLAGS.mealWeights = state.mealWeights || {};
      MEALS = buildMeals(state.mealPlan || '3+1');
      state.mealCount = MEALS.length;
      state.portionOverrides = state.portionOverrides || {};
      // rebuild the working copy from the saved prep so both stay in step
      if (prepReady()) applyDayToSelections(state.activeDay || 1);
      return !!(state.finalKcal && state.assignedTierId);
    }catch(e){ return false; }
  }

  /* Returns a promise: on native there is a backup file to delete as well,
     and the caller must not reload until that has actually happened.

     The pending save has to be cancelled first. Every click schedules one
     400ms out, including the click that started the wipe — so without this
     the debounced save fires after the key was removed and quietly writes
     the whole state back. */
  function clearSaved(){
    clearTimeout(saveTimer);
    try{ localStorage.removeItem(SAVE_KEY); }catch(e){}
    if (typeof clearNativeBackup === 'function'){
      return Promise.resolve(clearNativeBackup()).catch(function(){});
    }
    return Promise.resolve();
  }

  /* Any interaction is worth persisting — cheap, and debounced above */
  document.addEventListener('change', saveState, true);
  document.addEventListener('input', saveState, true);
  document.addEventListener('click', saveState, true);

