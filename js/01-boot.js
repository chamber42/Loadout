'use strict';
/* ============================================================
   LOADOUT - BOOT - PWA manifest + gesture guards
   From app.js lines 4-40 of the original single file.
   Loaded in order by index.html; all files share one global scope,
   so declarations here are visible to every file listed after it.
   ============================================================ */

  /* =========================================================
     ANDROID: inject an inline Web App Manifest (standalone PWA)
  ========================================================= */
  const manifest = {
    name: "Loadout",
    short_name: "Loadout",
    start_url: "./",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0e14",
    theme_color: "#0d1117",
    icons: [
      {
        src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%230a0e14'/%3E%3Cpath d='M46 28 L30 56 H46 L42 76 L70 42 H52 Z' fill='%2339ff88'/%3E%3C/svg%3E",
        sizes: "192x192",
        type: "image/svg+xml"
      }
    ]
  };
  try{
    const manifestBlob = new Blob([JSON.stringify(manifest)], {type:'application/json'});
    const manifestURL = URL.createObjectURL(manifestBlob);
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = manifestURL;
    document.head.appendChild(link);
  }catch(e){ /* manifest injection best-effort */ }

  /* Prevent rubber-band / pull-to-refresh + pinch zoom gestures */
  document.addEventListener('gesturestart', e => e.preventDefault());
  let lastTouchEnd = 0;
  document.addEventListener('touchend', function(e){
    const now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
  }, {passive:false});

