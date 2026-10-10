'use strict';
/* ============================================================
   LOADOUT - HOME-SCREEN WIDGET

   The widget draws whatever summary it was last handed, so this hands it
   one whenever Today is drawn — which is every time something is logged,
   a glass of water is added, or the step bonus moves. Always for today,
   whichever day the journal happens to be showing.

   Worked out here with the journal's own functions, never re-derived on
   the native side: the target, the bonus and what counts as eaten are the
   app's to decide, and a second copy of that arithmetic would drift.
   Native builds only; on the web there is no widget to tell.
   ============================================================ */

  (function(){
    const cap = window.Capacitor;
    const bridge = cap && cap.Plugins && cap.Plugins.WidgetBridge;
    if (!bridge || typeof renderJournal !== 'function') return;

    let pending = null, lastSent = '';

    function summary(){
      if (typeof characterExists === 'function' && !characterExists()) return null;
      const key = todayKey();
      const log = (state.log || {})[key] || {};
      const kind = log.dayKind || ((typeof activeDayKind === 'function') ? activeDayKind() : 'rest');
      const tg = (typeof targetsFor === 'function') ? targetsFor(kind) : currentTargets();
      const buff = (typeof stepBuffFor === 'function') ? stepBuffFor(key, kind) : null;
      const goal = tg.kcal + (buff ? buff.kcal : 0);
      const t = dayTotals(key);
      const th = THEMES[state.theme] || {};
      const c = th.colors || {};
      const tier = TIERS.find(x => x.id === state.assignedTierId);
      const wu = (typeof waterUnits === 'function') ? waterUnits() : null;
      const water = (wu && typeof waterOn === 'function' && waterOn(key))
        ? wu.show(waterOn(key)) + ' of ' + wu.show(waterGoalMl()) + ' ' + wu.unit + ' water' : '';
      return {
        day: key,
        word: (th.words && th.words.hp) || 'KCAL',
        className: tier ? tier.name : 'Loadout',
        kcalLeft: Math.round(goal - t.kcal),
        eaten: Math.round(t.kcal),
        goal: Math.round(goal),
        protein: [Math.round(tg.protein - t.protein), Math.round(tg.protein)],
        carbs:   [Math.round(tg.carbs - t.carbs),     Math.round(tg.carbs)],
        fat:     [Math.round(tg.fat - t.fat),         Math.round(tg.fat)],
        water,
        /* the Watch logs water itself, so it needs the raw figures too */
        waterMl: (typeof waterOn === 'function') ? Math.round(waterOn(key)) : 0,
        waterGoalMl: wu ? Math.round(waterGoalMl()) : 0,
        waterGlassMl: wu ? Math.round(wu.glass) : 250,
        waterUnit: wu ? wu.unit : 'L',
        accent: c.cyan || '#e05a5a',
        colors: [c.green || '#8fae76', c.magenta || '#9a6ca8', c.amber || '#d19a3c'],
        /* what the Watch can log from; the widget ignores it */
        watch: (typeof watchOptions === 'function') ? watchOptions() : null,
      };
    }

    function push(){
      try {
        const s = summary();
        if (!s) return;
        const json = JSON.stringify(s);
        if (json === lastSent) return;          // nothing moved; no redraw
        lastSent = json;
        bridge.update({ json }).catch(()=>{});
      } catch (e) { console.error('Loadout: widget summary', e); }
    }

    const original = window.renderJournal;
    window.renderJournal = function(){
      const out = original.apply(this, arguments);
      clearTimeout(pending);
      pending = setTimeout(push, 400);
      return out;
    };
    /* A new day starts with the app shut more often than not; coming back
       to it brings the widget up to date even if Today is not opened. */
    document.addEventListener('visibilitychange', ()=>{
      if (document.visibilityState === 'visible'){ takeWatchWater(); push(); }
    });

    /* What the Watch logged — water, or a food — applied to the day it was
       logged on, then the summary goes back so the Watch shows the phone's
       own figures rather than its guess. */
    function applyWatchItem(item){
      if (!item) return;
      if (item.type === 'log'){
        let pick = null;
        try { pick = JSON.parse(item.json); } catch (e) {}
        if (pick && typeof applyWatchLog === 'function') applyWatchLog(pick);
      } else if (typeof addWater === 'function'){
        addWater(item.day, parseInt(item.glasses, 10) || 0);
      }
      lastSent = '';
      renderJournal();
    }
    function takeWatchWater(){
      if (!bridge.takePending) return;
      bridge.takePending().then(res => (res && res.items || []).forEach(applyWatchItem)).catch(()=>{});
    }
    if (bridge.addListener) bridge.addListener('watchWater', ()=>{
      /* also queued natively; take the queue so each is applied exactly once */
      takeWatchWater();
    });
    takeWatchWater();
    push();
  })();
