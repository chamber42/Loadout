'use strict';
/* ============================================================
   Do the answers given on the prep screens govern the prep?

   Someone sets "two proteins" and stars six of them. The number is a
   shopping list count, not a calorie one: two different proteins across the
   whole prep. Before this was measured it was a starting count rather than a
   number — three dishes with different tastes handed back three, four or
   five, and the starred foods were put on the list first and then topped up
   at random.

   WHAT THIS MEASURES

   For each slot: how often the prep came back carrying more distinct foods
   than the number asked for, and what share of what it did carry was starred.

   A prep with a snack sitting in it usually buys one more of each than the
   number says — a snack wants a different kind of carb from a dinner — which
   is why the prep screen shows the range rather than the bare number. Read
   "over" against that, not against zero.
   ============================================================ */

function run(app, opts){
  const runs = opts.runs || 300;
  app.run(`state.variety = {protein:2, carb:2, fat:2, veg:2};
           state.discoveryMode = 'favorites';
           state.favorites = {
             protein:['chicken','beef93','wholeegg','yogurt0','salmon','grndturk93'],
             carb:['rice','oats','potato','pasta','sourdough','quinoa'],
             fat:['oil','avocado','pb','almonds'],
             veg:['broccoli','spinach','peppers','carrots']};`);

  const r = JSON.parse(app.run(`(function(){
    var slots = ['protein','carb','fat','veg'], out = {};
    slots.forEach(function(s){ out[s] = {over:0, most:0, sum:0, fav:0, all:0}; });
    for (var i = 0; i < ${runs}; i++){
      generateSuggestion();
      var dishes = (state.prep.meals || []).concat(state.prep.snacks || []);
      slots.forEach(function(s){
        var used = {};
        dishes.forEach(function(d){ (d[s] || []).forEach(function(k){ if (k) used[k] = 1; }); });
        var keys = Object.keys(used), o = out[s];
        o.sum += keys.length;
        if (keys.length > o.most) o.most = keys.length;
        if (keys.length > varietyBudget(s)) o.over++;
        keys.forEach(function(k){
          o.all++;
          if ((state.favorites[s] || []).indexOf(k) >= 0) o.fav++;
        });
      });
    }
    return JSON.stringify(out);
  })()`));

  const lines = Object.entries(r).map(([slot, o]) =>
    '  ' + slot.padEnd(9) + 'asked 2, averaged ' + (o.sum / runs).toFixed(2) +
    ', most ' + o.most + ', over on ' + (100 * o.over / runs).toFixed(0) + '% of preps' +
    ', starred ' + (o.all ? (100 * o.fav / o.all).toFixed(0) : '-') + '%');

  const worstOver = Math.max.apply(null, Object.values(r).map(o => o.over / runs));
  const worstFav = Math.min.apply(null, Object.values(r).map(o => (o.all ? o.fav / o.all : 1)));
  return {
    headline: runs + ' preps set to two of everything, with six starred proteins',
    detail: lines,
    failed: worstOver > 0.6 || worstFav < 0.6,
  };
}

module.exports = {name: 'options', describe: 'do the prep screens govern the prep', run};
