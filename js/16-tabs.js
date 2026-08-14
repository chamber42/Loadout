'use strict';
/* ============================================================
   LOADOUT - TABS
   From app.js lines 7253-7357 of the original single file.
   Loaded in order by index.html; all files share one global scope,
   so declarations here are visible to every file listed after it.
   ============================================================ */

  /* =========================================================
     TABS
     Character creation happens once. After that the app is a set of
     sections rather than a linear flow, and the character sheet is home.
  ========================================================= */
  const TABS = {
    sheet:   {screen:'screen-tiers'},
    roadmap: {screen:'screen-prefs'},
    prep:    {screen:'screen-prep'},
    quest:   {screen:'screen-quest'},
    journal: {screen:'screen-journal'},
    recipes: {screen:'screen-recipes'},
  };
  /* Which section each screen belongs to, so sub-pages keep the right tab lit */
  const SCREEN_TAB = {
    'screen-tiers':'sheet',
    'screen-prefs':'roadmap', 'screen-cravings':'roadmap', 'screen-style':'roadmap',
    'screen-suggest':'roadmap', 'screen-loadout':'roadmap', 'screen-shop':'roadmap',
    'screen-prep':'prep',
    'screen-quest':'quest', 'screen-journal':'journal', 'screen-recipes':'recipes',
  };

  function characterExists(){ return !!(state.finalKcal && state.assignedTierId); }

  /* Genre words are authored for ALL-CAPS headings, and some run two words
     long ("SUPPLY RUN"). The tab strip is 9px and one line, so title-case
     them here — lowercase letters are meaningfully narrower than caps, which
     is what keeps "Provisions" inside its column. */
  function tabWord(raw, fallback){
    const w = String(raw == null ? '' : raw).trim();
    if (!w) return fallback;
    return w.split(/\s+/)
            .map(x => x.charAt(0).toUpperCase() + x.slice(1).toLowerCase())
            .join(' ');
  }

  function refreshTabs(activeScreen){
    const bar = document.getElementById('tabBar');
    const show = characterExists() && !!SCREEN_TAB[activeScreen];
    bar.hidden = !show;
    document.body.classList.toggle('tabbed', show);
    if (!show) return;
    const tab = SCREEN_TAB[activeScreen];
    bar.querySelectorAll('.tab').forEach(b=>{
      const on = b.getAttribute('data-tab') === tab;
      b.classList.toggle('on', on);
      b.setAttribute('aria-current', on ? 'page' : 'false');
    });
    // the sheet tab takes the genre's own name for it
    const t = THEMES[state.theme] || THEMES.cyberpunk;
    const lbl = document.getElementById('tabSheetLbl');
    if (lbl) lbl.textContent = (t.sheet || 'CHARACTER SHEET').split(' ')[0].replace(/^\w/, c=>c.toUpperCase()).slice(0,9);
    // and the loadout tab takes the genre's word for a day's food
    const loLbl = document.getElementById('tabLoadoutLbl');
    if (loLbl) loLbl.textContent = tabWord(t.words && t.words.loadout, 'Loadout');
    /* Same for the calendar. "Log" reads better than the bare noun, so keep
       it wherever the pair still fits the column — "Objective Log" does not,
       and drops the suffix rather than the meaning. */
    const qLbl = document.getElementById('tabQuestLbl');
    if (qLbl){
      const q = tabWord(t.words && t.words.quest, 'Quest');
      qLbl.textContent = (q.length + 4) <= 10 ? q + ' Log' : q;
    }
  }

  function goTab(name){
    const t = TABS[name];
    if (!t) return;
    if (name === 'sheet') renderTiers();
    if (name === 'roadmap'){
      // pick up wherever the prep was left, rather than restarting it
      if (Object.values(state.selections || {}).some(sel =>
            SLOT_DEFS.some(d => (sel[d.slot]||[]).some(Boolean)))){
        renderEatenPanel(); renderMealTimeline(); refreshTargets();
        showScreen('screen-loadout'); return;
      }
      renderPrefs();
    }
    if (name === 'prep'){ writeBackActiveDay(); renderPrepDays(); }
    if (name === 'quest')   renderCalendar();
    if (name === 'journal') renderJournal();
    if (name === 'recipes') renderRecipeBook();
    showScreen(t.screen);
  }

  function showScreen(id){
    // the attract screen is a black cabinet, not a themed page
    document.body.classList.toggle('attract-mode', id === 'screen-attract');
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    const onLoadout = id === 'screen-loadout';
    document.getElementById('hud').classList.toggle('show', onLoadout);
    document.body.classList.toggle('hud-on', onLoadout);
    refreshTabs(id);
    window.scrollTo({top:0, behavior:'smooth'});
  }

  document.getElementById('tabBar').addEventListener('click', (e)=>{
    const b = e.target.closest('.tab');
    if (b) goTab(b.getAttribute('data-tab'));
  });
  document.querySelectorAll('[data-back]').forEach(btn=>{
    btn.addEventListener('click', ()=> showScreen(btn.getAttribute('data-back')));
  });

