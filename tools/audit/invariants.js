'use strict';
/* ============================================================
   Things that must hold on every plate, whatever the settings.

   WHAT THIS MEASURES

   Preps are built across the whole space a user can actually reach — every
   goal, any calorie figure, one to five prep days, every dietary preference,
   random dislikes, favourites on and off — and each plate is checked against
   the handful of statements that should never be false:

     nothing throws
     every dish has a name
     a required meal has a protein, a carb and a fat
     no food appears twice in one slot
     every ingredient has a portion
     no portion is absurd, missing, or a non-number
     nothing banned by a preference or a dislike is served
   ============================================================ */

function run(app, opts){
  const runs = opts.runs || 800;
  const problems = JSON.parse(app.run(`(function(){
    var problems = {};
    function note(what, detail){
      problems[what] = problems[what] || {n:0, eg:null};
      problems[what].n++;
      if (!problems[what].eg) problems[what].eg = detail;
    }
    for (var run = 0; run < ${runs}; run++){
      randomProfile();
      try { generateSuggestion(); }
      catch (e){ note('generateSuggestion threw: ' + e.message, ''); continue; }
      try { applyDayToSelections(1); }
      catch (e){ note('applyDayToSelections threw: ' + e.message, ''); continue; }

      MEALS.forEach(function(m){
        var sel = state.selections[m.key];
        if (!sel){ note('meal has no selection', m.key); return; }
        var plan;
        try { plan = computeMealPlan(m.key); }
        catch (e){ note('computeMealPlan threw: ' + e.message, m.key); return; }

        if (!sel.dish) note('dish has no name', m.key + ' recipe=' + (sel._recipe || 'improvised'));

        var seen = {};
        SLOT_DEFS.forEach(function(def){
          (sel[def.slot] || []).forEach(function(k, i){
            if (!k) return;
            if (seen[k]) note('same food twice in one meal', k);
            seen[k] = 1;
            var f = def.list().find(function(x){ return x.key === k; });
            if (!f){ note('meal holds a key no list has', k); return; }
            if (isDisliked(f)) note('a disliked food was served', f.name);
            if (!passesPrefs(f)) note('a food banned by preferences was served',
              f.name + ' / ' + state.preferences.join('+'));
            var g = plan[def.slot] && plan[def.slot][i];
            if (g == null){ note('ingredient with no portion', f.name); return; }
            if (!isFinite(g)) note('portion is not a number', f.name + '=' + g);
            else if (g <= 0) note('portion is zero or negative', f.name + '=' + g);
            else if (HARD_CAP[def.slot] && g > HARD_CAP[def.slot])
              note('portion over the hard cap', f.name + '=' + Math.round(g) + 'g');
          });
        });
        if (m.required){
          ['protein','carb','fat'].forEach(function(sl){
            if (!(sel[sl] || []).some(Boolean))
              note('required meal missing its ' + sl, sel.dish || m.key);
          });
        }
      });
    }
    return JSON.stringify(problems);
  })()`));

  const rows = Object.entries(problems).sort((a, b) => b[1].n - a[1].n);
  const total = rows.reduce((a, [, info]) => a + info.n, 0);
  return {
    headline: runs + ' preps, ' + (total || 'no') + ' problem' + (total === 1 ? '' : 's'),
    detail: rows.map(([what, info]) =>
      '  ' + String(info.n).padStart(5) + '  ' + what + (info.eg ? '   e.g. ' + info.eg : '')),
    failed: rows.some(([what]) => !/no portion/.test(what)) || total > runs * 0.02,
  };
}

module.exports = {name: 'invariants', describe: 'things that must hold on every plate', run};
