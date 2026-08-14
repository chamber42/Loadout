'use strict';
/* ============================================================
   LOADOUT - PREP DAYS + COOK TIMES + COOK PLAN
   From app.js lines 6316-6601 of the original single file.
   Loaded in order by index.html; all files share one global scope,
   so declarations here are visible to every file listed after it.
   ============================================================ */

  /* =========================================================
     PREP DAYS
     The plan as you'll actually live it: one row per day you're cooking
     for, each opening the full plate-by-plate breakdown for that day.
     Dishes repeat across days by design — this is where you see how.
  ========================================================= */
  const DISH_COLORS = ['var(--green)','var(--cyan)','var(--amber)','var(--magenta)','#8ab4ff','#ff8a65','#b388ff','#4dd0e1'];

  /* Totals for one day, computed from that day's actual dishes */
  function prepDayTotals(dayIdx){
    const out = {kcal:0, protein:0, carbs:0, fat:0};
    const keep = state.activeDay;
    applyDayToSelections(dayIdx + 1);
    MEALS.forEach(m=>{
      const plan = computeMealPlan(m.key);
      const sel = state.selections[m.key];
      SLOT_DEFS.forEach(d=>{
        (sel[d.slot] || []).forEach((k,i)=>{
          const g = plan[d.slot][i];
          if (!k || g == null) return;
          const f = d.list().find(x=>x.key === k);
          if (!f) return;
          out.kcal += f.kcal*g/100; out.protein += f.protein*g/100;
          out.carbs += f.carbs*g/100; out.fat += f.fat*g/100;
        });
      });
    });
    applyDayToSelections(keep);
    return out;
  }

  /* Which unique dish sits in each sitting on a given day */
  function prepDayDishes(dayIdx){
    return MEALS.map(m=>{
      const ref = dishRefFor(m.key, dayIdx);
      const dish = dishAt(ref);
      return {meal:m, ref, dish};
    });
  }

  /* A stable colour per unique dish, so you can see the rotation at a glance */
  function dishColor(ref){
    if (!ref || !state.prep) return 'var(--green)';
    const offset = ref.store === 'snacks' ? (state.prep.meals || []).length : 0;
    return DISH_COLORS[(ref.index + offset) % DISH_COLORS.length];
  }

  /* =========================================================
     COOK TIMES
     Recipes carry a `form` — Skillet, Tray, Slow Cooker — which already
     says most of what there is to say about how long a dish takes and what
     it occupies. Rather than hand-timing 239 recipes, timings are seeded
     from the form and a recipe can override with its own `time`.

     Two numbers, not one. Total is wall clock; active is hands-on. A tray
     bake and a stir-fry can both be "30 minutes" while being nothing alike
     to cook, and it's the hands-on number that decides whether a Sunday
     afternoon is enough.

     `stage` is cook order: 1 starts first because it runs longest without
     you, 4 is assembled last because it goes soggy or cold.
  ========================================================= */
  const GEAR = {
    oven:   {icon:'fire', name:'oven'},
    stove:  {icon:'egg', name:'hob'},
    slow:   {icon:'turtle', name:'slow cooker'},
    fryer:  {icon:'steam', name:'air fryer'},
    none:   {icon:'knife', name:'no heat'},
    chill:  {icon:'snowflake', name:'fridge'},
  };

  /* active, total, gear, stage */
  const FORM_COOK = {
    'Slow Cooker':{a:15,t:300,g:'slow', s:1},
    'Roast':      {a:15,t:75, g:'oven', s:1},
    'Stew':       {a:20,t:70, g:'stove',s:1},
    'Chili':      {a:20,t:60, g:'stove',s:1},
    'Pudding':    {a:5, t:245,g:'chill',s:1},
    'Jar':        {a:5, t:245,g:'chill',s:1},
    'Bites':      {a:10,t:70, g:'chill',s:1},
    'Bake':       {a:15,t:50, g:'oven', s:2},
    'Tray':       {a:15,t:45, g:'oven', s:2},
    'Meal Prep':  {a:25,t:50, g:'oven', s:2},
    'Muffins':    {a:15,t:35, g:'oven', s:2},
    'Skewers':    {a:15,t:30, g:'oven', s:2},
    'Soup':       {a:20,t:45, g:'stove',s:2},
    'Curry':      {a:20,t:40, g:'stove',s:2},
    'Treat':      {a:10,t:40, g:'oven', s:2},
    'Air Fryer':  {a:8, t:25, g:'fryer',s:2},
    'Pasta':      {a:15,t:30, g:'stove',s:3},
    'Noodles':    {a:12,t:25, g:'stove',s:3},
    'Hash':       {a:15,t:30, g:'stove',s:3},
    'Skillet':    {a:15,t:25, g:'stove',s:3},
    'Stir-Fry':   {a:15,t:20, g:'stove',s:3},
    'Fajitas':    {a:15,t:25, g:'stove',s:3},
    'Tacos':      {a:15,t:25, g:'stove',s:3},
    'Burrito':    {a:15,t:25, g:'stove',s:3},
    'Burger':     {a:12,t:22, g:'stove',s:3},
    'Pancakes':   {a:12,t:22, g:'stove',s:3},
    'Waffles':    {a:12,t:22, g:'stove',s:3},
    'Plate':      {a:15,t:25, g:'stove',s:3},
    'Bowl':       {a:15,t:25, g:'stove',s:3},
    'Quesadilla': {a:8, t:14, g:'stove',s:3},
    'Melt':       {a:8, t:14, g:'stove',s:3},
    'Oats':       {a:5, t:12, g:'stove',s:4},
    'Toast':      {a:5, t:8,  g:'stove',s:4},
    'Bagel':      {a:4, t:7,  g:'stove',s:4},
    'Salad':      {a:10,t:10, g:'none', s:4},
    'Sandwich':   {a:8, t:8,  g:'none', s:4},
    'Sub':        {a:8, t:8,  g:'none', s:4},
    'Wrap':       {a:7, t:7,  g:'none', s:4},
    'Wraps':      {a:7, t:7,  g:'none', s:4},
    'Roll':       {a:7, t:7,  g:'none', s:4},
    'Roll-Ups':   {a:6, t:6,  g:'none', s:4},
    'Board':      {a:10,t:10, g:'none', s:4},
    'Parfait':    {a:5, t:5,  g:'none', s:4},
    'Cup':        {a:5, t:5,  g:'none', s:4},
    'Snack':      {a:5, t:5,  g:'none', s:4},
    'Shake':      {a:3, t:3,  g:'none', s:4},
    'Drink':      {a:3, t:3,  g:'none', s:4},
    'Frozen':     {a:5, t:5,  g:'none', s:4},
  };
  const COOK_FALLBACK = {a:12, t:20, g:'stove', s:3};

  /* Cooking four portions is not four times the work, but it is not the
     same work either — more chopping, more batches in the pan. The hands-on
     part grows; the oven does not care how full it is. */
  function cookTime(recipe, servings){
    if (!recipe) return null;
    /* A recipe already tagged "no cooking" should never be handed a hob and
       fifteen minutes because its form happens to be Plate or Bowl. The
       tag is more specific than the form, so it wins. */
    const nocook = (recipe.crave || []).includes('nocook');
    const base = (recipe.time && recipe.time.a) ? recipe.time
               : nocook ? {a:6, t:6, g:'none', s:4}
               : (FORM_COOK[recipe.form] || COOK_FALLBACK);
    const n = Math.max(1, servings || 1);
    const extra = Math.round(base.a * 0.3 * (n - 1));
    return {
      active: base.a + extra,
      total:  base.t + extra,
      gear:   base.g,
      stage:  base.s,
      form:   recipe.form || '',
    };
  }

  function mins(n){
    n = Math.round(n);
    if (n < 60) return n + 'm';
    const h = Math.floor(n / 60), m = n % 60;
    return m ? h + 'h ' + m + 'm' : h + 'h';
  }

  function clockAt(n){
    n = Math.round(n);
    return Math.floor(n / 60) + ':' + String(n % 60).padStart(2, '0');
  }

  /* =========================================================
     COOK PLAN
     Prep screens usually hand you a pile of recipes and let you work out
     the order. The order is the hard part: start the slow cooker last and
     you eat at midnight. Dishes are sorted by how long they run without
     you, then laid on a clock where the unattended stretches overlap with
     the next dish's hands-on time — which is what actually happens in a
     kitchen, and why "three 30-minute recipes" is not 90 minutes.
  ========================================================= */
  function cookPlan(){
    if (!prepReady()) return null;
    const usage = prepDishUsage();
    if (!usage) return null;

    const jobs = [];
    [].concat(usage.meals, usage.snacks).forEach(rec=>{
      const servings = rec.days.length;
      if (!servings) return;
      const recipe = RECIPES.find(r => r.name === (rec.dish || {})._recipe);
      const t = cookTime(recipe, servings);
      if (!t) return;
      jobs.push({
        name: (rec.dish && rec.dish.dish) || (recipe && recipe.name) || 'Dish',
        recipe, servings, ref:{store:rec.store, index:rec.index},
        /* The plate was rebuilt around what was available, so the dish's
           written method describes food that isn't on it any more. */
        improvised: !!(rec.dish && rec.dish._improvised), ...t,
      });
    });
    if (!jobs.length) return null;

    // longest unattended first, so its dead time covers everything after it
    jobs.sort((a,b)=> (a.stage - b.stage) || (b.total - a.total) || (b.active - a.active));

    let cursor = 0;
    jobs.forEach(j=>{ j.start = cursor; j.end = cursor + j.total; cursor += j.active; });

    const handsOn = jobs.reduce((n,j)=> n + j.active, 0);
    const wallClock = jobs.reduce((n,j)=> Math.max(n, j.end), 0);

    /* Two things wanting the oven at the same moment is the single most
       common way a prep plan falls apart in a real kitchen. */
    const clashes = [];
    ['oven','slow','fryer'].forEach(g=>{
      const on = jobs.filter(j=>j.gear === g);
      for (let i = 0; i < on.length; i++)
        for (let k = i + 1; k < on.length; k++)
          if (on[i].start < on[k].end && on[k].start < on[i].end)
            clashes.push({gear:g, a:on[i].name, b:on[k].name});
    });

    return {jobs, handsOn, wallClock, clashes,
            servings: jobs.reduce((n,j)=> n + j.servings, 0)};
  }

  function renderCookPlan(){
    const host = document.getElementById('cookPlanBody');
    const plan = cookPlan();
    if (!plan){
      host.innerHTML = `<div class="panel"><div class="fav-nores">
        Build a prep first and the cook order shows up here.</div></div>`;
      return;
    }

    const seen = {};
    const gearLine = plan.jobs.reduce((acc,j)=>{
      seen[j.gear] = (seen[j.gear] || 0) + 1; return acc; }, null);
    const gearSummary = Object.keys(seen).filter(g=>g !== 'none')
      .map(g=>`${ic(GEAR[g].icon)} ${GEAR[g].name}`).join(' · ');

    host.innerHTML = `<div class="panel">
      <div class="eaten-head">
        <span class="eaten-title"><svg class="px" aria-hidden="true"><use href="#i-timer"></use></svg> THE WHOLE SESSION</span>
        <span class="eaten-total">${mins(plan.wallClock)}</span>
      </div>
      <div class="kv"><span>Hands-on</span><span style="color:var(--green)">${mins(plan.handsOn)}</span></div>
      ${plan.wallClock > plan.handsOn
        ? `<div class="kv"><span>Waiting around</span><span>${mins(plan.wallClock - plan.handsOn)}</span></div>`
        : `<div class="kv"><span>Waiting around</span><span style="color:var(--green)">none — every gap is filled</span></div>`}
      <div class="kv"><span>Dishes</span><span>${plan.jobs.length} · ${plan.servings} servings</span></div>
      ${gearSummary ? `<div class="kv"><span>You'll need</span><span>${gearSummary}</span></div>` : ''}
      <div class="season-hint" style="margin-top:10px;">
        Times assume you're cooking every serving at once. The clock runs from the
        moment you start — later dishes are timed to be done while earlier ones sit.
      </div>
    </div>

    <div class="panel">
      <div class="slot-label" style="margin-bottom:6px;"><svg class="px" aria-hidden="true"><use href="#i-egg"></use></svg> IN THIS ORDER</div>
      ${plan.jobs.map((j, i)=>{
        const col = dishColor(j.ref);
        const activePct = Math.max(4, Math.round(j.active / Math.max(1, j.total) * 100));
        return `<div class="cook-step">
          <div class="cook-clock">${clockAt(j.start)}</div>
          <div class="cook-main">
            <div class="cook-name" style="color:${col}">${i+1}. ${escapeHtml(j.name)}
              <span class="gear-tag">${ic(GEAR[j.gear].icon)} ${escapeHtml(j.form || GEAR[j.gear].name)}</span></div>
            <div class="cook-meta">${j.servings} serving${j.servings === 1 ? '' : 's'} ·
              <strong class="n-green">${mins(j.active)} hands-on</strong>
              ${j.total > j.active ? ` · ${mins(j.total - j.active)} unattended · done by ${clockAt(j.end)}` : ''}</div>
            <div class="cook-bar"><span style="width:${activePct}%; background:${col};"></span></div>
            <button class="mini-btn timer-start" data-timer-mins="${j.total}"
                    data-timer-label="${escapeHtml(j.name)}"><svg class="px" aria-hidden="true"><use href="#i-timer"></use></svg> START ${escapeHtml(mins(j.total))} TIMER</button>
          </div>
        </div>`;
      }).join('')}
    </div>

    ${plan.clashes.length ? `<div class="panel">
      <div class="slot-label" style="margin-bottom:6px;"><svg class="px" aria-hidden="true"><use href="#i-warn"></use></svg> ONE KITCHEN, TWO DISHES</div>
      ${plan.clashes.map(c=>`<div class="cook-warn">
        <strong>${escapeHtml(c.a)}</strong> and <strong>${escapeHtml(c.b)}</strong>
        both want the ${GEAR[c.gear].name} at the same time. Run them together if the
        temperatures are close, or push the second one back by
        ${escapeHtml(GEAR[c.gear].name === 'oven' ? 'the first one\'s bake time' : 'a cycle')}.
      </div>`).join('')}
    </div>` : ''}

    <div class="panel">
      <div class="slot-label" style="margin-bottom:6px;"><svg class="px" aria-hidden="true"><use href="#i-book"></use></svg> METHODS IN ORDER</div>
      ${plan.jobs.map((j, i)=> (j.recipe && j.recipe.steps && j.recipe.steps.length && !j.improvised)
        ? `<details class="rsteps"><summary>${i+1}. ${escapeHtml(j.name)} — ${j.recipe.steps.length} steps</summary>
             <ol>${j.recipe.steps.map(st=>`<li>${escapeHtml(st)}</li>`).join('')}</ol>
           </details>`
        : `<div class="cook-meta">${i+1}. ${escapeHtml(j.name)} — no written method; it's an assembly job.</div>`
      ).join('')}
    </div>`;
  }

