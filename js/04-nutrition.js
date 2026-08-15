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
     label data — good enough to tell "this day is low on fibre" from "this
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
    if (FIBRE_OVERRIDE[food.key] != null) return FIBRE_OVERRIDE[food.key];
    const fam = nutriFam(food.key);
    return (fam && FIBRE_BY_FAMILY[fam] != null) ? FIBRE_BY_FAMILY[fam] : 1.0;
  }
  function sodiumOf(food){
    if (!food) return 0;
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

     IMPORTANT — these are modelled by food class, not looked up per product.
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
     foods count as the same thing on a plate — two members of a family can
     only appear once per meal — and it drives ingredient substitution and the
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

  function nutriOf(food){
    if (!food) return null;
    const row = NUTRI_OVERRIDE[food.key]
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

     DISPLAY ONLY. Meal planning — portioning, food choice, goal-fit scoring —
     runs on calories, macros and fibre alone, exactly as it always has. None
     of the figures below feed computeTargets or the loadout builder. They
     exist so a person can see what they are reaching for.

     Values are the RDA (or AI where no RDA exists) published by the NIH Office
     of Dietary Supplements, which vary by AGE and SEX. They do NOT scale with
     bodyweight — a heavier person does not need more vitamin C. Only the
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

  /* Ceilings rather than targets — the point is to stay under them.
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

