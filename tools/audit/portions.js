'use strict';
/* ============================================================
   Does a meal land on the calories it was given?

   Bread, tortillas and buns cannot be served in fractions, so the portion
   pass rounds them up to whole units after the balance has already landed on
   the target. A sitting that cannot afford a whole one of something comes
   back over its target, and a sitting nothing can fill comes back under it.

   WHAT THIS MEASURES

   Every meal of every prep, across random profiles, as a ratio of what it
   served to what that sitting was given. The tail is what matters — a worst
   case of 2x means somebody's day is 500 kcal out.
   ============================================================ */

function run(app, opts){
  const runs = opts.runs || 800;
  const r = JSON.parse(app.run(`(function(){
    var n = 0, over10 = 0, over25 = 0, under25 = 0, worst = 0, worstName = '';
    for (var run = 0; run < ${runs}; run++){
      randomProfile();
      try { generateSuggestion(); applyDayToSelections(1); } catch (e){ continue; }
      MEALS.forEach(function(m){
        var sel = state.selections[m.key];
        if (!sel) return;
        var plan, kcal = 0;
        try { plan = computeMealPlan(m.key); } catch (e){ return; }
        SLOT_DEFS.forEach(function(def){
          (sel[def.slot] || []).forEach(function(k, i){
            if (!k) return;
            var f = def.list().find(function(x){ return x.key === k; });
            var g = plan[def.slot] && plan[def.slot][i];
            if (f && g) kcal += f.kcal * g / 100;
          });
        });
        var want = currentTargets().kcal * m.share;
        if (!(want > 0) || !(kcal > 0)) return;
        n++;
        var ratio = kcal / want;
        if (ratio > 1.10) over10++;
        if (ratio > 1.25) over25++;
        if (ratio < 0.75) under25++;
        if (ratio > worst){ worst = ratio; worstName = (sel.dish || m.key) + ' ' + Math.round(kcal) + '/' + Math.round(want); }
      });
    }
    return JSON.stringify({n:n, over10:over10, over25:over25, under25:under25,
                           worst:worst.toFixed(2), worstName:worstName});
  })()`));

  const pct = x => (100 * x / (r.n || 1)).toFixed(2) + '%';
  return {
    headline: r.n + ' meals, ' + r.over10 + ' more than 10% over target (' + pct(r.over10) + ')',
    detail: [
      '  more than 25% over : ' + r.over25 + ' (' + pct(r.over25) + ')',
      '  more than 25% under: ' + r.under25 + ' (' + pct(r.under25) + ')',
      '  worst              : ' + r.worst + 'x   ' + r.worstName,
    ],
    failed: r.over10 / (r.n || 1) > 0.005,
  };
}

module.exports = {name: 'portions', describe: 'does a meal land on its calorie target', run};
