'use strict';
/* ============================================================
   LOADOUT - EATING THE SAME THING AGAIN

   The journal could already copy from the prep plan, which answers "what
   was I supposed to eat". It had no answer at all for "the same as
   yesterday", which is how most people actually eat and by far the more
   common case once a prep has run out.

   Two shapes, because two different things get repeated:

     A MEAL — the breakfast someone has had every weekday for a year. Offered
     on an empty sitting, filled from the most recent earlier day that had
     something in that sitting.

     A DAY — Monday's whole log copied onto Thursday. Offered only on a day
     with nothing in it at all, because copying a day over a day already
     half-logged would either duplicate what was there or throw it away, and
     neither is what anybody means by "copy".

   Both look backwards only. Copying from a future day would be copying a
   plan, which is what the prep button already does and a different idea.

   NOTHING IS SHOWN THAT WOULD DO NOTHING

   Every control here is offered only when there is a real day behind it to
   copy from, and it names that day. A button reading "REPEAT FROM TUESDAY"
   needs no explanation; a permanently visible "Repeat" that might or might
   not find something to do would need a sentence under it saying so.
   ============================================================ */

  /* How far back to look for something to repeat. Beyond a few weeks it is
     not "the same as usual" any more, and offering to re-log a meal from
     three months ago is offering to log something the person has probably
     stopped eating. */
  const REPEAT_LOOKBACK_DAYS = 45;

  /* Entries are deep-copied on the way out. A shallow copy would leave the
     new day sharing objects with the old one, so correcting an amount today
     would silently rewrite what the person ate last Tuesday. */
  function cloneEntries(list){
    return (list || []).map(function(it){ return JSON.parse(JSON.stringify(it)); });
  }

  /* Day keys with anything logged, newest first, strictly before `beforeKey`
     and inside the lookback. */
  function loggedDaysBefore(beforeKey){
    if (typeof state === 'undefined' || !state.log) return [];
    return Object.keys(state.log)
      .filter(function(k){
        if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return false;
        if (k >= beforeKey) return false;
        const age = daysBetweenKeys(k, beforeKey);
        return age > 0 && age <= REPEAT_LOOKBACK_DAYS;
      })
      .sort()
      .reverse();
  }

  /* The most recent earlier day that had something in this sitting. */
  function lastMealBefore(mealName, beforeKey){
    const days = loggedDaysBefore(beforeKey);
    for (let i = 0; i < days.length; i++){
      const meals = (state.log[days[i]] || {}).meals || {};
      const items = meals[mealName];
      if (items && items.length) return {key: days[i], items: items};
    }
    return null;
  }

  /* The most recent earlier day with anything at all in it. */
  function lastDayBefore(beforeKey){
    const days = loggedDaysBefore(beforeKey);
    for (let i = 0; i < days.length; i++){
      const t = dayTotals(days[i]);
      if (t.items > 0) return {key: days[i], meals: (state.log[days[i]] || {}).meals || {}};
    }
    return null;
  }

  /* "yesterday", or "Tuesday", or "12 Aug" — whichever a person would
      actually use for a day that far back. */
  function repeatDayLabel(key, fromKey){
    const age = daysBetweenKeys(key, fromKey);
    if (age === 1) return 'yesterday';
    const [y, m, d] = key.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    if (age <= 6) return DOW[mondayIndex(dt)];
    return MONTHS[dt.getMonth()].slice(0, 3) + ' ' + d;
  }

  /* Copies one sitting onto the day being viewed, appending rather than
     replacing — someone repeating a breakfast onto a sitting that already
     has a coffee in it means to have both. */
  function repeatMealInto(mealName, destKey){
    const src = lastMealBefore(mealName, destKey);
    if (!src) return false;
    const log = dayLog(destKey);
    log.meals[mealName] = (log.meals[mealName] || []).concat(cloneEntries(src.items));
    return true;
  }

  /* Copies a whole day. Only ever called on an empty day — see the note at
     the top — so this can assign rather than merge. */
  function repeatDayInto(destKey){
    const src = lastDayBefore(destKey);
    if (!src) return false;
    const log = dayLog(destKey);
    Object.keys(src.meals).forEach(function(mealName){
      const items = src.meals[mealName];
      if (items && items.length) log.meals[mealName] = cloneEntries(items);
    });
    return true;
  }

  window.lastMealBefore   = lastMealBefore;
  window.lastDayBefore    = lastDayBefore;
  window.repeatDayLabel   = repeatDayLabel;
  window.repeatMealInto   = repeatMealInto;
  window.repeatDayInto    = repeatDayInto;
