'use strict';
/* ============================================================
   LOADOUT - THE STREAK

   This app is themed as a game. It has a Quest Log, a character sheet, a
   tier system, attributes drawn as an RPG stat screen, and a shelf of
   themes rendered as games on a shelf. It has had no streak, no milestone
   and nothing to unlock — which made it the one product on the comparison
   list with the theme and none of the mechanics.

   WHAT COUNTS, AND WHY IT IS NOT WHAT YOU MIGHT EXPECT

   The streak counts days you LOGGED, not days you hit your target.

   That distinction is the whole design. A streak that requires hitting a
   deficit punishes rest days, refeeds, birthdays and holidays — all of
   which are normal parts of eating well over a year. Worse, it teaches
   exactly the wrong reflex: on the day someone goes over, the way to
   protect the streak is to stop logging. So the number would be preserved
   by destroying the data, and the days that vanish are the ones most worth
   seeing.

   Rewarding the log inverts that. A day you ate badly and recorded
   honestly extends the streak, because the app got what it needed.

   THE THRESHOLD IS NOT ARBITRARY

   A day counts at dayLevel 2 or better — at least 55% of that day's target
   recorded. That is the same line 39-expenditure.js draws between a real
   day and a half-finished log, deliberately: below it, the far likelier
   explanation is a forgotten dinner, and the expenditure maths refuses to
   average such a day in.

   So the streak is not a decoration sitting next to the numbers. It counts
   exactly the days the expenditure algorithm can actually use, which makes
   it an honest readout of how much good data the app is working from.

   NO FREEZES, NO FORGIVENESS

   Plenty of apps let you buy or earn a pass for a missed day. That is
   engagement engineering, and it makes the number mean less than it
   appears to. A missed day breaks the streak; the best run is kept
   alongside the current one, so a break costs a record rather than
   erasing a year.
   ============================================================ */

  /* The lowest dayLevel that counts as a logged day. Mirrors
     EXP_COMPLETE_FRACTION in 39-expenditure.js — level 2 is exactly
     "at least 55% of target recorded". */
  const STREAK_MIN_LEVEL = 2;

  /* How far back to walk. Long enough for any streak anyone will build,
     bounded so the scan cannot grow without limit on an old log. */
  const STREAK_SCAN_DAYS = 1000;

  function streakDayCounts(key){
    if (typeof dayLevel !== 'function') return false;
    return dayLevel(key) >= STREAK_MIN_LEVEL;
  }

  function streakShift(key, days){
    const d = weightKeyToDate(key);
    d.setDate(d.getDate() + days);
    return d.getFullYear() + '-' +
           String(d.getMonth() + 1).padStart(2, '0') + '-' +
           String(d.getDate()).padStart(2, '0');
  }

  /* The run ending today, or ending yesterday.

     Today is allowed not to count yet. At nine in the morning nobody has
     logged 55% of a day, and showing a streak that reads zero until dinner
     — then jumps back to 41 — would make the number look broken and
     punish someone for the time of day. So the run is measured from
     yesterday, and today extends it the moment it qualifies. */
  function currentStreak(fromKey){
    const today = fromKey || todayKey();
    let cursor = streakDayCounts(today) ? today : streakShift(today, -1);
    let n = 0;
    for (let i = 0; i < STREAK_SCAN_DAYS; i++){
      if (!streakDayCounts(cursor)) break;
      n++;
      cursor = streakShift(cursor, -1);
    }
    return n;
  }

  /* Every logged day, oldest first — the basis for the longest run and for
     the lifetime count. */
  function streakLoggedKeys(){
    if (typeof state === 'undefined' || !state.log) return [];
    return Object.keys(state.log)
      .filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k) && streakDayCounts(k))
      .sort();
  }

  function bestStreak(){
    const keys = streakLoggedKeys();
    if (!keys.length) return 0;
    let best = 1, run = 1;
    for (let i = 1; i < keys.length; i++){
      run = daysBetweenKeys(keys[i-1], keys[i]) === 1 ? run + 1 : 1;
      if (run > best) best = run;
    }
    return best;
  }

  function totalLoggedDays(){ return streakLoggedKeys().length; }

  /* ---------------------------------------------------------
     MILESTONES

     Thresholds rather than points. An XP economy would need a rate to be
     tuned and balanced against nothing in particular; a milestone is
     simply true or not, and each of these marks a point where the app
     genuinely became able to do something it could not do before.
     --------------------------------------------------------- */
  const MILESTONES = [
    {key:'first',   need: 1,   label:'First entry',
     note:'The log starts here.'},
    {key:'week',    need: 7,   label:'A full week',
     note:'Enough to see a pattern rather than a day.'},
    {key:'fortnight', need: 14, label:'Two weeks',
     note:'The shortest run your daily burn can be measured from.'},
    {key:'month',   need: 30,  label:'A month',
     note:'Long enough that the trend is the signal, not the noise.'},
    {key:'quarter', need: 90,  label:'Three months',
     note:'Longer than most people manage with any tracker.'},
    {key:'year',    need: 365, label:'A year',
     note:'Three hundred and sixty-five honest days.'},
  ];

  /* Measured against the LIFETIME count, not the current run. A milestone
     that vanished the moment somebody missed a Tuesday would be a
     punishment dressed as an achievement — the days were still logged, and
     the app still has them. The streak is the thing that can be lost. */
  function milestones(){
    const total = totalLoggedDays();
    const best = bestStreak();
    return MILESTONES.map(m => ({
      key: m.key, label: m.label, note: m.note, need: m.need,
      got: total >= m.need,
      /* Days still to go, for the next one only — see below. */
      short: Math.max(0, m.need - total),
      streakGot: best >= m.need,
    }));
  }

  function nextMilestone(){
    const all = milestones();
    for (let i = 0; i < all.length; i++) if (!all[i].got) return all[i];
    return null;
  }

  /* ---------------------------------------------------------
     THE PANEL — on the Quest Log, where days already appear together
     --------------------------------------------------------- */
  function renderStreak(){
    const host = document.getElementById('questStreak');
    if (!host) return;

    const total = totalLoggedDays();
    if (!total){
      /* Nothing logged: no streak to report, and a zero with an explanation
         under it would be the app talking about itself before it has
         anything to say. */
      host.innerHTML = '';
      return;
    }

    const cur = currentStreak();
    const best = bestStreak();
    const next = nextMilestone();

    const stat = (label, value, cls) =>
      `<div class="streak-stat">
         <span class="streak-n${cls ? ' ' + cls : ''}">${value}</span>
         <span class="streak-lbl">${label}</span>
       </div>`;

    host.innerHTML = `
      <div class="panel streak-panel">
        <div class="streak-row">
          ${stat('day streak', cur, cur > 0 ? 'n-green' : '')}
          ${stat('best run', best)}
          ${stat('days logged', total)}
        </div>
        ${next ? `<div class="streak-next">
          <span class="streak-next-lbl">${escapeHtml(next.label)}</span>
          <span class="streak-next-bar"><i style="width:${Math.min(100, Math.round(total / next.need * 100))}%"></i></span>
          <span class="streak-next-go">${next.short} to go</span>
        </div>` : ''}
        ${milestones().filter(m => m.got).length ? `<div class="streak-badges">
          ${milestones().filter(m => m.got).map(m =>
            `<span class="streak-badge" title="${escapeHtml(m.note)}">${escapeHtml(m.label)}</span>`).join('')}
        </div>` : ''}
      </div>`;
  }

  window.currentStreak    = currentStreak;
  window.bestStreak       = bestStreak;
  window.totalLoggedDays  = totalLoggedDays;
  window.milestones       = milestones;
  window.nextMilestone    = nextMilestone;
  window.renderStreak     = renderStreak;
