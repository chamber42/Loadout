'use strict';
/* ============================================================
   LOADOUT - SAUCE RECIPES
   From app.js lines 4683-5136 of the original single file.
   Loaded in order by index.html; all files share one global scope,
   so declarations here are visible to every file listed after it.
   ============================================================ */

  /* =========================================================
     SAUCE RECIPES
     Batch sauces, made once and used all week. These are also registered
     as sauces in FOODS, so a meal can be built around one; this array is
     what the recipe book shows you to actually make it.
  ========================================================= */
  const SAUCE_RECIPES = [
    {key:"hpranch", name:"High-Protein Ranch", yield:"~11 servings", per:"~25 kcal · 4g protein · 2g carbs · 0g fat per 40g",
     ingredients:[
       "Nonfat Greek yogurt — 2 cups (448g)",
       "Hidden Valley Ranch seasoning — 1 packet (28g)",
       "Unsweetened almond milk — 2–4 tbsp"],
     steps:[
       "Whisk the seasoning into the yogurt before adding any liquid, or you get dry pockets.",
       "Add the almond milk a tablespoon at a time until it falls off the whisk in a ribbon.",
       "Rest it in the fridge for at least an hour. Ranch seasoning tastes dusty until it hydrates.",
       "Taste again after resting — it usually needs a squeeze of lemon or vinegar to lift it.",
       "Keeps 5–7 days; it thickens over time, so loosen with a splash of milk."]},
    {key:"jalapyog", name:"Creamy Jalapeño Yogurt Sauce", yield:"~6 servings", per:"~20 kcal · 3g protein · 2g carbs · 0g fat per 40g",
     ingredients:[
       "Nonfat Greek yogurt — 1 cup (224g)",
       "Pickled jalapeños — 30g",
       "Lime juice — 15g",
       "Garlic powder + salt",
       "Splash of jalapeño brine (optional)"],
     steps:[
       "Blend the jalapeños, lime and garlic powder first, before the yogurt goes in.",
       "Add the yogurt and pulse only briefly — over-blending Greek yogurt turns it thin and runny.",
       "Adjust heat with the brine rather than more peppers; brine adds heat and acid without bulk.",
       "Salt at the end, after the brine, or it lands too salty.",
       "Best on day two once the heat has spread evenly through it."]},
    {key:"tacoyog", name:"Greek Yogurt Taco Sauce", yield:"~6 servings", per:"~25 kcal · 4g protein · 2g carbs · 0g fat per 40g",
     ingredients:[
       "Nonfat Greek yogurt — 1 cup (224g)",
       "Taco seasoning — 1 tbsp",
       "Lime juice",
       "Water to thin (optional)"],
     steps:[
       "Stir the taco seasoning into the yogurt and let it sit 10 minutes before judging it.",
       "Add lime juice to taste — most taco blends are salt-heavy and need the acid to balance.",
       "Thin with water only if you want it drizzleable; leave it thick for a dip.",
       "Check the salt at the end; blends vary enormously.",
       "Keeps 5 days. Excellent on anything that came out of a hot pan with char on it."]},
    {key:"chipotleyog", name:"High-Protein Chipotle Sauce", yield:"~11 servings", per:"~30 kcal · 4g protein · 3g carbs · 0.5g fat per 40g",
     ingredients:[
       "Nonfat Greek yogurt — 2 cups (448g)",
       "Chipotle peppers in adobo — 30g",
       "Adobo sauce — 10g",
       "Lime juice — 15g",
       "Garlic powder — 1 tsp",
       "Water or almond milk — 1–3 tbsp"],
     steps:[
       "Blend the chipotles, adobo, lime and garlic to a smooth paste on their own first.",
       "Start with less chipotle than you think — you can add heat later, you cannot take it out.",
       "Fold the paste into the yogurt by hand rather than blending the whole lot.",
       "Thin to the consistency you want and season with salt.",
       "The heat climbs overnight, so make it a day ahead and taste before you commit."]},
    {key:"garlicparmyog", name:"High-Protein Garlic Parmesan Sauce", yield:"~11 servings", per:"~35 kcal · 5g protein · 2g carbs · 1g fat per 40g",
     ingredients:[
       "Nonfat Greek yogurt — 2 cups (448g)",
       "Grated parmesan — 28g",
       "Garlic — 2 cloves or 1 tsp powder",
       "Lemon juice — 10g",
       "Salt + pepper",
       "Almond milk or water — 1–3 tbsp"],
     steps:[
       "If you are using fresh garlic, grate it on a microplane; chopped garlic stays harsh in a cold sauce.",
       "Mix the parmesan into the yogurt first so it doesn't clump against the liquid.",
       "Add lemon, salt and a lot of black pepper.",
       "Rest 30 minutes before tasting — the garlic strengthens noticeably as it sits.",
       "Do not heat this sauce directly; nonfat yogurt splits. Spoon it over hot food instead."]},
    {key:"cilantroavoyog", name:"Cilantro Lime Avocado Yogurt Sauce", yield:"~11 servings", per:"~45 kcal · 3g protein · 3g carbs · 3g fat per 40g",
     ingredients:[
       "Nonfat Greek yogurt — 1½ cups (336g)",
       "Avocado — 100g",
       "Fresh cilantro — 10g",
       "Lime juice — 30g",
       "Garlic — 1 clove",
       "Water or almond milk — 1–3 tbsp"],
     steps:[
       "Blend the avocado, coriander, lime and garlic until completely smooth before the yogurt.",
       "Include the coriander stalks — they carry more flavor than the leaves.",
       "Add the yogurt and pulse briefly to combine.",
       "Use plenty of lime; it is what stops the avocado browning as much as it is a flavor.",
       "Press cling film onto the surface in the tub. It keeps about 3 days, less than the others."]},
    {key:"buffaloyog", name:"Buffalo Yogurt Sauce", yield:"~7 servings", per:"~20 kcal · 3g protein · 2g carbs · 0g fat per 40g",
     ingredients:[
       "Nonfat Greek yogurt — 1 cup (224g)",
       "Frank's RedHot — 60g",
       "Garlic powder — ½ tsp",
       "Butter flavor extract or a pinch of salt (optional)",
       "Water to thin if needed"],
     steps:[
       "Add the hot sauce to the yogurt gradually, whisking — dumped in at once it can look split.",
       "Garlic powder and a pinch of salt do most of the work of the butter in a real buffalo sauce.",
       "A few drops of butter extract gets you the rest of the way, if you use it.",
       "Thin with water rather than more hot sauce once the heat is where you want it.",
       "Keeps a week and gets better after a day."]},
    {key:"honeymustyog", name:"Honey Mustard Yogurt Sauce", yield:"~7 servings", per:"~30 kcal · 4g protein · 3g carbs · 0g fat per 40g",
     ingredients:[
       "Nonfat Greek yogurt — 1 cup (224g)",
       "Dijon mustard — 30g",
       "Sugar-free honey-style syrup — 20g",
       "Apple cider vinegar — 5g",
       "Pinch of salt"],
     steps:[
       "Whisk the mustard and syrup together first so the sweetener is evenly through the mustard.",
       "Fold that into the yogurt rather than the other way round.",
       "The vinegar is what stops it tasting flat and cloying — do not skip it.",
       "Taste and adjust: more mustard for bite, more syrup for a dipping sauce.",
       "Keeps a week. Good hot on chicken, cold as a salad dressing thinned with water."]},
    {key:"tzatzikihp", name:"High-Protein Tzatziki", yield:"~9 servings", per:"~29 kcal · 4.5g protein · 2g carbs per 50g",
     ingredients:[
       "Nonfat Greek yogurt — 2 cups (448g)",
       "Cucumber — 150g, grated",
       "Garlic — 1 clove, grated",
       "Lemon juice — 15g",
       "Fresh dill — 8g",
       "Salt + pepper"],
     steps:[
       "Grate the cucumber, salt it, and leave it in a sieve for 20 minutes.",
       "Then squeeze it dry in a towel, hard. This single step is the difference between tzatziki and cucumber soup.",
       "Grate the garlic finely and mix it with the lemon juice first to take the raw edge off.",
       "Fold everything into the yogurt and season.",
       "Rest an hour before serving. Keeps 4 days, though it loosens as the cucumber gives up more water."]},
    {key:"boomboom", name:"Skinny Boom Boom Sauce", yield:"~9 servings", per:"~24 kcal · 2.4g protein · 3g carbs per 30g",
     ingredients:[
       "Nonfat Greek yogurt — 1 cup (224g)",
       "Sriracha — 25g",
       "Sugar-free sweet chili or a little sweetener — 20g",
       "Smoked paprika — ½ tsp",
       "Garlic powder — ½ tsp",
       "Rice vinegar — 5g"],
     steps:[
       "Mix the sriracha, sweet element and vinegar together first and taste that on its own.",
       "Get the sweet-heat-acid balance right before the yogurt goes anywhere near it.",
       "Fold into the yogurt and add the paprika and garlic powder.",
       "Thin with water for a drizzle, leave thick for a dip.",
       "Keeps a week. This is the one for chicken bites, burgers and fries."]},
    {key:"caesarhp", name:"High-Protein Caesar Dressing", yield:"~8 servings", per:"~26 kcal · 3.3g protein · 1g carbs per 30g",
     ingredients:[
       "Nonfat Greek yogurt — 1 cup (224g)",
       "Grated parmesan — 20g",
       "Dijon mustard — 10g",
       "Lemon juice — 20g",
       "Anchovy paste — 5g (or 1 tsp Worcestershire)",
       "Garlic — 1 clove",
       "Black pepper"],
     steps:[
       "Mash the anchovy and garlic into a paste with the flat of a knife before anything else.",
       "Whisk it with the mustard and lemon into a smooth base.",
       "Fold in the yogurt, then the parmesan.",
       "Do not skip the anchovy — without it this is just garlic yogurt, and the whole point is the savory depth.",
       "Thin with water to coat leaves properly. Keeps 5 days."]},
    {key:"cottagealfredo", name:"Cottage Cheese Alfredo", yield:"~4 servings", per:"~76 kcal · 9g protein · 3g carbs per 80g",
     ingredients:[
       "Low-fat cottage cheese — 1½ cups (340g)",
       "Grated parmesan — 30g",
       "Garlic — 2 cloves",
       "Milk or pasta water — 60–100ml",
       "Nutmeg, salt, black pepper"],
     steps:[
       "Blend the cottage cheese with the milk for a full 2 minutes until there is no curd texture left.",
       "Warm the garlic gently in a pan — do not brown it.",
       "Add the blended base and heat very gently. It must not boil or it will go grainy.",
       "Melt in the parmesan off the heat, then loosen with pasta water.",
       "Sauce the pasta in the pan off the heat. It thickens as it cools, so serve it looser than looks right."]},
    {key:"chipotlecrema", name:"Avocado Chipotle Crema", yield:"~8 servings", per:"~48 kcal · 2.4g protein · 3g carbs per 40g",
     ingredients:[
       "Nonfat Greek yogurt — 1 cup (224g)",
       "Avocado — 80g",
       "Chipotle in adobo — 20g",
       "Lime juice — 25g",
       "Garlic — 1 clove",
       "Salt"],
     steps:[
       "Blend everything except the yogurt until completely smooth.",
       "Fold the yogurt in at the end so it stays thick.",
       "Season with salt and more lime than you think it needs.",
       "Use within 3 days — the avocado dulls in color after that even with the lime.",
       "Best over anything charred: fajitas, tacos, roasted sweet potato."]},
    {key:"peanutlight", name:"Lighter Peanut Sauce", yield:"~6 servings", per:"~60 kcal · 4.8g protein · 5g carbs per 40g",
     ingredients:[
       "PB2 / powdered peanut butter — 40g",
       "Warm water — 80–100ml",
       "Soy sauce — 15g",
       "Rice vinegar — 10g",
       "Lime juice — 10g",
       "Sriracha — 10g",
       "Grated ginger + garlic",
       "Sweetener to taste"],
     steps:[
       "Whisk the peanut powder into the warm water first, until it is completely smooth.",
       "Warm water, not cold — cold water leaves it gritty.",
       "Add soy, vinegar, lime and sriracha and whisk again.",
       "Adjust thickness with water; it thickens noticeably as it stands.",
       "Balance is the whole dish here: salty, sour, sweet, hot. Taste and adjust all four before serving."]},
    {key:"bbqyog", name:"Creamy BBQ Ranch", yield:"~7 servings", per:"~28 kcal · 3.6g protein · 3g carbs per 40g",
     ingredients:[
       "Nonfat Greek yogurt — 1 cup (224g)",
       "Sugar-free BBQ sauce — 45g",
       "Ranch seasoning — 1 tsp",
       "Smoked paprika — ½ tsp",
       "Apple cider vinegar — 5g"],
     steps:[
       "Stir the BBQ sauce into the yogurt until the color is even.",
       "Add the ranch seasoning and paprika and rest it 30 minutes to hydrate.",
       "The vinegar keeps it from tasting like sweet dairy — add it last and taste.",
       "Thin with water for a dressing, leave thick for a dip.",
       "Keeps a week. Built for chicken, burgers and loaded potatoes."]},

    /* ---------- CHEESE SAUCES ----------
       A cheese sauce is not a jar of cheddar. Every one of these works the
       same way: a starch or a stabiliser first, liquid second, cheese last
       and off the heat. Skip that order and you get grainy sauce with a
       slick of orange fat on top, which is what happens to most people the
       first time they try. */
    {key:"mornay", name:"Mornay Sauce (the proper one)", yield:"~6 servings", per:"~150 kcal · 6g protein · 6g carbs · 11g fat per 90g",
     ingredients:[
       "Butter — 30g",
       "Plain flour — 30g",
       "Whole milk — 500ml, warmed",
       "Gruyère, grated — 60g",
       "Parmesan, grated — 30g",
       "Nutmeg, salt, white pepper"],
     steps:[
       "Melt the butter and stir in the flour. Cook it two full minutes — raw flour is the taste people mistake for 'too floury'.",
       "Add the warm milk a ladle at a time, whisking each addition smooth before the next. Cold milk into hot roux is what makes lumps.",
       "Simmer gently 8–10 minutes. It should coat the back of a spoon and no longer taste of flour.",
       "Take it OFF the heat before the cheese goes in. Cheese boiled in a sauce splits, every time.",
       "Stir the cheese in a handful at a time until each one disappears.",
       "Grate in nutmeg, season with white pepper, and use it hot. It sets firm in the fridge and loosens back with a splash of milk."]},
    {key:"whitecheddarsc", name:"White Cheddar Sauce", yield:"~6 servings", per:"~190 kcal · 7g protein · 5g carbs · 16g fat per 80g",
     ingredients:[
       "Butter — 25g",
       "Plain flour — 25g",
       "Whole milk — 400ml, warmed",
       "Sharp white cheddar, grated — 150g",
       "Dijon mustard — 1 tsp",
       "Salt + white pepper"],
     steps:[
       "Grate the cheddar yourself. Bagged shreds are dusted with anti-caking starch and it makes the sauce chalky.",
       "Butter and flour into a roux, two minutes, then the warm milk in stages, whisking.",
       "Simmer until it thickens, then off the heat entirely.",
       "Cheese in by the handful, stirring until smooth before adding more.",
       "The teaspoon of Dijon is not for mustard flavor — the acid keeps the emulsion together and sharpens the cheddar.",
       "Season at the very end; cheddar is already salty and it is easy to overshoot."]},
    {key:"beercheese", name:"Beer Cheese Sauce", yield:"~6 servings", per:"~200 kcal · 8g protein · 6g carbs · 16g fat per 70g",
     ingredients:[
       "Butter — 25g",
       "Plain flour — 25g",
       "Lager or amber ale — 180ml",
       "Whole milk — 200ml",
       "Sharp cheddar, grated — 150g",
       "Dijon — 1 tsp, Worcestershire — 1 tsp",
       "Garlic powder, smoked paprika, cayenne"],
     steps:[
       "Make the roux, then add the beer first and let it bubble a minute — that cooks off the raw alcohol edge that otherwise tastes bitter.",
       "Add the milk and whisk smooth, then simmer to thicken.",
       "Off the heat, then cheese in stages.",
       "Worcestershire, Dijon and the spices last. Taste before salting.",
       "Use a beer you would drink. A heavy IPA turns the sauce bitter as it reduces — lager or amber is the safer choice.",
       "Best hot over pretzels, fries or a pretzel-bun burger. It reheats gently over low heat, never in a hot pan."]},
    {key:"nachocheese", name:"Nacho Cheese Sauce", yield:"~7 servings", per:"~210 kcal · 7g protein · 8g carbs · 17g fat per 70g",
     ingredients:[
       "Evaporated milk — 340ml (one tin)",
       "Cornflour — 2 tsp",
       "Sharp cheddar, grated — 200g",
       "Processed cheese (American slices) — 60g",
       "Pickled jalapeño brine — 15g",
       "Chili powder, cumin, garlic powder"],
     steps:[
       "Whisk the cornflour into the cold evaporated milk before any heat. Doing it later gives you lumps you cannot whisk out.",
       "Warm it gently until it just steams. Do not boil.",
       "Off the heat, add both cheeses a handful at a time. The processed cheese is doing real work here — its emulsifying salts are why this stays pourable instead of splitting.",
       "Brine and spices last. The brine is the acid that stops it tasting flat.",
       "Evaporated milk is the trick: its low water content and concentrated proteins hold the emulsion far better than fresh milk.",
       "Keeps 5 days and reheats in 20-second bursts with a stir between each."]},
    {key:"quesoblanco", name:"Queso Blanco Dip", yield:"~7 servings", per:"~185 kcal · 8g protein · 5g carbs · 15g fat per 70g",
     ingredients:[
       "White American cheese, deli-sliced — 250g",
       "Whole milk — 200ml",
       "Pickled jalapeños, chopped — 25g",
       "Green chiles, diced — 40g",
       "Cumin — ½ tsp, garlic powder — ½ tsp",
       "Fresh coriander to finish"],
     steps:[
       "Buy the white American from the deli counter, not the wrapped singles. It melts to a completely different texture.",
       "Tear the slices up and put them in a pan with half the milk over the lowest heat you have.",
       "Stir constantly. It will look wrong and broken for a couple of minutes, then suddenly come together — do not panic and turn the heat up.",
       "Add the rest of the milk to reach the consistency you want. It thickens fast as it cools.",
       "Chiles, jalapeños and spices in at the end.",
       "Coriander over the top on serving. Reheat with a splash of milk."]},
    {key:"greenchilequeso", name:"Hatch Green Chile Queso", yield:"~7 servings", per:"~180 kcal · 8g protein · 6g carbs · 14g fat per 70g",
     ingredients:[
       "White American cheese — 200g",
       "Monterey Jack, grated — 80g",
       "Whole milk — 200ml",
       "Roasted Hatch green chiles, chopped — 100g",
       "Onion, finely diced — 50g",
       "Garlic, cumin, lime"],
     steps:[
       "Sweat the onion soft first, in butter or oil, before anything else goes in. Raw onion in a queso stays sharp and crunchy.",
       "Add the garlic for 30 seconds, then the chiles, and cook off their liquid for a minute or two.",
       "Turn the heat right down, add the milk, then the cheese in handfuls, stirring constantly.",
       "If your chiles came from a jar, drain them properly — the brine will thin the sauce and make it taste sour.",
       "Lime at the end, and salt only after the lime.",
       "Genuinely good on eggs, not just chips."]},
    {key:"pimentochz", name:"Pimento Cheese", yield:"~10 servings", per:"~285 kcal · 9g protein · 4g carbs · 26g fat per 40g",
     ingredients:[
       "Sharp cheddar, grated — 225g",
       "Cream cheese, softened — 60g",
       "Mayonnaise — 60g",
       "Roasted red peppers / pimentos, drained and diced — 60g",
       "Onion powder, cayenne, black pepper",
       "Worcestershire — a few dashes"],
     steps:[
       "Grate the cheddar on the coarse side of the box grater. Pimento cheese wants texture, not a paste.",
       "Beat the cream cheese and mayonnaise together smooth before the cheddar goes anywhere near them.",
       "Fold the cheddar in by hand. A food processor turns this into orange spackle.",
       "Squeeze the peppers dry in a paper towel first or the whole thing weeps in the fridge.",
       "Season hard — it needs more black pepper than feels reasonable.",
       "It is better on day two and keeps a week. Spread on white bread, griddled in butter, it is one of the best sandwiches there is."]},
    {key:"protcheddarsc", name:"High-Protein Cheddar Sauce", yield:"~6 servings", per:"~105 kcal · 12g protein · 5g carbs · 4g fat per 80g",
     ingredients:[
       "Low-fat cottage cheese — 300g",
       "Skim milk — 100ml",
       "Sharp cheddar, grated — 60g",
       "Cornflour — 1 tsp",
       "Dijon — 1 tsp",
       "Onion powder, garlic powder, salt"],
     steps:[
       "Blend the cottage cheese with the milk and cornflour until completely, genuinely smooth — a good 60 seconds. Any curd left will read as grainy later and you cannot fix it after heating.",
       "Warm the blended base gently in a pan, stirring, until it thickens slightly.",
       "Off the heat, add the real cheddar. The 60g is what makes it taste like cheese sauce; the cottage cheese is what makes the macros work.",
       "Dijon, onion and garlic powder, then salt to taste.",
       "Do not let it boil. Cottage cheese protein tightens and goes grainy above a simmer.",
       "About a third of the calories of a classic Mornay at roughly double the protein. Over protein pasta it turns a mac and cheese into a genuine post-training meal."]},
    {key:"protqueso", name:"High-Protein Queso", yield:"~6 servings", per:"~92 kcal · 12g protein · 4g carbs · 3.5g fat per 80g",
     ingredients:[
       "Low-fat cottage cheese — 300g",
       "Skim milk — 80ml",
       "Reduced-fat cheddar or Mexican blend — 50g",
       "Salsa or diced green chiles — 60g",
       "Cornflour — 1 tsp",
       "Cumin, chili powder, lime"],
     steps:[
       "Blend the cottage cheese, milk and cornflour absolutely smooth first.",
       "Warm it through gently — never above a bare simmer.",
       "Cheese off the heat, stirred in until it disappears.",
       "Fold the salsa or chiles in last so they stay distinct rather than dissolving into the base.",
       "Lime and salt at the end. Acid is what stops a high-protein sauce tasting like warm dairy.",
       "Thin with milk to pour, leave thick to dip. Keeps 4 days."]},
  ];


  /* Side portions are pegged to a slice of the meal's calories, never used to
     hit a carb or fat target — so a salad is a side, not your carb source. */
  const VEG_KCAL_SHARE   = 0.08;
  const FRUIT_KCAL_SHARE = 0.07;
  const SAUCE_KCAL_CAP   = 0.12;   // a sauce never eats more than this much of a meal
  /* Unless the dish is named after it. A cheese sauce on a mac and cheese
     is not a condiment, and holding it to a condiment's calorie budget is
     what produced 30g of sauce over 120g of pasta. */
  const SAUCE_KCAL_CORE  = 0.26;

  /* Which sauces suit which goal. A hard cut sees hot sauce and salsa; a
     bulk can afford pesto and alfredo, where the calories are useful. */
  /* Protein powder is a supplement, not a meal. It's allowed to top up
     breakfast or a snack, and whey is the only one suggested. */
  const POWDER_OK = ['breakfast','snack'];

  const SAUCE_LEVELS = {
    extreme_loss: ["light"],
    loss:         ["light"],
    maintain:     ["light","standard"],
    gain:         ["light","standard","rich"],
  };


  /* Meal split: 3 mains @ 30% + 1 optional snack @ 10% */
  /* Eating occasions are built from however many times a person actually
     eats. Up to three become full meals; anything beyond that is a smaller
     snack, weighted at 0.4 of a meal. Shares always sum to 1, so the daily
     target is fully allocated no matter how many sittings there are. */
  const MEAL_NAMES = ["BREAKFAST", "LUNCH", "DINNER"];
  const SNACK_WEIGHT = 0.4;

  /* Named configurations rather than a bare count, because "3 sittings"
     could mean three full meals or two meals and a snack — very different
     days. `mains` are proper meals, `snacks` are the smaller ones. */
  const MEAL_PLANS = [
    {key:'2',   mains:2, snacks:0, label:'2 Meals',        desc:'Two big sittings'},
    {key:'2+1', mains:2, snacks:1, label:'2 + a Snack',    desc:'Two meals, one snack'},
    {key:'2+2', mains:2, snacks:2, label:'2 + 2 Snacks',   desc:'Two meals, grazing between'},
    {key:'3',   mains:3, snacks:0, label:'3 Meals',        desc:'Breakfast, lunch, dinner'},
    {key:'3+1', mains:3, snacks:1, label:'3 + a Snack',    desc:'Classic plus one snack'},
    {key:'3+2', mains:3, snacks:2, label:'3 + 2 Snacks',   desc:'Steady through the day'},
    {key:'3+3', mains:3, snacks:3, label:'3 + 3 Snacks',   desc:'Frequent small feedings'},
  ];

  /* How heavy each main meal should feel, relative to the others */
  const WEIGHT_FACTOR = {light:0.65, normal:1, heavy:1.4};

  /* buildMeals runs once before state exists, so the flags it needs live
     here and state keeps them in sync. */
  const MEAL_FLAGS = {skipBreakfast:false, mealWeights:{}};

  function planFor(key){
    return MEAL_PLANS.find(p=>p.key === key) || MEAL_PLANS.find(p=>p.key === '3+1');
  }

  function buildMeals(planKey){
    const plan = planFor(planKey);
    const st = MEAL_FLAGS;
    const skipB = !!st.skipBreakfast && plan.mains >= 2;
    const mains = plan.mains;
    const snacks = plan.snacks;

    // Which named meals are in play. Skipping breakfast shifts everything up.
    let names;
    if (mains >= 3) names = skipB ? ["LUNCH","DINNER","LATE MEAL"] : MEAL_NAMES.slice(0, mains);
    else if (mains === 2) names = skipB ? ["LUNCH","DINNER"] : ["BREAKFAST","DINNER"];
    else names = ["MEAL"];

    const w = st.mealWeights || {};
    const factors = names.map((n,i)=> WEIGHT_FACTOR[w[i] || 'normal'] || 1);
    const totalWeight = factors.reduce((a,b)=>a+b, 0) + snacks * SNACK_WEIGHT;

    const out = [];
    for (let i = 0; i < mains; i++){
      out.push({
        key:`meal${i+1}`,
        label:`MEAL 0${i+1} // ${names[i]}`,
        name:names[i],
        share: factors[i] / totalWeight,
        weight: w[i] || 'normal',
        required:true
      });
    }
    for (let i = 0; i < snacks; i++){
      out.push({
        key:`snack${i+1}`,
        label:`SNACK 0${i+1}`,
        name:'SNACK',
        share: SNACK_WEIGHT / totalWeight,
        required:false
      });
    }
    return out;
  }

  let MEALS = buildMeals('3+1');

