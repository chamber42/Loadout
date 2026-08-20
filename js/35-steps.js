'use strict';
/* ============================================================
   LOADOUT - STEPS ON THE CHARACTER SHEET

   Native builds only. Safari has no step history, so on the web the
   panel stays hidden rather than showing a feature that cannot work —
   the same rule the camera scanner and the Health import already follow.

   Reads first, asks second. HealthKit only prompts for types it has not
   been asked about, so a plain read costs nothing when permission was
   already granted at character creation and returns nothing when it was
   not. Someone who has already said yes never sees a second prompt; only
   someone who has not gets offered the button.

   Nothing here is written back into state. Steps are a reading taken from
   Health, not something the app owns — persisting them would mean keeping
   a stale copy in the save file that disagrees with Health the moment
   anybody walks anywhere.
   ============================================================ */

  (function(){

    var panel = document.getElementById('sheetActivityPanel');
    var host  = document.getElementById('sheetSteps');
    if (!panel || !host) return;

    var cap = window.Capacitor;
    var HK  = cap && cap.Plugins && cap.Plugins.HealthKit;
    if (!HK) return;

    function commas(n){ return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

    /* Today against the last six days. A bare number says nothing about
       whether it is a good day; the comparison is the useful part. */
    function verdict(today, average){
      if (!average) return '';
      var diff = Math.round((today / average - 1) * 100);
      if (diff >= 15)  return 'Well above your usual ' + commas(average) + '.';
      if (diff <= -15) return 'Below your usual ' + commas(average) + '.';
      return 'About your usual ' + commas(average) + '.';
    }

    function showSteps(res){
      var today = res.today;
      panel.hidden = false;
      host.innerHTML =
        '<div class="vital vital-wide">' +
          '<span class="vital-lbl">Steps today</span>' +
          '<span class="vital-edit"><strong id="stepsToday">' + commas(today) + '</strong></span>' +
        '</div>' +
        (res.average
          ? '<p class="subtitle" style="font-size:11px; margin:12px 0 0;">' +
            verdict(today, res.average) +
            ' Averaged over the last ' + res.days + ' full ' +
            (res.days === 1 ? 'day' : 'days') + ', today not counted.</p>'
          : '');
    }

    function offerConnect(){
      panel.hidden = false;
      host.innerHTML =
        '<p class="subtitle" style="font-size:11px; margin:0 0 12px;">' +
        'Loadout can show your step count from the Health app. It only reads ' +
        'steps &mdash; nothing is ever written back.</p>' +
        '<button class="btn-ghost" id="btnStepsConnect" style="margin:0;">' +
        '<svg class="px" aria-hidden="true"><use href="#i-run"></use></svg> SHOW MY STEPS</button>';

      document.getElementById('btnStepsConnect').addEventListener('click', function(){
        var btn = this;
        btn.disabled = true;
        HK.requestAuthorization()
          .then(function(){ return HK.readSteps(); })
          .then(function(res){
            if (res && res.today != null) { showSteps(res); return; }
            /* Permission was refused, or Health genuinely holds no steps.
               HealthKit will not say which, so the message must cover both
               without accusing the person of either. */
            host.innerHTML =
              '<p class="subtitle" style="font-size:11px; margin:0;">' +
              'No steps to show. Either Health has none recorded, or Loadout ' +
              'was not given access &mdash; you can change that in Settings ' +
              '&rarr; Privacy &amp; Security &rarr; Health &rarr; Loadout.</p>';
          })
          .catch(function(){
            btn.disabled = false;
          });
      });
    }

    function refresh(){
      HK.readSteps().then(function(res){
        if (res && res.today != null) showSteps(res);
        else offerConnect();
      }).catch(function(){ /* leave the panel as it is */ });
    }

    /* The sheet is drawn by renderTiers, which runs on load and whenever the
       character changes. Hooking the render rather than calling once keeps
       the figure from going stale on a sheet that stays open all day. */
    if (typeof window.renderTiers === 'function'){
      var original = window.renderTiers;
      window.renderTiers = function(){
        var out = original.apply(this, arguments);
        refresh();
        return out;
      };
    }

    /* Coming back to the app after a walk should show the walk. */
    document.addEventListener('visibilitychange', function(){
      if (document.visibilityState === 'visible') refresh();
    });

    refresh();

  })();
