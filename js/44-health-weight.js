'use strict';
/* ============================================================
   LOADOUT - WEIGH-INS FROM THE HEALTH APP

   Native builds only. On the web this file loads and does nothing, the
   same rule the camera scanner, the Health import and the step panel
   already follow.

   Anyone with a connected scale already has a year of weigh-ins sitting in
   Health, recorded every morning without them thinking about it. Until now
   Loadout read a single bodyweight out of Health once, at character
   creation, to save someone typing it — and then ignored every reading
   that followed while asking them to type today's in by hand.

   So this fills the weight series from what the phone already knows.

   WHY IT IS A SEPARATE MAP AND NOT AN IMPORT

   The obvious approach — copy Health's readings into state.weights once —
   is wrong in two directions. Correct a weigh-in in Health afterwards and
   the copy here never hears about it. Re-run the copy to fix that and it
   overwrites whatever the person typed in Loadout.

   Keeping them in two maps solves both. state.healthWeights is replaced
   wholesale on every read, so Health stays the authority on its own
   readings; state.weights is never touched here, so the app stays the
   authority on its own. weightSeries() merges them with the typed entry
   winning, which is the right precedence: a scale reading is the better
   default and the worse override.

   The Health copy IS persisted, unlike the step figures in 35-steps.js.
   Steps describe today and go stale the moment anyone walks; a weight
   series is history, and the trend and the expenditure maths both have to
   keep working on the web, offline, and after somebody revokes the
   permission.
   ============================================================ */

  (function(){

    var cap = window.Capacitor;
    var HK  = cap && cap.Plugins && cap.Plugins.HealthKit;
    if (!HK || typeof HK.readWeights !== 'function') return;

    /* Whether the last read actually returned anything, so the panel can
       offer the permission prompt rather than sitting silently empty. */
    var everRead = false;

    function sameMap(a, b){
      var ak = Object.keys(a || {}), bk = Object.keys(b || {});
      if (ak.length !== bk.length) return false;
      for (var i = 0; i < ak.length; i++){
        if (a[ak[i]] !== b[ak[i]]) return false;
      }
      return true;
    }

    /* Reads first and asks second, the same order the step panel uses:
       HealthKit only prompts for types it has not been asked about, so a
       plain read costs nothing when permission was already granted at
       character creation — bodyMass is in the read set the app has always
       requested — and returns nothing when it was refused. */
    function refresh(){
      return HK.readWeights().then(function(res){
        var byDay = (res && res.byDay) || null;
        if (!byDay || !Object.keys(byDay).length) return false;

        everRead = true;
        if (typeof state === 'undefined') return false;

        /* Replaced wholesale rather than merged into: a weigh-in deleted in
           Health should disappear here too, and that only happens if this
           map is exactly what Health last said. */
        if (sameMap(state.healthWeights, byDay)) return false;
        state.healthWeights = byDay;

        /* state.bodyweight has to follow the newest reading, or every
           target in the app keeps sizing itself against a figure the person
           stopped weighing weeks ago. Only when Health is genuinely newer
           than anything typed here — recordWeight owns the other case. */
        var series = (typeof weightSeries === 'function') ? weightSeries() : [];
        if (series.length){
          var newest = series[series.length - 1];
          if (newest.lb > 0 && newest.lb !== state.bodyweight){
            state.bodyweight = newest.lb;
            if (typeof syncTargets === 'function') syncTargets();
            if (typeof assignTier === 'function') assignTier();
          }
        }

        if (typeof saveState === 'function') saveState();
        return true;
      }).catch(function(){ return false; });
    }

    /* Offered only when a read came back with nothing — which means either
       no weigh-ins exist or the permission was refused, and HealthKit will
       not say which. */
    function offerConnect(host){
      host.innerHTML =
        '<button class="btn-ghost" id="btnWeightConnect" style="margin:10px 0 0;">' +
        '<svg class="px" aria-hidden="true"><use href="#i-scales"></use></svg> READ MY WEIGH-INS</button>';
      var btn = document.getElementById('btnWeightConnect');
      if (!btn) return;
      btn.addEventListener('click', function(){
        btn.disabled = true;
        HK.requestAuthorization()
          .then(refresh)
          .then(function(got){
            if (got && typeof renderWeightPanel === 'function'){ renderWeightPanel(); return; }
            host.innerHTML =
              '<p class="subtitle" style="font-size:11px; margin:10px 0 0;">' +
              'No weigh-ins in Health to read. Either none are recorded, or ' +
              'Loadout was not given access &mdash; you can change that in ' +
              'Settings &rarr; Privacy &amp; Security &rarr; Health &rarr; Loadout.</p>';
          })
          .catch(function(){ btn.disabled = false; });
      });
    }

    /* Hangs the connect button off the weight panel once it has drawn,
       rather than reaching into its markup. */
    function decorate(){
      var host = document.getElementById('sheetWeightHealth');
      if (!host) return;
      if (everRead){ host.innerHTML = ''; return; }
      offerConnect(host);
    }

    if (typeof window.renderWeightPanel === 'function'){
      var original = window.renderWeightPanel;
      window.renderWeightPanel = function(){
        var out = original.apply(this, arguments);
        try{ decorate(); }catch(e){}
        return out;
      };
    }

    /* One read on load, and one whenever the app comes back to the front —
       someone who weighs in after breakfast should find it here without
       having to ask. */
    function readAndRedraw(){
      refresh().then(function(changed){
        if (changed && typeof renderTiers === 'function') renderTiers();
        else if (typeof renderWeightPanel === 'function') renderWeightPanel();
      });
    }

    document.addEventListener('visibilitychange', function(){
      if (document.visibilityState === 'visible') readAndRedraw();
    });

    readAndRedraw();

  })();
