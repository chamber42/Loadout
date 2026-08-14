'use strict';
/* ============================================================
   LOADOUT - FOOD FAMILIES
   From app.js lines 1702-2151 of the original single file.
   Loaded in order by index.html; all files share one global scope,
   so declarations here are visible to every file listed after it.
   ============================================================ */

  /* =========================================================
     FOOD FAMILIES
     Two different carbs in a meal is fine — rice and a tortilla work.
     Two variants of the SAME thing is not: a 6" corn tortilla next to a
     10" flour one, or sourdough beside Ezekiel. Anything sharing a family
     can only appear once per meal.
  ========================================================= */
  const FAMILY = {
    // wraps and flatbreads
    corntort6:"tortilla", corntort8:"tortilla", whitecorn:"tortilla",
    flourtort6:"tortilla", flourtort8:"tortilla", flourtort10:"tortilla", flourtort12:"tortilla",
    lowcarbtort6:"tortilla", lowcarbtort8:"tortilla", lowcarbtort10:"tortilla",
    wwtort8:"tortilla", protwrap:"tortilla", spinachwrap:"tortilla", lavash:"tortilla",
    carbbalance:"tortilla", srirachatort:"tortilla",
    // sliced breads and rolls
    bread:"bread", sourdough:"bread", ezekiel:"bread", protbread:"bread",
    sandthin:"bread", bagel:"bread", protbagel:"bread",
    engmuffin:"bread", pita:"bread", naan:"bread", pretzel:"bread",
    ryebread:"bread", marblerye:"bread", whitebread:"bread", texastoast:"bread",
    /* A bun is not a slice of bread. Keeping them apart stops a burger
       recipe substituting its way into a pita, and stops the meal builder
       putting a bun and a slice on the same plate. */
    burgerbun:"bun", potatobun:"bun", pretzelbun:"bun", protbun:"bun",
    hawaiian:"bun", hotdogbun:"bun", dinnerroll:"bun", brioche:"bun",
    hoagie:"subroll", kaiser:"subroll", ciabatta:"subroll",
    baguette:"subroll", focaccia:"subroll",
    biscuit:"pastry", englishcrumpet:"pastry",
    // rice
    buckwheat:"grain", freekeh:"grain", bulgur:"grain", farro:"grain", barley:"grain",
    amaranth:"grain", teff:"grain", millet:"grain", quinoa:"grain", couscous:"grain",
    rice:"rice", whiterice:"rice", brownrice:"rice", basmati:"rice",
    sushirice:"rice", arborio:"rice", wildrice:"rice", caulirice:"rice",
    // pasta and noodles
    shellpasta:"pasta", cavatappi:"pasta", promacaroni:"pasta",
    rigatoni:"pasta", fettuccine:"pasta",
    pasta:"pasta", wwpasta:"pasta", propasta:"pasta", lentilpasta:"pasta",
    edamamepasta:"pasta", blackbeanpasta:"pasta", chickpasta:"pasta",
    macaroni:"pasta", orzo:"pasta", eggnoodle:"pasta", tortellini:"pasta",
    ricenoodle:"noodle", soba:"noodle", udon:"noodle", ramen:"noodle",
    shirataki:"noodle", palmini:"noodle", squashzoodle:"noodle",
    // potatoes and roots
    potato:"potato", whitepot:"potato", sweetpotfries:"potato",
    hashbrown:"potato", yuca:"potato", cassava:"potato",
    frenchfries:"potato", crinklefry:"potato", tatertots:"potato",
    onionring:"friedside", hominy:"grain", masa:"grain",
    // hot cereals
    oats:"oats", steelcut:"oats", muesli:"oats", granola:"granola",
    protgranola:"granola", cereal:"cereal", protcereal:"cereal",
    grits:"porridge", polenta:"porridge", creamrice:"porridge",
    // chips and crackers
    tortchips:"chips", pitachips:"chips", crackers:"chips", popcorn:"chips", ricecakes:"chips",
    cornchips:"chips",
    // sweeteners
    honey:"syrup", maple:"syrup",
    // ground meats
    beef93:"groundbeef", beef85:"groundbeef", beef80:"groundbeef",
    grndturk93:"groundpoultry", grndturk85:"groundpoultry", grndchick:"groundpoultry",
    // steaks and roasts
    steak:"beefcut", ribeye:"beefcut", flanksteak:"beefcut", chuckroast:"beefcut", brisket:"beefcut",
    corned:"beefcut", venison:"beefcut", bison:"groundbeef", lamb:"beefcut",
    chicken:"chickencut", chickthigh:"chickencut", chickwing:"chickencut", duck:"poultrycut",
    chickdrum:"chickencut", rotisserie:"chickencut",
    pork:"porkcut", porkchop:"porkcut", porkloinroast:"porkcut",
    bacon:"curedpork", canadian:"curedpork", ham:"curedpork", prosciutto:"curedpork",
    turkbacon:"curedpoultry", turkeydeli:"curedpoultry", turkey:"turkeycut",
    chickdeli:"curedpoultry",
    // deli counter — one cured meat per sandwich is plenty
    capicola:"curedpork", mortadella:"curedpork", bologna:"curedpork",
    soppressata:"curedpork", porchetta:"porkcut",
    roastbeef:"beefcut",
    // fish
    salmon:"salmon", salmoncan:"salmon", smokedsalmon:"salmon",
    tunacan:"tuna", ahi:"tuna",
    tilapia:"whitefish", cod:"whitefish", halibut:"whitefish", mahi:"whitefish",
    seabass:"whitefish", snapper:"whitefish", catfish:"whitefish", trout:"whitefish",
    // eggs
    wholeegg:"egg", eggwhites:"egg", eggliquid:"egg", yolks:"egg",
    // cultured dairy
    milk:"dairyliquid", edamame:"soy",
    yogurt0:"yogurt", yogurt2:"yogurt", yogurt5:"yogurt", skyr:"yogurt", kefir:"yogurt",
    cottage1:"cottage", cottage4:"cottage", queijo:"cottage",
    // cheeses
    /* Two different cheeses on a dish is normal — mozzarella and parmesan.
       Two versions of the SAME cheese is not, so each variety is its own
       family and only the cross-variety mixing is allowed. */
    cheddar:"cheddar", cheddarred:"cheddar", cheddarff:"cheddar", veganched:"cheddar",
    cheddarsharp:"cheddar",
    /* Shredded blends are cheddar-and-jack in a bag — their own family so
       one bag doesn't turn up alongside the block it's made from. */
    mexblend:"shredblend", cheddarjack:"shredblend",
    /* Processed cheese is what makes a queso smooth instead of grainy.
       It is not interchangeable with a real cheddar, so it stands alone. */
    american:"processedcheese", velveeta:"processedcheese",
    muenster:"softcheese", provoslice:"softcheese", swissslice:"swiss",
    jack:"jackcheese", pepperjack:"jackcheese", colby:"jackcheese",
    swisscheese:"swiss", swissred:"swiss", gruyere:"swiss",
    mozzarella:"mozzarella", mozzff:"mozzarella", mozzfresh:"mozzarella", burrata:"mozzarella",
    parmesan:"hardcheese", romano:"hardcheese", asiago:"hardcheese", manchego:"hardcheese",
    bluecheese:"bluecheese", gorgonzola:"bluecheese",
    provolone:"softcheese", gouda:"softcheese", havarti:"softcheese", brie:"softcheese",
    feta:"feta", goatcheese:"goatcheese", halloumi:"grillcheese", paneer:"grillcheese",
    queso:"freshcheese", ricotta:"freshcheese", stringcheese:"stringcheese",
    laughingcow:"spreadcheese",
    // powders
    whey:"powder", casein:"powder", plantpro:"powder", protshake:"powder",
    // beans
    blackbeans:"beans", pintobeans:"beans", kidneybeans:"beans", whitebeans:"beans",
    navybeans:"beans", favabeans:"beans", blackeyed:"beans", chickpeas:"beans",
    greatnorth:"beans", chilibeans:"beans", refried:"beans",
    pintocan:"beans", kidneycan:"beans", blackbeancan:"beans",
    lentils:"lentils", splitpeas:"lentils",
    // soy
    tofu:"soy", tempeh:"soy", seitan:"soy", tvp:"soy", soycurls:"soy", natto:"soy",
    // fats
    oil:"oil", avocadooil:"oil", sesameoil:"oil", coconut:"oil", duckfat:"oil",
    butter:"butter", ghee:"butter",
    pb:"nutbutter", almondbutter:"nutbutter", sunbutter:"nutbutter",
    tahini:"nutbutter", nutella:"nutbutter", pbpowder:"nutbutter",
    almonds:"nuts", walnuts:"nuts", cashews:"nuts", pistachios:"nuts", pecans:"nuts",
    hazelnuts:"nuts", macadamia:"nuts", peanuts:"nuts", brazilnuts:"nuts", pinenuts:"nuts",
    pumpkinseeds:"seeds", sunflowerseeds:"seeds", hemphearts:"seeds",
    chia:"seeds", flaxseed:"seeds", sesameseeds:"seeds", pepitas:"seeds",
    mayo:"mayo", mayolight:"mayo",
    sourcream:"cream", heavycream:"cream", halfhalf:"cream", creamcheese:"cream",
    creamcheeselight:"cream", coconutmilk:"cream",
    avocado:"avocado", hassavo:"avocado", guac:"avocado",
    // fruit varieties
    honeycrisp:"apple", gala:"apple", fuji:"apple", grannysmith:"apple",
    pinklady:"apple", greenapple:"apple", applesauce:"apple",
    navel:"orange", valencia:"orange", cara:"orange", blood:"orange",
    mandarin:"citrus", clementine:"citrus", tangerine:"citrus",
    grapefruit:"citrus", lemon:"citrus", lime:"citrus",
    bartlett:"pear", bosc:"pear",
    bananamed:"banana", bananalg:"banana", banana:"banana",
    grapes:"grape",
    berries:"berry", strawberry:"berry", raspberry:"berry", blackberry:"berry",
    blueberrfroz:"berry", cranberry:"berry",
    cantaloupe:"melon", honeydew:"melon", watermelon:"melon",
    dates:"driedfruit", raisins:"driedfruit", prunes:"driedfruit",
    apricotdry:"driedfruit", mangodry:"driedfruit",
    // veg
    spinach:"leafygreen", babyspinach:"leafygreen", kale:"leafygreen",
    greens:"leafygreen", arugula:"leafygreen", romaine:"lettuce",
    butterlettuce:"lettuce", iceberg:"lettuce", endive:"lettuce", watercress:"leafygreen",
    chard:"leafygreen", collards:"leafygreen",
    cabbage:"cabbage", redcabbage:"cabbage", napa:"cabbage", bokchoy:"cabbage",
    broccoli:"brassica", broccolini:"brassica", cauliflower:"brassica",
    brussels:"brassica", broccolislaw:"brassica", kohlrabi:"brassica",
    zucchini:"squash", squash:"squash", butternut:"squash", acornsq:"squash",
    spaghettisq:"squash", delicata:"squash", kabocha:"squash", chayote:"squash",
    peppers:"pepper", roastedpeppers:"pepper", poblano:"pepper", shishito:"pepper",
    jalapeno:"chilli", serrano:"chilli", habanero:"chilli",
    tomatoes:"tomato", sundried:"tomato", tomatoslice:"tomato",
    firetom:"tomato", dicedtom:"tomato", tompaste:"tomato",
    chipotleadobo:"chilli", greenchilecan:"chilli",
    /* Pickled things share a role — a sandwich wants pickles or
       giardiniera, not a plate of both. */
    pickles:"pickle", dillspears:"pickle", giardiniera:"pickle",
    shreddedlettuce:"lettuce", pickledonion:"onion", grillonion:"onion",
    mushrooms:"mushroom", shiitake:"mushroom", portobello:"mushroom",
    onion:"onion", pearlonion:"onion", scallion:"onion", leek:"onion", shallot:"onion",
    peas:"peas", snappeas:"peas", snowpeas:"peas", edamamepod:"peas",
    carrots:"root", parsnip:"root", turnip:"root", rutabaga:"root",
    beets:"root", daikon:"root", radish:"root", jicama:"root",
    /* Sauce families exist mainly so a recipe that calls for one cheese
       sauce will accept another. Only one sauce is ever plated. */
    cheesesauce:"cheesesauce", nachocheese:"cheesesauce", quesoblanco:"cheesesauce",
    greenchilequeso:"cheesesauce", beercheese:"cheesesauce", mornay:"cheesesauce",
    whitecheddarsc:"cheesesauce", protqueso:"cheesesauce", protcheddarsc:"cheesesauce",
    pimentochz:"cheesesauce",
    russian:"burgersauce", burgersauce:"burgersauce", thousand:"burgersauce",
    chipotlemayo:"mayosauce", pestomayo:"mayosauce", aioli:"mayosauce",
    boomboom:"mayosauce", remoulade:"mayosauce", tartar:"mayosauce",
    dijon:"mustardsauce", mustard:"mustardsauce", honeymust:"mustardsauce",
    aujus:"gravysauce", gravy:"gravysauce", gravywhite:"gravysauce",
    chilisauce:"tomatocondiment", ketchup:"tomatocondiment",
    subdressing:"vinaigrette", balsamic:"vinaigrette", vinlight:"vinaigrette",
    greekdress:"vinaigrette", horseradishcr:"creamcondiment",
    jerky:"jerky", chicksaus:"sausage", pineapple:"tropical", fishsauce:"asiansauce",
    olives:"olives", peach:"peach", chipotle:"chillisauce", applesaucecond:"sweetsauce",
    garlicpwd:"driedaromatic",
    onionpwd:"driedaromatic",
    paprika:"chillispice",
    chilipwd:"chillispice",
    cayenne:"chillispice",
    blackpepper:"pepperspice",
    seasalt:"salt",
    italianherb:"herbblend",
    oregano:"herbblend",
    rosemary:"herbblend",
    thyme:"herbblend",
    basil:"freshherb",
    cilantro:"freshherb",
    parsley:"freshherb",
    dill:"freshherb",
    cinnamon:"sweetspice",
    nutmeg:"sweetspice",
    vanilla:"sweetspice",
    cocoapwd:"sweetspice",
    turmeric:"currysspice",
    currypwd:"currysspice",
    garammasala:"currysspice",
    cajunspice:"rubblend",
    jerkspice:"rubblend",
    tacoseason:"rubblend",
    everything:"rubblend",
    lemonpepper:"rubblend",
    ranchdry:"rubblend",
    gingerfresh:"freshherb",
    lemonjuice:"acid",
    limejuice:"acid",
    vinegarbal:"acid",
    ricevinegar:"acid",
    kimchi:"ferment", sauerkraut:"ferment",
    chickbreastskin:"chickencut",
    grndturk99:"groundpoultry",
    chickliver:"organ",
    turkeyjerky:"jerky",
    eyeround:"beefcut",
    tritip:"beefcut",
    nystrip:"beefcut",
    beefliver:"organ",
    elk:"beefcut",
    rabbit:"beefcut",
    bratwurst:"sausage",
    kielbasa:"sausage",
    andouille:"sausage",
    porkrind:"curedpork",
    branzino:"whitefish",
    grouper:"whitefish",
    haddock:"whitefish",
    sole:"whitefish",
    tunasteak:"tuna",
    sardinesoil:"oilyfish",
    caviar:"roe",
    squid:"shellfish2",
    snowcrab:"shellfish2",
    eggbeater:"egg",
    quarkcheese:"cottage",
    labneh:"yogurt",
    halloumigrill:"grillcheese",
    cheesestick:"stringcheese",
    eggwhitewrap:"tortilla",
    beefstick:"jerky",
    tunapouch:"tuna",
    calrose:"rice",
    parboiled:"rice",
    riceblend:"rice",
    linguine:"pasta",
    penne:"pasta",
    ravioli:"pasta",
    dumpling:"dumpling",
    gnocchicau:"potato",
    chapati:"tortilla",
    arepas:"bread",
    injera:"bread",
    cornbread:"bread",
    proteinchips:"chips",
    lentilchips:"chips",
    proteinoats:"oats",
    kodiakmix:"pastry",
    cassavaflour:"tortilla",
    macadamiabutter:"nutbutter",
    pecanbutter:"nutbutter",
    pumpkinbutter:"nutbutter",
    flaxoil:"oil",
    grapeseed:"oil",
    trufflepaste:"pestofat",
    cottagedip:"cream",
    kalamata:"olives",
    asparagusthin:"brassica",
    greenchile:"chilli",
    babybella:"mushroom",
    sugarsnap:"peas",
    greenbeansfr:"peas",
    babycarrot:"root",
    cauliflorets:"brassica",
    broccoflorets:"brassica",
    pepperonc:"chilli",
    greenolive:"olives",
    cotton:"grape",
    muskmelon:"melon",
    whitepeach:"peach",
    appleslices:"apple",
    berrymix:"berry",
    chickthighskin:"chickencut",
    chicktender:"chickencut",
    cornishhen:"poultrycut",
    turkeythigh:"turkeycut",
    duckleg:"poultrycut",
    quail:"poultrycut",
    beef96:"groundbeef",
    skirtsteak:"beefcut",
    flatiron:"beefcut",
    filet:"beefcut",
    shortrib:"beefcut",
    oxtail:"beefcut",
    lambshank:"beefcut",
    goat:"beefcut",
    porkbelly:"porkcut",
    porkshould:"porkcut",
    italsaus:"sausage",
    chorizo:"sausage",
    pepperoni:"curedpork",
    salami:"curedpork",
    hotdog:"sausage",
    chickdog:"sausage",
    arcticchar:"salmon",
    barramundi:"whitefish",
    swordfish:"whitefish",
    herring:"oilyfish",
    mackerel:"oilyfish",
    pollock:"whitefish",
    octopus:"shellfish2",
    crawfish:"shellfish2",
    imitcrab:"shellfish2",
    eggwhole6:"egg",
    jasminebrown:"rice",
    blackrice:"rice",
    redrice:"rice",
    glassnoodle:"noodle",
    pho:"noodle",
    lasagna:"pasta",
    couscousprl:"grain",
    sorghum:"grain",
    fonio:"grain",
    croissant:"pastry",
    waffle:"pastry",
    protwaffle:"pastry",
    pancakemix:"pastry",
    protpancake:"pastry",
    proteinbar:"bar",
    oatbran:"oats",
    cofw:"porridge",
    pistachiobutter:"nutbutter",
    cashewbutter:"nutbutter",
    pbfit:"nutbutter",
    walnutoil:"oil",
    peanutoil:"oil",
    canola:"oil",
    chilioil:"oil",
    creme:"cream",
    mascarpone:"cream",
    skyrfat:"cream",
    pesto2:"pestofat",
    blackolive:"olives",
    mustardgreens:"leafygreen",
    beetgreens:"leafygreen",
    frisee:"lettuce",
    radicchio:"lettuce",
    celeriac:"root",
    sunchoke:"root",
    lotusroot:"root",
    taro:"root",
    greenpapaya:"squash",
    bittermelon:"squash",
    enoki:"mushroom",
    oystermush:"mushroom",
    cremini:"mushroom",
    aspgreens:"brassica",
    cherrytom:"tomato",
    greentom:"tomato",
    asianpear:"pear",
    envy:"apple",
    mangosteen:"tropical",
    rambutan:"tropical",
    currants:"berry",
    gooseberry:"berry",
    acai:"berry",
    pomelo:"citrus",
    plantainrp:"banana",
    // ---- ADDED foods ----
    porkribs:"porkcut", lambchop:"beefcut", grndlamb:"groundbeef", breakfastsaus:"sausage", pastrami:"beefcut",
    bisonsteak:"beefcut", sablefish:"oilyfish", salmonatl:"salmon", troutsmoked:"oilyfish", whitefishsm:"whitefish",
    unagi:"oilyfish", ricottawhole:"softcheese", cottage2:"cottage", yogurtwhole:"yogurt", milkwhole:"dairyliquid",
    chocmilk:"dairyliquid", soymilk:"dairyliquid", cheesecurds:"cheddar", fontina:"swiss", mycoprotein:"soy",
    veganground:"soy", tofusilken:"soy", hempprot:"powder", gainer:"powder",
    /* hoagie, burgerbun, hotdogbun, dinnerroll, focaccia and texastoast are
       deliberately NOT filed as "bread" — see the bun/subroll families
       above. They were here, and being an object literal, these later
       entries were quietly winning. */
    stuffingmix:"bread", pierogi:"dumpling", wontonwrap:"dumpling",
    mashedflake:"potato", instantoat:"oats", graham:"chips",
    granolabar:"granola", condensed:"cream", agave:"syrup", mochi:"rice", riceballs:"rice",
    bagelchips:"chips", coconutcream:"cream", tallow:"oil", lard:"oil", mctoil:"oil",
    milkchoc:"bar", whitechoc:"bar", almondflour:"nuts", crema:"cream", walnutbutter:"nutbutter",
    tapenade:"olives", chocpb:"nutbutter", sourcreamlt:"cream", marcona:"nuts", evapmilk:"cream",
    cashewcream:"nutbutter", seedmix:"seeds", redonion:"onion", roastedgarlic:"onion", tomatillo:"tomato",
    broccolirabe:"brassica", savoy:"cabbage", coleslawmix:"cabbage", microgreens:"leafygreen", mixveg:"peas",
    stirfryveg:"brassica", peasfroz:"peas", nopales:"leafygreen", mangofroz:"tropical", pineapplecan:"tropical",
    strawbfroz:"berry", mixberryfroz:"berry", cherryfroz:"berry", peachcan:"peach", mandarincan:"orange",
    oj:"orange", figsdried:"driedfruit", bananachips:"driedfruit",
  };

  /* Some families genuinely mix on a plate — a handful of greens, two
     cheeses on a pasta, whole eggs alongside whites, nuts in a trail mix.
     Only the families where a second variant would look like a mistake
     are enforced. */
  const MIXABLE = new Set([
    "leafygreen","lettuce","brassica","pepper","chilli","mushroom","onion",
    "peas","root","ferment","cabbage","squash","tomato","berry","citrus",
    "nuts","seeds","egg","beans","herbs","driedaromatic","chillispice","pepperspice",
    "salt","herbblend","freshherb","sweetspice","currysspice","rubblend","acid",
    /* Vegetables that turn up as fixings rather than as the vegetable —
       a sandwich can have pickles AND tomato AND onion without any of them
       being "the veg". */
    "pickle",
  ]);

  /* A layer above families. Nobody serves a tortilla next to a pita, or
     rice alongside pasta — they occupy the same role on the plate even
     though they're different families. One member of a group per meal. */
  const GROUP = {
    tortilla:"bready", bread:"bready", pastry:"bready", bun:"bready", subroll:"bready",
    friedside:"staple",
    rice:"staple", pasta:"staple", noodle:"staple", grain:"staple", potato:"staple", dumpling:"staple",
    oats:"breakfastcarb", porridge:"breakfastcarb", cereal:"breakfastcarb", granola:"breakfastcarb",
    groundbeef:"redmeat", beefcut:"redmeat", porkcut:"redmeat", curedpork:"redmeat",
    chickencut:"poultry", groundpoultry:"poultry", turkeycut:"poultry",
    curedpoultry:"poultry", poultrycut:"poultry",
    processedcheese:"meltcheese", shredblend:"meltcheese",
    salmon:"seafood", tuna:"seafood", whitefish:"seafood", oilyfish:"seafood", shellfish2:"seafood",
    roe:"seafood",
    nutbutter:"spread", butter:"spread",
  };
  function groupOf(food){
    const fam = FAMILY[food && food.key];
    return fam ? (GROUP[fam] || null) : null;
  }

  function familyOf(food){ return food && (FAMILY[food.key] || null); }
  function strictFamilyOf(food){
    const fam = familyOf(food);
    return (fam && !MIXABLE.has(fam)) ? fam : null;
  }

  /* Would adding this food duplicate a family already on the plate? */
  function familyClash(food, sel){
    const fam = strictFamilyOf(food);
    const grp = groupOf(food);
    if (!fam && !grp) return false;
    return SLOT_DEFS.some(d => (sel[d.slot] || []).some(k=>{
      if (!k || k === food.key) return false;
      const other = listFor(d.slot).find(f=>f.key === k);
      if (!other) return false;
      if (fam && strictFamilyOf(other) === fam) return true;
      return !!grp && groupOf(other) === grp;
    }));
  }

