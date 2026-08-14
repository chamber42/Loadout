'use strict';
/* ============================================================
   LOADOUT - NAVIGATION + RECIPE BOOK
   From app.js lines 5233-5331 of the original single file.
   Loaded in order by index.html; all files share one global scope,
   so declarations here are visible to every file listed after it.
   ============================================================ */

  /* =========================================================
     NAVIGATION
  ========================================================= */
  /* =========================================================
     RECIPE BOOK
  ========================================================= */
  const RECIPE_FILTERS = [
    {key:'all',      label:'All'},
    {key:'highprot', label:'High protein'},
    {key:'highcarb', label:'High carb'},
    {key:'lowcal',   label:'Lighter'},
    {key:'treat',    label:'Sweet treat'},
    {key:'quick',    label:'No cooking'},
    {key:'veg',      label:'Meat-free'},
    {key:'breakfast',label:'Breakfast'},
    {key:'sauce',    label:'Sauces'},
  ];

  /* Rough per-serving figures, using the middle option in each slot, so the
     book can be sorted and filtered without pretending to exact numbers. */
  function recipeProfile(r){
    const pick = slot => {
      const keys = r[slot] || [];
      for (const k of keys){
        const f = listFor(slot).find(x=>x.key === k);
        if (f) return f;
      }
      return null;
    };
    const P = pick('protein'), C = pick('carb'), F = pick('fat');
    const g = {protein:150, carb:70, fat:15};
    let kcal = 0, prot = 0, carb = 0;
    [[P,'protein'],[C,'carb'],[F,'fat']].forEach(([f,slot])=>{
      if (!f) return;
      kcal += f.kcal    * g[slot] / 100;
      prot += f.protein * g[slot] / 100;
      carb += f.carbs   * g[slot] / 100;
    });
    return {kcal:Math.round(kcal), protein:Math.round(prot), carbs:Math.round(carb), P, C, F};
  }

  /* ---------------------------------------------------------
     LIGHTER SWAPS
     Within a slot, swap for the leanest option the recipe already allows —
     85/15 beef becomes 93/7, sour cream becomes 0% Greek yogurt. Only
     substitutes the recipe or its family already permits, so a lighter
     version is still recognisably the same dish rather than a different
     meal wearing its name.
  --------------------------------------------------------- */
  const SWAP_SLOTS = ['protein','carb','fat','sauce'];

  function lighterSwaps(recipe){
    const swaps = [];
    let saving = 0;
    const per = {protein:150, carb:70, fat:15, sauce:30};

    SWAP_SLOTS.forEach(slot=>{
      const all = recipeOptions(recipe, slot)
        .map(k=>listFor(slot).find(f=>f.key===k))
        .filter(f=>f && passesPrefs(f) && !isDisliked(f));
      if (all.length < 2) return;

      // what the dish would normally reach for — its first listed choice
      const base = all.find(f=>(recipe[slot]||[]).includes(f.key)) || all[0];

      /* Only swap inside the same family. Pork belly to pork loin is a
         lighter banh mi; pork belly to tofu is a different sandwich. This
         is the difference between a swap and a substitution. */
      const fam = FAMILY[base.key];
      if (!fam) return;
      const opts = all.filter(f=>FAMILY[f.key] === fam);
      if (opts.length < 2) return;

      const lean = opts.reduce((a,b)=> b.kcal < a.kcal ? b : a, base);
      if (lean.key === base.key) return;

      // a swap that guts the protein isn't lighter, it's just worse
      if (slot === 'protein' && lean.protein < base.protein * 0.8) return;
      const diff = (base.kcal - lean.kcal) * per[slot] / 100;
      if (diff < 15) return;
      saving += diff;
      swaps.push({slot, from: shortName(base), to: shortName(lean), fromKey:base.key, toKey:lean.key});
    });

    return {saving: Math.round(saving), swaps};
  }

  /* A copy of the recipe with the lean option promoted to first choice */
  function lightenRecipe(recipe){
    const {swaps} = lighterSwaps(recipe);
    const copy = {...recipe, name: recipe.name + ' (lighter)'};
    swaps.forEach(sw=>{
      const list = (recipe[sw.slot] || []).slice();
      const without = list.filter(k=>k !== sw.toKey);
      copy[sw.slot] = [sw.toKey, ...without];
    });
    return copy;
  }

