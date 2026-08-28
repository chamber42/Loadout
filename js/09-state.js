'use strict';
/* ============================================================
   LOADOUT - STATE
   From app.js lines 5137-5232 of the original single file.
   Loaded in order by index.html; all files share one global scope,
   so declarations here are visible to every file listed after it.
   ============================================================ */

  /* =========================================================
     STATE
  ========================================================= */
  const state = {
    theme:'cyberpunk',
    mode:'direct',        // 'direct' = paste a target, 'calc' = estimate it
    directKcal:null, directP:null, directC:null, directF:null,
    goal:null,
    activity:null,
    sex:null,
    bodyweight:null,
    heightIn:null,
    age:null,
    /* Training is described once, as a typical session. Whether a given day
       counts as a training day is a property of the PREP, not the character —
       see state.trainingDays and the schedule's per-day kind. */
    exerciseMode:'none',   // 'none' | 'auto' | 'custom'
    exerciseRaw:null,      // the custom burn the person typed, kept off the DOM
    exerciseKcal:0,        // credited burn added on a training day
    tdee:null,
    finalKcal:null,       // the rest-day target — the character's base number
    restKcal:null,        // base target, nothing added
    trainKcal:null,       // base + credited training burn
    trainingDays:0,       // how many of the prepped days are training days
    sheetDayView:'rest',  // which column the character sheet's macros show
    assignedTierId:null,  // tier is a label derived from finalKcal
    selectedTierId:null,
    preferences:[], // e.g. ["vegetarian","nutfree"]
    cravings:[],    // e.g. ["savory","crunchy"]
    favorites:{protein:[], carb:[], fat:[], veg:[], fruit:[], sauce:[]},
    discoveryMode:'favorites',   // 'favorites' | 'new'
    dislikes:[],      // food keys the person never wants suggested
    mustUse:[],
    mustQty:{},       // key -> grams available (blank = unlimited)
    onHandUsed:[], onHandUnused:[],       // ingredients on hand — every one of these has to appear
    mealPlan:'3+1',       // which meal configuration
    mealCount:4,          // derived: total sittings
    mealWeights:{},       // index -> 'light' | 'normal' | 'heavy'
    skipBreakfast:false,
    breakfastForDinner:false,
    breakfastAllDay:false,
    prepServings:1,     // days being cooked for
    log:{},             // date -> what was actually eaten
    journalMeals:0,     // fallback slot count when there's no prep plan
    calDate:null, calMode:'month', calSel:null, journalDate:null,
    recipeQuery:'', recipeFilter:'all', recipeGoal:'any', seedRecipe:null,
    uniqueMeals:null,   // distinct main dishes across the WHOLE prep
    uniqueSnacks:null,  // distinct snacks across the whole prep, counted apart
    prep:null,          // {days, mealKeys, snackKeys, meals[], snacks[], schedule[]}
    activeDay:1,        // which prepped day the loadout screen is editing
    portionOverrides:{},// mealKey -> slot -> index -> grams the person set by hand
    variety:{protein:2, carb:2, fat:2, veg:3},
    eaten:[],         // day-level manual entries: {name,kcal,protein,carbs,fat,covers}
    /* Packaged products scanned into a loadout slot. Same shape as a library
       food, kept per slot, and merged into FOODS on load so every lookup,
       portion calculation and shopping list treats them like anything else. */
    customFoods:{protein:[], carb:[], fat:[], veg:[], fruit:[], sauce:[]},
    eatingStyle:null, // 'consistent' | 'balanced' | 'variety'
    // selections[mealKey] = {protein:[keys], carb:[], fat:[], veg:[], fruit:[], sauce:[], notes:""}
    selections:{}
  };
  function blankMeal(){ return {protein:[""], carb:[""], fat:[""], veg:[""], fruit:[""], sauce:[], notes:"", dish:""}; }

  function setMealPlan(key){
    MEAL_FLAGS.skipBreakfast = !!state.skipBreakfast;
    MEAL_FLAGS.mealWeights = state.mealWeights || {};
    state.mealPlan = key;
    MEALS = buildMeals(key);
    state.mealCount = MEALS.length;
    state.selections = {};
    MEALS.forEach(m => state.selections[m.key] = blankMeal());
    /* The prep schedules dishes against specific sittings. Change the shape
       of the day and those slots no longer exist, so the plan has to go
       rather than linger pointing at meals that aren't there. */
    state.prep = null;
    state.portionOverrides = {};
    state.activeDay = 1;
    reconcileJournalSlots();
  }

  /* Kept for saved plans written before configurations existed */
  function setMealCount(n){
    const mains = Math.min(n, 3);
    const key = mains + (n - mains ? '+' + (n - mains) : '');
    setMealPlan(MEAL_PLANS.some(p=>p.key===key) ? key : '3+1');
  }

  function rebuildMeals(){
    MEAL_FLAGS.skipBreakfast = !!state.skipBreakfast;
    MEAL_FLAGS.mealWeights = state.mealWeights || {};
    const prev = state.selections || {};
    MEALS = buildMeals(state.mealPlan);
    state.mealCount = MEALS.length;
    const next = {};
    MEALS.forEach(m => next[m.key] = prev[m.key] || blankMeal());
    state.selections = next;
    reconcileJournalSlots();
  }
  MEALS.forEach(m => state.selections[m.key] = blankMeal());

