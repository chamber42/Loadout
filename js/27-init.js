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

  /* Character creation and game selection happen once. With a character
     saved, the app opens straight on the sheet — no title screen, no
     library, no re-entering stats. Both are changed deliberately through
     the System menu instead. */
  if (hadSave){
    renderTiers();
    showScreen('screen-tiers');
  } else {
    showScreen('screen-attract');
  }
