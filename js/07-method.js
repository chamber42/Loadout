'use strict';
/* ============================================================
   LOADOUT - METHOD
   From app.js lines 3804-4682 of the original single file.
   Loaded in order by index.html; all files share one global scope,
   so declarations here are visible to every file listed after it.
   ============================================================ */

  /* =========================================================
     METHOD
     How to actually cook each of the older recipes. Kept in a map rather
     than inlined so the recipe list stays readable and so the method can be
     edited on its own. Recipes added later carry `steps` on themselves.
  ========================================================= */
  const RECIPE_STEPS = {
    "Antipasto Plate": [
      "Take everything out of the fridge 20–30 minutes before eating.",
      "Fold the cured meat loosely rather than laying it flat.",
      "Group by type in clusters, with the wet items — olives, peppers — in small dishes.",
      "Add bread or crackers last so they stay crisp.",
      "Oil, pepper and a little vinegar over the vegetables only."
    ],
    "Apple Nachos": [
      "Slice the apple thin and toss in lemon juice so it doesn't brown.",
      "Fan the slices out overlapping on a plate.",
      "Warm the nut butter 15 seconds in the microwave so it drizzles instead of clumping.",
      "Drizzle over, then scatter the crunchy toppings.",
      "Eat immediately; the apple weeps once it is topped."
    ],
    "Avocado Toast & Eggs": [
      "Toast the bread hard; soft toast collapses under avocado.",
      "Mash the avocado with lemon, salt and chili in a bowl, not on the bread.",
      "Spread thick, all the way to the edges.",
      "Cook the eggs to your liking and slide them on top.",
      "Flaky salt, pepper, and something acidic to finish."
    ],
    "Baked Ziti": [
      "Cook the pasta 2 minutes under — it finishes cooking in the oven.",
      "Brown the protein, then add the sauce and simmer 10 minutes.",
      "Mix the pasta with the sauce and half the cheese in the baking dish.",
      "Top with the rest of the cheese and bake at 200C/400F for 20–25 minutes.",
      "Rest 10 minutes before serving or it will slump on the plate."
    ],
    "Banana Nut Butter Toast": [
      "Toast the bread until it is properly firm — nut butter and banana are heavy and soft toast folds.",
      "Warm the nut butter for 10 seconds if it is fridge-cold, then spread it right to the crusts.",
      "Slice the banana on a diagonal so the pieces are wide enough to sit flat.",
      "Lay the fruit on in a single overlapping layer, not a heap.",
      "Cinnamon over the top. If you are adding yogurt or protein, stir it smooth and spread it under the nut butter."
    ],
    "Banh Mi": [
      "Pickle the carrot and daikon in vinegar, sugar and salt at least an hour ahead.",
      "Marinate and grill the protein until it has real char on the edges.",
      "Hollow out some of the bread inside the roll so the filling fits.",
      "Spread the mayo or pate on both cut faces.",
      "Layer protein, pickles, cucumber, coriander and chili. Press the roll shut hard."
    ],
    "Beef & Barley Soup": [
      "Cut the beef into 2cm cubes and dry the surfaces on paper towel — wet meat steams instead of browning.",
      "Brown the beef hard in batches. Crowding the pan is the single most common way this soup ends up bland.",
      "Soften onion, carrot and celery in the fat left behind, scraping the brown bits up as they release.",
      "Return the beef, cover with stock and simmer covered for 1 hour 15 before the barley goes anywhere near it.",
      "Add the barley and cook another 40–45 minutes until both the grain and the beef give way easily.",
      "Rest off the heat 10 minutes. Barley keeps drinking liquid overnight, so loosen with stock when you reheat."
    ],
    "Beef & Broccoli": [
      "Slice the beef thin against the grain and toss it in cornflour and soy.",
      "Blanch the broccoli 90 seconds, then drop it in cold water to keep it green.",
      "Sear the beef in a very hot pan in one layer, 60 seconds, then remove.",
      "Cook the aromatics, add the sauce, let it bubble and thicken.",
      "Return everything, toss to coat, serve immediately over rice."
    ],
    "Beef Bulgogi": [
      "Freeze the steak 30 minutes, then slice against the grain as thin as you can manage. This is most of the dish.",
      "Blitz or grate the pear into the marinade — the enzyme in it is what makes bulgogi tender, sugar alone will not.",
      "Marinate 30 minutes minimum, 4 hours is better. Longer than overnight and the texture goes mealy.",
      "Get the pan properly hot and cook in thin single layers. Piled-in beef boils in its own marinade.",
      "Let each batch catch and caramelise before you turn it; those charred edges are the point.",
      "Onion and mushroom go in at the end so they keep some bite. Sesame oil and seeds off the heat."
    ],
    "Beef Chili": [
      "Brown the meat in batches in a dry hot pot. Crowding it steams it gray.",
      "Cook the onion and peppers in the fat left behind.",
      "Toast the chili powder and cumin in the pan for a minute before liquid.",
      "Add tomatoes and stock, simmer at least 45 minutes uncovered, low.",
      "Beans go in for the last 15 minutes only.",
      "Season at the very end, when the liquid has finished reducing."
    ],
    "Beef Stick & Cheese": [
      "Nothing here is cooked, so the work is portioning — weigh it out before you eat, not after.",
      "Slice the beef stick on an angle into coins rather than eating it whole; it goes much further.",
      "Cube the cheese rather than slicing, so it sits alongside the crackers instead of on them.",
      "Add something acidic — pickles, mustard — or the whole plate reads as salt and fat.",
      "Build it in a lidded container the night before if it is going in a bag."
    ],
    "Bibimbap": [
      "Prepare each vegetable separately — that separation is the dish.",
      "Blanch or quickly saute each one, seasoning with sesame oil, garlic and salt as you go.",
      "Cook the protein with a spoon of the gochujang.",
      "Arrange the vegetables in wedges over the hot rice, protein in the middle.",
      "Top with a fried egg. Add the rest of the gochujang and mix at the table."
    ],
    "Black Bean Bowl": [
      "Cook the onion, garlic and cumin, then add the beans with some of their liquid.",
      "Simmer 10 minutes and mash a quarter of them to thicken the rest.",
      "Cook the rice with lime and coriander.",
      "Char the corn and peppers in a dry pan until spotted.",
      "Build, then add the cold toppings and hot sauce."
    ],
    "Blackened Fish Bowl": [
      "Pat the fillets bone dry and coat both sides thickly in cajun seasoning. Thin coating means no crust.",
      "Get a cast iron pan to the point where it is just starting to smoke. Blackening needs real heat.",
      "Lay the fish down and do not touch it for 3 minutes. Turn once, 2 more minutes, then out.",
      "Cook the rice with a pinch of salt and finish with lime juice and zest while it is still hot.",
      "Dress the cabbage separately with lime and a little salt; it should be crunchy, not wilted.",
      "Build the bowl with rice underneath, slaw and corn beside, fish on last so the crust stays dry."
    ],
    "Breakfast Burrito": [
      "Cook and cool the fillings slightly; hot fillings steam the tortilla soft.",
      "Warm the tortilla so it folds without splitting.",
      "Keep the filling in a line in the lower third, leaving a clear border.",
      "Fold the sides in first, then roll up tight from the bottom.",
      "Sear the seam side down in a dry pan for a minute to seal it shut."
    ],
    "Breakfast Hash": [
      "Dice the potato small — 1cm — or it will not cook through before it burns.",
      "Fry in the oil, cut side down, without stirring for 5 minutes so it crusts.",
      "Add the onion and peppers, cook another 6–8 minutes until the potato is tender.",
      "Push to one side, cook the eggs or breakfast meat in the same pan.",
      "Season hard, add hot sauce, and serve out of the pan."
    ],
    "Breakfast Quesadilla": [
      "Scramble the eggs slightly wetter than you want them — they finish cooking inside the quesadilla.",
      "Cook the veg first and drain it. Wet filling is the reason quesadillas go soggy in the middle.",
      "Cheese goes down on the tortilla first and last, with the egg between; it glues the whole thing shut.",
      "Dry pan, medium heat, 2–3 minutes a side. Butter or oil in the pan makes it greasy rather than crisp.",
      "Press down with a spatula while the second side cooks so the cheese fully melts.",
      "Rest 2 minutes before cutting or the filling slides out."
    ],
    "Breakfast Sandwich": [
      "Toast the muffin or bun and butter it while hot.",
      "Fry the egg in a ring or a small pan so it stays sandwich-shaped.",
      "Lay the cheese on the egg in the last 30 seconds so it melts on the residual heat.",
      "Crisp the bacon or sausage in the same pan.",
      "Stack, add sauce, wrap in foil for a minute — the steam softens it together."
    ],
    "Buddha Bowl": [
      "Roast the veg at 200C/400F for 25–30 minutes, tossed in oil, until edges char.",
      "Cook the grain while the veg roasts.",
      "Cook or warm the protein and season it separately from the veg.",
      "Assemble in sections rather than mixed — grain, veg, protein, each in its own quarter.",
      "Spoon the sauce over the middle and finish with seeds."
    ],
    "Buffalo Chicken Wrap": [
      "Cook and shred the chicken, then toss it in the buffalo sauce while it is hot.",
      "Warm the tortilla so it rolls without cracking.",
      "Spread the ranch on the tortilla, not on the chicken.",
      "Keep the lettuce between the sauce and the wrap — it acts as a barrier.",
      "Roll tight, then griddle the seam down for 30 seconds."
    ],
    "Burrito Bowl": [
      "Cook the rice and stir lime juice and coriander through it while hot.",
      "Cook the protein hot and fast with the taco seasoning until the edges catch.",
      "Warm the beans with a little of their own liquid, don't drain them dry.",
      "Layer rice, beans, protein, then the cold toppings so they stay cold.",
      "Salsa and avocado last, right before eating."
    ],
    "Butter Chicken": [
      "Marinate the chicken in yogurt, garam masala and garlic for at least 30 minutes.",
      "Sear it hard in batches until it is colored, then set it aside.",
      "Cook the onion, ginger and garlic down, then the spices for a full minute.",
      "Add the tomato and simmer 15 minutes until it darkens and thickens.",
      "Blend smooth if you want it restaurant-style, then return the chicken with the cream.",
      "Simmer 10 minutes more. Finish with a knob of butter off the heat."
    ],
    "Cajun Pasta": [
      "Season the protein heavily with the Cajun blend and sear it first; set aside.",
      "Cook the peppers and onion in the same pan, scraping up the browned bits.",
      "Add the cream or sauce base and simmer until it thickens slightly.",
      "Fold in the drained pasta with a splash of pasta water, then the protein.",
      "Taste for salt at the end — Cajun blends vary wildly in how salty they are."
    ],
    "Caprese Plate": [
      "Take the mozzarella out of the fridge 20 minutes ahead. Cold kills the flavor.",
      "Slice tomato and cheese the same thickness and shingle them alternately.",
      "Salt the tomato only, not the cheese.",
      "Tear the basil rather than cutting it — a knife bruises it black.",
      "Oil and balsamic just before serving."
    ],
    "Carnitas Tacos": [
      "Cut the pork shoulder into large chunks and salt it heavily — an hour ahead if you have it.",
      "Braise covered with citrus, onion and cumin at 160C/325F for about 3 hours, until it shreds with no effort.",
      "Shred the meat, then spread it on a tray and grill or broil for 5 minutes. Crisped edges are what separates carnitas from pulled pork.",
      "Spoon a little of the cooking liquid back over the crisped meat so it does not dry out.",
      "Char the tortillas over a flame or in a dry pan and stack them under a towel to steam soft.",
      "Onion, cilantro, lime. Salsa verde on the side, not on the meat."
    ],
    "Charcuterie Snack": [
      "Take the cheese out 20 minutes ahead; cold cheese has almost no flavour.",
      "Cut the cheese into pieces you can pick up without a knife.",
      "Fold the meat rather than laying it flat.",
      "Add something acidic — pickles, olives, mustard — to cut the fat.",
      "Crackers last so they stay crisp."
    ],
    "Chia Pudding": [
      "Stir the chia into the yogurt or milk and whisk hard for 20 seconds.",
      "Wait 5 minutes and whisk again — this second stir is what stops the clumping.",
      "Add sweetener and vanilla or cocoa now, while it's still loose.",
      "Chill at least 4 hours, ideally overnight, until it is spoonable.",
      "Top with the fruit and nuts just before eating so they stay crisp."
    ],
    "Chicken & Rice Bowl": [
      "Cook the rice first and leave it covered to steam while everything else happens.",
      "Dry the chicken, season it, and sear it in a hot pan without moving it for 4 minutes.",
      "Finish cooking through, then rest it 5 minutes before slicing.",
      "Cook the veg in the same pan with a splash of water to steam it.",
      "Slice the chicken, build the bowl, sauce over the top."
    ],
    "Chicken Alfredo Bake": [
      "Cook the pasta 2 minutes shy of the box time — it finishes in the oven and mushy pasta cannot be rescued.",
      "Save a mug of pasta water before draining; the starch in it keeps the sauce from splitting.",
      "Sear the chicken in pieces and season it on its own. Chicken cooked in the sauce tastes of nothing.",
      "Build the sauce off the boil. Once cream or a yogurt alfredo hits a hard simmer it separates.",
      "Fold pasta, chicken, veg and sauce together loosely, then top with cheese.",
      "Bake 20 minutes at 200C/400F, then 3 minutes under the grill for the top. Rest 10 minutes before serving."
    ],
    "Chicken Burrito Bowl": [
      "Toss the protein in taco seasoning and a little oil, then sear it hard in a hot pan.",
      "Cook the rice and finish it with lime juice and coriander off the heat.",
      "Char the peppers and onion until spotted, not soft.",
      "Warm the beans separately.",
      "Layer rice, beans, protein, char, then cold toppings and salsa last."
    ],
    "Chicken Caesar Salad": [
      "Cook the chicken and rest it while you build the salad.",
      "Dry the leaves thoroughly and tear rather than chop them.",
      "Dress the leaves in a big bowl with your hands, adding dressing in stages.",
      "Slice the warm chicken over the top.",
      "Parmesan in shavings, croutons last."
    ],
    "Chicken Fajitas": [
      "Slice the protein and peppers to the same thickness so they cook at the same rate.",
      "Marinate the protein in lime, cumin and chili for 20 minutes.",
      "Cook in a screaming hot pan in batches — crowding gives you steamed gray strips.",
      "You are after char, not tenderness. Leave things alone to catch color.",
      "Warm the tortillas and serve everything in the pan it cooked in."
    ],
    "Chicken Parmesan": [
      "Flatten the chicken to an even thickness so it cooks through before the crust burns.",
      "Set up three trays: seasoned flour, egg, then breadcrumbs mixed with parmesan.",
      "Bake or air-fry at 200C/400F for 15 minutes until the crust is set and gold.",
      "Spoon sauce over the middle only — sauce on the edges makes them soggy.",
      "Add mozzarella and return for 5 minutes until it blisters."
    ],
    "Chicken Pot Pie Bowl": [
      "Dice everything to a similar size so it cooks evenly — this is a stew, not a roast.",
      "Sweat onion, carrot and celery in the butter until soft but not colored, about 8 minutes.",
      "Sprinkle flour or your thickener over the vegetables and cook it out for a full minute before liquid goes in.",
      "Add stock a splash at a time, stirring, then the cream. Lumps form when the liquid goes in all at once.",
      "Fold the cooked chicken and peas in at the end so they stay tender.",
      "Bake or toast the biscuit separately and set it on top at the table, or it goes to paste."
    ],
    "Chicken Salad Sandwich": [
      "Shred or chop the cooked protein rather than cubing it — it holds dressing better.",
      "Mix the dressing separately first, then fold it through.",
      "Add the crunch — celery, onion, grapes — at the end so it stays crunchy.",
      "Chill 20 minutes if you have time; it firms up and tastes seasoned.",
      "Toast the bread and put the leaves against the bread to keep it dry."
    ],
    "Chicken Shawarma Bowl": [
      "Marinate the protein in yogurt, lemon, garlic, cumin and paprika, 2 hours or overnight.",
      "Roast at 220C/425F or griddle hard until the edges are properly dark.",
      "Chop the salad small and dress it with lemon and salt.",
      "Warm the grain or flatbread.",
      "Build, then sauce heavily — this dish is meant to be wet."
    ],
    "Chicken Stir-Fry": [
      "Cut everything before the pan goes on. A stir-fry gives you no time to chop mid-cook.",
      "Mix the sauce in a cup beforehand for the same reason.",
      "Get the pan properly hot, cook the protein in one layer, remove it.",
      "Cook the veg 2–3 minutes, hardest first, keeping everything moving.",
      "Return the protein, add the sauce, toss 30 seconds until it glazes. Serve immediately."
    ],
    "Chicken Tikka Masala": [
      "Marinate the chicken in yogurt, garam masala and turmeric for at least 2 hours. This is the tikka half and it is not optional.",
      "Cook the chicken hot and fast — grill, broil or a screaming pan — until the edges char. Then set it aside.",
      "Fry the onion down properly, 10 minutes, then the ginger and garlic for one more.",
      "Add tomato and the rest of the spice and cook until the oil separates out at the edges. That is the signal the base is done.",
      "Cream or coconut milk goes in off the boil, then the chicken back in for 5 minutes only.",
      "Rest 10 minutes before serving. Rice or naan, not both."
    ],
    "Chili Mac": [
      "Brown the mince in a dry pan and break it up small. Drain the fat if you are watching the number.",
      "Onion and pepper into the same pan, then the chili powder and cumin — toast the spice in the fat for 30 seconds.",
      "Add tomato and stock, bring to a simmer, then stir the dry pasta straight in.",
      "Cook uncovered, stirring often, until the pasta is done and the liquid has thickened around it, 10–12 minutes.",
      "It will look too loose one minute before it is right. Take it off there; it sets as it sits.",
      "Cheese and hot sauce at the table."
    ],
    "Chipotle Grain Bowl": [
      "Cook the grain in stock, then fork through lime and coriander.",
      "Rub the protein with the chipotle and roast or sear it hard.",
      "Char the peppers, onion and corn in a dry hot pan until spotted black.",
      "Build grain, veg, protein.",
      "Thin the chipotle sauce with a spoon of water and drizzle over."
    ],
    "Chocolate Protein Pudding": [
      "Whisk the cocoa into the dry protein powder first. Cocoa dumped into liquid clumps and never recovers.",
      "Add the yogurt and beat hard for a full minute before you add any liquid at all.",
      "Thin with milk a tablespoon at a time until it just holds a spoon mark.",
      "Chill 30 minutes minimum — it thickens considerably and the flavor rounds out.",
      "Toppings go on at eating, not before, or the crunchy things soften."
    ],
    "Cobb Salad": [
      "Cook and cool the egg and bacon first; warm items wilt the leaves.",
      "Dry the leaves properly — dressing slides straight off wet lettuce.",
      "Lay the toppings in stripes across the leaves rather than tossing.",
      "Crumble the cheese over the top.",
      "Dress at the table so the stripes survive to the plate."
    ],
    "Cottage Cheese & Crackers": [
      "Drain any pooled liquid off the cottage cheese and give it a quick stir before it goes in the bowl.",
      "Pepper and everything seasoning go on the cheese, not the crackers.",
      "Keep the crackers in a separate pot if this is travelling; they soften within an hour of contact.",
      "Cut the tomatoes and cucumber into pieces that sit on a cracker without falling off.",
      "A drop of hot sauce or a little olive brine lifts the whole thing."
    ],
    "Cottage Cheese & Fruit": [
      "Spoon the cottage cheese into a bowl and season with a pinch of salt — it wakes it up.",
      "Add the fruit in wedges over the top.",
      "Add nuts or seeds for texture.",
      "Sweet direction: honey and cinnamon. Savory direction: pepper, oil and tomato."
    ],
    "Cottage Cheese Ice Cream": [
      "Blend the cottage cheese completely smooth — 2 full minutes, scraping down twice.",
      "Any remaining curd texture stays in the final result, so keep going.",
      "Blend in sweetener and flavor, then fold in any chunky mix-ins by hand.",
      "Freeze 3–4 hours, stirring once at the halfway point.",
      "Rest 10 minutes at room temperature before scooping."
    ],
    "Cottage Cheese Toast": [
      "Toast the bread until it is firm enough to hold a wet topping without going soggy.",
      "Spread the cottage cheese thick, right to the edges.",
      "Season the top: cracked pepper, chili flakes or everything blend.",
      "Add the fruit or veg, then the fat — seeds, avocado or a thread of oil.",
      "Eat straight away; it softens fast."
    ],
    "Edamame Bowl": [
      "Boil the pods 4–5 minutes in heavily salted water, or steam from frozen.",
      "Drain well and toss while still steaming so the salt sticks.",
      "Season with flaky salt, chili and a little sesame oil.",
      "Serve with an empty bowl for the pods."
    ],
    "Egg & Cheese Snack Plate": [
      "Boil the eggs 9 minutes from a rolling boil, then straight into ice water for 5. That is what makes them peel.",
      "Peel them under running water, starting at the fat end where the air pocket is.",
      "Halve the eggs and season the cut faces — a whole egg carries almost no seasoning.",
      "Cube the cheese and group everything in clusters rather than spreading it out.",
      "Batch the eggs six at a time on prep day; they keep 5 days unpeeled."
    ],
    "Egg White Wrap": [
      "Warm the tortilla in a dry pan 20 seconds a side so it folds without cracking.",
      "Pour the egg whites into a lightly oiled non-stick pan over low heat.",
      "Stir slowly — egg whites turn rubbery over high heat faster than whole eggs.",
      "Add the cheese and veg while the egg is still just wet.",
      "Fill, fold the sides in, roll tight, then sear the seam side down to seal."
    ],
    "Falafel Bowl": [
      "Bake or air-fry the falafel until the crust is properly hard, 15–18 minutes.",
      "Dress the raw salad veg with lemon and salt 10 minutes ahead so they soften slightly.",
      "Loosen the tahini with cold water until it pours — it thickens before it thins, keep going.",
      "Build on the grain: salad, falafel, pickles.",
      "Sauce over the top, herbs last."
    ],
    "Fish & Chips Plate": [
      "Cut the potatoes into even chips and dry them thoroughly — water is the enemy of crisp.",
      "Toss in a little oil and bake at 220C/425F for 30–35 minutes, turning once.",
      "Pat the fish dry, season, and bake or air-fry for the last 12–15 minutes.",
      "Cook the peas and crush them roughly with mint and lemon.",
      "Vinegar on the chips the moment they leave the oven."
    ],
    "Fish Tacos": [
      "Make the slaw first with lime, salt and a little sugar so it softens while you cook.",
      "Season the fish and cook it hot and fast, 2–3 minutes a side, in big pieces.",
      "Break it into chunks rather than shredding it.",
      "Char the tortillas directly over a flame or in a dry pan.",
      "Build: sauce, fish, slaw, then lime over the top."
    ],
    "Frozen Yogurt Bark": [
      "Stir the yogurt with sweetener and vanilla until smooth.",
      "Spread it 1cm thick on a lined tray — thinner shatters, thicker won't snap.",
      "Press the fruit and toppings into the surface rather than scattering them on.",
      "Freeze at least 4 hours until solid.",
      "Break into shards and keep frozen. It softens in about 3 minutes out of the freezer."
    ],
    "Greek Salad": [
      "Cut the cucumber and tomato in chunks, not slices. This is a chunky salad.",
      "Salt the tomato and let it sit 10 minutes — the juice it releases is half the dressing.",
      "Soak the raw onion in cold water 10 minutes to take the harsh edge off.",
      "Combine with olives, oil, vinegar and a heavy hand of dried oregano.",
      "Feta on top in a slab, not crumbled, if you want it done properly."
    ],
    "Greek Yogurt Bowl": [
      "Stir the yogurt smooth and add any sweetener or vanilla to the yogurt itself, not the top.",
      "Layer fruit and crunch on top.",
      "Add nut butter warmed for 10 seconds so it swirls.",
      "Build it just before eating — granola on yogurt has a 5-minute crunch window."
    ],
    "Gyro Wrap": [
      "Marinate the protein in lemon, oregano, garlic and oil for 30 minutes.",
      "Cook it hot and fast so the outside chars while the inside stays juicy.",
      "Warm the flatbread in a dry pan until it puffs slightly.",
      "Spread the tzatziki on the bread first — it stops the bread going through.",
      "Fill, roll tight, then toast the roll seam-down for 30 seconds."
    ],
    "Harissa Chicken & Couscous": [
      "Slash the chicken thighs or butterfly the breast so the marinade reaches past the surface.",
      "Coat in harissa, oil, cumin and lemon and leave at least 30 minutes at room temperature.",
      "Roast at 220C/425F on a hot tray, or grill, until the edges are properly dark. Harissa needs char.",
      "Couscous is a 1:1 pour of boiling stock, lid on, off the heat, 5 minutes. Then fork it apart — never stir it.",
      "Roast the vegetables on their own tray so they do not steam under the chicken.",
      "Rest the chicken 5 minutes, then slice across it and let the juices run into the couscous."
    ],
    "Honey Mustard Chicken": [
      "Whisk the honey, mustard and a splash of vinegar into a glaze.",
      "Sear the protein first and only then brush the glaze on — sugar in a hot dry pan burns.",
      "Finish in the oven at 200C/400F, basting once, until cooked through.",
      "Roast the veg on the same tray for the last 20 minutes.",
      "Rest before slicing and spoon the pan glaze over."
    ],
    "Huevos Rancheros": [
      "Warm the tortillas one at a time in a dry pan until they puff, then keep them wrapped in a towel.",
      "Simmer the salsa with the onion and pepper for 10 minutes so it stops tasting raw.",
      "Fry the eggs in a separate pan so the whites set crisp at the edges and the yolks stay loose.",
      "Tortilla down, beans or sauce over it, egg on top. In that order — the tortilla is a plate, not a topping.",
      "Avocado, cheese and cilantro last, off the heat.",
      "Eat it immediately. This is not a dish that waits."
    ],
    "Hummus & Veg Plate": [
      "Spread the hummus in a bowl with the back of a spoon to make a well.",
      "Fill the well with oil, paprika and a scatter of seeds.",
      "Cut the veg into sticks the same length so they stand up in the dish.",
      "Add something pickled or salty on the side.",
      "Warm the pita in a dry pan just before serving."
    ],
    "Jambalaya": [
      "Brown the sausage first and leave the rendered fat in the pot. It is the backbone of the flavor.",
      "Cook the trinity — onion, pepper, celery — in that fat until it collapses, a good 10 minutes.",
      "Toast the cajun spice and the dry rice in the fat for a minute before any liquid goes in.",
      "Add stock and tomato at a ratio of about 1.75 to 1 against the rice, bring to a boil, then straight down to the lowest simmer.",
      "Lid on and do not stir it again. Stirring is what turns jambalaya into risotto. 25 minutes.",
      "Shrimp go in for the last 5 minutes only. Rest off the heat 10 minutes, then fork it through."
    ],
    "Jerk Chicken": [
      "Marinate the chicken in the jerk paste overnight if you can, 2 hours minimum.",
      "Cook it hot and get real char on the outside — grill, griddle or 220C/425F oven.",
      "Baste with the leftover marinade only in the first half of cooking.",
      "Cook the rice and peas with coconut milk, thyme and a whole scotch bonnet on top, unbroken.",
      "Rest the chicken, serve with lime and the fruit salsa."
    ],
    "Jerky & Trail Mix": [
      "Portion both into a container before you start eating. This snack is very easy to overrun.",
      "Pair a salty item with a sweet one and a nut for texture.",
      "Drink water with it; jerky and nuts are both dehydrating."
    ],
    "Lamb & Couscous": [
      "Rub the lamb with the spices and let it sit while the oven heats to 200C/400F.",
      "Sear all sides in a hot pan first, then roast to your liking.",
      "Pour boiling stock over the couscous, cover, and leave 5 minutes — no heat needed.",
      "Fork the couscous through with oil, lemon, herbs and any dried fruit.",
      "Rest the lamb 10 minutes, slice against the grain, serve on the couscous."
    ],
    "Lemon Garlic Pasta": [
      "Warm the garlic in the oil or butter over LOW heat until it smells sweet, not brown.",
      "Add lemon zest off the heat, juice on the heat — zest burns, juice doesn't.",
      "Toss the drained pasta through with a good splash of pasta water.",
      "Add the protein and greens and toss until the greens just wilt.",
      "Finish with cheese, pepper and more lemon than feels sensible."
    ],
    "Lentil Curry": [
      "Fry the onion until it is properly golden — 10 minutes, not 3.",
      "Add ginger and garlic, then the ground spices, and toast them for a minute.",
      "Add the lentils and stock and simmer until they collapse, 25–35 minutes.",
      "Stir in the greens and coconut milk at the end.",
      "Finish with lime and salt. Lentils need more salt than you think."
    ],
    "Loaded Sweet Potato": [
      "Prick the potato, rub with oil and salt, and bake at 200C/400F for 45–60 minutes.",
      "It is done when a knife goes in with no resistance at all — undercooked is the usual mistake.",
      "Split it open and fluff the inside with a fork before topping.",
      "Add the protein hot, the cold toppings after.",
      "Sauce over the top and a squeeze of lime."
    ],
    "Mediterranean Grain Bowl": [
      "Cook the grain in stock and dress it while warm with oil and lemon.",
      "Chop the salad veg small and salt it so it releases some juice.",
      "Roast or sear the protein separately and season it its own way.",
      "Build in sections with the dips at the edge, not stirred through.",
      "Herbs, olives and feta over the top."
    ],
    "Mediterranean Quinoa": [
      "Rinse the quinoa in a sieve for 30 seconds — unrinsed quinoa tastes soapy.",
      "Cook 1 part quinoa to 2 parts stock, 15 minutes, then rest covered 5 minutes.",
      "Fork through olive oil, lemon and oregano while warm so it absorbs.",
      "Fold in the cucumber, tomato, onion and olives once it's cooled to room temperature.",
      "Crumble the feta over at the end so it doesn't melt into the grain."
    ],
    "Miso Salmon & Rice": [
      "Whisk miso, a little sweetener, ginger and rice vinegar into a paste that just coats a spoon.",
      "Marinate the fish 20–30 minutes. Longer and the salt in the miso starts curing the flesh firm.",
      "Wipe most of the marinade off before cooking — miso burns fast and bitter.",
      "Broil or pan-sear skin-side down 4 minutes, then 2–3 on the flesh, until it flakes at the thickest point.",
      "Steam the greens separately and dress with sesame oil so they keep their color.",
      "Rice underneath, fish on top, the reserved marinade warmed and spooned over."
    ],
    "Mongolian Beef": [
      "Slice the steak thinly against the grain and toss it in a spoon of cornflour. That coating is what makes the sauce cling.",
      "Mix the sauce in a cup before you start cooking — once the wok is going there is no time.",
      "Sear the beef in two batches over the highest heat you have, 90 seconds a batch. Remove it.",
      "Garlic and ginger for 20 seconds only, then the sauce straight in to stop them burning.",
      "Let the sauce bubble and thicken, then return the beef and toss for 30 seconds to coat.",
      "Scallions off the heat. Serve at once; it dulls as it sits."
    ],
    "Overnight Oats": [
      "Use roughly equal volumes of oats and liquid, then a little more liquid than feels right.",
      "Stir in the protein powder or yogurt now, not in the morning.",
      "Add the seeds, sweetener and any spice and stir until no dry patches remain.",
      "Refrigerate at least 6 hours in a sealed jar.",
      "Add fruit and crunch in the morning."
    ],
    "Pesto Pasta": [
      "Salt the pasta water properly and cook the pasta 1 minute short of the packet time.",
      "Reserve a mug of pasta water before draining. This is not optional.",
      "Take the pan off the heat before adding pesto — heat turns basil dull and bitter.",
      "Loosen with the pasta water a splash at a time until the sauce coats rather than sits.",
      "Add the protein and veg, toss, finish with cheese."
    ],
    "Philly Cheesesteak Bowl": [
      "Freeze the steak 30 minutes and slice it paper thin. Thickness is the difference between cheesesteak and stew.",
      "Cook the onions and peppers low and slow first, 15 minutes, until sweet and collapsed. Set aside.",
      "Crank the heat, sear the beef in a single layer for 60–90 seconds, then chop it up in the pan with the spatula.",
      "Return the vegetables, fold them through, then lay the cheese over and cover for a minute to melt it.",
      "Over rice or potato rather than a roll if you want the protein to carry the meal.",
      "Season at the end — the cheese brings its own salt."
    ],
    "Pho": [
      "Char the onion and ginger directly over a flame or in a dry pan until blackened.",
      "Simmer them in the stock with the spices for at least 30 minutes, then strain.",
      "Season the broth with fish sauce until it tastes slightly too strong on its own.",
      "Cook the noodles separately and put them in the bowl first.",
      "Lay raw thin-sliced beef or cooked protein on top and pour the boiling broth over it.",
      "Herbs, lime, chili and sprouts at the table, not in the pot."
    ],
    "Poke Bowl": [
      "Use fish sold for raw eating, keep it cold, and cut it in even cubes with a sharp knife.",
      "Marinate in soy, sesame oil and a little ginger for 10–15 minutes. No longer.",
      "Season the rice with rice vinegar while it is warm, then cool it to room temperature.",
      "Build: rice, then the fish, then the veg and fruit in sections.",
      "Sauce and sesame last."
    ],
    "Pork Chop Dinner": [
      "Take the chops out of the fridge 20 minutes ahead and dry the surface with paper.",
      "Sear in a hot pan 3–4 minutes a side without moving them.",
      "Add butter, garlic and herbs and spoon it over for the last minute.",
      "Pull at 63C/145F internal — pork chops are ruined by 5 extra minutes.",
      "Rest 5 minutes while the sides finish. Pour the pan juices over."
    ],
    "Pork Loin & Roasted Veg": [
      "Score the fat and salt the joint all over an hour ahead.",
      "Start at 220C/425F for 20 minutes to set the crust, then drop to 180C/350F.",
      "Add the veg around the meat so it roasts in the drippings.",
      "Pull at 63C/145F internal — pork loin dries out very fast beyond that.",
      "Rest 15 minutes under foil before carving."
    ],
    "Pork Stir-Fry": [
      "Slice the pork thin and toss with a splash of soy and a teaspoon of cornflour; 15 minutes is enough.",
      "Have every vegetable cut and the sauce mixed before the pan goes on. Stir-frying is all prep and no thinking.",
      "Sear the pork in one layer over the highest heat, 2 minutes, then take it out.",
      "Hard vegetables first — carrot, broccoli — then the soft ones, 3–4 minutes total.",
      "Aromatics for 20 seconds, sauce in, pork back, toss until everything is glossy.",
      "Off the heat, then sesame oil and peanuts. Sesame oil cooked is sesame oil wasted."
    ],
    "Protein Brownie Bowl": [
      "Mix the dry — cocoa, protein powder, sweetener — before any liquid goes in.",
      "Add liquid a spoon at a time to a thick batter, not a pourable one.",
      "Microwave 40–60 seconds. Stop while the middle still looks slightly wet.",
      "Overcooking by 15 seconds is what makes protein bakes rubbery.",
      "Top with nut butter and let it melt in."
    ],
    "Protein French Toast": [
      "Whisk the eggs or egg whites with the cinnamon and vanilla until fully combined.",
      "If you are using protein powder, whisk it in with a splash of milk first so it doesn't clump.",
      "Soak each slice 20 seconds a side — long enough to wet, short enough to stay intact.",
      "Cook on a buttered pan over medium-low, 2–3 minutes a side. High heat burns the outside first.",
      "Top with the fruit and nut butter."
    ],
    "Protein Mug Cake": [
      "Whisk the dry ingredients in the mug first, breaking up any lumps against the side.",
      "Add the wet and mix until just combined — overmixing makes it tough.",
      "Microwave 50–70 seconds. It should still look glossy in the very center.",
      "Let it stand 1 minute; it firms as it cools.",
      "Add the topping after cooking, never before."
    ],
    "Protein Pancakes": [
      "Mix wet and dry separately, then combine with as few strokes as possible.",
      "Rest the batter 5 minutes — this is what stops protein pancakes going flat and rubbery.",
      "Cook on medium-low. Protein batter burns before it sets on high heat.",
      "Flip once, when the bubbles on top stay open.",
      "Stack, top with fruit and syrup."
    ],
    "Protein Pasta Primavera": [
      "Protein pasta overcooks fast — start testing 2 minutes before the packet time.",
      "Cook the veg in oil hot and fast so it stays bright and firm.",
      "Reserve pasta water; protein pasta water is starchy and makes a good sauce.",
      "Toss everything with lemon, oil and a splash of the water off the heat.",
      "Cheese and pepper at the end."
    ],
    "Protein Shake": [
      "Liquid into the blender first, powder last — powder on the blades cakes on.",
      "Add ice or frozen fruit for thickness rather than more powder.",
      "Blend 30 seconds, scrape down, blend 15 more.",
      "Drink within a few minutes; it separates and thickens on standing."
    ],
    "Protein Shake & Fruit": [
      "Blend the shake with ice so it is cold and thick rather than lukewarm.",
      "Cut the fruit and eat it alongside rather than blending it in — it is more filling that way.",
      "Add cinnamon or cocoa to the shake if it is fruit-free."
    ],
    "Protein Waffles": [
      "Mix the batter and let it stand 5 minutes. Protein powder needs that time to hydrate or the waffles go rubbery.",
      "Heat the iron fully and grease it properly — protein batter sticks far worse than flour batter.",
      "Fill to about three-quarters. Protein batter rises less than you expect but spreads more.",
      "Cook longer than a normal waffle and resist opening the lid early; that is when they tear.",
      "Cool on a rack, not a plate, or the underside steams soft.",
      "They freeze well between sheets of parchment and go straight into a toaster from frozen."
    ],
    "Pulled Pork Sandwich": [
      "Rub the pork all over and leave it overnight if possible.",
      "Cook low and slow — 150C/300F for 4–6 hours, or 8 hours in a slow cooker — until it shreds with no effort.",
      "Shred it and return it to the cooking juices, not to a dry bowl.",
      "Add sauce to taste; you need less than you think once the juices are back in.",
      "Toast the bun and put the slaw on top of the meat to keep the lid dry."
    ],
    "Quesadilla": [
      "Grate your own cheese; pre-grated has anti-caking starch and melts badly.",
      "Cheese goes on both tortilla faces, filling in the middle — it glues the thing shut.",
      "Cook dry in a pan over medium, pressing flat, 3 minutes a side.",
      "Medium heat only. Hot pans burn the tortilla before the cheese melts.",
      "Rest 2 minutes before cutting or the filling runs out."
    ],
    "Ramen Bowl": [
      "Build the tare in the bowl first: soy, a little sesame oil, garlic, chili.",
      "Heat the stock separately until it is properly boiling.",
      "Cook the noodles in their own water so the broth stays clear.",
      "Pour the hot stock over the tare and whisk, then add the noodles.",
      "Top with the protein, soft egg, greens and corn. Assemble fast — ramen waits for nobody."
    ],
    "Rice Cake Stack": [
      "Spread the wet topping right to the edges so every bite has some.",
      "Heavier toppings go on rice cakes only just before eating — they soften within minutes.",
      "Layer soft first, crunchy second.",
      "Finish with salt or cinnamon depending on which direction you have gone."
    ],
    "Rice Cakes & Nut Butter": [
      "Warm the nut butter 10–15 seconds so it spreads instead of tearing the rice cake.",
      "Spread thin and even, right to the edges.",
      "Top with sliced fruit and a pinch of salt or cinnamon.",
      "Assemble immediately before eating."
    ],
    "Salmon & Rice": [
      "Take the salmon out of the fridge 15 minutes ahead and pat the skin bone dry.",
      "Skin side down in a hot oiled pan, press flat for 10 seconds, then leave it 5–6 minutes.",
      "Flip for a final minute only. Most of the cooking happens on the skin side.",
      "Steam the greens in the same pan with a splash of water and a lid.",
      "Serve on the rice with the sauce spooned around, not over the crisp skin."
    ],
    "Salmon Salad Bowl": [
      "If you are cooking the salmon, do it the night before and chill it — warm fish wilts the leaves.",
      "Flake it in large pieces rather than shredding; it should look like fish, not tuna mayo.",
      "Dress the grain while it is still warm so it absorbs the lemon and oil, then let it cool.",
      "Keep the leaves dry and undressed until the moment of eating.",
      "Build in layers if it is going in a container: grain at the bottom, dressing under that, leaves on top.",
      "Dill, lemon and pepper are the whole seasoning. It does not need more."
    ],
    "Savoury Oats": [
      "Cook the oats in water or stock rather than milk — stock is the whole point here.",
      "Stir constantly for the last 2 minutes so they go creamy.",
      "Off the heat, stir in the cheese, nutritional yeast and pepper.",
      "Wilt the greens or mushrooms in a pan and fold through.",
      "Top with a soft-cooked egg and hot sauce."
    ],
    "Scrambled Eggs & Toast": [
      "Beat the eggs until the color is completely uniform.",
      "Low heat, butter in the pan, and pull the eggs constantly with a spatula.",
      "Take them off the heat while they still look underdone — they carry on cooking in the pan.",
      "Season at the end. Salt beaten in early makes them watery.",
      "Toast should already be buttered and waiting."
    ],
    "Sesame Noodles": [
      "Cook the noodles, then rinse under cold water to stop them gluing together.",
      "Whisk the sauce until it emulsifies — sesame, soy, vinegar, a little sweetener.",
      "Toss the noodles through the sauce while they're still slightly wet.",
      "Add the raw veg, cut into matchsticks, and the protein.",
      "Rest 10 minutes before eating; the noodles drink the sauce."
    ],
    "Shakshuka": [
      "Soften the onion and peppers in the oil over medium heat, 6–8 minutes.",
      "Add the spices and cook 30 seconds until they smell toasted, then the tomatoes.",
      "Simmer 10–12 minutes until the sauce is thick enough to hold a spoon trail.",
      "Make wells and crack in the eggs. Cover and cook 5–7 minutes for runny yolks.",
      "Scatter over the herbs and cheese. Serve with the bread for dipping."
    ],
    "Sheet Pan Chicken": [
      "Heat the oven and the empty tray together to 220C/425F.",
      "Toss the veg in oil and seasoning. Dense veg goes on first for a 10-minute head start.",
      "Add the protein and the softer veg, everything in a single layer with gaps.",
      "Roast 20–25 minutes without stirring so it roasts instead of steams.",
      "Squeeze lemon over the hot tray and scrape it all up with the juices."
    ],
    "Shepherd's Pie": [
      "Brown the mince hard, then cook the onion, carrot and celery in the same pot.",
      "Add stock and herbs and simmer until it is thick, not soupy — 20 minutes.",
      "Boil and mash the potato dry, then beat in butter or yogurt for the topping.",
      "Spread the mash over the cooled filling and rough the top with a fork.",
      "Bake 200C/400F for 25 minutes until the ridges brown."
    ],
    "Shrimp Scampi": [
      "Pat the prawns dry and season them. Wet prawns steam instead of searing.",
      "Cook them 60–90 seconds a side in butter and oil, then remove immediately.",
      "Overcooked prawns cannot be rescued, so pull them early.",
      "Cook the garlic gently, deglaze with lemon or wine, and let it reduce by half.",
      "Return the prawns with the drained pasta and a splash of pasta water. Toss and serve."
    ],
    "Smash Burger Plate": [
      "Roll the mince into loose balls. Do not compact them.",
      "Get the pan or plate ripping hot with a scrape of oil.",
      "Put the ball down and smash it flat for 10 seconds, then leave it completely alone.",
      "Flip once at 2 minutes, when the crust is dark. Cheese on immediately.",
      "Toast the bun in the beef fat. Sauce on the top bun, salad under the patty."
    ],
    "Smoked Salmon Bagel": [
      "Toast the bagel halves cut side down until golden.",
      "Spread the cream cheese thick on the base while it's warm.",
      "Lay the salmon in loose folds rather than flat — it eats better.",
      "Add capers, red onion, cracked pepper and a squeeze of lemon.",
      "Serve open-faced; closing it squeezes everything out."
    ],
    "Smoothie Bowl": [
      "Use frozen fruit and as little liquid as you can get away with — this is meant to be spoonable.",
      "Blend in short pulses, scraping down, rather than running it long and warming it.",
      "If it won't move, add liquid a tablespoon at a time. It is very easy to overshoot.",
      "Pour into a chilled bowl.",
      "Arrange the toppings in lines and eat immediately."
    ],
    "Spaghetti & Meat Sauce": [
      "Brown the mince properly in batches until it is genuinely brown, not gray.",
      "Soften onion, carrot and celery in the fat, then add garlic and herbs.",
      "Add the tomato and simmer 30 minutes minimum, low, partly covered.",
      "Cook the pasta short and finish it in the sauce with a splash of pasta water.",
      "Finish with cheese off the heat."
    ],
    "Steak & Eggs": [
      "Take the steak out of the fridge 30 minutes ahead and salt it as soon as it comes out.",
      "Dry the surface right before it hits the pan. Moisture is the enemy of a crust.",
      "Ripping hot pan, 3–4 minutes a side for a medium steak, then butter, garlic and rosemary basted over for the last minute.",
      "Rest the steak a full 8 minutes. Fry the eggs in that window, in the same pan.",
      "Potatoes want their own pan and more time than you think — start them first.",
      "Slice against the grain and pour the resting juices back over."
    ],
    "Steak & Potatoes": [
      "Salt the steak and leave it uncovered in the fridge for an hour if you have time.",
      "Roast or boil-then-crush the potatoes so they have edges to crisp.",
      "Sear the steak in a very hot pan, 3–4 minutes a side, undisturbed.",
      "Butter, garlic and thyme in the pan at the end, spooned over for a minute.",
      "Rest 8–10 minutes. Slicing early loses the juices onto the board."
    ],
    "Steak Frites": [
      "Cut the potatoes into even batons and soak them in cold water 30 minutes to pull the starch out.",
      "Dry them completely, then cook twice: 160C/325F until soft, cool, then 200C/400F until golden. One fry gives you limp chips.",
      "Salt the steak and leave it at room temperature while the first fry happens.",
      "Sear in a heavy pan, hard, then baste with butter and herbs for the final minute.",
      "Rest the steak 8–10 minutes while the second fry goes; both finish at the same moment.",
      "Salt the chips the second they leave the oil. Sauce on the side."
    ],
    "Steak Salad": [
      "Salt the steak and leave it out 30 minutes before cooking.",
      "Sear in a screaming hot pan, 3–4 minutes a side for medium-rare, then rest 8 minutes.",
      "Dress the leaves lightly while the steak rests.",
      "Slice the steak against the grain, thin, at an angle.",
      "Lay it over the top and pour the resting juices on as part of the dressing."
    ],
    "Sushi Burrito": [
      "Season the warm rice with rice vinegar and cool it to room temperature.",
      "Lay the nori shiny side down and spread rice over two-thirds, leaving the far edge bare.",
      "Lay the fillings in a tight line across the middle. Overfilling is the main failure here.",
      "Roll from the near edge using the mat, pulling back to tighten as you go.",
      "Wet the bare edge to seal. Cut with a wet knife in one stroke."
    ],
    "Taco Bowl": [
      "Brown the mince, drain the excess fat, then add seasoning and a splash of water.",
      "Simmer 5 minutes until it is saucy rather than dry.",
      "Warm the beans and cook the rice.",
      "Build hot to cold: rice, beans, meat, then cheese, then cold toppings.",
      "Salsa and avocado at the very end."
    ],
    "Teriyaki Rice Bowl": [
      "Cook the rice first and leave it covered off the heat.",
      "Sear the protein in a hot dry-ish pan until browned on all sides.",
      "Add the teriyaki in the last 2 minutes — added early, the sugar burns.",
      "Steam or stir-fry the veg separately so it stays bright.",
      "Assemble over rice and finish with sesame seeds and spring onion."
    ],
    "Thai Green Curry": [
      "Fry the curry paste in a spoonful of the thick coconut cream for 2 minutes until it splits.",
      "Add the protein and coat it in the paste before any liquid goes in.",
      "Pour in the rest of the coconut milk and simmer gently — a hard boil curdles it.",
      "Add the veg by cooking time, hardest first.",
      "Season with fish sauce, lime and a pinch of sugar. Balance all three."
    ],
    "Tofu Scramble": [
      "Press the tofu at least 20 minutes under something heavy. Unpressed tofu will not brown, it will only steam.",
      "Crumble it by hand into uneven pieces so it reads like egg rather than mince.",
      "Turmeric goes in early for colour; nutritional yeast and black salt go in at the end for flavour.",
      "Get the pan hot and leave the tofu alone in between stirs so some faces catch and crisp.",
      "Cook the vegetables separately if they are watery — mushrooms and spinach will flood the pan otherwise.",
      "Finish with hot sauce or chilli crisp; tofu takes far more seasoning than eggs do."
    ],
    "Tofu Stir-Fry": [
      "Press the tofu 20 minutes under something heavy. This is the step that decides the dish.",
      "Cube it, toss in cornflour, and fry until every side is genuinely golden.",
      "Remove it before it goes soft again in the sauce.",
      "Stir-fry the veg hot and fast, then add the pre-mixed sauce.",
      "Return the tofu at the very end and toss for 20 seconds only."
    ],
    "Trail Mix": [
      "Toast the nuts in a dry pan or a 180C/350F oven for 6–8 minutes; it doubles the flavour.",
      "Cool them completely before mixing or they will sweat the dried fruit.",
      "Mix in roughly equal volumes of nut, dried fruit and the crunchy element.",
      "Add salt — unsalted trail mix tastes flat.",
      "Portion into bags immediately. Eating from the big bag is how the calories get away from you."
    ],
    "Tuna & Crackers": [
      "Drain the tuna hard — press it against the lid until nothing more runs out. Wet tuna makes a sad plate.",
      "Flake it with a fork and mix in the mayo, lemon and pepper before anything crunchy goes near it.",
      "Fold in the celery and pickle last so they stay crisp.",
      "Keep the crackers separate until eating, always.",
      "Doubles easily and keeps 2 days covered; longer than that and it starts to weep."
    ],
    "Tuna Salad Plate": [
      "Drain the tuna properly, pressing the lid down hard.",
      "Mix the dressing separately, then fold it in with a fork rather than mashing.",
      "Add the crunch — celery, onion, pickle — last.",
      "Season heavily; tinned tuna takes more salt and acid than you expect.",
      "Serve on leaves or crackers with the veg alongside."
    ],
    "Turkey Roll-Ups": [
      "Lay the slices flat and pat them dry so the filling sticks.",
      "Spread a thin layer of the soft element across the whole slice.",
      "Lay the veg in a line at one end, then roll tight.",
      "Chill 10 minutes if you want them to hold their shape when cut.",
      "Serve with mustard or hot sauce for dipping."
    ],
    "Turkey Taco Salad": [
      "Brown the turkey in a dry pan until it has real color before adding any seasoning — pale mince tastes of pale mince.",
      "Add taco seasoning plus a splash of water and simmer it down so the spice coats rather than dusts.",
      "Cool the meat slightly. Hot mince on lettuce turns the whole bowl to slop.",
      "Chop the lettuce fine, more finely than feels right; it should be a bed, not leaves.",
      "Layer lettuce, meat, beans, corn, tomato, then avocado. Chips go on at the table.",
      "Lime over everything at the end and a spoon of yogurt-based sauce rather than sour cream."
    ],
    "Veggie Burger Bowl": [
      "If you are forming your own patties, chill the mix 20 minutes first or they will not hold together.",
      "Cook them in a properly hot pan and turn once. Bean and tofu patties break when they are fussed with.",
      "Roast the potatoes at 220C/425F on a preheated tray for real edges.",
      "Build the bowl cold-side first: lettuce, tomato, pickle, onion, then the hot patty broken over the top.",
      "Sauce goes on last and generously — this bowl lives or dies on the sauce.",
      "Everything except the patty can be prepped three days ahead."
    ],
    "Yogurt Parfait": [
      "Stir the yogurt smooth first; straight from the tub it layers badly.",
      "Layer yogurt, fruit, granola, repeating and finishing with granola.",
      "Build it in a glass or jar so the layers are visible and stay separate.",
      "If it is for tomorrow, keep the granola in a separate pot and add on eating."
    ],
  };
  RECIPES.forEach(r=>{ if (!r.steps && RECIPE_STEPS[r.name]) r.steps = RECIPE_STEPS[r.name]; });

