'use strict';
/* ============================================================
   LOADOUT - LOGGING FROM THE WATCH

   A Watch has no keyboard worth typing a food name on, so it logs from what
   Loadout already knows: saved meals, recent foods at the amount last
   eaten, the dish the prep cooked for that meal, and a plain calorie
   quick-add. Each is something the person picks — nothing is logged on
   their behalf.

   watchOptions() is what the Watch is offered, carried in the summary the
   phone already sends it. applyWatchLog() is what happens when it picks
   one: the same functions the phone's own add-food sheet uses, so a meal
   logged from the wrist is indistinguishable from one logged here — the
   pantry is drawn down, the recents learn from it, and it can be edited on
   Today like anything else.

   Recents are offered with everything needed to log them, not by position
   in a list: the list can change between the moment it is sent and the
   moment it is tapped, and a position would then log the wrong food.
   ============================================================ */

  function mealLabel(name){
    return String(name).charAt(0) + String(name).slice(1).toLowerCase();
  }

  function watchOptions(){
    const key = todayKey();
    const slots = (typeof journalSlots === 'function' && journalSlots()) || [];
    const log = (state.log || {})[key] || {meals: {}};
    const planned = Object.values(state.selections || {})
      .some(sel => SLOT_DEFS.some(d => (sel[d.slot] || []).some(Boolean)));
    const meals = slots.map(sl => {
      const items = (log.meals || {})[sl.name] || [];
      const sel = planned && (state.selections || {})[sl.key];
      return {
        key: sl.key, name: sl.name, label: mealLabel(sl.name),
        kcal: Math.round(items.reduce((a, i) => a + (+i.kcal || 0), 0)),
        items: items.length,
        dish: (sel && sel.dish) || '',
      };
    });
    const saved = ((typeof savedMeals === 'function') ? savedMeals() : []).slice(0, 8).map(m => ({
      id: m.id, label: m.name,
      kcal: Math.round(m.items.reduce((a, i) => a + (+i.kcal || 0), 0)),
    }));
    const recents = ((typeof journalRecents === 'function') ? journalRecents(10) : []).map(r => {
      if (r.kind === 'food' && r.pick && r.pick.food && r.pick.food.key){
        const g = Math.round((r.grams || defaultLogGrams(r.pick.slot, r.pick.food)) * 10) / 10;
        return { kind: 'food', label: r.label, foodKey: r.pick.food.key, grams: g,
                 kcal: Math.round((+r.pick.food.kcal || 0) * g / 100) };
      }
      const e = r.entry || {};
      return { kind: 'entry', label: r.label,
               entry: { name: e.name, kcal: +e.kcal || 0, protein: +e.protein || 0, carbs: +e.carbs || 0, fat: +e.fat || 0 },
               kcal: Math.round(+e.kcal || 0) };
    }).filter(r => r.kcal >= 0 && r.label);
    return { meals, saved, recents };
  }

  /* One pick from the Watch, applied to the day it was made on. */
  function applyWatchLog(item){
    if (!item || !item.meal) return false;
    const key = item.day || todayKey();
    const keep = state.journalDate;
    state.journalDate = key;
    let done = false;
    try {
      if (item.kind === 'saved' && typeof logSavedMeal === 'function'){
        done = logSavedMeal(item.id, item.meal);
      } else if (item.kind === 'food'){
        const hit = foodIndex().find(x => x.food.key === item.foodKey);
        if (hit){ addLibraryFoodToJournal(item.meal, hit.food, +item.grams || 100); done = true; }
      } else if (item.kind === 'entry' && item.entry){
        const log = dayLog(key);
        log.meals[item.meal] = log.meals[item.meal] || [];
        const copy = Object.assign({}, item.entry);
        log.meals[item.meal].push(copy);
        if (typeof pantryTakeForEntry === 'function') pantryTakeForEntry(copy);
        done = true;
      } else if (item.kind === 'plan'){
        journalCopyFromPlan(item.mealKey, item.meal);
        done = true;
      } else if (item.kind === 'quick'){
        const kcal = Math.max(0, Math.round(+item.kcal || 0));
        if (kcal){
          const log = dayLog(key);
          log.meals[item.meal] = log.meals[item.meal] || [];
          log.meals[item.meal].push({ name: 'Quick add', kcal, protein: 0, carbs: 0, fat: 0, _quick: true });
          done = true;
        }
      }
    } finally {
      state.journalDate = keep;
    }
    if (done){ saveState(); }
    return done;
  }
