'use strict';
/* ============================================================
   LOADOUT - NUTRITION - fibre, sodium, full model
   From app.js lines 1379-1701 of the original single file.
   Loaded in order by index.html; all files share one global scope,
   so declarations here are visible to every file listed after it.
   ============================================================ */

  /* =========================================================
     FIBRE & SODIUM
     These two are added because they're the ones that actually change a
     meal-prep decision, and because they can be estimated honestly.

     Values are per 100g and assigned by food class, with overrides where a
     specific food differs sharply from its class. They are ESTIMATES, not
     label data â€” good enough to tell "this day is low on fibre" from "this
     day is fine", which is what the number is for. Anything packaged should
     be read off the box.

     Vitamins and the remaining minerals are deliberately NOT included:
     assigning 15 micronutrients across 600+ foods from memory would produce
     numbers that look authoritative and aren't. A varied plan with plenty of
     vegetables covers that ground better than a fabricated readout would.
  ========================================================= */
  const FIBRE_BY_FAMILY = {
    leafygreen:2.4, lettuce:1.3, cabbage:2.3, brassica:2.8, squash:1.4, root:2.6,
    tomato:1.4, pepper:1.7, chilli:1.9, mushroom:1.0, onion:1.7, peas:2.8,
    ferment:1.4, olives:3.2, herbs:2.0,
    berry:5.3, apple:2.4, pear:3.1, orange:2.4, citrus:2.2, melon:0.8,
    grape:0.9, tropical:1.7, banana:2.6, peach:1.5, driedfruit:7.0,
    beans:15.5, lentils:11.0, soy:2.5,
    bun:2.6, subroll:2.4, friedside:3.0, shredblend:0, processedcheese:0,
    cheesesauce:0.3, burgersauce:0.4, mayosauce:0.2, mustardsauce:2.0,
    gravysauce:0.2, tomatocondiment:1.0, vinaigrette:0.1, creamcondiment:0.8,
    pickle:1.2,
    rice:1.3, grain:7.0, pasta:3.2, noodle:1.8, bread:5.0, tortilla:4.5,
    potato:2.2, oats:10.1, porridge:1.5, cereal:3.0, granola:7.0, chips:5.0,
    pastry:2.0, dumpling:1.6, bar:8.0, syrup:0.2,
    nuts:8.5, seeds:15.0, nutbutter:6.5, avocado:6.7,
    oil:0, butter:0, cream:0, mayo:0,
    cheese:0, cheddar:0, mozzarella:0, swiss:0, jackcheese:0, hardcheese:0,
    bluecheese:0, softcheese:0, feta:0, goatcheese:0, grillcheese:0,
    freshcheese:0, stringcheese:0, spreadcheese:0, yogurt:0, cottage:0,
    egg:0, powder:2.0, jerky:1.5,
    chickencut:0, poultrycut:0, groundpoultry:0, turkeycut:0, curedpoultry:0,
    beefcut:0, groundbeef:0, porkcut:0, curedpork:0, sausage:0, organ:0,
    salmon:0, tuna:0, whitefish:0, oilyfish:0, shellfish2:0, roe:0,
  };
  const FIBRE_OVERRIDE = {
    broccoli:2.6, brusselsSprouts:3.8, artichoke:5.4, kale:3.6, spinach:2.2,
    lentils:30.5, blackbeans:24.9, chickpeas:17.4, splitpeas:25.5,
    oats:10.6, steelcut:10.1, quinoa:7.0, bulgur:12.5, farro:6.0, barley:15.6,
    chia:34.4, flaxseed:27.3, almonds:12.5, pistachios:10.6, pecans:9.6,
    avocado:6.7, hassavo:6.7, raspberry:6.5, blackberry:5.3, dates:8.0,
    prunes:7.1, popcorn:14.5, ricecakes:4.2, shirataki:3.0, caulirice:2.0,
    edamame:5.2, tempeh:5.0, tofu:0.9, seitan:0.6, hummus:6.0,
  };
  const SODIUM_BY_FAMILY = {   // mg per 100g
    oil:0, butter:2, cream:40, mayo:600,
    cheese:600, cheddar:620, mozzarella:400, swiss:190, jackcheese:600,
    hardcheese:1400, bluecheese:1400, softcheese:600, feta:1100, goatcheese:400,
    grillcheese:1100, freshcheese:400, stringcheese:600, spreadcheese:900,
    yogurt:45, cottage:330, egg:140, powder:250,
    chickencut:60, poultrycut:60, groundpoultry:70, turkeycut:60,
    curedpoultry:900, beefcut:60, groundbeef:70, porkcut:55,
    curedpork:1200, sausage:800, organ:70, jerky:1800,
    salmon:50, tuna:40, whitefish:70, oilyfish:300, shellfish2:250, roe:1500,
    beans:5, lentils:5, soy:10,
    bun:450, subroll:520, friedside:450, shredblend:620, processedcheese:1400,
    cheesesauce:900, burgersauce:800, mayosauce:700, mustardsauce:1500,
    gravysauce:700, tomatocondiment:1100, vinaigrette:700, creamcondiment:600,
    pickle:1100,
    rice:2, grain:5, pasta:5, noodle:5, bread:490, tortilla:400,
    potato:8, oats:3, porridge:3, cereal:400, granola:60, chips:400,
    pastry:400, dumpling:450, bar:200, syrup:5,
    nuts:5, seeds:5, nutbutter:150, avocado:7,
    leafygreen:30, lettuce:10, cabbage:15, brassica:25, squash:5, root:50,
    tomato:8, pepper:4, chilli:5, mushroom:5, onion:4, peas:5,
    ferment:900, olives:1500, herbs:10,
    berry:1, apple:1, pear:1, orange:1, citrus:2, melon:12,
    grape:2, tropical:2, banana:1, peach:0, driedfruit:15,
  };
  const SODIUM_OVERRIDE = {
    tunacan:320, salmoncan:340, sardines:400, sardinesoil:400, anchovy:3670,
    ham:1200, bacon:750, prosciutto:2000, pepperoni:1600, salami:1700,
    hotdog:1100, chickdog:900, kielbasa:1200, andouille:1100, porkrind:1800,
    pickles:1200, kimchi:800, sauerkraut:660, olives:1500, kalamata:1550,
    soy:5500, aminos:2400, teriyaki:3800, hoisin:1600, fishsauce:7800,
    oystersauce:2700, ponzu:3400, sriracha:2100, hotsauce:2600, bbq:1000,
    ketchup:900, mustard:1100, marinara:400, salsa:700, miso:3700,
    protshake:180, whey:250, imitcrab:840, canadian:1000, turkbacon:1900,
    pastrami:1100, breakfastsaus:800, cheesecurds:600, tapenade:1600,
    cheesesauce:900, sweetsour:400, honeygarlic:1400, tartar:600,
    toum:400, nashville:900, bolognesejar:450, stuffingmix:1400,
    tatertots:480, frenchfries:300, mashedflake:220,
    chilibeans:450, pintocan:230, kidneycan:230, blackbeancan:230,
    refried:480, hominy:340, giardiniera:900, pickledonion:400,
    dillspears:1100, firetom:220, dicedtom:180, tompaste:80,
    greenchilecan:390, chipotleadobo:700, american:1400, velveeta:1400,
    roastbeef:900, chickdeli:950, capicola:1300, mortadella:1200,
    bologna:1100, soppressata:1600, nachocheese:1000, quesoblanco:850,
    beercheese:800, mornay:520, whitecheddarsc:780, protqueso:520,
    protcheddarsc:540, pimentochz:900, aujus:900, dijon:1900,
    russian:900, chipotlemayo:750, burgersauce:800, subdressing:400,
    chilisauce:1200, horseradishcr:450, greenchilequeso:820,
  };

  /* Nutrition beyond the macros, per 100g */
  /* FAMILY first so nothing that already resolved changes; NUTRI_FAMILY (defined
     further down) then catches the foods FAMILY deliberately leaves out. */
  function nutriFam(key){
    return FAMILY[key] || NUTRI_FAMILY[key] || null;
  }
  function fibreOf(food){
    if (!food) return 0;
    if (typeof USDA_FIBRE !== 'undefined' && USDA_FIBRE[food.key] != null) return USDA_FIBRE[food.key];
    if (FIBRE_OVERRIDE[food.key] != null) return FIBRE_OVERRIDE[food.key];
    const fam = nutriFam(food.key);
    return (fam && FIBRE_BY_FAMILY[fam] != null) ? FIBRE_BY_FAMILY[fam] : 1.0;
  }
  function sodiumOf(food){
    if (!food) return 0;
    if (typeof USDA_SODIUM !== 'undefined' && USDA_SODIUM[food.key] != null) return USDA_SODIUM[food.key];
    if (SODIUM_OVERRIDE[food.key] != null) return SODIUM_OVERRIDE[food.key];
    const fam = nutriFam(food.key);
    return (fam && SODIUM_BY_FAMILY[fam] != null) ? SODIUM_BY_FAMILY[fam] : 30;
  }
  /* Sauces carry their sodium in the food's own record where known */
  function microTotals(){
    let fibre = 0, sodium = 0;
    MEALS.forEach(m=>{
      const plan = computeMealPlan(m.key);
      SLOT_DEFS.forEach(d=>{
        state.selections[m.key][d.slot].forEach((k,i)=>{
          const g = plan[d.slot][i];
          if (!k || g == null) return;
          const f = d.list().find(x=>x.key === k);
          if (!f) return;
          fibre  += fibreOf(f)  * g / 100;
          sodium += sodiumOf(f) * g / 100;
        });
      });
    });
    return {fibre, sodium};
  }

  /* Reference intakes used only to show progress, not as prescriptions */
  function fibreTarget(){
    const tg = currentTargets();
    return Math.round(Math.max(14 * (tg.kcal / 1000), 21));   // ~14g per 1000 kcal
  }
  const SODIUM_LIMIT = 2300;   // mg, general upper guidance

  /* =========================================================
     FULL NUTRITION MODEL
     Covers the set a nutrition label carries: saturated fat, cholesterol,
     sugar, fibre, sodium, potassium, calcium, iron, magnesium, zinc and
     vitamins A, C and D.

     IMPORTANT â€” these are modelled by food class, not looked up per product.
     Each family carries a typical per-100g profile and individual foods
     override it where they differ sharply (liver for iron and vitamin A,
     citrus for vitamin C, dairy for calcium). They're accurate enough to
     answer "is this day short on iron?" and not accurate enough to manage a
     deficiency. Anything packaged: read the label.
  ========================================================= */
  /* per 100g: [satFat g, chol mg, sugar g, potassium mg, calcium mg,
                iron mg, magnesium mg, zinc mg, vitA mcg, vitC mg, vitD mcg] */
  const NUTRI_BY_FAMILY = {
    chickencut:[1.0,73,0,256,11,0.7,27,1.0,9,0,0.1],
    poultrycut:[1.5,80,0,250,12,1.2,25,1.8,15,0,0.2],
    groundpoultry:[2.5,80,0,240,20,1.3,24,2.4,12,0,0.2],
    turkeycut:[0.4,60,0,290,12,0.8,28,1.4,5,0,0.1],
    curedpoultry:[3.0,70,1,290,10,1.0,20,1.6,10,0,0.2],
    beefcut:[3.5,65,0,320,15,2.3,21,4.5,0,0,0.1],
    groundbeef:[3.0,70,0,300,18,2.4,20,4.8,0,0,0.1],
    porkcut:[1.5,65,0,400,15,0.9,26,2.0,2,0.6,0.6],
    curedpork:[4.0,60,1,320,10,0.9,18,1.8,0,0,0.5],
    sausage:[9.0,70,1,250,20,1.2,16,2.0,0,0,0.4],
    organ:[1.6,345,0,290,8,9.0,20,4.0,4900,25,0.4],
    jerky:[10,60,20,600,20,3.0,50,6.0,0,0,0],
    salmon:[3.0,55,0,363,12,0.8,29,0.6,12,0,11],
    tuna:[0.2,39,0,444,4,0.8,50,0.6,6,0,2],
    whitefish:[0.4,50,0,350,15,0.4,30,0.5,10,0,2],
    oilyfish:[3.0,60,0,380,80,1.5,35,1.2,30,0,10],
    shellfish2:[0.2,150,0,220,60,1.5,35,1.4,50,2,0.2],
    roe:[4.0,590,4,180,275,12,300,1.0,270,0,6],
    egg:[3.1,372,0.4,138,56,1.8,12,1.3,160,0,2],
    yogurt:[0.2,5,4,141,110,0.1,11,0.5,1,0.5,0],
    cottage:[0.6,10,3,104,83,0.1,8,0.4,10,0,0],
    cheddar:[21,105,1,98,720,0.7,28,3.1,265,0,0.6],
    shredblend:[18,95,1,90,700,0.6,26,3.0,240,0,0.5],
    processedcheese:[19,90,8,200,600,0.4,24,2.6,230,0,0.5],
    cheesesauce:[10,45,1,120,280,0.3,12,1.2,110,0,0.3],
    mozzarella:[10,54,1,76,505,0.2,20,2.9,180,0,0.4],
    swiss:[18,90,1,77,790,0.2,36,3.6,220,0,0.6],
    jackcheese:[19,89,1,81,750,0.7,27,3.0,220,0,0.6],
    hardcheese:[19,88,1,125,1180,0.8,44,3.4,240,0,0.5],
    bluecheese:[19,75,1,256,528,0.3,23,2.7,200,0,0.5],
    softcheese:[17,90,1,120,600,0.3,28,3.0,210,0,0.5],
    feta:[15,89,4,62,493,0.7,19,2.9,125,0,0.4],
    goatcheese:[21,79,2,158,298,1.6,30,0.7,290,0,0.3],
    grillcheese:[16,90,3,60,700,0.4,25,2.8,200,0,0.4],
    freshcheese:[15,80,3,90,600,0.3,20,2.5,180,0,0.4],
    stringcheese:[14,60,2,80,700,0.2,22,3.0,190,0,0.4],
    spreadcheese:[3,20,8,150,300,0.2,12,1.0,90,0,0.2],
    powder:[2.0,15,7,300,300,1.0,40,2.0,0,0,0],
    beans:[0.3,0,2,1400,120,6.5,170,3.0,0,4,0],
    lentils:[0.2,0,2,950,55,7.5,120,4.0,2,4,0],
    soy:[1.5,0,2,240,180,2.5,60,1.5,1,0,0],
    rice:[0.2,0,0.1,90,10,0.8,25,1.1,0,0,0],
    grain:[0.5,0,1,320,30,3.0,120,2.5,0,0,0],
    pasta:[0.3,0,3,220,20,3.3,55,1.4,0,0,0],
    noodle:[0.2,0,0.2,60,10,0.8,25,0.6,0,0,0],
    bread:[0.7,0,5,250,150,3.6,60,1.5,0,0,0],
    tortilla:[1.8,0,2,150,140,3.0,40,1.0,0,0,0],
    potato:[0.1,0,4,420,20,0.8,25,0.3,700,20,0],
    oats:[1.2,0,1,430,54,4.7,177,4.0,0,0,0],
    porridge:[0.2,0,0.3,80,5,4.0,20,0.5,0,0,0],
    cereal:[0.2,0,10,110,10,8.0,30,2.0,0,0,0],
    granola:[3.0,0,20,350,60,3.0,90,2.5,0,0,0],
    chips:[3.0,0,2,220,40,2.0,60,1.5,0,0,0],
    pastry:[6.0,25,10,120,60,2.0,20,0.6,50,0,0.2],
    dumpling:[2.0,15,2,120,30,1.5,20,0.6,10,1,0],
    bar:[3.0,5,15,300,250,3.0,80,3.0,0,0,0],
    syrup:[0,0,80,150,25,0.3,15,0.3,0,0,0],
    nuts:[5.0,0,4,700,150,3.5,250,3.2,0,0,0],
    seeds:[5.0,0,2,700,200,7.0,400,6.0,0,1,0],
    nutbutter:[8.0,0,9,650,50,2.0,180,3.0,0,0,0],
    avocado:[2.1,0,0.7,485,12,0.6,29,0.6,7,10,0],
    oil:[14,0,0,0,0,0,0,0,0,0,0],
    butter:[51,215,0.1,24,24,0,2,0.1,680,0,1.5],
    cream:[19,70,3,120,90,0.1,9,0.3,300,0.8,0.4],
    mayo:[11,40,1,20,8,0.2,1,0.1,30,0,0.2],
    olives:[2.0,0,0,42,88,3.3,4,0.2,20,1,0],
    pestofat:[6.0,10,2,200,150,1.5,40,1.0,150,3,0],
    leafygreen:[0.1,0,0.4,490,120,2.2,70,0.5,470,35,0],
    lettuce:[0,0,1,200,35,0.9,13,0.2,300,5,0],
    cabbage:[0,0,3,190,45,0.5,12,0.2,50,36,0],
    brassica:[0,0,1.7,320,45,0.7,21,0.4,30,80,0],
    squash:[0.1,0,2,300,25,0.4,20,0.3,300,15,0],
    root:[0,0,4,320,35,0.4,15,0.3,700,6,0],
    tomato:[0,0,2.6,240,10,0.3,11,0.2,42,14,0],
    pepper:[0,0,4,210,10,0.4,12,0.2,160,120,0],
    chilli:[0,0,3,320,15,0.5,20,0.3,50,140,0],
    mushroom:[0,0,2,320,3,0.5,9,0.5,0,2,7],
    onion:[0,0,4,150,23,0.2,10,0.2,0,7,0],
    peas:[0,0,4,240,40,2.0,25,0.3,60,50,0],
    ferment:[0,0,1,200,40,0.5,12,0.2,20,15,0],
    herbs:[0,0,0,500,150,3.0,60,1.0,400,30,0],
    berry:[0,0,7,90,20,0.5,14,0.3,3,25,0],
    apple:[0,0,10,110,6,0.1,5,0,3,5,0],
    pear:[0,0,10,120,9,0.2,7,0.1,1,4,0],
    orange:[0,0,9,180,40,0.1,10,0.1,11,53,0],
    citrus:[0,0,8,160,35,0.2,10,0.1,10,45,0],
    melon:[0,0,8,220,9,0.2,12,0.2,170,30,0],
    grape:[0,0,16,190,10,0.4,7,0.1,3,4,0],
    tropical:[0,0,14,170,15,0.2,12,0.1,50,40,0],
    banana:[0.1,0,12,360,5,0.3,27,0.2,3,9,0],
    peach:[0,0,8,190,6,0.3,9,0.2,16,7,0],
    driedfruit:[0.1,0,60,700,50,1.5,40,0.3,2,2,0],
    /* Thin, salty, poured-by-the-spoon sauces: soy, teriyaki, hot sauce and
       the like. Their sodium is carried separately in SODIUM_OVERRIDE, so
       this row is only about what little else they bring. */
    sauce:[0.2,0,8,150,25,0.8,20,0.3,10,3,0],
    /* Nori and other sea vegetables: negligible energy, unusually mineral-dense */
    seaweed:[0.1,0,0.5,356,70,1.8,67,0.4,260,39,0],

    /* --- families that already existed in FAMILY but had no row here, so
       every food in them counted as nothing. Adding a row is purely additive:
       these foods are already grouped, so meal building is unaffected. --- */
    bun:[1.0,0,6,130,100,3.2,30,0.9,0,0,0],
    subroll:[0.7,0,3,140,60,3.4,35,1.0,0,0,0],
    mayosauce:[11,40,1,20,8,0.2,1,0.1,30,0,0.2],      // as mayo
    burgersauce:[9,30,6,30,10,0.2,2,0.1,25,0,0.2],
    creamcondiment:[19,70,3,120,90,0.1,9,0.3,300,0.8,0.4],
    vinaigrette:[2.0,0,3,30,10,0.2,3,0.1,5,1,0],
    mustardsauce:[0.3,0,3,150,60,1.5,45,0.6,0,1,0],   // mustard seed carries minerals
    gravysauce:[1.0,5,1,60,15,0.3,5,0.2,0,0,0],
    tomatocondiment:[0,0,22,300,15,0.4,13,0.2,40,4,0],
    pickle:[0,0,1,200,40,0.5,12,0.2,20,15,0],         // as ferment
    friedside:[3.0,0,2,220,40,2.0,60,1.5,0,0,0],      // as chips
    dairyliquid:[1.0,10,5,150,120,0.05,11,0.4,50,0,1.2],
    /* Citrus juice and vinegars: nothing much beyond a little vitamin C */
    acid:[0,0,1,100,10,0.1,5,0.05,0,20,0],
    /* Dried and fresh seasonings. Weighed in grams, so the profile matters
       less than not reading as zero. */
    freshherb:[0,0,0,500,150,3.0,60,1.0,400,30,0],
    herbblend:[0,0,0,500,150,3.0,60,1.0,400,30,0],
    rubblend:[0,0,2,600,180,4.0,80,1.5,200,5,0],
    driedaromatic:[0,0,2,600,180,4.0,80,1.5,200,5,0],
    chillispice:[0,0,3,1000,280,8.0,150,2.5,900,5,0],
    currysspice:[0,0,2,1500,480,20,250,4.0,20,1,0],
    sweetspice:[0.5,0,5,500,200,4.0,90,1.5,10,2,0],
    pepperspice:[0,0,1,1300,440,9.7,170,1.2,15,0,0],
    /* Salt contributes sodium and nothing else; sodium is tracked separately */
    salt:[0,0,0,0,0,0,0,0,0,0,0],
  };
  const NUTRI_OVERRIDE = {
    beefliver:[1.6,275,0,313,5,6.5,18,4.0,4970,1.3,1.2],
    chickliver:[1.6,345,0,230,8,9.0,19,2.7,3300,17,0.2],
    salmon:[3.1,55,0,363,12,0.8,29,0.4,12,0,11],
    sardines:[1.5,142,0,397,382,2.9,39,1.3,32,0,4.8],
    sardinesoil:[1.5,142,0,397,382,2.9,39,1.3,32,0,4.8],
    oysters:[0.5,50,0,168,45,5.1,22,39,25,3,0.8],
    spinach:[0.1,0,0.4,558,99,2.7,79,0.5,469,28,0],
    babyspinach:[0.1,0,0.4,558,99,2.7,79,0.5,469,28,0],
    kale:[0.1,0,0.8,491,150,1.5,47,0.6,500,120,0],
    broccoli:[0,0,1.7,316,47,0.7,21,0.4,31,89,0],
    peppers:[0,0,4.2,211,7,0.4,12,0.1,157,128,0],
    orange:[0,0,9.4,181,40,0.1,10,0.1,11,53,0],
    navel:[0,0,9.4,181,40,0.1,10,0.1,11,53,0],
    kiwi:[0,0,9,312,34,0.3,17,0.1,4,93,0],
    strawberry:[0,0,4.9,153,16,0.4,13,0.1,1,59,0],
    potato:[0,0,0.8,425,12,0.8,23,0.3,0,20,0],
    whitepot:[0,0,0.8,425,12,0.8,23,0.3,0,20,0],
    chia:[3.3,0,0,407,631,7.7,335,4.6,0,1.6,0],
    pepitas:[8.7,0,1.3,809,46,8.8,592,7.8,1,0.3,0],
    almonds:[3.8,0,4.4,733,269,3.7,270,3.1,0,0,0],
    milk:[0.1,2,5,150,125,0,11,0.4,60,0,1.2],
    kefir:[0.6,5,4,164,130,0,12,0.4,30,1,1.0],
    yogurt0:[0.1,5,3.6,141,110,0.1,11,0.5,1,0.5,0],
    wholeegg:[3.1,372,0.4,138,56,1.8,12,1.3,160,0,2.0],
    eggwhites:[0,0,0.7,163,7,0.1,11,0,0,0,0],
    mushrooms:[0,0,2,318,3,0.5,9,0.5,0,2,7],
    shiitake:[0,0,2.4,304,2,0.4,20,1.0,0,3,18],
    tofu:[0.7,0,0.6,121,350,5.4,30,0.8,0,0,0],
    tempeh:[2.2,0,0,412,111,2.7,81,1.1,0,0,0],
    lentils:[0.2,0,2,955,56,7.5,122,4.8,2,4.5,0],
    blackbeans:[0.2,0,2,1483,123,5.0,171,3.7,0,0,0],
    chickpeas:[0.6,0,11,875,105,6.2,115,3.4,3,4,0],
    /* A zero-calorie sweetener genuinely contributes nothing. Stated
       explicitly so it reads as "counted, and it's nil" rather than
       "not modelled". */
    monkfruit:[0,0,0,0,0,0,0,0,0,0,0],
  };

  const NUTRI_KEYS = ['satfat','chol','sugar','potassium','calcium','iron','magnesium','zinc','vita','vitc','vitd'];

  /* =========================================================
     NUTRITION-ONLY FAMILIES

     FAMILY (05-food-families.js) is NOT a nutrition map. It decides which
     foods count as the same thing on a plate â€” two members of a family can
     only appear once per meal â€” and it drives ingredient substitution and the
     suggested loadout. Around 150 foods are deliberately left out of it so
     that, say, shrimp and crab can share a plate.

     The side effect was that those foods had no nutrition row either, and
     nutriOf() returned null for them: a shrimp dinner read as 0% iron rather
     than "not counted". Widening FAMILY to fix that would have changed how
     meals are built, so nutrition gets its own parallel lookup instead. It is
     consulted only after FAMILY, so nothing that already worked changes.

     Grouped by what the food IS, not by what its key suggests -- several keys
     are historical and misleading ("curry" is a coconut curry sauce,
     "gochugaru" is ssamjang, "ranchdip" is a dry seasoning, "nashville" is a
     chilli oil).
  ========================================================= */
  const NUTRI_FAMILY = {
    /* --- shellfish and seafood --- */
    shrimp:'shellfish2', scallops:'shellfish2', crab:'shellfish2',
    mussels:'shellfish2', clams:'shellfish2', lobster:'shellfish2',
    calamari:'shellfish2', anchovy:'oilyfish', seaweed:'seaweed',

    /* --- vegetables --- */
    asparagus:'brassica', artichoke:'brassica', artichokehearts:'brassica',
    okra:'brassica', fennel:'cabbage', bambooshoot:'cabbage',
    heartsofpalm:'cabbage', sprouts:'cabbage', celery:'lettuce',
    cucumber:'lettuce', eggplant:'squash', waterchest:'root',
    corn:'peas', cornfroz:'peas', babycorn:'peas', greenbeans:'peas',
    garlic:'onion', plantain:'banana', gnocchi:'potato',

    /* --- fruit --- */
    apricot:'peach', nectarine:'peach', plum:'peach',
    cherries:'berry', pomegranate:'berry',
    mango:'tropical', papaya:'tropical', guava:'tropical', lychee:'tropical',
    passionfruit:'tropical', persimmon:'tropical', starfruit:'tropical',
    dragonfruit:'tropical', jackfruit:'tropical', fig:'tropical',

    /* --- nuts, seeds, cocoa --- */
    coconutmeat:'nuts', coconutflake:'nuts', cacaonibs:'nuts', darkchoc:'nuts',

    /* --- other whole foods --- */
    meatball:'groundpoultry', hummus:'beans', nutyeast:'powder',

    /* --- tomato-based sauces --- */
    marinara:'tomato', pizzasauce:'tomato', salsa:'tomato', salsaroja:'tomato',
    salsaverde:'tomato', enchilada:'tomato', bolognesejar:'tomato',
    vodkasauce:'tomato', cocktail:'tomato',

    /* --- dairy- and yogurt-based sauces --- */
    alfredo:'cream', hollandaise:'cream', curry:'cream', korma:'cream',
    massaman:'cream', tikka:'cream',
    cottagealfredo:'cottage',
    tzatziki:'yogurt', tzatzikihp:'yogurt', tzatzikilight:'yogurt',
    tkatziki2:'yogurt', bbqyog:'yogurt', buffaloyog:'yogurt',
    chipotleyog:'yogurt', cilantroavoyog:'yogurt', garlicparmyog:'yogurt',
    honeymustyog:'yogurt', jalapyog:'yogurt', tacoyog:'yogurt',
    buffalowing:'yogurt',

    /* --- mayo- and oil-based dressings --- */
    ranch:'mayo', ranchlight:'mayo', hpranch:'mayo', caesar:'mayo',
    caesarhp:'mayo', greengoddess:'mayo', chipotlecrema:'mayo',
    nashville:'oil', chilicrisp:'oil',

    /* --- herb and nut pastes --- */
    pesto:'pestofat', chimichurri:'pestofat', romesco:'pestofat',
    ajiverde:'pestofat', zhoug:'pestofat', harissa:'pestofat',
    mole:'pestofat', toum:'pestofat',
    peanutsauce:'nutbutter', peanutlight:'nutbutter', tahinisauce:'nutbutter',

    /* --- thin, salty and sweet sauces --- */
    soy:'sauce', aminos:'sauce', teriyaki:'sauce', hoisin:'sauce',
    ponzu:'sauce', oystersauce:'sauce', blackbean:'sauce', gochujang:'sauce',
    gochugaru:'sauce', katsu:'sauce', nuocmam:'sauce', sweetchili:'sauce',
    sweetsour:'sauce', honeygarlic:'sauce', honeysriracha:'sauce',
    bbq:'sauce', bbqlight:'sauce', buffalo:'sauce', hotsauce:'sauce',
    sriracha:'sauce', peri:'sauce', jerk:'sauce', horseradish:'sauce',

    /* --- dried spices and seasoning blends ---
       Used by the gram or two, so the profile matters far less than simply
       not counting as zero. */
    adobo:'herbs', allspice:'herbs', bayleaf:'herbs', caraway:'herbs',
    cardamom:'herbs', celeryseed:'herbs', chiliflake:'herbs',
    chiliseason:'herbs', coriander:'herbs', cumin:'herbs', fennelseed:'herbs',
    fivespice:'herbs', ginger:'herbs', mesquite:'herbs', mint:'herbs',
    mustardpwd:'herbs', oldbay:'herbs', poultryseason:'herbs', sage:'herbs',
    smokedpap:'herbs', steakrub:'herbs', sumac:'herbs', tarragon:'herbs',
    whitepepper:'herbs', zaatar:'herbs', ranchdip:'herbs',

    /* --- last few one-offs that sit in no family at all --- */
    chipotle:'chilli', fishsauce:'sauce', applesaucecond:'apple',
  };

  /* =========================================================
     MEASURED VALUES FROM USDA FOODDATA CENTRAL

     Everything above this point is modelled by food class: a typical profile
     for "leafy green" or "ground beef", accurate enough to tell a short day
     from a full one. The entries below are not modelled. They are the
     measured per-100g values for a specific USDA SR Legacy food, and they
     take precedence over both the family rows and the hand overrides.

     Source: USDA FoodData Central, SR Legacy (2018-04), a work of the US
     federal government and in the public domain. See THIRD-PARTY-NOTICES.md.

     HOW THESE WERE CHOSEN. Names were matched automatically and then read
     one by one, because automated matching alone was not safe: it paired
     "Butter" with apple fruit butter, "Grapes" with grape leaves, "Olives"
     with olive loaf, "Sweet Potato (raw)" with sweet potato LEAVES, and
     "Hazelnuts" with a hazelnut coffee creamer. Around 50 matches were
     rejected on inspection and those foods keep their modelled values --
     an honest estimate beats a confident wrong number. Each entry carries
     the USDA description it came from so any of them can be re-checked.

     The comment on each line is the exact SR Legacy description.
  ========================================================= */
  const USDA_NUTRI = {
    acornsq:         [0.021,0,0,347,33,0.7,32,0.13,18,11,0],  // Squash, winter, acorn, raw
    apricot:         [0.027,0,9.24,259,13,0.39,10,0.2,96,10,0],  // Apricots, raw
    apricotdry:      [0.017,0,53.44,1162,55,2.66,32,0.39,180,1,0],  // Apricots, dried, sulfured, uncooked
    arugula:         [0.086,0,2.05,369,160,1.46,47,0.47,119,15,0],  // Arugula, raw
    asianpear:       [0.012,0,7.05,121,4,0,8,0.02,0,3.8,0],  // Pears, asian, raw
    asparagus:       [0.04,0,1.88,202,24,2.14,14,0.54,38,5.6,0],  // Asparagus, raw
    avocadooil:      [11.56,0,0,0,0,0,0,0,0,0,0],  // Oil, avocado
    babycarrot:      [0.023,0,4.76,237,32,0.89,10,0.17,690,2.6,0],  // Carrots, baby, raw
    bambooshoot:     [0.069,0,3,533,13,0.5,3,1.1,1,4,0],  // Bamboo shoots, raw
    basil:           [0.041,0,0.3,295,177,3.17,64,0.81,264,18,0],  // Basil, fresh
    beef80:          [7.581,71,0,270,18,1.94,17,4.18,4,0,0.1],  // Beef, ground, 80% lean meat / 20% fat, raw
    beef93:          [2.878,63,0,336,10,2.33,21,4.97,4,0,0.1],  // Beef, ground, 93% lean meat / 7% fat, raw
    beefliver:       [1.233,275,0,313,5,4.9,18,4,4968,1.3,1.2],  // Beef, variety meats and by-products, liver, raw
    beetgreens:      [0.02,0,0.5,762,117,2.57,70,0.38,316,30,0],  // Beet greens, raw
    beets:           [0.027,0,6.76,325,16,0.8,23,0.35,2,4.9,0],  // Beets, raw
    berries:         [0.028,0,9.96,77,6,0.28,6,0.16,3,9.7,0],  // Blueberries, raw
    blackberry:      [0.014,0,4.88,162,29,0.62,20,0.53,11,21,0],  // Blackberries, raw
    bluecheese:      [18.669,75,0.5,256,528,0.31,23,2.66,198,0,0.5],  // Cheese, blue
    bologna:         [10.487,57,2.05,351,21,1.29,13,1.93,19,15.2,0.7],  // Bologna, beef
    brisket:         [2.59,62,0,330,5,1.92,23,4.31,0,0,0],  // Beef, brisket, whole, separable lean only, all grades, raw
    broccoli:        [0.114,0,1.7,316,47,0.73,21,0.41,31,89.2,0],  // Broccoli, raw
    brussels:        [0.062,0,2.2,389,42,1.4,23,0.42,38,85,0],  // Brussels sprouts, raw
    buckwheat:       [0.591,0,0,320,17,2.47,221,2.42,0,0,0],  // Buckwheat groats, roasted, dry
    bulgur:          [0.232,0,0.41,410,35,2.46,164,1.93,0,0,0],  // Bulgur, dry
    butternut:       [0.021,0,2.2,352,48,0.7,34,0.15,532,21,0],  // Squash, winter, butternut, raw
    cabbage:         [0.034,0,3.2,170,40,0.47,12,0.18,5,36.6,0],  // Cabbage, raw
    caesar:          [8.789,39,2.81,29,48,1.08,2,0.11,9,0.3,0.1],  // Salad dressing, caesar dressing, regular
    canadian:        [0.9,48,0.9,683,6,0.44,20,1.23,0,0,0.1],  // Canadian bacon, unprepared
    canola:          [7.365,0,0,0,0,0,0,0,0,0,0],  // Oil, canola
    carrots:         [0.032,0,4.74,320,33,0.3,12,0.24,835,5.9,0],  // Carrots, raw
    cassava:         [0.074,0,1.7,271,16,0.27,21,0.34,1,20.6,0],  // Cassava, raw
    cauliflower:     [0.13,0,1.91,299,22,0.42,15,0.27,0,48.2,0],  // Cauliflower, raw
    celeriac:        [0.079,0,1.6,300,43,0.7,20,0.33,0,8,0],  // Celeriac, raw
    celery:          [0.042,0,1.34,260,40,0.2,11,0.13,22,3.1,0],  // Celery, raw
    cereal:          [0.13,0,0,113,6,31.7,25,1.03,0,0,0],  // Cereals ready-to-eat, rice, puffed, fortified
    chard:           [0.03,0,1.1,379,51,1.8,81,0.36,306,30,0],  // Chard, swiss, raw
    cheddar:         [19.368,99,0.27,76,711,0.16,27,3.74,263,0,1],  // Cheese, cheddar, sharp, sliced
    cheesesauce:     [6.01,29,0.42,30,184,0.21,9,0.98,80,0.4,0],  // Sauce, cheese, ready-to-serve
    chickdeli:       [0.564,51,0.75,360,11,0.39,26,0.51,2,0,0.1],  // Chicken breast, deli, rotisserie seasoned, sliced, prepackaged
    chicken:         [2.66,64,0,220,11,0.74,25,0.8,24,0,0.4],  // Chicken, broilers or fryers, breast, meat and skin, raw
    chickliver:      [1.563,345,0,230,8,8.99,19,2.67,3296,17.9,0],  // Chicken, liver, all classes, raw
    chickwing:       [0.94,57,0,194,13,0.88,22,1.63,18,1.2,0.1],  // Chicken, broilers or fryers, wing, meat only, raw
    chilisauce:      [0.045,0,13.33,370,20,0.8,12,0.16,34,16,0],  // Sauce, tomato chili sauce, bottled, with salt
    cilantro:        [0.014,0,0.87,521,67,1.77,26,0.5,337,27,0],  // Coriander (cilantro) leaves, raw
    cocktail:        [0,0,11.83,309,26,0.83,17,0.38,18,11.6,0],  // Sauce, cocktail, ready-to-serve
    cocoapwd:        [12.64,0,1.53,2509,122,14.5,476,6.7,0,0,0],  // Cocoa, dry powder, hi-fat or breakfast, processed with alkali
    coconut:         [82.475,0,0,0,1,0.05,0,0.02,0,0,0],  // Oil, coconut
    corn:            [0.182,0,3.22,270,2,0.52,37,0.45,0,6.8,0],  // Corn, sweet, white, raw
    cornfroz:        [0.12,0,3.78,294,4,0.68,32,0.7,12,7.2,0],  // Corn, sweet, yellow, frozen, kernels on cob, unprepared
    couscous:        [0.117,0,0,166,24,1.08,44,0.83,0,0,0],  // Couscous, dry
    cranberry:       [0.008,0,4.27,80,8,0.23,6,0.09,3,14,0],  // Cranberries, raw
    creamcheese:     [20.213,101,3.76,132,97,0.11,9,0.5,308,0,0],  // Cheese, cream
    croissant:       [11.659,67,11.26,118,37,2.03,16,0.75,206,0.2,0],  // Croissants, butter
    cucumber:        [0.078,0,1.38,136,14,0.22,12,0.17,4,3.2,0],  // Cucumber, peeled, raw
    currants:        [0.034,0,0,322,55,1.54,24,0.27,12,181,0],  // Currants, european black, raw
    darkchoc:        [24.489,3,23.99,715,73,11.9,228,3.31,2,0,0],  // Chocolate, dark, 70-85% cacao solids
    dill:            [0.06,0,0,738,208,6.59,55,0.91,386,85,0],  // Dill weed, fresh
    eggnoodle:       [1.18,84,1.88,244,35,4.01,58,1.92,17,0,0.3],  // Noodles, egg, dry, enriched
    eggplant:        [0.034,0,3.53,229,9,0.23,14,0.16,1,2.2,0],  // Eggplant, raw
    eggwhites:       [0,0,0.71,163,7,0.08,11,0.03,0,0,0],  // Egg, white, raw, fresh
    elk:             [0.706,0,0,328,4,7.17,22,5.82,0,0,0],  // Elk, free range, ground, raw (Shoshone Bannock)
    enchilada:       [0.111,0,1.83,101,7,0.67,6,0.09,36,0.3,0],  // Sauce, enchilada, red, mild, ready to serve
    endive:          [0.048,0,0.25,314,52,0.83,15,0.79,108,6.5,0],  // Endive, raw
    enoki:           [0.027,0,0.22,359,0,1.15,16,0.65,0,0,0.1],  // Mushrooms, enoki, raw
    evapmilk:        [1.204,0,6.67,303,267,0.19,24,0.77,56,16,4],  // Milk, evaporated, 2% fat, with added vitamin A and vitamin D
    fennel:          [0.09,0,3.93,414,49,0.73,17,0.2,48,12,0],  // Fennel, bulb, raw
    feta:            [13.3,89,0,62,493,0.65,19,2.88,125,0,0.4],  // Cheese, feta
    fig:             [0.06,0,16.26,232,35,0.37,17,0.15,7,2,0],  // Figs, raw
    figsdried:       [0.144,0,47.92,680,162,2.03,68,0.55,0,1.2,0],  // Figs, dried, uncooked
    fishsauce:       [0.003,0,3.64,288,43,0.78,175,0.2,4,0.5,0],  // Sauce, fish, ready-to-serve
    flaxoil:         [8.976,0,0,0,1,0,0,0.07,0,0,0],  // Oil, flaxseed, cold pressed
    flourtort8:      [2.924,0,3.71,125,146,3.63,22,0.53,0,0,0],  // Tortillas, ready-to-bake or -fry, flour, refrigerated
    focaccia:        [0.877,0,1.75,114,35,3.16,20,1.33,0,0,0],  // Focaccia, Italian flatbread, plain
    fontina:         [19.196,116,1.55,64,550,0.23,14,3.5,261,0,0.6],  // Cheese, fontina
    ginger:          [0.203,0,1.7,415,16,0.6,43,0.34,0,5,0],  // Ginger root, raw
    gingerfresh:     [0.203,0,1.7,415,16,0.6,43,0.34,0,5,0],  // Ginger root, raw
    goat:            [0.71,57,0,385,13,2.83,0,4,0,0,0],  // Game meat, goat, raw
    goatcheese:      [24.609,105,2.17,48,895,1.88,54,1.59,486,0,0.7],  // Cheese, goat, hard type
    gooseberry:      [0.038,0,0,198,25,0.31,10,0.12,15,27.7,0],  // Gooseberries, raw
    grapeseed:       [9.6,0,0,0,0,0,0,0,0,0,0],  // Oil, grapeseed
    greenbeans:      [0.05,0,3.26,211,37,1.03,25,0.24,35,12.2,0],  // Beans, snap, green, raw
    greengoddess:    [5.978,40,6.67,58,34,0.35,7,0.25,10,0.2,0],  // Salad dressing, green goddess, regular
    greentom:        [0.139,0,3.93,268,7,0.62,20,0.22,6,11.7,0],  // Tomatillos, raw
    grndlamb:        [10.19,73,0,222,16,1.55,21,3.41,0,0,0.1],  // Lamb, ground, raw
    grndturk85:      [3.414,78,0,202,33,1.32,19,2.75,30,0,0.4],  // Turkey, ground, 85% lean, 15% fat, raw
    grndturk93:      [2.17,74,0,213,21,1.17,21,2.53,22,0,0.4],  // Turkey, ground, 93% lean, 7% fat, raw
    guava:           [0.272,0,8.92,417,18,0.26,22,0.23,31,228.3,0],  // Guavas, common, raw
    heartsofpalm:    [0.046,0,17.16,1806,18,1.69,10,3.73,3,8,0],  // Hearts of palm, raw
    heavycream:      [23.032,113,2.92,95,66,0.1,7,0.24,411,0.6,1.6],  // Cream, fluid, heavy whipping
    hoisin:          [0.568,3,27.26,119,32,1.01,24,0.32,0,0.4,0],  // Sauce, hoisin, ready-to-serve
    honeydew:        [0.038,0,8.12,228,6,0.17,10,0.09,3,18,0],  // Melons, honeydew, raw
    horseradish:     [0.09,0,7.99,246,56,0.42,27,0.83,0,24.9,0],  // Horseradish, prepared
    hotsauce:        [0,0,15.11,321,18,1.64,16,0.24,129,26.9,0],  // Sauce, hot chile, sriracha
    hummus:          [2.562,0,0.62,312,47,2.54,75,1.44,1,0,0],  // Hummus, commercial
    iceberg:         [0.018,0,1.97,141,18,0.41,7,0.15,25,2.8,0],  // Lettuce, iceberg (includes crisphead types), raw
    italsaus:        [8.615,69,1.19,211,12,1.77,16,1.91,0,0,0],  // Sausage, Italian, pork, mild, raw
    jackfruit:       [0.195,0,19.08,448,24,0.23,29,0.13,5,13.7,0],  // Jackfruit, raw
    jicama:          [0.021,0,1.8,150,12,0.6,12,0.16,1,20.2,0],  // Yambean (jicama), raw
    kale:            [0.178,0,0.99,348,254,1.6,33,0.39,241,93.4,0],  // Kale, raw
    kefir:           [0.658,5,4.61,164,130,0.04,12,0.46,171,0.2,1],  // Kefir, lowfat, plain, LIFEWAY
    kielbasa:        [9.894,73,2.39,306,42,0.99,16,1.53,9,14.7,0.9],  // Kielbasa, fully cooked, grilled
    kohlrabi:        [0.013,0,2.6,350,24,0.4,19,0.03,2,62,0],  // Kohlrabi, raw
    lamb:            [1.96,66,0,356,7,1.54,24,2.54,4,0,0],  // Lamb, New Zealand, imported, loin saddle, separable lean only, raw
    lambchop:        [2.764,66,0,327,18,1.52,23,2.69,5,0,0],  // Lamb, New Zealand, imported, loin chop, separable lean only, raw
    lambshank:       [1.278,65,0,309,7,1.37,20,4.28,3,0,0],  // Lamb, New Zealand, imported, fore-shank, separable lean only, raw
    lard:            [39.2,95,0,0,0,0,0,0.11,0,0,2.5],  // Lard
    lemonjuice:      [0.04,0,2.52,103,6,0.08,6,0.05,0,38.7,0],  // Lemon juice, raw
    lime:            [0.022,0,1.69,102,33,0.6,6,0.11,2,29.1,0],  // Limes, raw
    limejuice:       [0.008,0,1.69,117,14,0.09,8,0.08,2,30,0],  // Lime juice, raw
    lotusroot:       [0.03,0,0,556,45,1.16,23,0.39,0,44,0],  // Lotus root, raw
    macadamia:       [12.061,0,4.57,368,85,3.69,130,1.3,0,1.2,0],  // Nuts, macadamia nuts, raw
    mango:           [0.092,0,13.66,168,11,0.16,10,0.09,54,36.4,0],  // Mangos, raw
    marinara:        [0.218,2,4.91,320,26,0.73,18,0.2,31,2,0],  // Sauce, pasta, spaghetti/marinara, ready-to-serve
    mixveg:          [0.098,0,0,212,25,0.95,24,0.45,254,10.4,0],  // Vegetables, mixed, frozen, unprepared
    mortadella:      [9.51,56,0,163,18,1.4,11,2.1,0,0,1],  // Mortadella, beef, pork
    muenster:        [19.113,96,1.12,134,717,0.41,27,2.81,298,0,0.6],  // Cheese, muenster
    mustard:         [0.214,0,0.92,152,63,1.61,48,0.64,5,0.3,0],  // Mustard, prepared, yellow
    mustardgreens:   [0.01,0,1.32,384,115,1.64,32,0.25,151,70,0],  // Mustard greens, raw
    natto:           [1.591,0,4.89,729,217,8.6,115,3.03,0,13,0],  // Natto
    nutella:         [28.423,0,54.05,407,108,4.38,64,1.06,1,0,0],  // Chocolate-flavored hazelnut spread
    okra:            [0.026,0,1.48,299,82,0.62,57,0.58,36,23,0],  // Okra, raw
    onionring:       [4.534,0,0,190,46,0.93,14,0.36,0,4.6,0],  // Onion rings, breaded, par fried, frozen, unprepared
    oystermush:      [0.062,0,1.11,420,3,1.33,18,0.77,2,0,0.7],  // Mushrooms, oyster, raw
    oystersauce:     [0.043,0,0,54,32,0.18,4,0.09,0,0.1,0],  // Sauce, oyster, ready-to-serve
    papaya:          [0.081,0,7.82,182,20,0.25,21,0.08,47,60.9,0],  // Papayas, raw
    parsley:         [0.132,0,0.85,554,138,6.2,50,1.07,421,133,0],  // Parsley, fresh
    parsnip:         [0.05,0,4.8,375,36,0.59,29,0.59,0,17,0],  // Parsnips, raw
    passionfruit:    [0.059,0,11.2,348,12,1.6,29,0.1,64,30,0],  // Passion-fruit, (granadilla), purple, raw
    pasta:           [0.277,0,2.67,223,21,1.3,53,1.41,0,0,0],  // Pasta, dry, unenriched
    peachcan:        [0.004,0,10.27,128,6,0.27,7,0.11,19,3.6,0],  // Peaches, canned, juice pack, solids and liquids
    peanuts:         [7.329,0,0,332,62,2.09,184,3.34,0,0,0],  // Peanuts, valencia, raw
    peanutsauce:     [3.53,0,18.8,99,9,0.38,19,0.3,0,0,0],  // Sauce, peanut, made from coconut, water, sugar, peanuts
    peas:            [0.071,0,5.67,244,25,1.47,33,1.24,38,40,0],  // Peas, green, raw
    persimmon:       [0.02,0,12.53,161,8,0.15,9,0.11,81,7.5,0],  // Persimmons, japanese, raw
    pimentochz:      [19.663,94,0.62,162,614,0.42,22,2.98,244,2.3,0.5],  // Cheese, pasteurized process, pimento
    pineapplecan:    [0.008,0,14.26,124,16,0.28,15,0.1,3,9.4,0],  // Pineapple, canned, juice pack, drained
    plantain:        [0.121,0,2.29,431,2,0.75,41,0.18,0,20.2,0],  // Plantains, green, raw
    pomegranate:     [0.12,0,13.67,236,10,0.3,12,0.35,0,10.2,0],  // Pomegranates, raw
    pork:            [0.698,65,0,399,5,0.98,27,1.89,0,0,0.2],  // Pork, fresh, loin, tenderloin, separable lean only, raw
    porkbelly:       [19.33,72,0,185,5,0.52,4,1.02,3,0.3,0],  // Pork, fresh, belly, raw
    porkchop:        [1.208,66,0,387,5,0.51,27,1.59,0,0,0.3],  // Pork, fresh, loin, top loin (chops), boneless, separable lean only, raw
    porkloinroast:   [0.524,62,0,399,5,0.8,25,2.05,0,0,0],  // Pork, Leg sirloin tip roast, boneless, separable lean and fat, raw
    porkshould:      [2.47,67,0,341,14,1.22,21,3.14,2,0.8,0],  // Pork, fresh, shoulder, whole, separable lean only, raw
    proteinbar:      [3.384,3,15.17,793,322,5.4,71,2.39,391,27.9,0],  // Formulated Bar, SOUTH BEACH protein bar
    pumpkinseeds:    [3.67,0,0,919,55,3.31,262,10.3,3,0.3,0],  // Seeds, pumpkin and squash seeds, whole, roasted, without salt
    quail:           [1.32,70,0,237,13,4.51,25,2.7,17,7.2,0],  // Quail, meat only, raw
    radicchio:       [0.06,0,0.6,302,19,0.57,13,0.62,1,8,0],  // Radicchio, raw
    radish:          [0.032,0,1.86,233,25,0.34,10,0.28,0,14.8,0],  // Radishes, raw
    ranch:           [6.964,26,4.69,64,28,0.3,5,0.17,15,0,0.1],  // Salad dressing, ranch dressing, regular
    raspberry:       [0.019,0,4.42,151,25,0.69,22,0.42,2,26.2,0],  // Raspberries, raw
    redcabbage:      [0.021,0,3.83,243,45,0.8,16,0.22,56,57,0],  // Cabbage, red, raw
    ricenoodle:      [0.153,0,0.12,30,18,0.7,12,0.74,0,0,0],  // Rice noodles, dry
    roastbeef:       [1.318,51,0.29,647,5,2.05,20,3.2,3,0,0],  // Roast beef, deli style, prepackaged, sliced
    romaine:         [0.039,0,1.19,247,33,0.97,14,0.23,436,4,0],  // Lettuce, cos or romaine, raw
    rosemary:        [2.838,0,0,668,317,6.65,91,0.93,146,21.8,0],  // Rosemary, fresh
    russian:         [2.39,0,17.68,173,13,0.6,10,0.22,29,6,0],  // Salad dressing, russian dressing
    rutabaga:        [0.027,0,4.46,305,43,0.44,20,0.24,0,25,0],  // Rutabagas, raw
    ryebread:        [0.626,0,3.85,166,73,2.83,40,1.14,0,0.4,0],  // Bread, rye
    salami:          [9.865,71,1.5,188,6,2.2,13,1.77,0,0,1.2],  // Salami, cooked, beef
    salmoncan:       [1.46,67,0,329,198,0.57,30,0.67,39,0,19],  // Salmon, sockeye, canned, total can contents
    savoy:           [0.013,0,2.27,230,35,0.4,28,0.27,50,31,0],  // Cabbage, savoy, raw
    serrano:         [0.059,0,3.83,305,11,0.86,22,0.26,47,44.9,0],  // Peppers, serrano, raw
    sesameoil:       [14.2,0,0,0,0,0,0,0,0,0,0],  // Oil, sesame, salad or cooking
    shallot:         [0.017,0,7.87,334,37,1.2,21,0.4,0,8,0],  // Shallots, raw
    shiitake:        [0,0,2.38,304,2,0.41,20,1.03,0,0,0.4],  // Mushrooms, shiitake, raw
    skyrfat:         [13.831,76,8,147,101,0.05,11,0.37,188,0,0.4],  // Cream, whipped, cream topping, pressurized
    smokedsalmon:    [2.593,155,0,960,58,1.06,58,1.14,31,0,0],  // Salmon, red (sockeye), filets with skin, smoked (Alaska Native)
    soba:            [0.136,0,0,252,35,2.7,95,1.71,0,0,0],  // Noodles, japanese, soba, dry
    sourcream:       [10.14,59,3.41,125,101,0.07,10,0.33,124,0.9,0],  // Cream, sour, cultured
    sourcreamlt:     [6.6,35,0.22,212,141,0.07,10,0.5,90,0.9,0.2],  // Sour cream, light
    soy:             [0.011,0,1.7,212,20,2.38,40,0.43,0,0,0],  // Soy sauce made from soy (tamari)
    spaghettisq:     [0.117,0,2.76,108,23,0.31,12,0.19,6,2.1,0],  // Squash, winter, spaghetti, raw
    spinach:         [0.063,0,0.42,558,99,2.71,79,0.53,469,28.1,0],  // Spinach, raw
    strawberry:      [0.015,0,4.89,153,16,0.41,13,0.14,1,58.8,0],  // Strawberries, raw
    sunbutter:       [4.678,0,10.54,576,64,4.12,311,4.89,0,2.7,0],  // Seeds, sunflower seed butter, without salt
    sundried:        [0.426,0,37.59,3427,110,9.09,194,1.99,44,39.2,0],  // Tomatoes, sun-dried
    sweetsour:       [0,0,18.75,99,10,0.21,8,0.09,1,8.7,0],  // Sauce, sweet and sour, ready-to-serve
    swisscheese:     [18.227,93,0,72,890,0.13,33,4.37,288,0,0],  // Cheese, swiss
    taro:            [0.041,0,0.4,591,43,0.55,33,0.23,4,4.5,0],  // Taro, raw
    tartar:          [3.333,7,4.25,68,26,0.25,6,0.12,11,2.3,0],  // Sauce, tartar, ready-to-serve
    tempeh:          [2.539,0,0,412,111,2.7,81,1.14,0,0,0],  // Tempeh
    teriyaki:        [0,0,14.1,225,25,1.7,61,0.1,0,0,0],  // Sauce, teriyaki, ready-to-serve
    thyme:           [0.467,0,0,609,405,17.45,160,1.81,238,160.1,0],  // Thyme, fresh
    tofu:            [0.71,0,0.4,0,149,1.69,0,0,0,1.1,0],  // HOUSE FOODS Premium Firm Tofu
    tomatillo:       [0.139,0,3.93,268,7,0.62,20,0.22,6,11.7,0],  // Tomatillos, raw
    tortchips:       [0.85,0,0.67,272,159,1.6,97,1.15,5,0.2,0],  // Tortilla chips, low fat, baked without fat
    tortellini:      [3.6,42,0.95,89,152,1.5,21,1.02,38,0,0],  // Tortellini, pasta with cheese filling, fresh-refrigerated, as purchased
    turkey:          [0.289,57,0.05,242,11,0.73,28,1.28,6,0,0.1],  // Turkey, whole, breast, meat only, raw
    turkeythigh:     [0.782,78,0,269,4,1.42,22,2.95,19,0,0.5],  // Turkey, retail parts, thigh, meat only, raw
    turnip:          [0.011,0,3.8,191,30,0.3,11,0.27,0,21,0],  // Turnips, raw
    vanilla:         [0.01,0,12.65,148,11,0.12,12,0.11,0,0,0],  // Vanilla extract
    venison:         [0.63,18,0,0,7,2.9,0,0,0,0,0],  // Deer (venison), sitka, raw (Alaska Native)
    vinegarbal:      [0,0,14.95,112,27,0.72,12,0.08,0,0,0],  // Vinegar, balsamic
    waffle:          [1.898,15,4.3,126,279,6.04,19,0.48,401,0,0],  // Waffles, buttermilk, frozen, ready-to-heat
    walnutoil:       [9.1,0,0,0,0,0,0,0,0,0,0],  // Oil, walnut
    watercress:      [0.027,0,0.2,330,120,0.2,21,0.11,160,43,0],  // Watercress, raw
    watermelon:      [0.016,0,6.2,112,7,0.24,10,0.1,28,8.1,0],  // Watermelon, raw
    whiterice:       [0.294,0,0.33,174,71,3.33,27,1.02,0,0,0],  // Rice, white, long-grain, parboiled, enriched, dry
    wontonwrap:      [0.263,9,0,82,47,3.36,20,0.71,4,0,0],  // Wonton wrappers (includes egg roll wrappers)
    wwpasta:         [0.351,0,2.6,366,27,3.33,104,2.4,0,0,0],  // Pasta, whole grain, 51% whole wheat, remaining unenriched semolina, dry
    wwtort8:         [4.878,0,2.44,262,244,2.63,85,1.92,0,0,0],  // Tortillas, ready-to-bake or -fry, whole wheat
  };

  /* Fibre, g per 100g, measured -- same source and same caveats */
  const USDA_FIBRE = {
    acornsq: 1.5,
    apricot: 2,
    apricotdry: 7.3,
    arugula: 1.6,
    asianpear: 3.6,
    asparagus: 2.1,
    avocadooil: 0,
    babycarrot: 2.9,
    bambooshoot: 2.2,
    basil: 1.6,
    beef80: 0,
    beef93: 0,
    beefliver: 0,
    beetgreens: 3.7,
    beets: 2.8,
    berries: 2.4,
    blackberry: 5.3,
    bluecheese: 0,
    bologna: 0,
    brisket: 0,
    broccoli: 2.6,
    brussels: 3.8,
    buckwheat: 10.3,
    bulgur: 12.5,
    butternut: 2,
    cabbage: 2.5,
    caesar: 0.5,
    canadian: 0,
    canola: 0,
    carrots: 2.8,
    cassava: 1.8,
    cauliflower: 2,
    celeriac: 1.8,
    celery: 1.6,
    cereal: 1.7,
    chard: 1.6,
    cheddar: 0,
    cheesesauce: 0.5,
    chickdeli: 0,
    chicken: 0,
    chickliver: 0,
    chickwing: 0,
    chilisauce: 2.4,
    cilantro: 2.8,
    cocktail: 1.8,
    cocoapwd: 33.9,
    coconut: 0,
    corn: 2.7,
    cornfroz: 2.8,
    couscous: 5,
    cranberry: 3.6,
    creamcheese: 0,
    croissant: 2.6,
    cucumber: 0.7,
    currants: 0,
    darkchoc: 10.9,
    dill: 2.1,
    eggnoodle: 3.3,
    eggplant: 3,
    eggwhites: 0,
    elk: 0,
    enchilada: 0.5,
    endive: 3.1,
    enoki: 2.7,
    evapmilk: 0,
    fennel: 3.1,
    feta: 0,
    fig: 2.9,
    figsdried: 9.8,
    fishsauce: 0,
    flaxoil: 0,
    flourtort8: 3.5,
    focaccia: 1.8,
    fontina: 0,
    ginger: 2,
    gingerfresh: 2,
    goat: 0,
    goatcheese: 0,
    gooseberry: 4.3,
    grapeseed: 0,
    greenbeans: 2.7,
    greengoddess: 0.1,
    greentom: 1.9,
    grndlamb: 0,
    grndturk85: 0,
    grndturk93: 0,
    guava: 5.4,
    heartsofpalm: 1.5,
    heavycream: 0,
    hoisin: 2.8,
    honeydew: 0.8,
    horseradish: 3.3,
    hotsauce: 2.2,
    hummus: 5.5,
    iceberg: 1.2,
    italsaus: 0,
    jackfruit: 1.5,
    jicama: 4.9,
    kale: 4.1,
    kefir: 0,
    kielbasa: 0,
    kohlrabi: 3.6,
    lamb: 0,
    lambchop: 0,
    lambshank: 0,
    lard: 0,
    lemonjuice: 0.3,
    lime: 2.8,
    limejuice: 0.4,
    lotusroot: 4.9,
    macadamia: 8.6,
    mango: 1.6,
    marinara: 1.8,
    mixveg: 4,
    mortadella: 0,
    muenster: 0,
    mustard: 4,
    mustardgreens: 3.2,
    natto: 5.4,
    nutella: 5.4,
    okra: 3.2,
    onionring: 1.8,
    oystermush: 2.3,
    oystersauce: 0.3,
    papaya: 1.7,
    parsley: 3.3,
    parsnip: 4.9,
    passionfruit: 10.4,
    pasta: 3.2,
    peachcan: 1.3,
    peanuts: 8.7,
    peanutsauce: 1.1,
    peas: 5.7,
    persimmon: 3.6,
    pimentochz: 0.1,
    pineapplecan: 1.3,
    plantain: 2.2,
    pomegranate: 4,
    pork: 0,
    porkbelly: 0,
    porkchop: 0,
    porkloinroast: 0,
    porkshould: 0,
    proteinbar: 7.3,
    pumpkinseeds: 18.4,
    quail: 0,
    radicchio: 0.9,
    radish: 1.6,
    ranch: 0,
    raspberry: 6.5,
    redcabbage: 2.1,
    ricenoodle: 1.6,
    roastbeef: 0,
    romaine: 2.1,
    rosemary: 14.1,
    russian: 0.7,
    rutabaga: 2.3,
    ryebread: 5.8,
    salami: 0,
    salmoncan: 0,
    savoy: 3.1,
    serrano: 3.7,
    sesameoil: 0,
    shallot: 3.2,
    shiitake: 2.5,
    skyrfat: 0,
    smokedsalmon: 0,
    soba: 0,
    sourcream: 0,
    sourcreamlt: 0,
    soy: 0.8,
    spaghettisq: 1.5,
    spinach: 2.2,
    strawberry: 2,
    sunbutter: 5.7,
    sundried: 12.3,
    sweetsour: 0.1,
    swisscheese: 0,
    taro: 4.1,
    tartar: 0.5,
    tempeh: 0,
    teriyaki: 0.1,
    thyme: 14,
    tofu: 0.9,
    tomatillo: 1.9,
    tortchips: 5.3,
    tortellini: 1.9,
    turkey: 0,
    turkeythigh: 0,
    turnip: 1.8,
    vanilla: 0,
    venison: 0,
    vinegarbal: 0,
    waffle: 2.2,
    walnutoil: 0,
    watercress: 0.5,
    watermelon: 0.4,
    whiterice: 1.8,
    wontonwrap: 1.8,
    wwpasta: 10.1,
    wwtort8: 9.8,
  };

  /* Sodium, mg per 100g, measured */
  const USDA_SODIUM = {
    acornsq: 3,
    apricot: 1,
    apricotdry: 10,
    arugula: 27,
    asianpear: 0,
    asparagus: 2,
    avocadooil: 0,
    babycarrot: 78,
    bambooshoot: 4,
    basil: 4,
    beef80: 66,
    beef93: 66,
    beefliver: 69,
    beetgreens: 226,
    beets: 78,
    berries: 1,
    blackberry: 1,
    bluecheese: 1146,
    bologna: 1013,
    brisket: 79,
    broccoli: 33,
    brussels: 25,
    buckwheat: 11,
    bulgur: 17,
    butternut: 4,
    cabbage: 18,
    caesar: 1209,
    canadian: 751,
    canola: 0,
    carrots: 69,
    cassava: 14,
    cauliflower: 30,
    celeriac: 100,
    celery: 80,
    cereal: 3,
    chard: 213,
    cheddar: 644,
    cheesesauce: 828,
    chickdeli: 1032,
    chicken: 63,
    chickliver: 71,
    chickwing: 81,
    chilisauce: 1338,
    cilantro: 46,
    cocktail: 1262,
    cocoapwd: 20,
    coconut: 0,
    corn: 15,
    cornfroz: 5,
    couscous: 10,
    cranberry: 2,
    creamcheese: 314,
    croissant: 384,
    cucumber: 2,
    currants: 2,
    darkchoc: 20,
    dill: 61,
    eggnoodle: 21,
    eggplant: 2,
    eggwhites: 166,
    elk: 49,
    enchilada: 547,
    endive: 22,
    enoki: 3,
    evapmilk: 100,
    fennel: 52,
    feta: 1139,
    fig: 1,
    figsdried: 10,
    fishsauce: 7851,
    flaxoil: 0,
    flourtort8: 736,
    focaccia: 561,
    fontina: 800,
    ginger: 13,
    gingerfresh: 13,
    goat: 82,
    goatcheese: 423,
    gooseberry: 1,
    grapeseed: 0,
    greenbeans: 6,
    greengoddess: 867,
    greentom: 1,
    grndlamb: 59,
    grndturk85: 54,
    grndturk93: 69,
    guava: 2,
    heartsofpalm: 14,
    heavycream: 27,
    hoisin: 1615,
    honeydew: 18,
    horseradish: 420,
    hotsauce: 2124,
    hummus: 426,
    iceberg: 10,
    italsaus: 563,
    jackfruit: 2,
    jicama: 4,
    kale: 53,
    kefir: 40,
    kielbasa: 1062,
    kohlrabi: 20,
    lamb: 75,
    lambchop: 77,
    lambshank: 82,
    lard: 0,
    lemonjuice: 1,
    lime: 2,
    limejuice: 2,
    lotusroot: 40,
    macadamia: 5,
    mango: 1,
    marinara: 437,
    mixveg: 47,
    mortadella: 1246,
    muenster: 628,
    mustard: 1104,
    mustardgreens: 20,
    natto: 7,
    nutella: 41,
    okra: 7,
    onionring: 246,
    oystermush: 18,
    oystersauce: 2733,
    papaya: 8,
    parsley: 56,
    parsnip: 10,
    passionfruit: 28,
    pasta: 6,
    peachcan: 4,
    peanuts: 1,
    peanutsauce: 319,
    peas: 5,
    persimmon: 1,
    pimentochz: 915,
    pineapplecan: 1,
    plantain: 2,
    pomegranate: 3,
    pork: 53,
    porkbelly: 32,
    porkchop: 49,
    porkloinroast: 50,
    porkshould: 76,
    proteinbar: 436,
    pumpkinseeds: 18,
    quail: 51,
    radicchio: 22,
    radish: 39,
    ranch: 901,
    raspberry: 1,
    redcabbage: 27,
    ricenoodle: 182,
    roastbeef: 853,
    romaine: 8,
    rosemary: 26,
    russian: 1133,
    rutabaga: 12,
    ryebread: 603,
    salami: 1140,
    salmoncan: 433,
    savoy: 28,
    serrano: 10,
    sesameoil: 0,
    shallot: 12,
    shiitake: 9,
    skyrfat: 8,
    smokedsalmon: 51,
    soba: 792,
    sourcream: 31,
    sourcreamlt: 83,
    soy: 5586,
    spaghettisq: 17,
    spinach: 79,
    strawberry: 1,
    sunbutter: 3,
    sundried: 107,
    sweetsour: 539,
    swisscheese: 187,
    taro: 11,
    tartar: 667,
    tempeh: 9,
    teriyaki: 3833,
    thyme: 9,
    tofu: 33,
    tomatillo: 1,
    tortchips: 517,
    tortellini: 406,
    turkey: 113,
    turkeythigh: 75,
    turnip: 67,
    vanilla: 9,
    venison: 0,
    vinegarbal: 23,
    waffle: 621,
    walnutoil: 0,
    watercress: 41,
    watermelon: 1,
    whiterice: 2,
    wontonwrap: 572,
    wwpasta: 11,
    wwtort8: 617,
  };

  /* Measured USDA values first, then the hand overrides, then the family
     model. Only the first of these is real data for that specific food. */
  function nutriOf(food){
    if (!food) return null;
    const row = USDA_NUTRI[food.key]
      || NUTRI_OVERRIDE[food.key]
      || NUTRI_BY_FAMILY[FAMILY[food.key]]
      || NUTRI_BY_FAMILY[NUTRI_FAMILY[food.key]]
      || null;
    if (!row) return null;
    const out = {};
    NUTRI_KEYS.forEach((k,i)=> out[k] = row[i] || 0);
    return out;
  }

  /* Reference daily values, adult, roughly FDA %DV.
     Kept for anything that wants one flat adult column; the Full Stats panel
     uses dailyGoals() below, which varies the figures by age and sex. */
  const DV = { satfat:20, chol:300, sugar:50, fibre:28, sodium:2300,
               potassium:4700, calcium:1300, iron:18, magnesium:420,
               zinc:11, vita:900, vitc:90, vitd:20 };

  /* =========================================================
     DAILY MICRONUTRIENT GOALS

     DISPLAY ONLY. Meal planning â€” portioning, food choice, goal-fit scoring â€”
     runs on calories, macros and fibre alone, exactly as it always has. None
     of the figures below feed computeTargets or the loadout builder. They
     exist so a person can see what they are reaching for.

     Values are the RDA (or AI where no RDA exists) published by the NIH Office
     of Dietary Supplements, which vary by AGE and SEX. They do NOT scale with
     bodyweight â€” a heavier person does not need more vitamin C. Only the
     calorie-linked figures below move with the target.

     Bands are 14-18, 19-30, 31-50, 51-70 and 71+. Pregnancy and lactation
     change several of these substantially and are deliberately not modelled;
     the panel says so rather than quietly showing the wrong number.
  ========================================================= */
  function ageBand(age){
    const a = Number(age);
    if (!a || a < 19) return '14';    // also the fallback when age is unset
    if (a <= 30) return '19';
    if (a <= 50) return '31';
    if (a <= 70) return '51';
    return '71';
  }

  /* [male, female] per age band, in the unit shown in the panel */
  const DRI = {
    iron:      {'14':[11,15],  '19':[8,18],   '31':[8,18],   '51':[8,8],    '71':[8,8]},
    calcium:   {'14':[1300,1300],'19':[1000,1000],'31':[1000,1000],'51':[1000,1200],'71':[1200,1200]},
    magnesium: {'14':[410,360],'19':[400,310],'31':[420,320],'51':[420,320],'71':[420,320]},
    zinc:      {'14':[11,9],   '19':[11,8],   '31':[11,8],   '51':[11,8],   '71':[11,8]},
    vita:      {'14':[900,700],'19':[900,700],'31':[900,700],'51':[900,700],'71':[900,700]},
    vitc:      {'14':[75,65],  '19':[90,75],  '31':[90,75],  '51':[90,75],  '71':[90,75]},
    vitd:      {'14':[15,15],  '19':[15,15],  '31':[15,15],  '51':[15,15],  '71':[20,20]},
    potassium: {'14':[3000,2300],'19':[3400,2600],'31':[3400,2600],'51':[3400,2600],'71':[3400,2600]},
  };

  /* Ceilings rather than targets â€” the point is to stay under them.
     Sodium is the CDRR; cholesterol has no DRI, so the FDA label value stands
     in; saturated fat follows the Dietary Guidelines' "under 10% of calories". */
  const SODIUM_CEILING = 2300;   // mg
  const CHOL_CEILING   = 300;    // mg

  /* Pass the targets for whichever day is on screen (rest vs training); the
     calorie-linked goals follow it. Defaults to the current day. */
  function dailyGoals(tgIn){
    const tg   = tgIn || currentTargets();
    const kcal = tg.kcal;
    const band = ageBand(state.age);
    const i    = (state.sex === 'female') ? 1 : 0;
    const pick = k => DRI[k][band][i];

    const prefs = state.preferences || [];
    const meatFree = prefs.includes('vegetarian') || prefs.includes('vegan');

    return {
      /* Calorie-linked. These are the only figures that move with the target.
         Fibre matches fibreTarget()'s rule exactly, but reads kcal from the
         day being shown rather than always the current one. */
      fibre:     Math.round(Math.max(14 * (kcal / 1000), 21)),
      addedSugar: Math.round(kcal * 0.10 / 4),        // under 10% of calories
      satfat:    Math.round(kcal * 0.10 / 9),         // under 10% of calories

      /* Ceilings */
      sodium: SODIUM_CEILING,
      chol:   CHOL_CEILING,

      /* Age and sex based */
      potassium: pick('potassium'),
      calcium:   pick('calcium'),
      /* The one adjustment with an official multiplier: the DRI for iron is
         1.8x higher on a vegetarian diet, because non-heme iron from plants is
         far less bioavailable than heme iron from meat. Zinc absorption is
         also poorer on a plant-based diet, but no official multiplier is
         published for it, so zinc is left at the RDA and flagged in the note
         instead of being quietly inflated. */
      iron:      meatFree ? Math.round(pick('iron') * 1.8) : pick('iron'),
      ironNote:  meatFree,
      magnesium: pick('magnesium'),
      zinc:      pick('zinc'),
      zincNote:  meatFree,
      vita:      pick('vita'),
      vitc:      pick('vitc'),
      vitd:      pick('vitd'),

      /* So the panel can say whose figures these are */
      band, sex: state.sex || null, meatFree,
    };
  }

  function fullNutrition(){
    const out = {fibre:0, sodium:0};
    NUTRI_KEYS.forEach(k=> out[k] = 0);
    MEALS.forEach(m=>{
      const plan = computeMealPlan(m.key);
      SLOT_DEFS.forEach(d=>{
        state.selections[m.key][d.slot].forEach((k,i)=>{
          const g = plan[d.slot][i];
          if (!k || g == null) return;
          const f = d.list().find(x=>x.key === k);
          if (!f) return;
          const mult = g / 100;
          out.fibre  += fibreOf(f)  * mult;
          out.sodium += sodiumOf(f) * mult;
          const n = nutriOf(f);
          if (n) NUTRI_KEYS.forEach(key => out[key] += n[key] * mult);
        });
      });
    });
    // anything logged by hand contributes its calories and macros only
    return out;
  }

