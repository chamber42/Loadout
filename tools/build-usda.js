'use strict';
/* ============================================================
   Build js/42-usda-data.js from the USDA FoodData Central bulk downloads.

   WHY THIS EXISTS AS A SCRIPT

   The generated table is checked in, so nobody needs to run this to build
   the app. It is here so the table can be regenerated when USDA publishes,
   and so what is in it — which datasets, which nutrients, which filters —
   is written down rather than being a file of numbers nobody can account
   for.

   WHAT GOES IN

   Two datasets, both works of the US federal government and therefore
   public domain under 17 U.S.C. 105. No licence, no attribution
   requirement, no share-alike:

     Foundation Foods  — a few hundred foods, analysed recently, with the
                         best provenance USDA publishes.
     SR Legacy         — ~7,800 foods from the old Standard Reference.
                         Older, but it is the reference table most
                         nutrition software in the world is built on.

   Branded Foods is deliberately NOT included. It is enormous, it is
   contributed by manufacturers rather than analysed, and it is the one
   part of FDC that Open Food Facts already covers better and more
   currently. USDA's value here is exactly what OFF is weakest at: raw and
   whole foods.

   USAGE

     node tools/build-usda.js <path to unzipped downloads>

   expecting, inside that directory:

     FoodData_Central_foundation_food_json_<date>.json
     FoodData_Central_sr_legacy_food_csv_2018-04/food.csv
     FoodData_Central_sr_legacy_food_csv_2018-04/food_nutrient.csv
   ============================================================ */

const fs = require('fs');
const path = require('path');

/* FDC nutrient ids. These are stable across releases — they are the
   database's own identifiers, not the older "nutrient number" column. */
const N = {
  kcal:    1008,   // Energy, KCAL
  protein: 1003,   // Protein, G
  carbs:   1005,   // Carbohydrate, by difference, G
  fat:     1004,   // Total lipid (fat), G
  fibre:   1079,   // Fiber, total dietary, G
  sodium:  1093,   // Sodium, Na, MG
};

/* Nothing edible exceeds about 900 kcal per 100 g — pure fat is 900. A
   record above this is a unit error in the source, and the app applies the
   same ceiling to Open Food Facts results. */
const KCAL_CEILING = 950;

/* ---- a CSV reader that survives quoted commas in food descriptions ---- */
function parseCsvLine(line){
  const out = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++){
    const c = line[i];
    if (inQ){
      if (c === '"'){
        if (line[i+1] === '"'){ cur += '"'; i++; }   // escaped quote
        else inQ = false;
      } else cur += c;
    } else if (c === '"'){ inQ = true; }
    else if (c === ','){ out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

/* Streams rather than splitting the whole file: food_nutrient.csv is 644k
   rows and holding it as one array of strings is needless. */
function eachCsvRow(file, onRow){
  const text = fs.readFileSync(file, 'utf8');
  let start = 0, header = null;
  while (start < text.length){
    let end = text.indexOf('\n', start);
    if (end < 0) end = text.length;
    const line = text.slice(start, end).replace(/\r$/, '');
    start = end + 1;
    if (!line) continue;
    const cells = parseCsvLine(line);
    if (!header){ header = cells; continue; }
    const row = {};
    for (let i = 0; i < header.length; i++) row[header[i]] = cells[i];
    onRow(row);
  }
}

function num(v){
  const x = parseFloat(v);
  return (isFinite(x) && x >= 0) ? x : null;
}

/* Rounded the way the app displays them: calories whole, macros to a tenth,
   sodium whole. Storing more precision than is ever shown just makes the
   bundled file bigger. */
function tidy(rec){
  return {
    name:    rec.name,
    kcal:    Math.round(rec.kcal),
    protein: rec.protein == null ? 0 : Math.round(rec.protein * 10) / 10,
    carbs:   rec.carbs   == null ? 0 : Math.round(rec.carbs   * 10) / 10,
    fat:     rec.fat     == null ? 0 : Math.round(rec.fat     * 10) / 10,
    fibre:   rec.fibre   == null ? null : Math.round(rec.fibre * 10) / 10,
    sodium:  rec.sodium  == null ? null : Math.round(rec.sodium),
  };
}

function readSrLegacy(dir){
  const base = fs.readdirSync(dir)
    .find(f => /^FoodData_Central_sr_legacy_food_csv/.test(f));
  if (!base) return [];
  const root = path.join(dir, base);

  const byId = new Map();
  eachCsvRow(path.join(root, 'food.csv'), r => {
    const name = (r.description || '').trim();
    if (name) byId.set(r.fdc_id, {name});
  });

  const wanted = new Map(Object.entries(N).map(([k, id]) => [String(id), k]));
  eachCsvRow(path.join(root, 'food_nutrient.csv'), r => {
    const field = wanted.get(r.nutrient_id);
    if (!field) return;
    const rec = byId.get(r.fdc_id);
    if (!rec) return;
    rec[field] = num(r.amount);
  });

  return Array.from(byId.values());
}

function readFoundation(dir){
  const file = fs.readdirSync(dir)
    .find(f => /^FoodData_Central_foundation_food_json.*\.json$/.test(f));
  if (!file) return [];
  const raw = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  const list = raw.FoundationFoods || raw.foundationFoods || [];
  const byId = new Map(Object.entries(N).map(([k, id]) => [id, k]));

  return list.filter(Boolean).map(f => {
    /* The published file carries a few null slots in the array. */
    const rec = {name: ((f && f.description) || '').trim()};
    (f.foodNutrients || []).forEach(fn => {
      const id = fn.nutrient && fn.nutrient.id;
      const field = byId.get(id);
      if (!field) return;
      /* Foundation reports `amount` on the nutrient row; a few entries omit
         it where the analysis found nothing measurable. */
      if (fn.amount != null) rec[field] = num(fn.amount);
    });
    return rec;
  }).filter(r => r.name);
}

function main(){
  const dir = process.argv[2];
  if (!dir){
    console.error('usage: node tools/build-usda.js <unzipped FDC downloads dir>');
    process.exit(2);
  }

  const foundation = readFoundation(dir);
  const legacy     = readSrLegacy(dir);
  console.log(`read ${foundation.length} Foundation, ${legacy.length} SR Legacy`);

  /* Foundation first so that where the two describe the same food, the
     newer analysis is the one kept. */
  const seen = new Set();
  const out = [];
  let dropped = 0;

  for (const rec of foundation.concat(legacy)){
    if (rec.kcal == null){ dropped++; continue; }        // nothing to size against
    if (rec.kcal > KCAL_CEILING){ dropped++; continue; } // a unit error upstream
    const key = rec.name.toLowerCase();
    if (seen.has(key)){ dropped++; continue; }
    seen.add(key);
    out.push(tidy(rec));
  }

  out.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

  /* Emitted as a JSON string parsed at load rather than as a JS array
     literal. JSON.parse is markedly faster than the JS parser on a payload
     this size, and this runs during app start-up on a phone. */
  const rows = out.map(f => [f.name, f.kcal, f.protein, f.carbs, f.fat, f.fibre, f.sodium]);
  const json = JSON.stringify(rows);

  const banner = `'use strict';
/* ============================================================
   LOADOUT - USDA FOODDATA CENTRAL, BUNDLED

   GENERATED FILE — do not edit by hand.
   Rebuild with:  node tools/build-usda.js <unzipped FDC downloads>

   ${out.length} foods from USDA FoodData Central: Foundation Foods and
   SR Legacy. Works of the US federal government, not subject to copyright
   in the United States (17 U.S.C. 105) and in the public domain. No
   licence applies, no attribution is required, and nothing here is
   share-alike — which is exactly why it can be bundled where the Open
   Food Facts database could not.

   Branded Foods is deliberately excluded: Open Food Facts covers packaged
   products better and more currently, and this is here to fill the gap it
   leaves at raw and whole foods.

   Each row is [name, kcal, protein, carbs, fat, fibre, sodium] per 100 g.
   Fibre and sodium are null where USDA published no figure — null rather
   than zero, so the app falls back to its own estimate instead of
   claiming the food contains none.
   ============================================================ */

  /* Parsed rather than written as an array literal: JSON.parse is
     substantially faster on a payload this size, and this cost is paid
     during start-up. */
  const USDA_ROWS = JSON.parse(${JSON.stringify(json)});
`;

  const dest = path.join(__dirname, '..', 'js', '42-usda-data.js');
  fs.writeFileSync(dest, banner);
  const kb = Math.round(fs.statSync(dest).size / 1024);
  console.log(`wrote ${dest} — ${out.length} foods, ${kb} KB (${dropped} dropped)`);
}

main();
