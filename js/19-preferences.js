'use strict';
/* ============================================================
   LOADOUT - SCREEN 2.5: FOOD PREFERENCES
   From app.js lines 8285-8377 of the original single file.
   Loaded in order by index.html; all files share one global scope,
   so declarations here are visible to every file listed after it.
   ============================================================ */

  /* =========================================================
     SCREEN 2.5: FOOD PREFERENCES
  ========================================================= */
  const prefGrids = ['prefEating','prefAllergy','prefExclude'].map(id=>document.getElementById(id));
  const btnConfirmPrefs = document.getElementById('btnConfirmPrefs');
  const btnSkipPrefs = document.getElementById('btnSkipPrefs');

  const prefSummary = document.getElementById('prefSummary');

  /* Rendered from data so the three groups stay in one place */
  const PREF_GROUPS = [
    {id:'prefEating', items:[
      ['vegetarian','Vegetarian','No meat, fish or shellfish'],
      ['vegan','Vegan','No animal products at all'],
      ['pescatarian','Pescatarian','Fish and seafood, no other meat'],
      ['wholefoods','Whole Foods Only','Skips powders and supplements']]},
    {id:'prefAllergy', items:[
      ['dairyfree','Dairy-Free','No milk, cheese or yogurt'],
      ['glutenfree','Gluten-Free','No wheat, barley or rye'],
      ['nutfree','Nut-Free','No tree nuts or peanuts'],
      ['eggfree','Egg-Free','No eggs or egg products'],
      ['soyfree','Soy-Free','No tofu, tempeh, edamame or soy sauce'],
      ['shellfishfree','Shellfish-Free','No shrimp, crab, lobster or scallops'],
      ['legumefree','Legume-Free','No beans, lentils, peanuts or peas'],
      ['nightshadefree','Nightshade-Free','No tomato, pepper, potato or eggplant']]},
    {id:'prefExclude', items:[
      ['porkfree','No Pork','Skips bacon, ham, chops and sausage'],
      ['redmeatfree','No Red Meat','Skips beef, pork, lamb and game'],
      ['poultryfree','No Poultry','Skips chicken, turkey and duck'],
      ['fishfree','No Fish/Seafood','Skips all fish and shellfish']]},
  ];

  function renderPrefs(){
    PREF_GROUPS.forEach(g=>{
      const host = document.getElementById(g.id);
      if (!host) return;
      host.innerHTML = g.items.map(([key,label,desc])=>
        `<button class="choice-btn${state.preferences.includes(key)?' selected':''}" data-pref="${key}">
           <span><strong>${label}</strong><span class="desc">${desc}</span></span></button>`).join('');
    });
    updatePrefSummary();
  }

  function updatePrefSummary(){
    const counts = {
      Protein: FOODS.protein.filter(passesPrefs).length,
      Carb:    FOODS.carbs.filter(passesPrefs).length,
      Fat:     FOODS.fat.filter(passesPrefs).length,
      Veg: FOODS.veg.filter(passesPrefs).length,
      Fruit: FOODS.fruit.filter(passesPrefs).length,
      Sauce: FOODS.sauce.filter(passesPrefs).length,
      Seasoning: FOODS.season.filter(passesPrefs).length,
    };
    const empty = Object.keys(counts).filter(k=>counts[k]===0);
    if (empty.length){
      prefSummary.textContent = `Heads up: no ${empty.join(" or ")} Blocks match these filters. Deselect one to reopen that slot.`;
      prefSummary.style.color = "var(--red)";
      return;
    }
    if (!state.preferences.length){
      const totalFoods = Object.values(FOODS).reduce((n,a)=>n + a.length, 0);
      prefSummary.textContent = `No filters set — all ${totalFoods} Food Blocks available.`;
      prefSummary.style.color = "var(--muted)";
      return;
    }
    prefSummary.textContent = `Available: ${counts.Protein} protein · ${counts.Carb} carb · ${counts.Fat} fat · ${counts.Veg} veg · ${counts.Fruit} fruit · ${counts.Sauce} sauce · ${counts.Seasoning} seasoning.`;
    prefSummary.style.color = "var(--green)";
  }

  PREF_GROUPS.forEach(g=>{
    const host = document.getElementById(g.id);
    if (!host) return;
    host.addEventListener('click', (e)=>{
      const btn = e.target.closest('.choice-btn');
      if (!btn) return;
      const key = btn.getAttribute('data-pref');
      const at = state.preferences.indexOf(key);
      if (at >= 0) state.preferences.splice(at, 1); else state.preferences.push(key);
      renderPrefs();
    });
  });

  btnConfirmPrefs.addEventListener('click', ()=>{
    renderCravings();
    showScreen('screen-cravings');
  });
  btnSkipPrefs.addEventListener('click', ()=>{
    state.preferences = [];
    renderPrefs();
    renderCravings();
    showScreen('screen-cravings');
  });

