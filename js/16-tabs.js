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
    pantry:   {screen:'screen-pantry'},
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

    /* The pantry began inside `prep`, on the reasoning that a pantry is a
       thing you have rather than something you do. What settled it the other
       way was building it: shopping, the kitchen questions and the journal
       each needed their own door into it, and the back link had to learn who
       had opened it. A page that needs three entrances and has to remember
       which one you used is not a sub-page of anything — and the pantry is no
       longer prep's, since half its traffic is the journal depleting it on
       days when no prep is being cooked at all. */
    'screen-pantry':'pantry',

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
    /* The genre's own word for a store of things — Larder, Stash, Armory.
       Five columns at 9px will not seat a two-word name, and the two genres
       that have one say for themselves which half to keep: the Root Cellar
       becomes the Cellar, Item Select becomes Items. Shortening those by rule
       would have picked "Select", which names the menu rather than the food. */
    const pLbl = document.getElementById('tabPantryLbl');
    if (pLbl){
      const w = t.words || {};
      pLbl.textContent = tabWord(w.inventoryTab || w.inventory, 'Pantry');
    }
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
    if (name === 'pantry')   renderPantry();
    if (name === 'progress') renderCalendar();
    if (name === 'today')    renderJournal();
    showScreen(t.screen);
  }

  /* Where the pantry's back link should return to. It is reached from the
     shopping list, the kitchen questions and the journal, so a fixed target
     would strand two of the three callers on a screen they were not on. */
  const PANTRY_FROM = {'screen-shop':'SHOPPING LIST', 'screen-cravings':'CRAVINGS',
                       'screen-journal':'JOURNAL'};

  function swapScreen(id){
    if (id === 'screen-pantry'){
      const from = document.querySelector('.screen.active');
      const label = from && PANTRY_FROM[from.id];
      const strip = document.querySelector('#screen-pantry .top-strip');
      const back = strip && strip.querySelector('[data-back]');
      /* Reached from a button mid-task, the back link returns you to the task.
         Reached from the tab bar there is no task to return to, and a link
         claiming otherwise would send you somewhere you had not been. */
      if (back && label){
        back.setAttribute('data-back', from.id);
        back.textContent = label;
      }
      if (strip) strip.hidden = !label;
      if (typeof renderPantry === 'function') renderPantry();
    } else if (typeof scanTarget !== 'undefined' && scanTarget === 'pantry'){
      /* Leaving the pantry hands the scanner back, so a scan started later
         from the loadout tab is not still pointed at a screen you have left.
         The same handback the food picker does when its modal closes. */
      scanTarget = 'eaten';
      if (typeof resetPantryScanRow === 'function') resetPantryScanRow();
    }
    // the attract screen is a black cabinet, not a themed page
    document.body.classList.toggle('attract-mode', id === 'screen-attract');
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    const onLoadout = id === 'screen-loadout';
    document.getElementById('hud').classList.toggle('show', onLoadout);
    document.body.classList.toggle('hud-on', onLoadout);
    refreshTabs(id);
    /* Instant, not smooth. The old page is already gone by the time this
       runs, so there is nothing left to scroll away from — a smooth scroll
       just drags the arriving page under its own fade. */
    window.scrollTo(0, 0);
    /* Last, so the question lands on a screen that is already drawn. */
    if (onLoadout && typeof maybeOfferNewPrep === 'function') maybeOfferNewPrep();
  }

  /* ---------------------------------------------------------
     WHY THERE IS NO CROSSFADE HERE

     Screens used to swap inside a view transition so the page being left
     and the page arriving would overlap. It looked better and it cost far
     too much: while a view transition runs, WebKit replaces the live DOM
     with snapshots and NOTHING ON THE PAGE IS HIT-TESTABLE.

     Measured on the simulator with elementFromPoint at two points, one on
     the tab bar and one in the middle of the page. Both return the tab and
     the panel at rest and one millisecond in; from 64ms to 293ms both
     return <html>; both are live again at 344ms. So every screen change
     bought a quarter of a second in which no button anywhere in the app
     could be pressed — which is exactly the "sometimes it takes two taps"
     that came back, and it was never only the tabs.

     Nothing in CSS or JS reaches this. pointer-events on the overlay does
     not help because the overlay is not what is swallowing the tap, and
     recognising taps from pointer events does not help because the element
     is not hit-testable to begin with. A shorter transition would only
     shorten the dead window.

     So the swap is a plain swap, and .screen.active's own rise covers the
     arrival, the way it did before any of this.
  --------------------------------------------------------- */
  function showScreen(id){ swapScreen(id); }

  /* ---------------------------------------------------------
     TAPPING A TAB

     A click was being dropped in two situations, and neither of them is
     the tab bar's fault.

     Straight after a screen change: a view transition puts a snapshot of
     the page in the top layer for the length of the crossfade, and a tap
     landing on that overlay never reaches the button underneath. So the
     tab you pressed a fifth of a second after the last one did nothing.

     And straight after a scroll: iOS spends the first touch stopping the
     momentum rather than delivering it, so the click is never synthesised
     at all. That one predates everything here and has nothing to do with
     transitions — it is simply what the platform does.

     A press and a release on the same tab, close together in space and
     time, is a tap. Recognising it from the pointer events rather than
     waiting for the click WebKit may or may not synthesise answers both:
     pointerdown and pointerup arrive in either situation.

     The click handler stays for the keyboard, where there are no pointer
     events at all — guarded so a tap that has already been served does not
     arrive twice. */
  const tabBar = document.getElementById('tabBar');

  function activateTab(b){
    if (!b) return;
    const name = b.getAttribute('data-tab');
    /* Reaching the journal from the tab bar always lands on today. Done here
       rather than inside goTab() on purpose: the calendar opens a chosen day
       by calling goTab('today') directly, and that date has to survive. */
    if (name === 'today' && typeof resetJournalToToday === 'function') resetJournalToToday();
    goTab(name);
  }

  const TAP_SLOP = 12;      // px of drift still counted as a tap, not a drag
  const TAP_TIME = 700;     // ms held before it stops being a tap

  /* Whether a press and a release are the same tap: same tab, close in
     space, close in time. Named rather than inlined so it can be checked
     without a device — the thresholds are the whole behaviour, and getting
     one wrong means either a scroll that fires a tab or a tap that does
     not. */
  function isTap(press, target, x, y, now){
    return !!press && target === press.b &&
      Math.abs(x - press.x) <= TAP_SLOP &&
      Math.abs(y - press.y) <= TAP_SLOP &&
      (now - press.t) <= TAP_TIME;
  }

  let pressed = null, servedAt = 0;

  tabBar.addEventListener('pointerdown', (e)=>{
    const b = e.target.closest('.tab');
    pressed = b ? {b, x:e.clientX, y:e.clientY, t:performance.now()} : null;
  });
  tabBar.addEventListener('pointercancel', ()=>{ pressed = null; });
  tabBar.addEventListener('pointerup', (e)=>{
    const p = pressed; pressed = null;
    if (!isTap(p, e.target.closest('.tab'), e.clientX, e.clientY, performance.now())) return;
    servedAt = performance.now();
    activateTab(p.b);
  });
  tabBar.addEventListener('click', (e)=>{
    /* A click following a tap this just served is that same tap arriving a
       second time; anything else is the keyboard, or a browser with no
       pointer events, and has to work. */
    if (performance.now() - servedAt < 700) return;
    activateTab(e.target.closest('.tab'));
  });
  document.querySelectorAll('[data-back]').forEach(btn=>{
    btn.addEventListener('click', ()=> showScreen(btn.getAttribute('data-back')));
  });

