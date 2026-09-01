'use strict';
/* ============================================================
   LOADOUT - TAKING YOUR DATA WITH YOU

   Everything this app knows lives on one device, which is the right
   default and the reason it needs no account. It also means a lost or
   replaced phone was, until now, a deleted history: 33-native-backup.js
   mirrors the save into Documents, but that file lives on the same phone
   as the thing it is backing up, so it survives iOS clearing WKWebView's
   storage and nothing else.

   Two halves, and neither needs an account or a server.

   EXPORT writes everything the app owns into one dated JSON file.
   IMPORT reads one back and replaces what is here.

   WHY NOT iCLOUD SYNC

   The obvious answer — put the backup in iCloud Drive and be done — needs
   the iCloud entitlement, and that is not available on a free Apple
   developer team. It is the same wall the widget hits. What IS available
   is UIFileSharingEnabled, which is an Info.plist key rather than an
   entitlement: it makes the app's Documents folder visible in the Files
   app, so the backup this app already writes can be found, copied into
   iCloud Drive by hand, AirDropped, or mailed. That turns a file nobody
   could reach into one somebody can actually keep.

   A FILE, NOT A FORMAT

   The export is the app's own storage keys, verbatim, wrapped with a
   version and a timestamp. Deliberately not a tidied-up "nutrition data"
   schema: a restore has to reproduce the app's state exactly, and every
   transformation between here and there is a chance to lose something.
   Anyone wanting to read it in a spreadsheet can — the journal is plain
   JSON inside — but that is a side effect, not the design.
   ============================================================ */

  /* Every key the app writes. Kept as a list rather than sweeping all of
     localStorage: this device may hold storage from other pages served
     from the same origin, and an export should carry Loadout's data, not
     whatever else happened to be there. */
  const EXPORT_KEYS = [
    'gfl.state.v1',              // the save blob — character, prep, journal, weights
    'loadout.timers.v1',         // cook timers
    'loadout.disclaimer.v1',     // the health notice acknowledgement
    'gfl.health.write.v1',       // whether meals are written to Apple Health
    'gfl.reminders.v1',          // reminder switches and times
  ];

  /* Bumped only when the shape of the wrapper changes, not when the app's
     own state gains a field — state grows constantly and old saves are
     already handled by the migrations in 25-persistence.js. */
  const EXPORT_VERSION = 1;

  function exportBlob(){
    const keys = {};
    EXPORT_KEYS.forEach(function(k){
      try{
        const v = localStorage.getItem(k);
        if (v !== null) keys[k] = v;
      }catch(e){ /* storage blocked; export what can be read */ }
    });
    return {
      app: 'Loadout',
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      keys: keys,
    };
  }

  function exportFilename(){
    const d = new Date();
    return 'loadout-' + d.getFullYear() + '-' +
           String(d.getMonth() + 1).padStart(2, '0') + '-' +
           String(d.getDate()).padStart(2, '0') + '.json';
  }

  /* ---- writing one out ------------------------------------------------- */

  function nativeFilesystem(){
    var cap = window.Capacitor;
    return (cap && cap.Plugins && cap.Plugins.Filesystem) || null;
  }

  /* Resolves with a short line saying where the file went, or rejects.

     Two routes with genuinely different endings. In a browser the file
     downloads and the browser says so. On the phone it is written into
     Documents, which UIFileSharingEnabled exposes in the Files app — so
     the useful thing to say is where to look for it, since nothing visible
     happens at the moment of writing. */
  function exportData(){
    const blob = exportBlob();
    if (!blob.keys['gfl.state.v1']){
      return Promise.reject(new Error('nothing saved to export yet'));
    }
    const text = JSON.stringify(blob, null, 2);
    const name = exportFilename();

    const FS = nativeFilesystem();
    if (FS){
      return FS.writeFile({path: name, directory: 'DOCUMENTS', encoding: 'utf8', data: text})
        .then(function(){
          return 'Saved as ' + name + ' — find it in Files, under On My iPhone › Loadout.';
        });
    }

    return new Promise(function(resolve, reject){
      try{
        const file = new Blob([text], {type: 'application/json'});
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        /* Revoked on a delay rather than immediately: some browsers have
           not finished reading the blob when click() returns, and pulling
           the URL out from under them produces an empty file. */
        setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
        resolve('Downloaded ' + name + '.');
      }catch(e){ reject(e); }
    });
  }

  /* ---- reading one back ------------------------------------------------ */

  /* Checked before anything is written, because the failure mode of a
     half-applied import is a save file that is part one person and part
     another — which is worse than a refused import and far harder to
     explain. */
  function validateImport(text){
    let blob;
    try{ blob = JSON.parse(text); }
    catch(e){ return {ok: false, why: 'That file is not readable JSON.'}; }

    if (!blob || typeof blob !== 'object' || blob.app !== 'Loadout'){
      return {ok: false, why: 'That is not a Loadout export.'};
    }
    if (!(blob.version <= EXPORT_VERSION)){
      return {ok: false, why: 'That file came from a newer version of Loadout.'};
    }
    if (!blob.keys || typeof blob.keys !== 'object'){
      return {ok: false, why: 'That export has no data in it.'};
    }
    if (typeof blob.keys['gfl.state.v1'] !== 'string'){
      return {ok: false, why: 'That export is missing the main save.'};
    }
    /* The save blob itself has to parse, or the app will boot into a
       broken state and the person will think the import worked. */
    try{
      const inner = JSON.parse(blob.keys['gfl.state.v1']);
      if (!inner || typeof inner !== 'object'){
        return {ok: false, why: 'The save inside that export is damaged.'};
      }
    }catch(e){ return {ok: false, why: 'The save inside that export is damaged.'}; }

    return {ok: true, blob: blob};
  }

  /* Replaces what is here. The caller is responsible for having asked
     first — this does not confirm anything.

     Ends in a reload for the same reason 33-native-backup.js does: init
     has already read localStorage and drawn the screen, so writing new
     data underneath it would leave the two disagreeing. */
  function importData(text){
    const check = validateImport(text);
    if (!check.ok) return check;

    /* Every key in the export is written, and every key the app owns that
       the export does NOT carry is removed. Otherwise importing someone's
       data onto a phone that already had some would leave orphans behind —
       yesterday's timers running against today's imported journal. */
    EXPORT_KEYS.forEach(function(k){
      try{
        if (Object.prototype.hasOwnProperty.call(check.blob.keys, k)){
          localStorage.setItem(k, check.blob.keys[k]);
        } else {
          localStorage.removeItem(k);
        }
      }catch(e){}
    });

    /* The native mirror is written from localStorage on the next event, so
       it catches up on its own — but the restore-if-missing guard must not
       fire in the meantime and put the old data back. */
    try{ sessionStorage.removeItem('loadout.restoreAttempted'); }catch(e){}

    return {ok: true};
  }

  window.exportData     = exportData;
  window.importData     = importData;
  window.validateImport = validateImport;
  window.exportBlob     = exportBlob;
  window.exportFilename = exportFilename;
