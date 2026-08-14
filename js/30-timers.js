'use strict';
/* ============================================================
   LOADOUT - COOK TIMERS

   Timers are stored as an ABSOLUTE end timestamp, never as a
   decrementing counter. A counter drifts whenever the tab is
   backgrounded or the phone sleeps, and dies entirely on
   reload; an end time is simply compared against the clock, so
   a timer survives refreshes, sleep and app switches, and is
   still correct when you come back.

   That is also precisely the shape iOS ActivityKit wants: a
   Live Activity is handed an end date and counts down on its
   own. window.LoadoutTimers below is the bridge a native layer
   would mirror -- start/pause/resume/cancel plus a change
   subscription, with no DOM assumptions in the data.

   Its own localStorage key, so cook timers are independent of
   the meal-plan save blob and of "Start over".
   ============================================================ */

  const TIMER_KEY  = 'loadout.timers.v1';
  const TICK_MS    = 1000;
  const DONE_KEEP_MS = 10 * 60 * 1000;  // finished timers linger this long, then self-clear

  let timers = [];
  let tickHandle = null;
  const timerSubs = [];

  /* ---- persistence ---- */
  function timersLoad(){
    try{
      const raw = localStorage.getItem(TIMER_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    }catch(e){ return []; }
  }
  function timersSave(){
    try{ localStorage.setItem(TIMER_KEY, JSON.stringify(timers)); }catch(e){}
  }

  function timersChanged(){
    timersSave();
    renderTimerStrip();
    timerSubs.forEach(function(fn){ try{ fn(timerSnapshot()); }catch(e){} });
  }

  /* ---- model ---- */
  function timerRemaining(t, now){
    if (t.status === 'paused') return t.remainingMs;
    if (t.status === 'done')   return 0;
    return Math.max(0, t.endsAt - now);
  }

  function timerSnapshot(){
    const now = Date.now();
    return timers.map(function(t){
      return {
        id: t.id, label: t.label, status: t.status,
        endsAt: t.endsAt, durationMs: t.durationMs,
        remainingMs: timerRemaining(t, now)
      };
    });
  }

  function newTimerId(){
    /* Date.now alone collides when two timers start in the same millisecond. */
    return 't' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
  }

  function timerStart(label, ms){
    ms = Math.max(1000, Math.round(ms));
    const now = Date.now();
    const t = {
      id: newTimerId(),
      label: String(label || 'Timer'),
      startedAt: now,
      endsAt: now + ms,
      durationMs: ms,
      remainingMs: ms,
      status: 'running',
      notified: false
    };
    timers.push(t);
    timersChanged();
    ensureTicking();
    requestNotifyPermission();
    return t.id;
  }

  function timerFind(id){
    for (let i = 0; i < timers.length; i++) if (timers[i].id === id) return timers[i];
    return null;
  }

  function timerPause(id){
    const t = timerFind(id);
    if (!t || t.status !== 'running') return;
    t.remainingMs = Math.max(0, t.endsAt - Date.now());
    t.status = 'paused';
    timersChanged();
  }

  function timerResume(id){
    const t = timerFind(id);
    if (!t || t.status !== 'paused') return;
    t.endsAt = Date.now() + t.remainingMs;
    t.status = 'running';
    timersChanged();
    ensureTicking();
  }

  function timerCancel(id){
    const before = timers.length;
    timers = timers.filter(function(t){ return t.id !== id; });
    if (timers.length !== before) timersChanged();
  }

  /* ---- completion ---- */
  function timerComplete(t){
    t.status = 'done';
    t.remainingMs = 0;
    t.doneAt = Date.now();
    if (!t.notified){
      t.notified = true;
      notifyTimerDone(t);
    }
  }

  function requestNotifyPermission(){
    /* Asked on the first timer start rather than at app launch: a permission
       prompt makes sense when you have just asked for something that needs it. */
    try{
      if (typeof Notification === 'undefined') return;
      if (Notification.permission === 'default') Notification.requestPermission();
    }catch(e){}
  }

  function notifyTimerDone(t){
    try{
      if (typeof Notification === 'undefined') return;
      if (Notification.permission !== 'granted') return;
      /* A notification only reaches the user reliably when the page is alive.
         Genuine scheduled reminders need the native layer; this is the case
         the web can actually honour. */
      const n = new Notification('Timer finished', {
        body: t.label + ' is done.',
        tag: t.id,
        requireInteraction: false
      });
      n.onclick = function(){ try{ window.focus(); n.close(); }catch(e){} };
    }catch(e){}
  }

  /* ---- ticking ---- */
  function ensureTicking(){
    const live = timers.some(function(t){ return t.status === 'running'; });
    if (live && !tickHandle){
      tickHandle = setInterval(timerTick, TICK_MS);
    } else if (!live && tickHandle && !timers.some(function(t){ return t.status === 'done'; })){
      clearInterval(tickHandle); tickHandle = null;
    }
  }

  function timerTick(){
    const now = Date.now();
    let changed = false;

    timers.forEach(function(t){
      if (t.status === 'running' && t.endsAt <= now){ timerComplete(t); changed = true; }
    });

    // finished timers clear themselves after a while so the strip doesn't pile up
    const keep = timers.filter(function(t){
      return !(t.status === 'done' && t.doneAt && (now - t.doneAt) > DONE_KEEP_MS);
    });
    if (keep.length !== timers.length){ timers = keep; changed = true; }

    if (changed) timersChanged();
    else renderTimerStrip();   // cheap text refresh for the countdown

    if (!timers.length && tickHandle){ clearInterval(tickHandle); tickHandle = null; }
  }

  /* ---- view ---- */
  function fmtClock(ms){
    const s = Math.max(0, Math.round(ms / 1000));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h) return h + ':' + String(m).padStart(2,'0') + ':' + String(sec).padStart(2,'0');
    return m + ':' + String(sec).padStart(2,'0');
  }

  /* The strip is fixed to the bottom, so without this it would sit on top of
     whatever is at the end of the page. Reserving its MEASURED height keeps the
     last row of content reachable; hard-coding a number gets it wrong the moment
     a second timer wraps the strip to two rows. */
  function syncStripSpace(){
    const host = document.getElementById('timerStrip');
    if (!host) return;
    document.body.style.paddingBottom =
      host.hidden ? '' : (host.offsetHeight + 10) + 'px';
  }

  function renderTimerStrip(){
    const host = document.getElementById('timerStrip');
    if (!host) return;
    if (!timers.length){ host.hidden = true; host.innerHTML = ''; syncStripSpace(); return; }

    const now = Date.now();
    host.hidden = false;
    host.innerHTML = timers.map(function(t){
      const left = timerRemaining(t, now);
      const done = t.status === 'done';
      const pct  = done ? 100 : Math.min(100, Math.round((1 - left / Math.max(1, t.durationMs)) * 100));
      return '<div class="timer-row' + (done ? ' timer-done' : '') + '">' +
               '<div class="timer-fill" style="width:' + pct + '%"></div>' +
               '<span class="timer-label">' + escapeHtml(t.label) + '</span>' +
               '<span class="timer-clock">' + (done ? 'DONE' : fmtClock(left)) + '</span>' +
               (done ? '' :
                 '<button class="timer-btn" data-timer-toggle="' + t.id + '">' +
                   (t.status === 'paused' ? 'RESUME' : 'PAUSE') + '</button>') +
               '<button class="timer-btn" data-timer-cancel="' + t.id + '" aria-label="Dismiss timer">' +
                 (done ? 'CLEAR' : 'STOP') + '</button>' +
             '</div>';
    }).join('');

    syncStripSpace();
  }

  /* A rotate or a resize changes how many rows the strip needs. */
  window.addEventListener('resize', syncStripSpace);

  /* ---- wiring ----
     Delegated from document, so buttons keep working across the re-renders
     that redraw the cook plan and the strip. */
  document.addEventListener('click', function(e){
    const startBtn = e.target.closest && e.target.closest('[data-timer-mins]');
    if (startBtn){
      const m = parseFloat(startBtn.getAttribute('data-timer-mins'));
      if (m > 0) timerStart(startBtn.getAttribute('data-timer-label') || 'Timer', m * 60000);
      return;
    }
    const toggle = e.target.closest && e.target.closest('[data-timer-toggle]');
    if (toggle){
      const t = timerFind(toggle.getAttribute('data-timer-toggle'));
      if (t) (t.status === 'paused' ? timerResume : timerPause)(t.id);
      return;
    }
    const cancel = e.target.closest && e.target.closest('[data-timer-cancel]');
    if (cancel){ timerCancel(cancel.getAttribute('data-timer-cancel')); }
  });

  /* Coming back from a backgrounded tab: recompute immediately rather than
     waiting up to a second for the next tick. */
  document.addEventListener('visibilitychange', function(){
    if (!document.hidden) timerTick();
  });

  /* ---- restore ---- */
  timers = timersLoad().filter(function(t){
    return t && t.id && t.status && typeof t.endsAt === 'number';
  });
  /* Anything that expired while the app was closed is already finished. It is
     marked notified so reopening the app doesn't fire a stale alert. */
  timers.forEach(function(t){
    if (t.status === 'running' && t.endsAt <= Date.now()){
      t.status = 'done'; t.remainingMs = 0; t.notified = true;
      if (!t.doneAt) t.doneAt = t.endsAt;
    }
  });
  renderTimerStrip();
  if (timers.length){ timersSave(); ensureTicking(); }

  /* ---- bridge ----
     The surface a Capacitor/ActivityKit layer mirrors. Deliberately free of
     DOM types so it can be driven from native code or a test harness. */
  window.LoadoutTimers = {
    list:   timerSnapshot,
    start:  timerStart,
    pause:  timerPause,
    resume: timerResume,
    cancel: timerCancel,
    on:     function(fn){ if (typeof fn === 'function') timerSubs.push(fn); }
  };
