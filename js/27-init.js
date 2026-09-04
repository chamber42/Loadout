'use strict';
/* ============================================================
   LOADOUT - HEADLESS HOOK, PANEL OVERLAYS, INIT
   From app.js lines 13349-13405 of the original single file.
   Loaded in order by index.html; all files share one global scope,
   so declarations here are visible to every file listed after it.
   ============================================================ */

  /* Headless driving surface — used by the render harness. */
  window.__T = { applyTheme, showScreen, goTab, renderTiers, renderLibrary,
                 renderEatenPanel, renderMealTimeline, refreshTargets,
                 get state(){ return state; } };

  /* ---- material overlay layers ------------------------------------------
     Every .panel gets the same two layers the calendar has, because that is
     where the materials put anything drawn over the content. Panels built by
     JS are caught by the observer rather than by hunting down render sites.
     -------------------------------------------------------------------- */
  function dressPanels(root){
    const nodes = (root || document).querySelectorAll('.panel:not([data-fx])');
    for (const el of nodes){
      el.dataset.fx = '1';
      /* the calendar already carries its pair in the markup */
      if (el.querySelector(':scope > .paper-fx')) continue;
      const fx = document.createElement('div');
      fx.className = 'paper-fx'; fx.setAttribute('aria-hidden', 'true');
      const ed = document.createElement('div');
      ed.className = 'paper-edge'; ed.setAttribute('aria-hidden', 'true');
      el.appendChild(fx); el.appendChild(ed);
    }
  }
  let __fxPending = 0;
  function __scheduleDress(){
    cancelAnimationFrame(__fxPending);
    __fxPending = requestAnimationFrame(function(){ dressPanels(); });
  }
  if (typeof MutationObserver !== 'undefined'){
    new MutationObserver(function(muts){
      for (let i = 0; i < muts.length; i++){
        if (muts[i].addedNodes.length){ __scheduleDress(); return; }
      }
    }).observe(document.body, { childList:true, subtree:true });
  }
  dressPanels();

  /* init */
  const hadSave = loadState();
  renderLibrary();
  applyTheme(state.theme || 'cyberpunk');
  /* The custom-burn field is the one calculator input the sheet can edit, so
     it has to be put back before the options are drawn. */
  if (state.exerciseRaw != null) exerciseInput.value = state.exerciseRaw;
  syncTargets();
  renderExerciseOptions();

  /* The title screen is what every launch opens on, because the console
     coming on is the app coming on — a returning player has already watched
     it happen while the sheet was being built behind it. What differs is who
     it waits for. Without a character it waits for a tap, because there is a
     game to pick and stats to enter. With one there is nothing to ask, so it
     plays the power-on, holds the wordmark long enough to read, and hands
     over to the sheet on its own.

     Character creation and game selection still happen once, and are changed
     deliberately through the System menu rather than on the way in. */
  if (hadSave){
    renderTiers();
    splashThenShow('screen-tiers');
  } else {
    showScreen('screen-attract');
  }

  /* Long enough that the tube has finished striking, opening and settling
     (1.47s of CSS) and the name is legible for a beat after. With motion
     turned down there is no power-on to wait through, so the hold is only
     what it takes to read the word. */
  function splashThenShow(id){
    const still = window.matchMedia &&
                  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hold = still ? 900 : 1700;
    document.body.classList.add('attract-auto');
    showScreen('screen-attract');
    setTimeout(function(){
      /* The set going off rather than a page turning: the picture fades on
         black, then the sheet is simply there. */
      document.body.classList.add('attract-out');
      setTimeout(function(){
        document.body.classList.remove('attract-auto', 'attract-out');
        showScreen(id);
        /* The health notice used to fire at load for a saved character, on
           the grounds that no START tap was coming to hang it off. One is
           still not coming — so it hangs off the end of the splash instead,
           where it lands on the sheet rather than over the title. */
        if (typeof showDisclaimerIfNeeded === 'function') showDisclaimerIfNeeded();
      }, still ? 0 : 300);
    }, hold);
  }
