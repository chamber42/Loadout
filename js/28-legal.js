'use strict';
/* ============================================================
   LOADOUT - LEGAL, CREDITS AND FIRST-RUN HEALTH NOTICE

   Loaded last, after 27-init.js, so the app is fully built and
   state is already restored by the time any of this runs.

   Uses its own localStorage key rather than the app's save blob,
   so acknowledging the notice is independent of "Start over" and
   the persistence logic in 25-persistence.js is left untouched.
   ============================================================ */

  const DISCLAIMER_KEY = 'loadout.disclaimer.v1';
  const OFF_SITE       = 'https://world.openfoodfacts.org/';

  /* localStorage throws in private-browsing modes on some browsers, so every
     access is guarded. A failure here must never stop the app from loading. */
  function disclaimerSeen(){
    try{ return localStorage.getItem(DISCLAIMER_KEY) === '1'; }
    catch(e){ return false; }
  }
  function markDisclaimerSeen(){
    try{ localStorage.setItem(DISCLAIMER_KEY, '1'); }catch(e){}
  }

  /* Left alone: this works for a genuinely external address. window.open()
     returns null in a native webview, but an off-origin URL still reaches the
     host's navigation policy on the way and opens in the system browser, so
     the null return does not mean nothing happened. A SAME-ORIGIN document is
     the case that really fails — that would need a second webview inside the
     app, which nothing implements — which is why the bundled privacy policy
     is shown in-app rather than handed to this. */
  function openExternal(url){
    /* noopener so the opened page cannot reach back through window.opener */
    const w = window.open(url, '_blank', 'noopener,noreferrer');
    if (w) w.opener = null;
  }

  /* ---- System menu -> Legal & credits ---- */
  const sysLegalBtn = document.getElementById('sysLegal');
  if (sysLegalBtn){
    sysLegalBtn.addEventListener('click', ()=>{
      closeModal('modalSystem');
      openModal('modalLegal');
    });
  }

  /* The policy ships in the bundle, so it is shown in the app rather than
     handed to a browser that may never appear. */
  const legalPrivacyBtn = document.getElementById('legalPrivacy');
  if (legalPrivacyBtn){
    legalPrivacyBtn.addEventListener('click', ()=>{
      const frame = document.getElementById('privacyFrame');
      // set on open rather than in the markup, so the document is only
      // loaded if somebody actually asks for it
      if (frame && frame.getAttribute('src') !== 'privacy.html'){
        frame.setAttribute('src', 'privacy.html');
      }
      closeModal('modalLegal');
      openModal('modalPrivacy');
    });
  }

  const legalOffBtn = document.getElementById('legalOff');
  if (legalOffBtn){
    legalOffBtn.addEventListener('click', ()=> openExternal(OFF_SITE));
  }

  /* ---- First-run health notice ----

     Shown when somebody commits to starting, not before they have seen
     anything. Nothing it warns about has happened by then: no estimate exists
     until a character is built, and nothing reaches the network until a food
     is scanned or searched — every request in the app is behind one of those
     two actions. A notice that arrives before the app does is a notice nobody
     reads.

     Whatever asked for it can pass a continuation, so acknowledging it
     carries on into the screen the person was heading for rather than
     dropping them back on the title. */
  let afterDisclaimer = null;

  function showDisclaimerIfNeeded(then){
    if (disclaimerSeen()) return false;
    afterDisclaimer = (typeof then === 'function') ? then : null;
    openModal('modalDisclaimer');
    return true;
  }
  window.showDisclaimerIfNeeded = showDisclaimerIfNeeded;

  const disclaimerOkBtn = document.getElementById('disclaimerOk');
  if (disclaimerOkBtn){
    disclaimerOkBtn.addEventListener('click', ()=>{
      markDisclaimerSeen();
      closeModal('modalDisclaimer');
      const go = afterDisclaimer;
      afterDisclaimer = null;
      if (go) go();
    });
  }

  /* A saved character skips the title screen entirely — 27-init.js opens
     straight on the sheet — so the notice still has to fire at load for those,
     or somebody who has never acknowledged it never would. Checked against
     what is actually on screen rather than against the save, because that is
     the condition that matters: is there a START tap coming to hang it off?
     Opened synchronously; 27-init.js has already rendered by the time this
     file runs, and requestAnimationFrame never fires in a background tab. */
  const titleShowing = (document.getElementById('screen-attract') || {}).classList;
  if (!titleShowing || !titleShowing.contains('active')){
    showDisclaimerIfNeeded();
  }
