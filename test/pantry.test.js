'use strict';
/* Covers the single pantry store that replaced two disagreeing ones.

   The app used to keep what you own twice: mustUse/mustQty steered the
   planner, pantry steered the shopping list, and neither told the other. The
   risk in merging them is silent data loss on the way in, and a shopping
   list that decides you already have enough of something you never weighed.
   Both are what this suite watches. */

const {loadFunctions, suite} = require('./helpers');

const MODEL = ['pantryEntry','pantryHas','pantryGrams','pantryVague','pantryWanted',
               'pantryPut','pantryDrop','setPantryUse','setPantryGrams',
               'planPantryKeys','shopLine',
               'pantryTakeForEntry','pantryReturnForEntry'];

function model(pantry, pantryUse){
  const state = {pantry: pantry || {}, pantryUse: pantryUse === undefined ? true : pantryUse};
  const ctx = loadFunctions('26-shopping-pantry.js', MODEL, {state, saveState(){}});
  ctx.state = state;
  return ctx;
}

function migrated(saved){
  const state = {};
  const ctx = loadFunctions('25-persistence.js', ['migratePantry'], {state});
  ctx.migratePantry(saved);
  return state;
}

module.exports = () => suite('pantry', (t) => {

  t.section('reading an entry');
  {
    const m = model({rice:{g:400, use:true}, oats:{g:0, use:false}});
    t.equal('grams come back', m.pantryGrams('rice'), 400);
    t.check('a weighed item is not vague', !m.pantryVague('rice'));
    t.check('a zero-gram item is vague', m.pantryVague('oats'));
    t.check('vague still counts as owned', m.pantryHas('oats'));
    t.check('absent is not owned', !m.pantryHas('salmon'));
    t.equal('absent reads as zero grams', m.pantryGrams('salmon'), 0);
  }

  t.section('saves written before the merge');
  {
    // the old store held a bare number here, not an object
    const m = model({rice: 250});
    t.equal('a bare number is read as grams', m.pantryGrams('rice'), 250);
    t.check('and carries no claim on the plan', !m.pantryWanted('rice'));
  }

  t.section('merging the two old stores');
  {
    const s = migrated({
      pantry:  {rice: 250, oats: 300},
      mustUse: ['chicken', 'rice'],
      mustQty: {chicken: 400, rice: 100},
    });
    t.equal('a shopping-only item survives', s.pantry.oats.g, 300);
    t.check('and does not start steering the plan', !s.pantry.oats.use);
    t.equal('a planner-only item survives', s.pantry.chicken.g, 400);
    t.check('and keeps steering the plan', s.pantry.chicken.use);
    t.equal('a food in both keeps the larger weight', s.pantry.rice.g, 250);
    t.check('and keeps the claim on the plan', s.pantry.rice.use);
    t.check('the old stores are gone', s.mustUse === undefined && s.mustQty === undefined);
  }
  {
    const s = migrated({mustUse: ['eggs'], mustQty: {}});
    t.equal('a must-use with no stated weight becomes vague', s.pantry.eggs.g, 0);
    t.check('but still steers the plan', s.pantry.eggs.use);
  }
  {
    const s = migrated({pantry: {rice: {g: 120, use: true}}});
    t.equal('re-running over merged data is harmless', s.pantry.rice.g, 120);
    t.check('and preserves the mark', s.pantry.rice.use);
  }

  t.section('what the planner is allowed to build around');
  {
    const m = model({rice:{g:400, use:true}, oats:{g:300, use:false}, eggs:{g:0, use:true}});
    const keys = m.planPantryKeys().sort();
    t.equal('only items marked to use up', keys.join(','), 'eggs,rice');
    m.state.pantryUse = false;
    t.equal('and nothing at all when the switch is off', m.planPantryKeys().length, 0);
  }

  t.section('subtracting from the shopping list');
  {
    const m = model({rice:{g:400, use:false}, oats:{g:0, use:false}});
    const plenty = m.shopLine({key:'rice'}, 300);
    t.check('enough on hand covers the line', plenty.covered);
    t.equal('and leaves nothing to buy', plenty.buy, 0);

    const partial = m.shopLine({key:'rice'}, 1000);
    t.check('a partial holding does not cover it', !partial.covered);
    t.equal('and buys only the difference', partial.buy, 600);

    /* The whole point of keeping "some" distinct from a weight: an amount
       nobody has stated must never be subtracted. */
    const vague = m.shopLine({key:'oats'}, 500);
    t.check('an unstated amount is reported', vague.vague);
    t.check('but never covers the line', !vague.covered);
    t.equal('and buys the full amount', vague.buy, 500);

    const none = m.shopLine({key:'salmon'}, 200);
    t.equal('an unowned food buys everything', none.buy, 200);
    t.check('and is not reported as vague', !none.vague);
  }

  t.section('writing');
  {
    const m = model({});
    m.pantryPut('rice', 400, true);
    t.equal('a weight is stored', m.pantryGrams('rice'), 400);
    t.check('with its mark', m.pantryWanted('rice'));

    // editing a weight on the shopping list must not silently re-plan the day
    m.pantryPut('rice', 200);
    t.equal('re-weighing updates the grams', m.pantryGrams('rice'), 200);
    t.check('and leaves the mark alone', m.pantryWanted('rice'));

    m.setPantryUse('rice', false);
    t.check('the mark can be cleared on its own', !m.pantryWanted('rice'));
    t.equal('without touching the weight', m.pantryGrams('rice'), 200);

    m.pantryPut('eggs', 0, true);
    t.check('something owned without a weight is vague', m.pantryVague('eggs'));
    t.check('and still owned', m.pantryHas('eggs'));

    // the shopping editor's field: clearing it means gone, not mysterious
    m.setPantryGrams('rice', 0);
    t.check('clearing a weight on the list drops the food', !m.pantryHas('rice'));

    m.pantryDrop('eggs');
    t.check('dropping removes it', !m.pantryHas('eggs'));
  }

  t.section('eating out of the pantry');
  {
    const m = model({chicken:{g:500, use:false}});
    const entry = {_food:'chicken', _grams:200};
    t.equal('a logged meal takes what it ate', m.pantryTakeForEntry(entry), 200);
    t.equal('and the shelf drops by that much', m.pantryGrams('chicken'), 300);
    t.equal('the take is recorded on the row', entry._pantryTook, 200);
  }
  {
    /* The prep already took its ingredients out at cook time. Charging the
       pantry again when the food is eaten would bill one purchase twice. */
    const m = model({chicken:{g:500, use:false}});
    const planned = {_food:'chicken', _grams:200, _fromPlan:true};
    t.equal('a meal copied from the prep plan takes nothing',
      m.pantryTakeForEntry(planned), 0);
    t.equal('and leaves the shelf alone', m.pantryGrams('chicken'), 500);
    t.check('and records no take', planned._pantryTook === undefined);
  }
  {
    // eating something you never recorded owning must not invent a debt
    const m = model({});
    const entry = {_food:'salmon', _grams:200};
    t.equal('food outside the pantry takes nothing', m.pantryTakeForEntry(entry), 0);
    t.check('and stays out of the pantry', !m.pantryHas('salmon'));
  }
  {
    // eating more than you had empties the shelf rather than going negative
    const m = model({chicken:{g:150, use:false}});
    const entry = {_food:'chicken', _grams:400};
    t.equal('a take is capped at what was held', m.pantryTakeForEntry(entry), 150);
    t.check('which empties it', !m.pantryHas('chicken'));
  }
  {
    /* An amount stated as "some" is not a number to subtract from, so it is
       left alone rather than guessed at. */
    const m = model({oats:{g:0, use:false}});
    const entry = {_food:'oats', _grams:80};
    t.equal('an unweighed holding is not depleted', m.pantryTakeForEntry(entry), 0);
    t.check('and stays in the pantry', m.pantryVague('oats'));
  }

  t.section('handing it back');
  {
    const m = model({chicken:{g:500, use:false}});
    const entry = {_food:'chicken', _grams:200};
    m.pantryTakeForEntry(entry);
    t.equal('deleting the row returns what it took',
      m.pantryReturnForEntry(entry), 200);
    t.equal('restoring the shelf exactly', m.pantryGrams('chicken'), 500);
    t.check('and clearing the record', entry._pantryTook === undefined);
    t.equal('returning twice gives nothing back', m.pantryReturnForEntry(entry), 0);
    t.equal('so the shelf cannot be inflated', m.pantryGrams('chicken'), 500);
  }
  {
    // the row that emptied a food brings it back when deleted
    const m = model({chicken:{g:200, use:false}});
    const entry = {_food:'chicken', _grams:200};
    m.pantryTakeForEntry(entry);
    t.check('a fully-eaten food leaves the pantry', !m.pantryHas('chicken'));
    m.pantryReturnForEntry(entry);
    t.equal('and comes back when the row goes', m.pantryGrams('chicken'), 200);
  }
  {
    /* Correcting 500g to 50g must cost the pantry 50, not 550. */
    const m = model({chicken:{g:600, use:false}});
    const wrong = {_food:'chicken', _grams:500};
    m.pantryTakeForEntry(wrong);
    m.pantryReturnForEntry(wrong);
    const right = {_food:'chicken', _grams:50};
    m.pantryTakeForEntry(right);
    t.equal('re-weighing a row charges only the new amount',
      m.pantryGrams('chicken'), 550);
  }
  {
    // a take made against a holding that later became vague stays out of it
    const m = model({rice:{g:300, use:false}});
    const entry = {_food:'rice', _grams:100};
    m.pantryTakeForEntry(entry);
    m.pantryPut('rice', 0);
    t.equal('nothing is added back to an unweighed holding',
      m.pantryReturnForEntry(entry), 0);
    t.check('which stays unweighed', m.pantryVague('rice'));
  }

  t.section('the shopping cycle');
  {
    /* The loop the pantry exists to close: you hold some of what the prep
       needs, buy only the shortfall, and the cook then takes the whole amount
       back out of a shelf that can actually cover it. */
    const state = {pantry:{chicken:{g:500, use:false}, rice:{g:250, use:false}}, pantryUse:true};
    const ctx = loadFunctions('26-shopping-pantry.js',
      MODEL.concat(['pantryReplenishFromList','deductPrepFromPantry']), {
        state, saveState(){},
        shoppingMultiplier: () => 1,
        aggregateIngredients: () => ({
          chicken: {food:{key:'chicken', name:'Chicken'}, slot:'protein', grams:1050},
          rice:    {food:{key:'rice',    name:'Rice'},    slot:'carb',    grams:600},
        }),
      });

    t.equal('the list asks only for the shortfall',
      ctx.shopLine({key:'chicken'}, 1050).buy, 550);

    const bought = ctx.pantryReplenishFromList();
    t.equal('buying it stocks two items', bought.items, 2);
    t.equal('chicken is topped up to what the prep needs',
      ctx.pantryGrams('chicken'), 1050);
    t.equal('and rice with it', ctx.pantryGrams('rice'), 600);

    ctx.deductPrepFromPantry();
    t.check('cooking then takes the whole amount back out', !ctx.pantryHas('chicken'));
    t.check('leaving nothing behind for either', !ctx.pantryHas('rice'));
  }
  {
    /* A prep is a slice of the pantry, not the whole of it. Whatever the plan
       never mentioned has to survive the cook untouched. */
    const state = {pantry:{chicken:{g:1200, use:false}, coffee:{g:400, use:false}}, pantryUse:true};
    const ctx = loadFunctions('26-shopping-pantry.js',
      MODEL.concat(['deductPrepFromPantry']), {
        state, saveState(){},
        shoppingMultiplier: () => 1,
        aggregateIngredients: () => ({
          chicken: {food:{key:'chicken', name:'Chicken'}, slot:'protein', grams:1050},
        }),
      });
    ctx.deductPrepFromPantry();
    t.equal('the cook takes only what the prep used', ctx.pantryGrams('chicken'), 150);
    t.equal('food the prep never mentioned is untouched', ctx.pantryGrams('coffee'), 400);
  }

  t.section('scanning a packet in');
  {
    const {packGrams, slotForScannedFood} = loadFunctions('46-pantry.js',
      ['packGrams', 'slotForScannedFood'], {});

    t.equal('a plain gram weight', packGrams('500 g'), 500);
    t.equal('kilos become grams', packGrams('1.5 kg'), 1500);
    t.equal('no space needed', packGrams('250g'), 250);
    t.equal('a comma decimal', packGrams('1,5 kg'), 1500);
    t.equal('a multipack multiplies out', packGrams('6 x 40 g'), 240);
    t.equal('and with a times sign', packGrams('4 × 125 g'), 500);

    /* Anything it cannot be certain of is refused. A wrong weight here goes
       into an inventory the shopping list trusts; a refused one costs the
       person one tap. */
    t.equal('a drained weight is refused', packGrams('500 g drained'), 0);
    t.equal('millilitres are not grams', packGrams('500 ml'), 0);
    t.equal('a bare count says nothing', packGrams('6 pack'), 0);
    t.equal('freehand is refused', packGrams('one large tub'), 0);
    t.equal('empty is refused', packGrams(''), 0);
    t.equal('missing is refused', packGrams(undefined), 0);

    // the slot comes from whichever macro carries the most of the calories
    t.equal('a protein product', slotForScannedFood({protein:25, carbs:2, fat:3}), 'protein');
    t.equal('a carb product', slotForScannedFood({protein:7, carbs:70, fat:2}), 'carb');
    t.equal('a fat product', slotForScannedFood({protein:1, carbs:1, fat:80}), 'fat');
    /* Fat carries 9 kcal a gram against carbohydrate's 4, so this is a fat
       product despite having more grams of carbohydrate in it. */
    t.equal('calories decide, not grams',
      slotForScannedFood({protein:2, carbs:20, fat:15}), 'fat');
    t.equal('a product with no macros is a side',
      slotForScannedFood({protein:0, carbs:0, fat:0}), 'veg');
  }
  {
    /* Open Food Facts often repeats the brand inside the product name, and
       "Nutella (Nutella)" is a worse label than "Nutella". */
    const {productLabel} = loadFunctions('36-slot-scan.js', ['productLabel'], {});
    t.equal('a brand that adds nothing is dropped',
      productLabel({name:'Nutella', brand:'Nutella'}), 'Nutella');
    t.equal('and dropped case-insensitively',
      productLabel({name:'Nutella', brand:'NUTELLA'}), 'Nutella');
    t.equal('a brand already inside the name is dropped',
      productLabel({name:'Coca-Cola Zero', brand:'Coca-Cola'}), 'Coca-Cola Zero');
    t.equal('a brand that adds something is kept',
      productLabel({name:'Pain de mie', brand:'Harrys'}), 'Pain de mie (Harrys)');
    t.equal('no brand, no brackets',
      productLabel({name:'Pain de mie', brand:''}), 'Pain de mie');
  }

  t.section('portion ceilings');
  {
    const state = {
      pantry: {chicken:{g:400, use:true}, rice:{g:200, use:false}},
      pantryUse: true,
      selections: {
        breakfast: {protein:['chicken'], carb:[]},
        dinner:    {protein:['chicken'], carb:['rice']},
      },
    };
    const ctx = loadFunctions('26-shopping-pantry.js', MODEL, {state, saveState(){}});
    Object.assign(ctx, {
      MEALS: [{key:'breakfast'}, {key:'dinner'}],
      SLOT_DEFS: [{slot:'protein'}, {slot:'carb'}],
    });
    const {onHandCapFor} = loadFunctions('23-suggested-loadout.js', ['onHandCapFor'], ctx);

    t.equal('a stated amount splits across the meals using it',
      onHandCapFor('chicken'), 200);
    t.check('food you merely own is never capped', onHandCapFor('rice') === null);
    state.pantryUse = false;
    t.check('and nothing is capped with the switch off', onHandCapFor('chicken') === null);
  }
});
