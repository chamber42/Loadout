'use strict';
/* Covers 37-custom-food.js: the serving -> per-100g -> amount-eaten chain
   behind the ADD A FOOD form, in every unit it offers. */

const {loadScript, suite} = require('./helpers');

const FIELDS = ['cfName','cfBrand','cfServing','cfServingUnit','cfItemName','cfKcal',
                'cfProtein','cfCarbs','cfFat','cfAmount','cfAmountUnit','cfItemNameRow',
                'cfStatus','cfReadout','cfSave','cfoodTitle'];

function el(id){
  return {
    id, value:'', innerHTML:'', textContent:'', disabled:false, hidden:false,
    tagName: id === 'cfServingUnit' ? 'SELECT' : 'INPUT',
    _h:{},
    addEventListener(e, f){ (this._h[e] = this._h[e] || []).push(f); },
    setAttribute(){},
  };
}

/* The module reaches straight for document and the app's globals, so it gets
   a stub of each and a record of what it did with them. */
function harness(){
  const els = {};
  FIELDS.forEach(id => els[id] = el(id));
  els.cfServingUnit.value = 'g';           // as the real markup defaults
  const calls = {scanned:[], journal:[], saved:0};
  const ctx = loadScript('37-custom-food.js', {
    document: {getElementById: id => els[id] || null},
    state: {eaten: [], customFoods: {}},
    addScannedFood: (slot, food) => { calls.scanned.push({slot, food}); return food.key; },
    addLibraryFoodToJournal: (meal, food, grams) => calls.journal.push({meal, food, grams}),
    renderEatenPanel(){}, refreshTargets(){}, saveState(){ calls.saved++; },
    openModal(){}, closeModal(){},
  });
  return {
    els, ctx, calls,
    fill(values){ Object.keys(values).forEach(k => { els['cf'+k].value = String(values[k]); }); },
    type(field){ (els['cf'+field]._h.input || []).forEach(f => f()); },
    save(){ els.cfSave._h.click.forEach(f => f()); },
  };
}

module.exports = () => suite('custom food form', t => {

  t.section('a packet logged as one serving');
  {
    const h = harness();
    h.ctx.openCustomFood({mode:'eaten'});
    h.fill({Name:'Protein Bar', Brand:'Barebells', Serving:55, Kcal:202, Protein:20, Carbs:16, Fat:8});
    h.save();
    const r = h.ctx.state.eaten[0];
    t.check('logs the serving as typed', r && r.kcal === 202 && r.protein === 20, r);
    t.equal('name carries the brand', r && r.name, 'Protein Bar (Barebells)');
    t.near('grams = serving size', r && r.grams, 55);
    t.near('per100 scaled off the serving', r && r.per100.kcal, 367.27, 0.01);
    t.check('persisted as a reusable food', h.calls.scanned.length === 1, h.calls.scanned.length);
    t.equal('filed under protein', h.calls.scanned[0] && h.calls.scanned[0].slot, 'protein');
  }

  t.section('ate half of it');
  {
    const h = harness();
    h.ctx.openCustomFood({mode:'eaten'});
    h.fill({Name:'Protein Bar', Serving:55, Kcal:202, Protein:20, Amount:27.5});
    h.save();
    const r = h.ctx.state.eaten[0];
    t.equal('calories halve', r && r.kcal, 101);
    t.equal('protein halves', r && r.protein, 10);
    t.near('per100 unchanged by the amount', r && r.per100.kcal, 367.27, 0.01);
  }

  t.section('two servings, into the journal');
  {
    const h = harness();
    h.ctx.openCustomFood({mode:'journal', mealName:'Lunch'});
    h.fill({Name:'Rice', Serving:75, Kcal:260, Carbs:58, Amount:150});
    h.save();
    const j = h.calls.journal[0];
    t.check('goes to the journal, not the eaten panel',
      h.ctx.state.eaten.length === 0 && h.calls.journal.length === 1,
      {eaten:h.ctx.state.eaten.length, journal:h.calls.journal.length});
    t.equal('aimed at the right meal', j && j.meal, 'Lunch');
    t.near('grams = amount eaten', j && j.grams, 150);
    t.near('food carries per-100g values', j && j.food.kcal, 346.67, 0.01);
    t.equal('filed under carb', h.calls.scanned[0] && h.calls.scanned[0].slot, 'carb');
    t.equal('title names the meal', h.els.cfoodTitle.textContent, 'ADD TO Lunch');
  }

  t.section('refuses to log something meaningless');
  {
    const h = harness();
    h.ctx.openCustomFood({mode:'eaten'});
    t.equal('save disabled while empty', h.els.cfSave.disabled, true);
    h.fill({Name:'Mystery'}); h.type('Name');
    t.equal('still disabled with no numbers', h.els.cfSave.disabled, true);
    h.fill({Serving:100, Kcal:150}); h.type('Kcal');
    t.equal('enabled once name, serving and calories are in', h.els.cfSave.disabled, false);
    h.save();
    t.equal('then logs it', h.ctx.state.eaten.length, 1);
  }

  t.section('a serving stated in ounces');
  {
    const h = harness();
    h.ctx.openCustomFood({mode:'eaten'});
    h.els.cfServingUnit.value = 'oz';
    h.fill({Name:'Deli Turkey', Serving:2, Kcal:60, Protein:12});
    h.save();
    const r = h.ctx.state.eaten[0];
    t.equal('logs the serving as typed', r && r.kcal, 60);
    t.near('grams = 2 oz', r && r.grams, 56.699, 0.01);
    t.near('per100 off the real weight', r && r.per100.kcal, 105.82, 0.01);
    t.near('counts in ounces', r && r.unit && r.unit.g, 28.3495, 0.01);
    t.check('an ounce is a real weight, not an abstract one',
      r && r.unit && !r.unit.abstract, r && r.unit);
  }

  t.section('a whole item, no weight on the packet');
  {
    const h = harness();
    h.ctx.openCustomFood({mode:'journal', mealName:'Dinner'});
    h.els.cfServingUnit.value = 'item';
    h.fill({Name:"Culver's Chicken Sandwich", ItemName:'sandwich',
            Serving:1, Kcal:740, Protein:38, Carbs:62, Fat:37});
    h.save();
    const j = h.calls.journal[0];
    t.check('per-100g equals one item',
      j && Math.abs(j.food.kcal - 740) < 0.05 && Math.abs(j.food.protein - 38) < 0.05,
      j && {kcal:j.food.kcal, protein:j.food.protein});
    t.equal('marked abstract so no weight is ever shown', j && j.food.unit.abstract, true);
    t.equal('named in the singular', j && j.food.unit.one, 'sandwich');
    t.equal('and pluralised properly', j && j.food.unit.many, 'sandwiches');
  }

  t.section('two and a half items');
  {
    const h = harness();
    h.ctx.openCustomFood({mode:'eaten'});
    h.els.cfServingUnit.value = 'item';
    h.fill({Name:'Rice Cake', Serving:1, Kcal:35, Amount:2.5});
    h.save();
    const r = h.ctx.state.eaten[0];
    t.equal('calories scale by count', r && r.kcal, 88);
    t.near('grams follow the 100g basis', r && r.grams, 250);
    t.equal('defaults the unit name to item', r && r.unit.one, 'item');
  }

  t.section('the volume units stay true to each other');
  {
    /* Read each basis back through the real code path rather than poking at
       the table: one unit in, and the grams it lands on is the basis. */
    const basisOf = u => {
      const h = harness();
      h.ctx.openCustomFood({mode:'eaten'});
      h.els.cfServingUnit.value = u;
      h.fill({Name:'X', Serving:1, Kcal:100});
      h.save();
      return h.ctx.state.eaten[0];
    };
    const g = basisOf('g'), oz = basisOf('oz'), ml = basisOf('ml');
    const tsp = basisOf('tsp'), tbsp = basisOf('tbsp'), cup = basisOf('cup');
    t.near('3 tsp = 1 tbsp', tsp.grams * 3, tbsp.grams, 0.001);
    t.near('16 tbsp = 1 cup', tbsp.grams * 16, cup.grams, 0.001);
    t.near('a cup is 236.59 ml', cup.grams, 236.588, 0.01);
    t.near('an ounce is a real weight', oz.grams, 28.3495, 0.001);
    t.equal('grams need no unit at all', g.unit, null);
    t.check('ounces are not abstract', oz.unit && !oz.unit.abstract, oz.unit);
    t.check('every volume unit is abstract',
      [ml, tsp, tbsp, cup].every(x => x.unit && x.unit.abstract === true),
      [ml, tsp, tbsp, cup].map(x => x.unit && x.unit.abstract));
  }

  t.section('volume scales exactly even though the weight is unknown');
  {
    const h = harness();
    h.ctx.openCustomFood({mode:'eaten'});
    h.els.cfServingUnit.value = 'tbsp';
    h.fill({Name:'Peanut Butter', Serving:1, Kcal:94, Fat:8, Amount:2});
    h.save();
    const r = h.ctx.state.eaten[0];
    t.check('two tablespoons doubles it', r && r.kcal === 188 && r.fat === 16,
      r && {kcal:r.kcal, fat:r.fat});
    t.equal('weight is never claimed', r && r.unit.abstract, true);
    t.equal('counts in tbsp', r && r.unit.one, 'tbsp');
  }
});
