'use strict';
/* ============================================================
   LOADOUT - WEEKLY CHECK-IN

   One week at a glance, at the top of Progress: how many days were logged,
   what they averaged against the target, where the weight trend went, and
   what moved — steps, water, sessions. Monday to Sunday, the same week the
   calendar draws, with arrows to look back.

   Averages are over the days that were actually logged. A day with nothing
   in it is a day that was not recorded, not a day nothing was eaten, and
   averaging it in as zero would make every half-logged week look like a
   crash diet.
   ============================================================ */

  let checkinOffset = 0;           // 0 = this week, 1 = last week, ...

  function keyOf(d){
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function weekKeys(offset){
    const now = new Date();
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7) - offset * 7);
    return Array.from({length: 7}, (_, i) => keyOf(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)));
  }

  /* The trend value on or before a day, from the weight module's series. */
  function trendAt(key){
    if (typeof weightTrend !== 'function') return null;
    const t = weightTrend().filter(p => p.key <= key);
    return t.length ? t[t.length - 1].trend : null;
  }

  function weekStats(offset){
    const keys = weekKeys(offset);
    const today = keyOf(new Date());
    const past = keys.filter(k => k <= today);
    const logged = past.filter(k => dayTotals(k).items > 0);
    const avg = f => logged.length ? logged.reduce((a, k) => a + dayTotals(k)[f], 0) / logged.length : null;
    const tg = (typeof currentTargets === 'function') ? currentTargets() : {kcal: 0, protein: 0};
    const steps = past.map(k => (typeof stepsOn === 'function') ? stepsOn(k) : null).filter(v => v != null && v > 0);
    const water = past.map(k => (typeof waterOn === 'function') ? waterOn(k) : 0).filter(v => v > 0);
    const sessions = past.reduce((a, k) => a + ((typeof workoutsOn === 'function') ? workoutsOn(k).length : 0), 0);
    const startTrend = trendAt(keyOf(new Date(+new Date(keys[0] + 'T00:00') - 864e5)));
    const endTrend = trendAt(past[past.length - 1] || keys[0]);
    return {
      keys, past, logged: logged.length,
      kcal: avg('kcal'), protein: avg('protein'), target: tg,
      steps: steps.length ? steps.reduce((a, b) => a + b, 0) / steps.length : null,
      water: water.length ? water.reduce((a, b) => a + b, 0) / water.length : null,
      sessions,
      weight: (startTrend != null && endTrend != null) ? endTrend - startTrend : null,
    };
  }

  function renderCheckin(){
    const host = document.getElementById('checkinPanel');
    if (!host) return;
    const w = weekStats(checkinOffset);
    const p = w.keys[0].split('-').map(Number), start = new Date(p[0], p[1] - 1, p[2]);
    const label = checkinOffset === 0 ? 'This week' : checkinOffset === 1 ? 'Last week'
      : 'Week of ' + ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][start.getMonth()] + ' ' + start.getDate();
    const imperial = (state.units || 'imperial') === 'imperial';
    const wt = w.weight == null ? null : imperial ? w.weight : w.weight / 2.2046226218;
    const wu = imperial ? 'lb' : 'kg';
    const pct = (got, want) => (got != null && want) ? Math.round(got / want * 100) + '% of target' : '';
    const tile = (val, label, sub) => `<div class="ci-tile"><strong>${val}</strong><span>${label}</span>${sub ? `<small>${sub}</small>` : ''}</div>`;
    const commas = n => Math.round(n).toLocaleString();
    host.innerHTML = `<div class="panel ci">
      <div class="ci-head">
        <button class="ci-nav" data-ci="1" aria-label="Previous week">‹</button>
        <span class="ci-title">${label}</span>
        <button class="ci-nav" data-ci="-1" aria-label="Next week"${checkinOffset ? '' : ' disabled'}>›</button>
      </div>
      <div class="ci-grid">
        ${tile(w.logged + '<em>/' + w.past.length + '</em>', 'days logged',
               w.sessions ? w.sessions + ' workout' + (w.sessions === 1 ? '' : 's') : '')}
        ${tile(w.kcal == null ? '—' : commas(w.kcal), 'kcal a day', pct(w.kcal, w.target.kcal))}
        ${tile(w.protein == null ? '—' : commas(w.protein) + '<em>g</em>', 'protein a day', pct(w.protein, w.target.protein))}
        ${tile(wt == null ? '—' : (wt > 0 ? '+' : wt < 0 ? '−' : '') + Math.abs(wt).toFixed(1) + '<em>' + wu + '</em>', 'weight trend', '')}
        ${tile(w.steps == null ? '—' : commas(w.steps), 'steps a day', '')}
        ${tile(w.water == null || typeof waterUnits !== 'function' ? '—'
               : waterUnits().show(w.water) + '<em>' + waterUnits().unit + '</em>', 'water a day', '')}
      </div>
    </div>`;
    host.querySelectorAll('[data-ci]').forEach(b => b.addEventListener('click', ()=>{
      checkinOffset = Math.max(0, checkinOffset + parseInt(b.getAttribute('data-ci'), 10));
      renderCheckin();
    }));
  }
