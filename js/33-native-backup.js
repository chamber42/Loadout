'use strict';
/* ============================================================
   LOADOUT - NATIVE BACKUP

   Native builds only. On the web this file loads and does nothing.

   WHY THIS EXISTS
   Everything the app saves lives in localStorage. In a browser that is
   the right place for it. Inside the native shell it is not durable:
   WKWebView's storage belongs to the system, not to the app, and iOS is
   free to clear it when the device runs short of space. The app would
   come back looking freshly installed, with the journal gone.

   WHAT IT DOES INSTEAD OF FIXING THAT PROPERLY
   Nothing here changes how the app saves or loads. loadState() still
   reads localStorage synchronously during init, which is what lets the
   app boot in one pass. This mirrors the same keys into a real file in
   Documents — a directory iOS does not evict and does include in iCloud
   backups — and copies them back if they are ever found missing.

   The restore path ends in a reload. By the time this file runs, init
   has already read localStorage and drawn the screen, so putting the
   data back underneath it would leave the two disagreeing. One reload
   in the rare case that storage was actually cleared is a fair price
   for leaving the boot sequence alone.

   RESTORE IS ONLY EVER A REPAIR
   The backup is copied back exactly when the primary key is missing —
   never to "update" live data. A backup is by definition older than the
   thing it was copied from, so preferring it while real data exists
   would lose whatever happened since the last mirror.
   ============================================================ */

  (function(){

    /* window.Capacitor exists only inside the native shell. */
    var cap = window.Capacitor;
    if (!cap || !cap.Plugins || !cap.Plugins.Filesystem) return;

    var FS      = cap.Plugins.Filesystem;
    var FILE    = 'loadout-backup.json';
    var DIR     = 'DOCUMENTS';
    var UTF8    = 'utf8';
    var PRIMARY = 'gfl.state.v1';                 // the one that holds real data
    var KEYS    = [PRIMARY, 'loadout.disclaimer.v1', 'loadout.timers.v1'];

    /* Set before the reload so a failed restore cannot loop: if writing to
       localStorage does not stick, the second pass finds this flag and gives
       up rather than reloading forever. sessionStorage is per-launch, so a
       genuine later eviction still gets repaired on the next start. */
    var TRIED = 'loadout.restoreAttempted';

    function readAll(){
      var out = {};
      KEYS.forEach(function(k){
        try{ var v = localStorage.getItem(k); if (v !== null) out[k] = v; }
        catch(e){ /* storage blocked — nothing to mirror */ }
      });
      return out;
    }

    /* ---- mirror out ---------------------------------------------------- */

    var pending = null;
    function scheduleBackup(){
      clearTimeout(pending);
      /* Longer than saveState's own 400ms debounce so this reads the state
         after it has settled, rather than racing the write it is copying. */
      pending = setTimeout(writeBackup, 2500);
    }

    function writeBackup(){
      var data = readAll();
      if (!data[PRIMARY]) return;          // nothing worth keeping yet
      FS.writeFile({
        path: FILE, directory: DIR, encoding: UTF8,
        data: JSON.stringify({ savedAt: Date.now(), keys: data })
      }).catch(function(err){
        /* A failed backup must never break the app: the real save already
           succeeded in localStorage. Log and try again on the next edit. */
        console.warn('Loadout: backup write failed', err);
      });
    }

    /* ---- restore in ---------------------------------------------------- */

    function restoreIfMissing(){
      var present;
      try{ present = localStorage.getItem(PRIMARY); }
      catch(e){ return; }                  // storage unavailable; nothing to do
      if (present) return;                 // live data wins, always

      var tried;
      try{ tried = sessionStorage.getItem(TRIED); }catch(e){}
      if (tried) return;

      FS.readFile({ path: FILE, directory: DIR, encoding: UTF8 })
        .then(function(res){
          var blob = JSON.parse(res.data);
          if (!blob || !blob.keys || !blob.keys[PRIMARY]) return;
          try{ sessionStorage.setItem(TRIED, '1'); }catch(e){}
          Object.keys(blob.keys).forEach(function(k){
            try{ localStorage.setItem(k, blob.keys[k]); }catch(e){}
          });
          location.reload();
        })
        .catch(function(){
          /* No backup file yet is the normal state on a first run, and
             readFile rejects rather than returning empty. Not an error. */
        });
    }

    /* ---- wiring -------------------------------------------------------- */

    restoreIfMissing();

    /* The same three events saveState listens to, so a backup is scheduled
       whenever a save is. Capture phase for the same reason it uses it:
       handlers that stop propagation should not also stop the save. */
    document.addEventListener('change', scheduleBackup, true);
    document.addEventListener('input',  scheduleBackup, true);
    document.addEventListener('click',  scheduleBackup, true);

    /* Leaving the app is the moment a pending mirror is most likely to be
       lost, and on iOS it is often the last code that runs before the app
       is suspended. Flush immediately rather than waiting out the debounce. */
    document.addEventListener('visibilitychange', function(){
      if (document.visibilityState === 'hidden'){ clearTimeout(pending); writeBackup(); }
    });
    window.addEventListener('pagehide', function(){ clearTimeout(pending); writeBackup(); });

  })();
