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
    /* The tab labels are plain words, the same in every world. The genre
       names stay in the headings on each screen; down here they made the
       bar a riddle — Case, Supplies, Satchel, Intake, Night Log said what
       the world calls things, not what is behind each one. The labels are
       written in index.html and never re-set. */
  }

  function goTab(name){
    const t = TABS[name];
    if (!t) return;
    if (name === 'you') renderTiers();
    if (name === 'prep'){
      /* The prep itself is home. Once one exists the tab lands on it — the
         days, the shopping and the cooking — and editing the meals is a
         place you go from there, not where you arrive. */
      if (typeof prepReady === 'function' && prepReady()){
        writeBackActiveDay(); renderPrepDays();
        showScreen('screen-prep'); return;
      }
      /* A build that was started and never finished is picked up where it
         was left rather than restarted. */
      if (Object.values(state.selections || {}).some(sel =>
            SLOT_DEFS.some(d => (sel[d.slot]||[]).some(Boolean)))){
        renderEatenPanel(); renderMealTimeline(); refreshTargets();
        showScreen('screen-loadout'); return;
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

  /* Back links that depend on how you arrived. Each of these screens is
     reached from more than one place, so a fixed target would send you
     somewhere you had not been. */
  const SHOP_FROM = {'screen-prep':'YOUR PREP', 'screen-loadout':'MEALS', 'screen-pantry':'PANTRY'};
  function setBack(screenId, target, label){
    const strip = document.querySelector('#' + screenId + ' .top-strip');
    const back = strip && strip.querySelector('[data-back]');
    if (!strip) return;
    strip.hidden = !target;
    if (back && target){
      back.setAttribute('data-back', target);
      back.textContent = label;
    }
  }

  /* The build screen ends in one button. With a prep built, Done returns
     to it and the shopping list is one tap from there; before one exists,
     the list is the next step. */
  function syncLoadoutActions(){
    const ready = typeof prepReady === 'function' && prepReady();
    const done = document.getElementById('btnLoadoutDone');
    const shop = document.getElementById('btnShopping');
    if (done) done.hidden = !ready;
    if (shop) shop.hidden = ready;
  }

  /* Set while a tab tap is being served. Arriving from the bar is never
     the middle of a task, so no back link should claim to return to one. */
  let viaTab = false;

  function swapScreen(id){
    const ready = typeof prepReady === 'function' && prepReady();
    if (id === 'screen-shop'){
      const from = document.querySelector('.screen.active');
      const label = from && SHOP_FROM[from.id];
      if (label) setBack('screen-shop', from.id, label);
    }
    /* The first step of a plan goes back to the prep there already is, and
       has nowhere to go back to when there is none. */
    if (id === 'screen-prefs') setBack('screen-prefs', ready ? 'screen-prep' : null, 'YOUR PREP');
    if (id === 'screen-loadout'){
      setBack('screen-loadout', ready ? 'screen-prep' : 'screen-suggest', ready ? 'YOUR PREP' : 'SUGGESTIONS');
      syncLoadoutActions();
    }
    if (id === 'screen-pantry'){
      const from = document.querySelector('.screen.active');
      const label = !viaTab && from && PANTRY_FROM[from.id];
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
      const toShop = document.getElementById('pantryShopBtn');
      if (toShop) toShop.hidden = !ready || from && from.id === 'screen-shop';
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
    if ((onLoadout || id === 'screen-prep') && typeof maybeOfferNewPrep === 'function') maybeOfferNewPrep();
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
    viaTab = true;
    try { goTab(name); } finally { viaTab = false; }
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
  /* ---------------------------------------------------------
     THE BAR STANDS DOWN WHILE SOMETHING IS BEING TYPED INTO

     iOS raises the keyboard by shrinking the visual viewport, but a
     position:fixed element stays pinned to the LAYOUT viewport. So the tab
     bar rides up the page instead of staying at the bottom of the screen,
     and comes to rest on top of whatever content is there — measured on the
     simulator at 68px of drift, and it lands squarely over other buttons.

     This is not new and it is not something CSS can express: the same drift
     reproduces on builds from well before the bar was ever touched. Closing
     and reopening the app clears it, which is what makes it look
     intermittent.

     While a field has focus the bar is unreachable anyway — the keyboard is
     over the top of it — so it stands down for the duration and comes back
     when the field is left. Nothing floats, because there is nothing there
     to float.
  --------------------------------------------------------- */
  function isTypingTarget(el){
    if (!el) return false;
    const tag = el.tagName;
    if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (tag !== 'INPUT') return false;
    /* A checkbox or a file picker raises no keyboard and must not hide the
       bar underneath somebody's thumb. */
    return !/^(button|checkbox|radio|submit|reset|file|range|color)$/i.test(el.type || 'text');
  }

  document.addEventListener('focusin', (e)=>{
    if (isTypingTarget(e.target)) document.body.classList.add('typing');
  });
  document.addEventListener('focusout', ()=>{
    /* Next tick, so moving from one field straight to another does not
       flash the bar back in between them. */
    setTimeout(releaseTypingIfIdle, 80);
  });

  function releaseTypingIfIdle(){
    const el = document.activeElement;
    if (!isTypingTarget(el) || !el.isConnected) document.body.classList.remove('typing');
  }

  /* focusout is not the only way a field stops being typed into. When a
     redraw replaces the field that has focus — entering a weigh-in rebuilds
     its panel, a Health read rebuilds the whole sheet — WebKit drops the
     element without firing focusout for it, the class stays on, and the
     bar never comes back. So any change to the page while typing re-checks,
     and so does the next touch. */
  new MutationObserver(()=>{
    if (document.body.classList.contains('typing')) releaseTypingIfIdle();
  }).observe(document.body, {childList:true, subtree:true});
  document.addEventListener('pointerdown', ()=>{
    if (document.body.classList.contains('typing')) setTimeout(releaseTypingIfIdle, 80);
  }, true);

  document.querySelectorAll('[data-back]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const target = btn.getAttribute('data-back');
      // the prep is redrawn on the way back, so an edit made since shows
      if (target === 'screen-prep' && typeof renderPrepDays === 'function'){
        writeBackActiveDay(); renderPrepDays();
      }
      showScreen(target);
    });
  });

