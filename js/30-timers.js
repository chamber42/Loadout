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

   An end timestamp is also exactly what a scheduled notification
   wants, which is how a finished timer now reaches somebody who
   is not looking at the app -- see the note above
   requestNotifyPermission.

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
    armNativeTimerAlert(t);

    /* The strip sits at z-index 45 and every modal overlay at 60, so a timer
       started from the cook plan — which is where nearly all of them are
       started — renders completely behind the sheet it was started from.
       It is running; there is simply no way to see it until the modal is
       closed, which reads as the button doing nothing at all.

       Raising the strip is not the fix: it was lowered to 45 on purpose,
       because at 60 it tied with .modal-wrap and painted over modal buttons.
       A toast is at 9999 and belongs to the moment rather than the screen,
       so it confirms the tap wherever it happened. */
    if (typeof toast === 'function'){
      toast(t.label + ' — ' + fmtClock(ms) + ' running', 'timer');
    }
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
    disarmNativeTimerAlert(t);
    timersChanged();
  }

  function timerResume(id){
    const t = timerFind(id);
    if (!t || t.status !== 'paused') return;
    t.endsAt = Date.now() + t.remainingMs;
    t.status = 'running';
    armNativeTimerAlert(t);
    timersChanged();
    ensureTicking();
  }

  function timerCancel(id){
    const before = timers.length;
    const going = timerFind(id);
    if (going) disarmNativeTimerAlert(going);
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
      /* Native alerts are armed when the timer starts, so iOS delivers this
         one whether the app is open or not — the plugin sets itself as the
         notification-centre delegate so a banner still appears in the
         foreground, which iOS otherwise suppresses. Announcing it again
         here would double it for anyone watching the countdown. */
      if (!nativeReminders()) notifyTimerDone(t);
    }
  }

  /* ---- where a finished timer actually gets announced ------------------

     Two routes, and only one of them has ever worked on the phone.

     NATIVE. UNUserNotificationCenter, through the Reminders plugin. The
     alert is handed to iOS the moment the timer starts, scheduled for the
     moment it ends, so it arrives whether or not the app is running — which
     is the whole point of a cook timer, since nobody watches a countdown
     for forty minutes.

     WEB. new Notification(), which only fires while the page is alive.

     The web route was the only one here, and inside this app it has never
     fired at all: WKWebView does not implement the Notification API, so
     `typeof Notification` is undefined and the call has been returning
     early every time. The countdown was real; the alert was not. The web
     route stays for the browser build, where it is the best available. */
  function nativeReminders(){
    var cap = window.Capacitor;
    return (cap && cap.Plugins && cap.Plugins.Reminders) || null;
  }

  function requestNotifyPermission(){
    /* Asked on the first timer start rather than at app launch: a permission
       prompt makes sense when you have just asked for something that needs it. */
    try{
      var RM = nativeReminders();
      if (RM){
        RM.status().then(function(res){
          if (res && res.status === 'unasked') return RM.requestAuthorization();
        }).catch(function(){});
        return;
      }
    }catch(e){ return; }
    try{
      if (typeof Notification === 'undefined') return;
      if (Notification.permission === 'default') Notification.requestPermission();
    }catch(e){}
  }

  /* Handed to iOS up front, for when the timer will finish. */
  /* Every native call here is wrapped, not just its promise. A plugin
     method that is missing throws SYNCHRONOUSLY rather than rejecting, and
     an exception escaping this would take the whole click handler with it —
     turning a notification that could not be scheduled into a timer that
     could not be started. The alert is the optional part; the timer is not. */
  function armNativeTimerAlert(t){
    try{
      var RM = nativeReminders();
      if (!RM) return;
      RM.scheduleAt({
        id: 'timer.' + t.id,
        at: t.endsAt,
        title: 'Timer finished',
        body: t.label + ' is done.'
      }).catch(function(){});
    }catch(e){ console.warn('Loadout: could not schedule a timer alert', e); }
  }

  /* A paused or cancelled timer must take its scheduled alert with it, or
     iOS still announces a dish that is no longer cooking. */
  function disarmNativeTimerAlert(t){
    try{
      var RM = nativeReminders();
      if (!RM) return;
      RM.cancel({id: 'timer.' + t.id}).catch(function(){});
    }catch(e){ /* nothing was scheduled, so nothing to withdraw */ }
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
  /* Where the strip sits, and how much room the page owes it.

     Two measurements rather than two constants. The action bar's height
     depends on the safe-area inset, which differs by device and changes
     when the phone rotates; the strip's own height depends on how many
     timers are running and whether their labels wrap. Hard-coding either
     gets it wrong on some phone, in some orientation, at some point — and
     the way it goes wrong is that a timer ends up underneath the bar,
     which is exactly the bug this replaces. */
  function syncStripSpace(){
    const host = document.getElementById('timerStrip');
    if (!host) return;
    const root = document.documentElement;

    /* The bar is hidden until tabs are in play, and offsetHeight of a
       hidden element is 0 — which is the right answer for both.

       With no bar there is nothing between the strip and the bottom of the
       screen, so it has to clear the home indicator itself. The action bar
       already pays that inset in its own padding, and its offsetHeight
       includes it, so when the bar IS there the strip must not pay it a
       second time — that was a visible gap between the timer and the
       buttons, not a rounding error. */
    const bar = document.getElementById('tabBar');
    let barH = (bar && !bar.hidden) ? bar.offsetHeight : 0;
    if (!barH){
      const inset = getComputedStyle(root).getPropertyValue('--safe-bottom').trim();
      barH = parseFloat(inset) || 0;
    }
    root.style.setProperty('--tab-h', barH + 'px');

    const stripH = host.hidden ? 0 : host.offsetHeight;
    root.style.setProperty('--strip-h', stripH + 'px');

    /* Only the strip's own height: the screen already reserves space for
       the action bar through body.tabbed .screen. */
    document.body.style.paddingBottom = stripH ? (stripH + 10) + 'px' : '';
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

  /* A rotate or a resize changes how many rows the strip needs, and moves
     the safe-area inset the action bar is sized against. */
  window.addEventListener('resize', syncStripSpace);
  window.addEventListener('orientationchange', syncStripSpace);

  /* The action bar is revealed once onboarding finishes, which happens long
     after this file has run and measured a bar that was still hidden. A
     one-off pass after the first paint catches that; the resize and render
     hooks keep it right afterwards. */
  setTimeout(syncStripSpace, 0);

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
