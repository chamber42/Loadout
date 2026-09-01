'use strict';
/* ============================================================
   LOADOUT - THE IMPORT ROW ON THE RECIPE BOOK

   Matching an ingredient line to a food in the library is guesswork, and
   it is guesswork that cannot be made reliable: pages write "boneless
   skinless chicken breasts, cut into strips" and the library says
   "Chicken Breast (raw)". Most lines land, some do not, and a few land
   wrong.

   So nothing is kept until the person has seen what it decided. The
   result is shown as a working — what matched, what did not — and saving
   is a second, separate tap. An import that silently dropped half a
   recipe, or quietly put salmon in a chili, would be worse than one that
   refused.

   Unmatched lines are listed rather than hidden. They are the ones worth
   knowing about: an ingredient Loadout could not place is an ingredient
   the portions will not account for, and someone reading their own
   imported dish should be able to see the gap rather than discover it in
   a macro total.
   ============================================================ */

  (function(){

    const input  = document.getElementById('recipeImportUrl');
    const go     = document.getElementById('recipeImportGo');
    const result = document.getElementById('recipeImportResult');
    if (!input || !go || !result) return;

    /* The parsed import waiting on a decision. Held here rather than
       written to state, because nothing is saved until it is saved. */
    let pending = null;

    function say(html, cls){
      result.innerHTML = html
        ? '<p class="subtitle" style="font-size:11px; margin:10px 0 0;' +
          (cls === 'warn' ? ' color:var(--red);' : '') + '">' + html + '</p>'
        : '';
    }

    function slotLabel(slot){
      return {protein:'protein', carb:'carb', fat:'fat',
              veg:'veg', fruit:'fruit', sauce:'sauce'}[slot] || slot;
    }

    function showResult(res){
      if (!res.ok){ pending = null; say(escapeHtml(res.why), 'warn'); return; }
      pending = res;

      const rows = res.matched.map(function(m){
        return '<div class="jrow">' +
                 '<span class="jname">' + escapeHtml(m.label) +
                   '<small style="display:block;color:var(--muted);font-size:11px;">' +
                     escapeHtml(m.raw) + '</small>' +
                 '</span>' +
                 '<span class="jkcal">' + slotLabel(m.slot) + '</span>' +
               '</div>';
      }).join('');

      const missed = res.unmatched.length
        ? '<div class="season-hint" style="margin-top:12px;">' +
            'Not matched, so not portioned: ' +
            res.unmatched.map(function(u){ return escapeHtml(u.raw); }).join('; ') +
          '</div>'
        : '';

      result.innerHTML =
        '<div class="panel" style="margin-top:10px;">' +
          '<div class="jmeal-head">' +
            '<span class="eaten-title">' + escapeHtml(res.recipe.name) + '</span>' +
            '<span class="eaten-total">' + res.matched.length + ' matched</span>' +
          '</div>' +
          rows + missed +
          '<div class="season-hint" style="margin-top:12px;">From ' +
            escapeHtml(res.recipe._source.site) +
            '. Loadout keeps which foods this dish uses and sizes them to your ' +
            'targets — the amounts on the page are not copied.</div>' +
          '<button class="mini-btn add" id="recipeImportKeep" style="margin-top:10px;">KEEP THIS RECIPE</button>' +
          '<button class="mini-btn add" id="recipeImportDrop" style="margin-top:6px;">DISCARD</button>' +
        '</div>';

      const keep = document.getElementById('recipeImportKeep');
      if (keep) keep.addEventListener('click', function(){
        if (!pending) return;
        if (!saveImportedRecipe(pending.recipe)) return;
        const name = pending.recipe.name;
        pending = null;
        input.value = '';
        if (typeof saveState === 'function') saveState();
        if (typeof renderRecipeBook === 'function') renderRecipeBook();
        say('Kept ' + escapeHtml(name) + '. It is in your book now.');
      });

      const drop = document.getElementById('recipeImportDrop');
      if (drop) drop.addEventListener('click', function(){
        pending = null;
        result.innerHTML = '';
      });
    }

    function run(){
      const url = input.value.trim();
      if (!url) return;
      if (typeof importRecipeFromUrl !== 'function') return;
      go.disabled = true;
      say('Reading&hellip;');
      importRecipeFromUrl(url)
        .then(showResult)
        .catch(function(){ say('That import failed.', 'warn'); })
        .then(function(){ go.disabled = false; });
    }

    go.addEventListener('click', run);
    input.addEventListener('keydown', function(e){
      if (e.key === 'Enter'){ e.preventDefault(); run(); }
    });

  })();
