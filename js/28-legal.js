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

  const legalPrivacyBtn = document.getElementById('legalPrivacy');
  if (legalPrivacyBtn){
    legalPrivacyBtn.addEventListener('click', ()=> openExternal('privacy.html'));
  }

  const legalOffBtn = document.getElementById('legalOff');
  if (legalOffBtn){
    legalOffBtn.addEventListener('click', ()=> openExternal(OFF_SITE));
  }

  /* ---- First-run health notice ---- */
  const disclaimerOkBtn = document.getElementById('disclaimerOk');
  if (disclaimerOkBtn){
    disclaimerOkBtn.addEventListener('click', ()=>{
      markDisclaimerSeen();
      closeModal('modalDisclaimer');
    });
  }

  /* Opened synchronously. 27-init.js has already finished its render by the time
     this file executes, so there is nothing to wait for -- and requestAnimationFrame
     never fires in a background tab, which would leave the notice unshown. */
  if (!disclaimerSeen()){
    openModal('modalDisclaimer');
  }
