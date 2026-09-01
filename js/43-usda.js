'use strict';
/* ============================================================
   LOADOUT - SEARCHING THE BUNDLED USDA TABLE

   Open Food Facts is very good at packaged groceries and weak at the two
   things people log constantly without a barcode: raw ingredients and
   whole foods. Its records are contributed by the public and unverified,
   and there is often no record at all for "chicken breast, roasted".

   USDA FoodData Central is the opposite. It is analysed rather than
   contributed, it is the reference table most nutrition software in the
   world is built on, and it is public domain — so unlike the Open Food
   Facts database it can simply be bundled (42-usda-data.js) instead of
   fetched.

   THREE THINGS THAT FOLLOW FROM IT BEING LOCAL

   It is instant. No debounce, no rate limit, no waiting on a network
   round trip before anything appears.

   It works offline, which nothing else in the lookup path does.

   It works on the web build. Open Food Facts' name search reaches a host
   that sends no CORS header, so until now searching by name needed the
   installed app; the journal said as much and offered the library
   instead. A bundled table has no origin to be blocked from.

   HOW THE TWO SOURCES SHARE A SEARCH

   USDA answers first and its hits render immediately. The Open Food Facts
   request still goes out, and its results are appended underneath when
   they arrive. Someone looking for broccoli gets an answer before they
   have finished typing; someone looking for a specific brand of cereal
   still gets it a moment later. Neither source is hidden behind the
   other.
   ============================================================ */

  /* Built on first use rather than at load. Lower-casing 7,800 names costs
     a few milliseconds, and there is no reason to spend them during
     start-up for a screen most sessions never open. */
  let USDA_INDEX = null;

  function usdaIndex(){
    if (USDA_INDEX) return USDA_INDEX;
    USDA_INDEX = (typeof USDA_ROWS !== 'undefined' ? USDA_ROWS : []).map(function(r){
      return {row: r, lower: r[0].toLowerCase()};
    });
    return USDA_INDEX;
  }

  /* USDA descriptions are comma-inverted — "Broccoli, raw", "Beef, ground,
     85% lean meat / 15% fat, raw" — which is why a plain substring match
     works so well here: the food's own name is nearly always at the front,
     and everything after the first comma is qualification.

     Lower is better. The pieces, in the order they matter:

       - the whole query at the very start of the name is the best possible
         match and outranks everything else
       - otherwise, how far in the query appears
       - then name length, because the shortest name containing the query is
         almost always the plainest form of the food: "Broccoli, raw" ahead
         of "Broccoli, raw, USDA commodity, frozen"
       - then comma count, for the same reason at finer grain */
  function usdaScore(lower, query, tokens){
    let at = lower.indexOf(query);
    if (at === 0) return -1000 + lower.length;
    let score = at >= 0 ? at : 400;
    if (at < 0){
      /* Every token present but not as one phrase — "chicken roasted"
         matching "Chicken, broilers or fryers, ... roasted". Rank by where
         the first token landed so the food being named still leads. */
      const first = lower.indexOf(tokens[0]);
      score = 300 + (first < 0 ? 100 : first);
    }
    score += lower.length * 0.4;
    for (let i = 0; i < lower.length; i++) if (lower.charCodeAt(i) === 44) score += 4;
    return score;
  }

  /* Hits in exactly the shape offParseProduct returns, so everything
     downstream — the shared result list, the amount step, the journal, the
     loadout slot — treats a USDA food like any other lookup result and
     needs no knowledge that a second source exists. */
  function usdaHit(row){
    const kcal = row[1];
    const protein = row[2], carbs = row[3], fat = row[4];
    return {
      code: '',                       // no barcode: nothing to enrich or re-fetch
      name: row[0],
      brand: 'USDA',                  // names the source where the result is read
      serving: '',
      /* USDA publishes per 100 g and its portion table is not bundled, so
         there is no serving to open on. 100 g is the honest default and the
         amount step is where anyone changes it. */
      servingG: null,
      kcal: kcal,
      protein: protein,
      carbs: carbs,
      fat: fat,
      fibre: row[5],                  // null where USDA published no figure
      sodium: row[6],                 // already milligrams; OFF's are grams
      partial: false,
      /* Deliberately never flagged, unlike an Open Food Facts record.

         That check exists to catch a mistyped label, and it works by seeing
         whether the macros imply the stated calories. USDA carbohydrate is
         "by difference" — what is left after protein, fat, water and ash —
         and alcohol and organic acids carry calories that none of the four
         macros account for. So a sound USDA record can legitimately
         disagree with its own Atwater sum, and flagging it would be crying
         wolf over the better data. */
      suspect: false,
      impliedKcal: protein * 4 + carbs * 4 + fat * 9,
      _usda: true,
    };
  }

  /* Best matches for a typed term, or an empty array. */
  function usdaSearch(term, limit){
    const query = String(term || '').trim().toLowerCase();
    if (query.length < 2) return [];
    const tokens = query.split(/\s+/).filter(Boolean);
    if (!tokens.length) return [];

    const scored = [];
    const index = usdaIndex();
    for (let i = 0; i < index.length; i++){
      const lower = index[i].lower;
      let all = true;
      for (let t = 0; t < tokens.length; t++){
        if (lower.indexOf(tokens[t]) < 0){ all = false; break; }
      }
      if (!all) continue;
      scored.push({row: index[i].row, score: usdaScore(lower, query, tokens)});
    }

    scored.sort(function(a, b){ return a.score - b.score; });
    return scored.slice(0, limit || 8).map(function(s){ return usdaHit(s.row); });
  }

  window.usdaSearch = usdaSearch;
  window.usdaCount  = function(){ return usdaIndex().length; };
