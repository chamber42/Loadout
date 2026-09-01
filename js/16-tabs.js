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
  /* FOUR DESTINATIONS, NAMED FOR WHAT YOU ARE DOING

     The six that came before were six OBJECTS — a character, a plan, some
     prepped days, a journal, a calendar, a recipe book. That is how the data
     is shaped and it is not how anybody uses an app: the screen opened five
     times a day sat at the same weight as a calendar opened once a week, and
     the one thing this app does that nothing else does — re-sizing a real
     dish to your real numbers — was spread across three of them.

     These four are the loop the app actually describes, left to right:

       you       who you are, and what the targets are built from
       prep      what you will cook — the whole build, the cook plan, the
                 shopping list, the recipe book that feeds it
       today     what you are eating right now
       progress  what all of it did

     Each keeps its genre's own name. The grouping changed; the vocabulary
     did not. */
  const TABS = {
    you:      {screen:'screen-tiers'},
    prep:     {screen:'screen-prefs'},
    today:    {screen:'screen-journal'},
    progress: {screen:'screen-quest'},
  };

  /* Which destination each screen belongs to, so a sub-page keeps the right
     tab lit. The build flow — preferences, cravings, eating style, the
     suggestion, the loadout — stays whole inside `prep`: it is one sequence
     and splitting it across destinations would break it in the middle. */
  const SCREEN_TAB = {
    'screen-tiers':'you',

    'screen-prefs':'prep', 'screen-cravings':'prep', 'screen-style':'prep',
    'screen-suggest':'prep', 'screen-loadout':'prep', 'screen-shop':'prep',
    'screen-prep':'prep', 'screen-recipes':'prep',

    'screen-journal':'today',
    'screen-quest':'progress',
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
    /* Through tabWord like the other three. The genre names are authored in
       caps for headings, and this one used to keep them — which was hard to
       notice among six tabs and obvious among four, where OPERATOR sat
       beside Loadout, Intake and Quest Log. */
    if (lbl) lbl.textContent = tabWord((t.sheet || 'CHARACTER SHEET').split(' ')[0], 'Sheet').slice(0, 9);
    // and the loadout tab takes the genre's word for a day's food
    const loLbl = document.getElementById('tabLoadoutLbl');
    if (loLbl) loLbl.textContent = tabWord(t.words && t.words.loadout, 'Loadout');
    /* The journal takes the genre's word for a record of what was eaten —
       Rations in the wasteland, Fuel on the grid, Chronicle in the tavern. */
    const jLbl = document.getElementById('tabJournalLbl');
    if (jLbl) jLbl.textContent = tabWord(t.words && t.words.journal, 'Journal');
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
    if (name === 'you') renderTiers();
    if (name === 'prep'){
      /* Pick up wherever the prep was left rather than restarting it. A
         half-built loadout is the common case, and dropping somebody back
         at the preferences screen would throw it away. */
      if (Object.values(state.selections || {}).some(sel =>
            SLOT_DEFS.some(d => (sel[d.slot]||[]).some(Boolean)))){
        renderEatenPanel(); renderMealTimeline(); refreshTargets();
        showScreen('screen-loadout'); return;
      }
      /* A prep that is already cooked lands on the prepped days instead of
         asking about preferences again. */
      if (typeof prepReady === 'function' && prepReady()){
        writeBackActiveDay(); renderPrepDays();
        showScreen('screen-prep'); return;
      }
      renderPrefs();
    }
    if (name === 'progress') renderCalendar();
    if (name === 'today')    renderJournal();
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
    if (!b) return;
    const name = b.getAttribute('data-tab');
    /* Reaching the journal from the tab bar always lands on today. Done here
       rather than inside goTab() on purpose: the calendar opens a chosen day
       by calling goTab('today') directly, and that date has to survive. */
    if (name === 'today' && typeof resetJournalToToday === 'function') resetJournalToToday();
    goTab(name);
  });
  document.querySelectorAll('[data-back]').forEach(btn=>{
    btn.addEventListener('click', ()=> showScreen(btn.getAttribute('data-back')));
  });

