'use strict';
/* ============================================================
   LOADOUT - SAVED MEALS

   A meal eaten often — the same breakfast most mornings, a post-gym shake —
   saved once from the meal's own sheet and logged again in one tap from
   the top of the add-food list.

   A saved meal is a copy of the entries as they were, not a reference to
   the foods: a later correction to the food table should not quietly
   change what a saved meal says it contains. Logging one copies its
   entries again, so editing the logged copy leaves the saved one alone.
   ============================================================ */

  function savedMeals(){
    if (!Array.isArray(state.savedMeals)) state.savedMeals = [];
    return state.savedMeals;
  }

  function cleanEntry(it){
    const out = {};
    Object.keys(it).forEach(k => {
      /* Pantry bookkeeping belongs to the day it happened on, and the plan
         marker would stop a logged copy from ever drawing on the pantry. */
      if (k === '_pantryTook' || k === '_fromPlan') return;
      out[k] = it[k];
    });
    return out;
  }

  /* Saves the meal under a name, replacing one of the same name. */
  function saveMealFrom(mealName, name){
    const log = dayLog(state.journalDate || todayKey());
    const items = (log.meals[mealName] || []).filter(it => it && it.name);
    if (!items.length) return false;
    const list = savedMeals();
    const label = (name || '').trim() || mealName.charAt(0) + mealName.slice(1).toLowerCase();
    const at = list.findIndex(m => m.name.toLowerCase() === label.toLowerCase());
    const meal = { id: Date.now().toString(36), name: label, items: items.map(cleanEntry) };
    if (at >= 0) list[at] = meal; else list.unshift(meal);
    saveState();
    return true;
  }

  function logSavedMeal(id, mealName){
    const meal = savedMeals().find(m => m.id === id);
    if (!meal) return false;
    const log = dayLog(state.journalDate || todayKey());
    log.meals[mealName] = (log.meals[mealName] || []).concat(meal.items.map(it => ({...it})));
    saveState();
    return true;
  }

  function deleteSavedMeal(id){
    state.savedMeals = savedMeals().filter(m => m.id !== id);
    saveState();
  }

  function savedMealsHtml(){
    const list = savedMeals();
    if (!list.length) return '';
    return `<div class="fp-group">${ic('star')} SAVED MEALS</div>` + list.map(m => {
      const kcal = m.items.reduce((a, i) => a + (+i.kcal || 0), 0);
      return `<div class="fp-saved">
        <button class="fp-row" data-jsaved="${m.id}">
          <span class="nm">${escapeHtml(m.name)}<small>${m.items.length} item${m.items.length === 1 ? '' : 's'}</small></span>
          <span class="kc">${Math.round(kcal)} kcal</span>
        </button>
        <button class="fp-saved-del" data-jsaved-del="${m.id}" aria-label="Delete saved meal ${escapeHtml(m.name)}"><svg class="px" aria-hidden="true"><use href="#i-close"></use></svg></button>
      </div>`;
    }).join('');
  }

  /* Wired by the add-food list each time it draws its empty state. */
  function wireSavedMeals(host, mealName, redraw){
    host.querySelectorAll('[data-jsaved]').forEach(b => b.addEventListener('click', ()=>{
      if (!logSavedMeal(b.getAttribute('data-jsaved'), mealName)) return;
      closeModal('modalJournalFood');
      renderJournal();
      if (typeof toast === 'function') toast('Saved meal logged', 'star');
    }));
    host.querySelectorAll('[data-jsaved-del]').forEach(b => b.addEventListener('click', ()=>{
      deleteSavedMeal(b.getAttribute('data-jsaved-del'));
      if (typeof redraw === 'function') redraw();
    }));
  }

  /* The form in the meal's sheet: a name, prefilled, and Save. */
  function openSaveMeal(mealName){
    const label = mealName.charAt(0) + mealName.slice(1).toLowerCase();
    openSimpleSheet('Save as a meal', `
      <label class="field-label">Name</label>
      <input type="text" id="ssMealName" value="${escapeHtml(label)}" autocomplete="off">
      <button class="btn-primary" data-ss-save style="margin-top:14px;">Save</button>`, body => {
      body.querySelector('[data-ss-save]').addEventListener('click', ()=>{
        if (saveMealFrom(mealName, document.getElementById('ssMealName').value)){
          closeModal('modalSimple');
          if (typeof toast === 'function') toast('Saved — it is at the top of Add food', 'star');
        }
      });
    });
  }
