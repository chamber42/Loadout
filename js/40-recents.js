'use strict';
/* ============================================================
   LOADOUT - WHAT YOU ACTUALLY EAT

   There were three ways into the journal — a barcode, a search of the
   library, and a blank row — and none of them was the one people reach for
   most. Nearly everybody eats the same dozen things most weeks, and every
   one of those dozen had to be found again from scratch each time.

   This ranks what a person has actually logged and puts it in front of the
   search box, so the common case is a tap instead of a search. Nothing new
   is stored: the ranking is computed from state.log, which has been
   recording exactly this all along.

   RANKED BY BOTH HABIT AND RECENCY

   A plain count would be wrong. Something eaten every day last spring and
   never since would sit above what someone has had all week, and the list
   would slowly calcify into a record of who they used to be. Each use is
   therefore worth less the older it is, halving about every three weeks, so
   the list follows a person as their eating changes without forgetting a
   habit over a quiet fortnight.
   ============================================================ */

  /* How long a single use takes to count for half as much. Three weeks is
     long enough that a holiday does not wipe someone's staples off the
     list, and short enough that going vegetarian shows up inside a month. */
  const RECENT_HALF_LIFE_DAYS = 21;

  /* Enough to cover a person's staples without turning the top of the
     picker into a second list to search. */
  const RECENT_LIMIT = 12;

  /* Older than this and it is not a habit any more, it is history. Also
     keeps the scan bounded on a log with years in it. */
  const RECENT_WINDOW_DAYS = 120;

  /* One logged entry, reduced to the thing that identifies it across days.

     A library food is keyed by its own key, so chicken breast at 150g and
     at 200g are the same item ranked together — the amount is remembered
     separately, from the most recent use. Anything else falls back to its
     name, which is what a scanned product or a typed row has. */
  function recentKeyFor(entry){
    if (!entry) return null;
    if (entry._food) return 'food:' + entry._food;
    if (entry._foodData && entry._foodData.name) return 'data:' + entry._foodData.name;
    if (entry.name){
      /* The name carries the amount — "Chicken breast — 150 g" — and the
         amount is not part of what the thing IS. */
      return 'name:' + String(entry.name).split('—')[0].trim().toLowerCase();
    }
    return null;
  }

  /* The person's own foods, best first.

     Each returns either a food that can go through the picker's normal
     amount step, or a plain entry to be copied verbatim — a typed row has
     no per-100g table behind it, so there is nothing to re-scale and the
     honest thing is to log it exactly as it was logged before. */
  function journalRecents(limit){
    if (typeof state === 'undefined' || !state.log) return [];

    const today = todayKey();
    const scored = new Map();

    Object.keys(state.log).forEach(dayKey => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return;
      const age = daysBetweenKeys(dayKey, today);
      if (age < 0 || age > RECENT_WINDOW_DAYS) return;
      const weight = Math.pow(0.5, age / RECENT_HALF_LIFE_DAYS);

      const meals = (state.log[dayKey] || {}).meals || {};
      Object.values(meals).forEach(list => {
        (list || []).forEach(entry => {
          const k = recentKeyFor(entry);
          if (!k) return;
          const prev = scored.get(k);
          if (prev){
            prev.score += weight;
            prev.uses++;
            /* The most recent use is the one whose amount to reopen on:
               someone who moved from 150g to 200g of rice means the 200. */
            if (dayKey >= prev.lastDay){ prev.lastDay = dayKey; prev.entry = entry; }
          } else {
            scored.set(k, {key: k, score: weight, uses: 1, lastDay: dayKey, entry: entry});
          }
        });
      });
    });

    const index = (typeof foodIndex === 'function') ? foodIndex() : [];
    const byKey = new Map();
    index.forEach(x => { if (x.food && x.food.key) byKey.set(x.food.key, x); });

    return Array.from(scored.values())
      .sort((a, b) => b.score - a.score || (a.lastDay < b.lastDay ? 1 : -1))
      .map(r => {
        const e = r.entry;
        const hit = e._food ? byKey.get(e._food) : null;
        if (hit){
          return {kind: 'food', label: hit.food.name, icon: hit.icon,
                  pick: hit, grams: e._grams || null, uses: r.uses};
        }
        if (e._foodData){
          return {kind: 'food', label: e._foodData.name, icon: 'barcode',
                  pick: {food: e._foodData, slot: 'protein'},
                  grams: e._grams || null, uses: r.uses};
        }
        /* Everything else — a typed row, and also a library food whose key
           no longer resolves because the food was retired from the app —
           is copied exactly as it was logged. The entry still carries its
           own calories and macros, so it can be logged again perfectly
           well; dropping it would quietly lose something the person ate
           regularly for no better reason than that the library moved on. */
        return {kind: 'entry', label: String(e.name || '').split('—')[0].trim(),
                icon: 'plus', entry: e, uses: r.uses};
      })
      /* What genuinely cannot be offered: no food behind it AND nothing to
         copy. A row that logs nothing is worse than no row. */
      .filter(r => r.kind === 'food'
                 ? !!(r.pick && r.pick.food)
                 : !!(r.label && r.entry && r.entry.kcal != null))
      .slice(0, limit || RECENT_LIMIT);
  }

  window.journalRecents = journalRecents;
  window.RECENT_LIMIT   = RECENT_LIMIT;
