'use strict';
/* ============================================================
   LOADOUT - DIET BREAKS

   A long cut gets harder the longer it runs. Past a few months the body
   spends less — less fidgeting, less walking without noticing, a slightly
   slower metabolism — and the hunger and fatigue add up. Two weeks eaten at
   maintenance partway through takes the edge off both, and in the studies
   that tested it the people who took breaks kept more of what they lost.

   So after a stretch of cutting, the character sheet offers one. It is
   offered, never imposed: "not now" puts it away for two weeks. Taking it
   sets the goal to Maintain for fourteen days and then puts the cut back
   exactly as it was.

   HOW LONG HAS THIS CUT BEEN RUNNING

   Counting from the day the goal was set would tell someone who has been
   cutting since August, and only just updated the app, that they started
   today. The weight trend knows better. Walking back a week at a time, the
   cut is still going as long as the trend keeps falling; two flat weeks in
   a row mark where it began. One flat week is not a break — water, a
   salty weekend, a new scale — so it is stepped over.

   Once found, the start is kept (state.cutSince) rather than re-derived, so
   a plateau inside a cut cannot quietly reset the count.
   ============================================================ */

  const BREAK_DAYS = 14;
  const BREAK_SNOOZE_DAYS = 14;
  /* A week whose trend fell by less than this was not a cutting week. */
  const CUT_WEEK_MIN_DROP = 0.2;
  /* Weeks of cutting before a break is offered, by goal. The harder the
     deficit, the sooner it is due. */
  const BREAK_AFTER_WEEKS = {extreme_loss:12, loss:16, slow_cut:20};

  function keyPlusDays(key, n){
    const d = weightKeyToDate(key);
    d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' +
           String(d.getMonth() + 1).padStart(2, '0') + '-' +
           String(d.getDate()).padStart(2, '0');
  }

  /* The trend as it stood on a day: the last point on or before it. */
  function trendOn(trend, key){
    let hit = null;
    for (const p of trend){
      if (p.key <= key) hit = p; else break;
    }
    return hit;
  }

  /* The day the current cut began, read off the weight trend. `today` if
     the trend has nothing to say. */
  function inferCutStart(trend, today){
    if (!trend || !trend.length) return today;
    let start = today, flat = 0;
    for (let k = 1; k <= 104; k++){
      const fromKey = keyPlusDays(today, -7 * k);
      const from = trendOn(trend, fromKey);
      if (!from) break;                       // before the first reading
      const to = trendOn(trend, keyPlusDays(today, -7 * (k - 1)));
      if (from.trend - to.trend >= CUT_WEEK_MIN_DROP){
        flat = 0;
        start = fromKey;
      } else if (++flat >= 2){
        break;
      }
    }
    return start;
  }

  /* Keeps state.cutSince in step with the goal. Run after every target
     sync, which is every place the goal can change. */
  function trackCutPhase(today){
    if (typeof state === 'undefined') return;
    const day = today || todayKey();
    /* Picking a different goal mid-break is choosing to end it. */
    if (state.dietBreak && state.goal !== 'maintain'){
      state.dietBreak = null;
    }
    if (state.dietBreak) return;
    if (state.mode === 'calc' && goalDef(state.goal).dir < 0){
      if (!state.cutSince){
        state.cutSince = inferCutStart(
          (typeof weightTrend === 'function') ? weightTrend() : [], day);
      }
    } else {
      state.cutSince = null;
    }
  }

  function cutWeeks(today){
    if (!state.cutSince) return 0;
    return Math.floor(daysBetweenKeys(state.cutSince, today || todayKey()) / 7);
  }

  function dietBreakDue(today){
    const day = today || todayKey();
    if (state.mode !== 'calc' || state.dietBreak || !state.cutSince) return false;
    const after = BREAK_AFTER_WEEKS[state.goal];
    if (!after) return false;
    if (state.dietBreakSnoozed && day < state.dietBreakSnoozed) return false;
    return cutWeeks(day) >= after;
  }

  function startDietBreak(today){
    const day = today || todayKey();
    state.dietBreak = {resume: state.goal, until: keyPlusDays(day, BREAK_DAYS)};
    state.dietBreakSnoozed = null;
    state.goal = 'maintain';
  }

  /* Puts the cut back once the fortnight is up, and starts its count
     again: the weeks before the break have been paid for. Returns whether
     it ended one. */
  function endDietBreakIfOver(today, force){
    const day = today || todayKey();
    const b = state.dietBreak;
    if (!b || (!force && day < b.until)) return false;
    state.goal = b.resume || 'loss';
    state.dietBreak = null;
    state.cutSince = day;
    return true;
  }

  function snoozeDietBreak(today){
    state.dietBreakSnoozed = keyPlusDays(today || todayKey(), BREAK_SNOOZE_DAYS);
  }

  /* After the goal moves, everything that hangs off it follows. */
  function applyGoalChange(){
    if (typeof creditedExerciseKcal === 'function') state.exerciseKcal = creditedExerciseKcal();
    if (typeof syncTargets === 'function') syncTargets();
    if (typeof assignTier === 'function') assignTier();
    if (typeof saveState === 'function') saveState();
  }

  function renderDietBreakPanel(){
    const panel = document.getElementById('sheetBreakPanel');
    const host  = document.getElementById('sheetBreak');
    if (!panel || !host) return;

    if (state.dietBreak){
      const when = weightKeyToDate(state.dietBreak.until)
        .toLocaleDateString(undefined, {day:'numeric', month:'short'});
      host.innerHTML =
        `<p class="subtitle" style="font-size:11px; margin:0 0 10px;">
           Maintenance until ${escapeHtml(when)}, then back to
           ${escapeHtml(goalDef(state.dietBreak.resume).name)}.</p>
         <button class="btn-ghost" id="btnBreakEnd" style="margin:0;">END BREAK NOW</button>`;
      panel.hidden = false;
      document.getElementById('btnBreakEnd').addEventListener('click', ()=>{
        endDietBreakIfOver(null, true);
        applyGoalChange();
        renderTiers();
      });
      return;
    }

    if (!dietBreakDue()){ panel.hidden = true; host.innerHTML = ''; return; }

    host.innerHTML =
      `<p class="subtitle" style="font-size:11px; margin:0 0 10px;">
         ${cutWeeks()} weeks into this cut. Two weeks at maintenance now makes
         the rest of it easier to hold.</p>
       <div style="display:flex; gap:8px;">
         <button class="btn-ghost" id="btnBreakTake" style="margin:0; flex:1;">TAKE A BREAK</button>
         <button class="btn-ghost" id="btnBreakLater" style="margin:0; flex:1;">NOT NOW</button>
       </div>`;
    panel.hidden = false;
    document.getElementById('btnBreakTake').addEventListener('click', ()=>{
      startDietBreak();
      applyGoalChange();
      if (typeof toast === 'function') toast('Diet break started.', 'check');
      renderTiers();
    });
    document.getElementById('btnBreakLater').addEventListener('click', ()=>{
      snoozeDietBreak();
      if (typeof saveState === 'function') saveState();
      renderDietBreakPanel();
    });
  }

  /* The sheet is redrawn on load and whenever the character changes. A break
     that ran out overnight is ended before the sheet draws, so it never
     shows yesterday's goal. */
  (function hookDietBreak(){
    if (typeof window.renderTiers !== 'function') return;
    const original = window.renderTiers;
    window.renderTiers = function(){
      try{
        if (endDietBreakIfOver()){
          applyGoalChange();
          if (typeof toast === 'function') toast('Break over. Back to ' + goalDef(state.goal).name + '.', 'flag');
        } else if (!state.cutSince){
          /* A save from before breaks existed, already partway into a cut. */
          trackCutPhase();
          if (state.cutSince && typeof saveState === 'function') saveState();
        }
      }catch(e){ console.error('Loadout: diet break', e); }
      const out = original.apply(this, arguments);
      try{ renderDietBreakPanel(); }catch(e){ console.error('Loadout: diet break panel', e); }
      return out;
    };
  })();

  window.trackCutPhase = trackCutPhase;
