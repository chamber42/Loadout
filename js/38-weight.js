'use strict';
/* ============================================================
   LOADOUT - WEIGHT HISTORY AND TREND

   state.bodyweight is what the character weighs NOW — one number, read by
   the TDEE maths, the protein targets and the portion sizing. It is
   overwritten every time someone corrects it, which means the app has
   never been able to answer the only question a person on a cut actually
   asks: is this working?

   This file adds the series behind that number. state.weights maps a day
   key to a reading; state.bodyweight stays exactly what it was and stays
   the single value everything else reads, so nothing downstream changes.

   WHY A TREND AND NOT THE READINGS

   Day-to-day scale movement is mostly water, gut contents and glycogen —
   several pounds of noise around a signal of maybe half a pound a week.
   Read raw, yesterday's number says nothing and frequently says the
   opposite of the truth. An exponentially-weighted moving average is the
   standard answer: it carries every past reading at a decaying weight, so
   one heavy morning after a salty dinner moves it slightly instead of
   moving it entirely.

   The smoothing is gap-aware. Someone who weighs in daily and someone who
   weighs in on Mondays should get the same trend line through the same
   underlying body, so the weight given to a new reading grows with the
   number of days since the last one rather than being fixed per sample.
   A fixed alpha would make the once-a-week weigher's trend lag a month
   behind their body.
   ============================================================ */

  /* One day's worth of pull toward a new reading. 0.10 gives a time
     constant near ten days — long enough to swallow a bad morning, short
     enough to show a real change inside a fortnight. */
  const WEIGHT_ALPHA = 0.10;

  /* Below this many readings a trend is arithmetic, not evidence: the EWMA
     is still sitting on top of its seed value and says little more than
     "this is what you weighed". Reported as null rather than as a number
     that looks more certain than it is. */
  const TREND_MIN_READINGS = 3;

  function weightKeyToDate(key){
    const [y,m,d] = String(key).split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function daysBetweenKeys(a, b){
    return Math.round((weightKeyToDate(b) - weightKeyToDate(a)) / 86400000);
  }

  /* Every reading, oldest first, from both places one can come from.

     state.weights holds what the person entered in Loadout. state.healthWeights
     holds what was last read out of the Health app — a connected scale, or a
     weigh-in typed into Health itself. They are kept apart rather than merged
     on import so that neither can quietly overwrite the other: re-reading
     Health refreshes its own map wholesale, and a correction made in Health
     therefore reaches the trend, while nothing the person typed here is ever
     touched by it.

     Where both hold the same day, the Loadout entry wins. Someone who typed
     a figure into this app meant that figure; a scale reading is the better
     default but the worse override.

     Guards against a saved file holding something non-numeric — a hand-edited
     backup, or a key written by a future version — since one bad entry would
     otherwise take the whole trend with it. */
  function weightSeries(){
    if (typeof state === 'undefined') return [];
    const health = state.healthWeights || {};
    const own    = state.weights || {};
    const raw = {};
    Object.keys(health).forEach(k => { raw[k] = health[k]; });
    Object.keys(own).forEach(k => { raw[k] = own[k]; });   // typed beats measured
    return Object.keys(raw)
      .filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k) && typeof raw[k] === 'number' &&
                   isFinite(raw[k]) && raw[k] > 0)
      .sort()
      .map(k => ({key: k, lb: raw[k]}));
  }

  /* The series with a trend value attached to each reading.

     The effective alpha for a gap of d days is 1 - (1 - alpha)^d, which is
     exactly what would happen if the same reading were repeated on each of
     those days — the honest way to say "we have not heard anything for a
     while, so weight this more". */
  function weightTrend(){
    const series = weightSeries();
    if (!series.length) return [];
    let trend = series[0].lb;
    return series.map((pt, i) => {
      if (i > 0){
        const gap = Math.max(1, daysBetweenKeys(series[i-1].key, pt.key));
        const a = 1 - Math.pow(1 - WEIGHT_ALPHA, gap);
        trend = trend + a * (pt.lb - trend);
      }
      return {key: pt.key, lb: pt.lb, trend: trend};
    });
  }

  /* Today's smoothed weight, or null when there is not enough to smooth. */
  function trendWeightNow(){
    const t = weightTrend();
    if (t.length < TREND_MIN_READINGS) return null;
    return t[t.length - 1].trend;
  }

  /* Pounds per week.

     Fitted by least squares straight through the RAW readings, not measured
     across the trend line — and the difference is not cosmetic.

     An exponentially-weighted average lags what it is smoothing, by roughly
     (1 - alpha) / alpha days: about nine here. Its first point, though, is
     seeded exactly on the first reading and lags nothing. So the line starts
     pinned to the truth and falls progressively behind it, and its slope is
     shallower than the real one by about a third. Reading a rate off it
     would quietly report a 1.0 lb/week cut as 0.7 — an error in the
     flattering direction, and one that would go straight into the
     expenditure maths and hand back a calorie target that is too high.

     Least squares has no such lag: under a steady trend plus symmetric
     scale noise it is unbiased, and it uses every reading rather than the
     two at the ends. The smoothed line is still the right thing to DRAW —
     it is robust and it is the shape people recognise — but it is the wrong
     thing to differentiate.

     Returns null rather than zero when the window is too thin to say
     anything. A rate fitted through four readings over five days is mostly
     a description of what the scale did, and presenting it as a weekly
     figure invites someone to change their plan over noise. */
  const RATE_MIN_DAYS = 14;
  const RATE_MIN_READINGS = 5;

  function weightRatePerWeek(days){
    const window = days || 28;
    const series = weightSeries();
    if (series.length < RATE_MIN_READINGS) return null;

    const lastKey = series[series.length - 1].key;
    const pts = series.filter(p => daysBetweenKeys(p.key, lastKey) <= window);
    if (pts.length < RATE_MIN_READINGS) return null;

    const span = daysBetweenKeys(pts[0].key, lastKey);
    if (span < RATE_MIN_DAYS) return null;

    const xs = pts.map(p => daysBetweenKeys(pts[0].key, p.key));
    const ys = pts.map(p => p.lb);
    const n  = pts.length;
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = ys.reduce((a, b) => a + b, 0) / n;

    let num = 0, den = 0;
    for (let i = 0; i < n; i++){
      num += (xs[i] - mx) * (ys[i] - my);
      den += (xs[i] - mx) * (xs[i] - mx);
    }
    if (den <= 0) return null;          // every reading on one day

    return (num / den) * 7;
  }

  /* Record a reading and keep state.bodyweight in step with it.

     Both directions matter. The series is what the trend and the
     expenditure maths read; state.bodyweight is what every existing
     calculation reads, and it has to stay the current figure or the
     targets drift away from the person. */
  function recordWeight(lb, key){
    if (typeof state === 'undefined') return false;
    const n = parseFloat(lb);
    if (!(n > 0) || n > 1000) return false;
    const day = key || todayKey();
    state.weights = state.weights || {};
    state.weights[day] = Math.round(n * 10) / 10;
    /* Only the most recent reading defines "now". Correcting last Tuesday's
       entry should fix the history without rewriting what the character
       currently weighs. */
    const series = weightSeries();
    if (series.length && series[series.length - 1].key === day){
      state.bodyweight = state.weights[day];
    }
    return true;
  }

  /* Clears what the person typed for a day. If Health holds a reading for
     the same day it reappears, which is the truthful answer — deleting your
     own note about Tuesday does not mean the scale never saw you. */
  function forgetWeight(key){
    if (typeof state === 'undefined' || !state.weights) return;
    delete state.weights[key];
  }

  /* ---------------------------------------------------------
     THE CHART

     Raw readings as dots, the trend as a line through them. Both are
     needed: the dots are what the person saw on the scale and will look
     for, and the line is the part that means anything. Drawn as inline SVG
     against the theme's own variables, the same way the build-shape radar
     on this screen already is.
     --------------------------------------------------------- */
  const WEIGHT_CHART_DAYS = 120;

  function renderWeightChart(host){
    const all = weightTrend();
    if (!all.length){ host.innerHTML = ''; return false; }

    const lastKey = all[all.length - 1].key;
    let pts = all.filter(p => daysBetweenKeys(p.key, lastKey) <= WEIGHT_CHART_DAYS);
    if (pts.length < 2){ host.innerHTML = ''; return false; }

    const W = 280, H = 132, padL = 30, padR = 8, padT = 10, padB = 18;
    const firstDay = weightKeyToDate(pts[0].key).getTime();
    const lastDay  = weightKeyToDate(lastKey).getTime();
    const spanMs   = Math.max(1, lastDay - firstDay);

    /* The chart is drawn in whichever unit is on screen. Converting here
       rather than at each use keeps the gridline figures, the dots and the
       trend line in one unit and unable to disagree. */
    const conv = lb => (typeof showWeight === 'function' && typeof isMetric === 'function')
      ? showWeight(lb, 1) : lb;
    pts = pts.map(p => ({key: p.key, lb: conv(p.lb), trend: conv(p.trend)}));

    const values = pts.map(p => p.lb).concat(pts.map(p => p.trend));
    let lo = Math.min.apply(null, values), hi = Math.max.apply(null, values);
    /* A flat fortnight would otherwise collapse to a single row of pixels
       and read as missing data. Open the scale to at least four pounds so a
       genuinely steady weight looks steady rather than broken. */
    const mid = (lo + hi) / 2;
    const floorSpan = (typeof isMetric === 'function' && isMetric()) ? 2 : 4;
    if (hi - lo < floorSpan){ lo = mid - floorSpan / 2; hi = mid + floorSpan / 2; }
    const padY = (hi - lo) * 0.12;
    lo -= padY; hi += padY;

    const x = key => padL + (weightKeyToDate(key).getTime() - firstDay) / spanMs * (W - padL - padR);
    const y = lb  => padT + (hi - lb) / (hi - lo) * (H - padT - padB);

    /* Three gridlines with their weights, so the chart can be read as
       numbers and not only as a shape. */
    const grid = [0, 0.5, 1].map(f => {
      const lb = lo + (hi - lo) * f;
      const yy = y(lb).toFixed(1);
      return `<line x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}"
                    stroke="var(--line)" stroke-width="1"/>
              <text x="${padL - 5}" y="${+yy + 3}" text-anchor="end"
                    class="wt-axis">${Math.round(lb)}</text>`;
    }).join('');

    const dots = pts.map(p =>
      `<circle cx="${x(p.key).toFixed(1)}" cy="${y(p.lb).toFixed(1)}" r="1.9"
               fill="var(--line)"/>`).join('');

    const line = pts.map(p => `${x(p.key).toFixed(1)},${y(p.trend).toFixed(1)}`).join(' ');

    const endX = x(lastKey).toFixed(1);
    const endY = y(pts[pts.length - 1].trend).toFixed(1);

    host.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" class="wt-chart" role="img"
           aria-label="Weight over the last ${WEIGHT_CHART_DAYS} days: readings and smoothed trend">
        ${grid}${dots}
        <polyline points="${line}" fill="none" stroke="var(--cyan)"
                  stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>
        <circle cx="${endX}" cy="${endY}" r="3.2" fill="var(--cyan)"/>
      </svg>`;
    return true;
  }

  /* ---------------------------------------------------------
     THE PANEL
     --------------------------------------------------------- */

  function weightRateLine(){
    const rate = weightRatePerWeek();
    if (rate == null) return '';
    const per = Math.abs(rate);
    /* Under a tenth of a pound a week is not a direction, it is the trend
       failing to move. Saying "losing 0.02 lb a week" would dress noise up
       as progress. */
    if (typeof rateText === 'function') return rateText(rate);
    return per < 0.1 ? 'Holding steady'
         : (rate < 0 ? 'Down' : 'Up') + ' ' + per.toFixed(1) + ' lb a week';
  }

  /* Whether the measured direction agrees with what the person asked for.
     Stated plainly, without praise or scolding — the number is the message. */
  function weightGoalLine(){
    const rate = weightRatePerWeek();
    if (rate == null || typeof state === 'undefined' || !state.goal) return '';
    const per = Math.abs(rate);
    if (per < 0.1) return state.goal === 'maintain' ? 'On target.' : 'Not moving yet.';
    const losing = rate < 0;
    if (state.goal === 'maintain') return 'Drifting.';
    const wantsLoss = state.goal === 'loss' || state.goal === 'extreme_loss';
    if (wantsLoss !== losing) return 'Going the wrong way.';
    return 'On target.';
  }

  function renderWeightPanel(){
    const panel = document.getElementById('sheetWeightPanel');
    const host  = document.getElementById('sheetWeight');
    if (!panel || !host) return;

    const series = weightSeries();
    const trend  = trendWeightNow();
    const todayLogged = series.length && series[series.length - 1].key === todayKey();

    const wb = (typeof weightBounds === 'function') ? weightBounds() : {min:60, max:600};
    const unitLbl = (typeof weightUnitLabel === 'function') ? weightUnitLabel() : 'lb';
    const showWeightIn = lb => (typeof showWeight === 'function') ? showWeight(lb, 1) : lb;

    const chartHost = '<div id="sheetWeightChart"></div>';
    const rate = weightRateLine();
    const verdict = weightGoalLine();

    host.innerHTML =
      chartHost +
      (trend != null
        ? `<div class="vital vital-wide">
             <span class="vital-lbl">Trend</span>
             <span class="vital-edit"><strong>${(typeof showWeight === 'function' ? showWeight(trend, 1) : trend).toFixed(1)}</strong><span class="vital-unit">${typeof weightUnitLabel === 'function' ? weightUnitLabel() : 'lb'}</span></span>
           </div>`
        : '') +
      (rate
        ? `<div class="vital vital-wide">
             <span class="vital-lbl">${escapeHtml(rate)}</span>
             <span class="vital-edit"><strong class="${verdict === 'On target.' ? 'n-green' : ''}">${escapeHtml(verdict)}</strong></span>
           </div>`
        : '') +
      `<div class="vital vital-wide">
         <span class="vital-lbl">Today</span>
         <span class="vital-edit">
           <input type="number" id="weighInToday" inputmode="decimal" step="0.1"
                  min="${wb.min}" max="${wb.max}" placeholder="—"
                  value="${todayLogged ? showWeightIn(series[series.length-1].lb) : ''}"
                  aria-label="Today's weight in ${unitLbl}">
           <span class="vital-unit">${unitLbl}</span>
         </span>
       </div>
       <div id="sheetWeightHealth"></div>`;

    const chart = document.getElementById('sheetWeightChart');
    if (chart) renderWeightChart(chart);

    const input = document.getElementById('weighInToday');
    if (input){
      input.addEventListener('change', ()=>{
        const typed = parseFloat(input.value);
        /* Typed in whatever unit is on screen; recordWeight stores pounds. */
        const v = (typeof storeWeight === 'function') ? storeWeight(typed) : typed;
        if (input.value === ''){ forgetWeight(todayKey()); }
        else if (!recordWeight(v)) return;
        if (typeof syncTargets === 'function') syncTargets();
        if (typeof assignTier === 'function') assignTier();
        if (typeof saveState === 'function') saveState();
        renderWeightPanel();
        if (typeof refreshSheetReadouts === 'function') refreshSheetReadouts();
      });
    }
  }

  /* The sheet is drawn by renderTiers, which runs on load and whenever the
     character changes — the same hook the steps panel uses, for the same
     reason: a sheet left open all day should not sit on a stale chart. */
  (function hookWeightPanel(){
    if (typeof window.renderTiers !== 'function') return;
    const original = window.renderTiers;
    window.renderTiers = function(){
      const out = original.apply(this, arguments);
      try{ renderWeightPanel(); }catch(e){ console.error('Loadout: weight panel', e); }
      return out;
    };
  })();

  /* An existing save has a bodyweight and no history at all. Seed the series
     with it so the chart has somewhere to start from, rather than asking
     someone who has been using the app for months to begin from nothing.
     Dated today, because that is the only day it is honestly known for. */
  function seedWeightHistory(){
    if (typeof state === 'undefined') return;
    state.weights = state.weights || {};
    if (Object.keys(state.weights).length) return;
    if (state.bodyweight > 0) state.weights[todayKey()] = state.bodyweight;
  }

  window.weightSeries      = weightSeries;
  window.weightTrend       = weightTrend;
  window.trendWeightNow    = trendWeightNow;
  window.weightRatePerWeek = weightRatePerWeek;
  window.recordWeight      = recordWeight;
  window.seedWeightHistory = seedWeightHistory;
  window.renderWeightPanel = renderWeightPanel;
