'use strict';
/* ============================================================
   LOADOUT - IMPORT FROM HEALTH

   Native builds only. On the web this file loads and does nothing,
   leaving the button hidden, because Safari has no way to read any of
   this and a control that can only fail is worse than no control.

   Fills in the four character-creation fields the Health app already
   knows: sex, age, height and bodyweight. It is a shortcut past the most
   tedious part of setup, never a replacement for it — every field stays
   editable, and anything Health does not return is simply left for the
   person to type.

   WHY MISSING FIELDS ARE TREATED SO CAREFULLY
   HealthKit will not say whether a read was refused. A denied permission
   and a value that was never recorded both come back as nothing at all,
   deliberately: telling an app which health permissions were refused
   would itself leak something about the person. So "we got three of four"
   can never be reported as an error — it is reported as what happened,
   and the fourth field is left alone.

   The values are written into the inputs rather than into state, and then
   the app's own listener is fired. Onboarding already knows how to read
   those inputs, recompute the targets and re-validate; going around it
   would mean keeping a second copy of that logic in step with the first.
   ============================================================ */

  (function(){

    var btn  = document.getElementById('btnHealthImport');
    var note = document.getElementById('healthImportNote');
    if (!btn) return;

    var cap = window.Capacitor;
    var HK  = cap && cap.Plugins && cap.Plugins.HealthKit;
    if (!HK) return;                       // web, or the plugin is not linked

    /* isAvailable is false on iPad and in the simulator. Ask before
       offering, so the button never appears where it cannot work. */
    HK.isAvailable().then(function(res){
      if (res && res.available) btn.hidden = false;
    }).catch(function(){ /* leave it hidden */ });

    function say(msg){
      note.textContent = msg;
      note.hidden = !msg;
    }

    /* Setting .value does not fire input events, so the app would never
       hear about it. Dispatching one hands the values to onboarding's own
       handler, which reads all four inputs at once. */
    function fill(el, value){
      if (el && value != null && !isNaN(value)) { el.value = value; return true; }
      return false;
    }

    btn.addEventListener('click', function(){
      btn.disabled = true;
      say('Checking Health…');

      HK.requestAuthorization()
        .then(function(){
          /* The result of the prompt says only that it was answered, not
             what was allowed, so it is not worth inspecting. What actually
             came back is the only reliable signal. */
          return HK.readProfile();
        })
        .then(function(p){
          p = p || {};
          var got = [];

          if (p.sex === 'male' || p.sex === 'female'){
            var sexBtn = document.querySelector('#sexGrid [data-sex="' + p.sex + '"]');
            if (sexBtn){ sexBtn.click(); got.push('sex'); }
          }

          var bw  = document.getElementById('bodyweightInput');
          var ft  = document.getElementById('heightFtInput');
          var inches = document.getElementById('heightInInput');
          var age = document.getElementById('ageInput');

          if (fill(bw, p.bodyweight != null ? Math.round(p.bodyweight) : null)) got.push('weight');
          if (fill(age, p.age)) got.push('age');

          if (p.heightIn != null && !isNaN(p.heightIn)){
            var total = Math.round(p.heightIn);
            fill(ft, Math.floor(total / 12));
            fill(inches, total % 12);
            got.push('height');
          }

          /* One event is enough: onboarding's handler re-reads every field. */
          if (bw) bw.dispatchEvent(new Event('input', { bubbles: true }));

          if (!got.length){
            say('Health had nothing to share. Fill the fields in below.');
          } else if (got.length === 4){
            say('Filled in from Health. Change anything that looks wrong.');
          } else {
            say('Filled in ' + got.join(', ') + ' from Health. Add the rest below.');
          }
        })
        .catch(function(err){
          say('Could not read Health. Fill the fields in below.');
          console.warn('Loadout: Health import failed', err);
        })
        .then(function(){ btn.disabled = false; });
    });

  })();
