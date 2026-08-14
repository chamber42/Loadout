'use strict';
/* ============================================================
   LOADOUT - CONTAINER LEDGER + REAL-TIME FLEXIBILITY
   From app.js lines 6602-7031 of the original single file.
   Loaded in order by index.html; all files share one global scope,
   so declarations here are visible to every file listed after it.
   ============================================================ */

  /* =========================================================
     CONTAINER LEDGER
     A prep cooks a fixed number of servings of each dish — four of the
     Greek chicken, two of the oats — and the useful question mid-week is
     not "what is the plan" but "what is still in the fridge". The count of
     servings the schedule calls for is derived, not stored, so it stays
     right if the schedule changes; only the number eaten is kept. It lives
     on state.prep, so building a new prep starts the ledger clean.
  ========================================================= */
  function dishTag(ref){ return ref.store + '|' + ref.index; }

  /* "1 serving" / "4 servings" — the ledger says these numbers a lot */
  function servingWord(n){ return n === 1 ? 'serving' : 'servings'; }

  /* Servings the prep cooks: every sitting on every day that points here */
  function dishCooked(ref){
    if (!prepReady() || !ref) return 0;
    const lane = ref.store === 'snacks' ? 'snacks' : 'mains';
    return state.prep.schedule.reduce((n, row)=>
      n + (row[lane] || []).filter(i => i === ref.index).length, 0);
  }

  function dishEaten(ref){
    if (!ref) return 0;
    const led = (state.prep && state.prep.eaten) || {};
    return Math.max(0, Math.min(+led[dishTag(ref)] || 0, dishCooked(ref)));
  }

  function dishLeft(ref){ return Math.max(0, dishCooked(ref) - dishEaten(ref)); }

  function setDishEaten(ref, n){
    if (!prepReady() || !ref) return;
    state.prep.eaten = state.prep.eaten || {};
    state.prep.eaten[dishTag(ref)] = Math.max(0, Math.min(n, dishCooked(ref)));
    saveState();
  }

  function takeContainer(ref, delta){ setDishEaten(ref, dishEaten(ref) + (delta || 1)); }

  function containerTotals(){
    const out = {cooked:0, left:0};
    if (!prepReady()) return out;
    [['meals', state.prep.meals], ['snacks', state.prep.snacks]].forEach(([store, arr])=>{
      (arr || []).forEach((_, index)=>{
        const ref = {store, index};
        out.cooked += dishCooked(ref);
        out.left   += dishLeft(ref);
      });
    });
    return out;
  }

  /* One serving, logged and taken off the ledger in a single tap. This is
     the whole point of prepping: it was weighed once when it was cooked, so
     eating it should not mean weighing it again. */
  function eatOneServing(dayIdx, mealKey){
    const ref = dishRefFor(mealKey, dayIdx);
    if (!ref || !dishLeft(ref)) return;
    const keep = state.activeDay;
    applyDayToSelections(dayIdx + 1);
    const mi = MEALS.findIndex(m => m.key === mealKey);
    const slots = journalSlots() || [];
    const slotName = (slots[mi] || {}).name || (MEALS[mi] ? MEALS[mi].name : 'MEAL');
    const dish = dishAt(ref);
    state.journalDate = todayKey();
    journalCopyFromPlan(mealKey, slotName);
    applyDayToSelections(keep);
    takeContainer(ref, 1);
    renderJournal();
    const name = (dish && dish.dish) || 'Serving';
    const short = name.length > 30 ? name.slice(0, 29).trim() + '…' : name;
    const rest = dishLeft(ref);
    toast(short + ' logged — ' +
          (rest ? rest + ' left' : 'that was the last one'));
    saveState();
  }

  /* =========================================================
     REAL-TIME FLEXIBILITY
     A prep is cooked before the week happens, and the week does not
     cooperate. Two things go wrong: the days come in a different order than
     planned, and some days you don't eat the prep at all. Neither should
     mean rebuilding the plan.
  ========================================================= */

  /* Move day A's food to day B and B's to A. The rest/training kind stays
     with the calendar day rather than travelling with the food — training
     is a fact about the day, and the portions resize to match, which is the
     whole point of being able to move a dish onto a training day. */
  function swapPrepDays(a, b){
    if (!prepReady() || a === b) return false;
    const sch = state.prep.schedule;
    if (!sch[a] || !sch[b]) return false;
    writeBackActiveDay();
    const tmpM = sch[a].mains,  tmpS = sch[a].snacks;
    sch[a].mains  = sch[b].mains;  sch[a].snacks  = sch[b].snacks;
    sch[b].mains  = tmpM;          sch[b].snacks  = tmpS;
    applyDayToSelections(state.activeDay || 1);
    saveState();
    return true;
  }

  /* Sittings replaced by a restaurant, a work lunch, or a bag of chips.
     Marked rather than deleted: the serving is still in the fridge, so the
     ledger must not count it as eaten, and the plan now stretches further
     than it was built for. */
  function ateOutTag(dayIdx, mealKey){ return dayIdx + '|' + mealKey; }

  function isAteOut(dayIdx, mealKey){
    return !!(((state.prep || {}).ateOut) || {})[ateOutTag(dayIdx, mealKey)];
  }

  function setAteOut(dayIdx, mealKey, on){
    if (!prepReady()) return;
    state.prep.ateOut = state.prep.ateOut || {};
    if (on) state.prep.ateOut[ateOutTag(dayIdx, mealKey)] = true;
    else delete state.prep.ateOut[ateOutTag(dayIdx, mealKey)];
    saveState();
  }

  /* Only marks that still point at a real day count — a reshuffle builds a
     fresh state.prep, but a day count that shrank would strand them. */
  function ateOutCount(){
    if (!prepReady()) return 0;
    const days = state.prep.schedule.length;
    return Object.keys(state.prep.ateOut || {}).filter(k=>{
      const d = parseInt(k.split('|')[0], 10);
      return d >= 0 && d < days;
    }).length;
  }

  /* Send a sitting to the journal as a blank row to fill in. The prep stays
     untouched — that's the point. */
  function logAteOut(dayIdx, mealKey){
    setAteOut(dayIdx, mealKey, true);
    const mi = MEALS.findIndex(m => m.key === mealKey);
    const slots = journalSlots() || [];
    const slotName = (slots[mi] || {}).name || (MEALS[mi] ? MEALS[mi].name : 'MEAL');
    state.journalDate = todayKey();
    closeModal('modalPrepDay');
    renderPrepDays();
    goTab('journal');
    renderJournal();
    journalAddRow(slotName);
    toast('Serving kept in the fridge — log what you actually ate', 'burger');
    saveState();
  }

  /* A short self-dismissing confirmation. Logging a serving changes a
     screen you are not currently looking at, so something has to say so. */
  function toast(msg, icon){
    let el = document.getElementById('gflToast');
    if (!el){
      el = document.createElement('div');
      el.id = 'gflToast';
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.innerHTML = (icon ? ic(icon) + ' ' : '') + escapeHtml(msg);
    // reflow so the transition replays when toasting twice in a row
    void el.offsetWidth;
    el.classList.add('on');
    clearTimeout(toast._t);
    toast._t = setTimeout(()=>{ el.classList.remove('on'); }, 2400);
  }

  function renderPrepDays(){
    const host = document.getElementById('prepDayList');
    const intro = document.getElementById('prepDaysIntro');
    const summary = document.getElementById('prepDishSummary');
    if (!host) return;

    if (!prepReady()){
      intro.textContent = 'No prep built yet.';
      host.innerHTML = `<div class="panel"><div class="fav-nores">
        Nothing prepped yet. Head to the Loadout tab, set how many days you're cooking for
        and how many different meals you want, and this fills in.</div></div>`;
      summary.innerHTML = '';
      return;
    }

    const p = state.prep;
    const days = p.schedule.length;
    const nMeals = p.meals.length, nSnacks = p.snacks.length;
    const nTrain = p.schedule.filter(r=>r.kind === 'train').length;
    intro.innerHTML =
      `<strong class="n-green">${nMeals}</strong> different ${nMeals===1?'meal':'meals'}` +
      (nSnacks ? ` and <strong class="n-green">${nSnacks}</strong> snack${nSnacks===1?'':'s'}` : '') +
      `, spread across <strong>${days}</strong> day${days===1?'':'s'}` +
      (hasSplit() && nTrain
        ? ` — <strong class="n-green">${nTrain} training</strong> and ` +
          `<strong style="color:var(--cyan)">${days - nTrain} rest</strong>, portioned to match`
        : '') +
      `. Tap a day to see it.`;

    const introTot = containerTotals();
    if (introTot.cooked && introTot.left < introTot.cooked){
      intro.innerHTML += introTot.left
        ? ` <strong class="n-amber">${introTot.left} of ${introTot.cooked} ${servingWord(introTot.cooked)} still in the fridge.</strong>`
        : ` <strong class="n-amber">Everything cooked has been eaten.</strong>`;
    }

    host.innerHTML = Array.from({length:days}, (_,d)=>{
      const t = prepDayTotals(d);
      const dishes = prepDayDishes(d);
      const kind = dayKindAt(d);
      const chips = dishes.map(({ref, dish, meal})=>{
        const out = isAteOut(d, meal.key);
        const label = out ? '<svg class="px" aria-hidden="true"><use href="#i-burger"></use></svg> ate out' : ((dish && dish.dish) || (meal.required ? 'Meal' : 'Snack'));
        const cls = out ? ' ateout' : (ref && !dishLeft(ref) ? ' spent' : '');
        const col = out ? 'var(--amber)' : dishColor(ref);
        return `<span class="dish-chip${cls}" style="border-color:${col}; color:${col};">${escapeHtml(label)}</span>`;
      }).join('');
      return `<button class="panel prep-day" data-prepday-open="${d}">
        <div class="eaten-head">
          <span class="eaten-title">DAY ${d+1}${hasSplit()
            ? ` <span class="day-kind ${kind}">${ic(DAY_KIND_ICON[kind])} ${DAY_KIND_LABEL[kind]}</span>` : ''}</span>
          <span class="eaten-total">${Math.round(t.kcal)} kcal · P${Math.round(t.protein)}</span>
        </div>
        <div class="dish-chips">${chips}</div>
        <div class="prep-day-go">View this day ›</div>
      </button>`;
    }).join('');

    host.querySelectorAll('[data-prepday-open]').forEach(b=>b.addEventListener('click', ()=>
      openPrepDay(parseInt(b.getAttribute('data-prepday-open'),10))));

    /* What you cooked and what is left of it. The count used to be a flat
       "×4" — how many servings the prep needs — which stops being the
       useful number the moment you start eating them. */
    const tot = containerTotals();
    const line = (dish, ref)=>{
      const cooked = dishCooked(ref), left = dishLeft(ref), col = dishColor(ref);
      const name = dish.dish || (ref.store === 'snacks' ? 'Snack' : 'Dish');
      const pips = Array.from({length:cooked}, (_,i)=>
        `<span class="pip${i < left ? ' full' : ''}"></span>`).join('');
      return `<div class="ctn-row${left ? '' : ' spent'}">
        <div class="ctn-main">
          <span class="ctn-name" style="color:${left ? col : 'var(--muted)'}">${escapeHtml(name)}</span>
          <span class="ctn-count">${left
            ? `<strong style="color:${col}">${left}</strong> of ${cooked} left`
            : (cooked === 1 ? 'eaten' : `all ${cooked} eaten`)}</span>
          <div class="ctn-pips" style="color:${col}">${pips}</div>
        </div>
        <div class="ctn-btns">
          <button class="mini-btn" data-ctn-undo="${dishTag(ref)}"
            aria-label="Put a serving of ${escapeHtml(name)} back"${dishEaten(ref) ? '' : ' disabled'}><svg class="px" aria-hidden="true"><use href="#i-undo"></use></svg></button>
          <button class="mini-btn" data-ctn-take="${dishTag(ref)}"
            aria-label="Mark a serving of ${escapeHtml(name)} as eaten"${left ? '' : ' disabled'}>ATE ONE</button>
        </div>
      </div>`;
    };
    summary.innerHTML = `<div class="panel">
      <div class="ctn-bar" style="margin-bottom:10px;">
        <span class="slot-label" style="margin:0;"><svg class="px" aria-hidden="true"><use href="#i-bento"></use></svg> WHAT'S LEFT IN THE FRIDGE</span>
        <span class="eaten-total" style="color:${tot.left ? 'var(--green)' : 'var(--amber)'}">${tot.left} / ${tot.cooked}</span>
      </div>
      ${p.meals.map((d,i)=>line(d,{store:'meals',index:i})).join('')}
      ${nSnacks ? `<div class="slot-label" style="margin:14px 0 10px;"><svg class="px" aria-hidden="true"><use href="#i-snack"></use></svg> SNACKS</div>` +
        p.snacks.map((d,i)=>line(d,{store:'snacks',index:i})).join('') : ''}
      <div class="season-hint" style="margin-top:10px;">
        ${tot.left
          ? `Tap <strong>ATE ONE</strong> as you work through the fridge — or open a day and log
             the serving straight to the journal. ${tot.left === 1 ? 'One serving' : tot.left + ' servings'}
             still to eat.`
          : `Everything you cooked is eaten. Time to reshuffle and cook again.`}
      </div>
      ${ateOutCount() ? `<div class="season-hint" style="margin-top:8px; color:var(--amber);">
        <svg class="px" aria-hidden="true"><use href="#i-burger"></use></svg> You ate out ${ateOutCount() === 1 ? 'once' : ateOutCount() + ' times'}, so
        ${ateOutCount() === 1 ? 'that serving is' : `those ${ateOutCount()} servings are`}
        still in the fridge — this prep stretches
        ${ateOutCount() === 1 ? 'a meal' : ateOutCount() + ' meals'} further than it was built for.
      </div>` : ''}
      ${tot.left < tot.cooked
        ? `<button class="mini-btn add" id="ctnReset"><svg class="px" aria-hidden="true"><use href="#i-reset"></use></svg> RESET THE LEDGER — I'VE COOKED AGAIN</button>`
        : ''}
    </div>`;

    const bump = (attr, delta)=> summary.querySelectorAll('[' + attr + ']').forEach(b=>
      b.addEventListener('click', ()=>{
        const [store, index] = b.getAttribute(attr).split('|');
        takeContainer({store, index: parseInt(index, 10)}, delta);
        renderPrepDays();
      }));
    bump('data-ctn-take',  1);
    bump('data-ctn-undo', -1);

    const reset = document.getElementById('ctnReset');
    if (reset) reset.addEventListener('click', ()=>{
      state.prep.eaten = {};
      saveState();
      renderPrepDays();
      toast('Ledger reset — everything back in the fridge', 'reset');
    });
  }

  function openPrepDay(dayIdx){
    if (!prepReady()) return;
    writeBackActiveDay();
    const keep = state.activeDay;
    applyDayToSelections(dayIdx + 1);

    const tg = currentTargets();
    const t = prepDayTotals(dayIdx);
    const kind = dayKindAt(dayIdx);
    document.getElementById('prepDayTitle').textContent =
      `DAY ${dayIdx+1}` + (hasSplit() ? ` · ${DAY_KIND_LABEL[kind]}` : '');

    const body = document.getElementById('prepDayBody');
    body.innerHTML = `
      <div class="panel">
        <div class="eaten-head">
          <span class="eaten-title">DAY TOTAL</span>
          <span class="eaten-total">${Math.round(t.kcal)}${tg.kcal ? ' / ' + tg.kcal : ''} kcal</span>
        </div>
        <div class="kv"><span>Protein</span><span>${Math.round(t.protein)}g${tg.protein ? ' / ' + tg.protein + 'g' : ''}</span></div>
        <div class="kv"><span>Carbs</span><span>${Math.round(t.carbs)}g${tg.carbs ? ' / ' + tg.carbs + 'g' : ''}</span></div>
        <div class="kv"><span>Fat</span><span>${Math.round(t.fat)}g${tg.fat ? ' / ' + tg.fat + 'g' : ''}</span></div>
      </div>
    ` + MEALS.map(meal=>{
      const ref = dishRefFor(meal.key, dayIdx);
      const sel = state.selections[meal.key];
      const plan = computeMealPlan(meal.key);
      let rows = '';
      SLOT_DEFS.forEach(def=>{
        const parts = (sel[def.slot] || []).map((k,i)=>{
          const g = plan[def.slot][i];
          if (!k || g == null) return null;
          const food = def.list().find(f=>f.key === k);
          if (!food) return null;
          const ul = unitLabel(food, g);
          return `<div class="pd-row">
            <span class="pd-name">${ic(def.icon)} ${escapeHtml(food.name)}</span>
            <button class="amt-tap" data-pd-amt="${meal.key}|${def.slot}|${i}"
              aria-label="Change the amount of ${escapeHtml(food.name)}">${ul ? ul : g.toFixed(0)+'g'} <svg class="px" aria-hidden="true"><use href="#i-edit"></use></svg></button>
          </div>${ul ? `<div class="pd-sub">${g.toFixed(0)}g</div>` : ''}`;
        }).filter(Boolean);
        rows += parts.join('');
      });
      const season = (sel.season || []);
      const left = dishLeft(ref), cooked = dishCooked(ref);
      const ateOut = isAteOut(dayIdx, meal.key);
      return `<div class="panel">
        <div style="font-size:11px; color:var(--cyan); letter-spacing:1px; margin-bottom:4px;">${meal.label}${meal.required ? '' : ' (OPTIONAL)'}</div>
        ${sel.dish ? `<div style="font-family:var(--font-body); font-size:15px; color:${dishColor(ref)}; margin-bottom:8px;"><svg class="px" aria-hidden="true"><use href="#i-plate"></use></svg> ${escapeHtml(sel.dish)}</div>` : ''}
        ${cooked ? `<div class="ctn-count" style="margin-bottom:8px;"><svg class="px" aria-hidden="true"><use href="#i-bento"></use></svg> ${left
          ? `<strong style="color:${dishColor(ref)}">${left}</strong> of ${cooked} ${servingWord(cooked)} left`
          : `${cooked === 1 ? 'This serving is' : `All ${cooked} servings are`} eaten`}</div>` : ''}
        ${rows || '<div class="fav-nores">Nothing planned for this sitting.</div>'}
        ${season.length ? `<div class="season-hint"><svg class="px" aria-hidden="true"><use href="#i-season"></use></svg> Season with: <strong class="n-amber">${season.map(escapeHtml).join(' · ')}</strong></div>` : ''}
        ${sel.notes ? `<div class="season-hint"><svg class="px" aria-hidden="true"><use href="#i-note"></use></svg> ${escapeHtml(sel.notes)}</div>` : ''}
        ${ateOut ? `<div class="pd-ateout"><svg class="px" aria-hidden="true"><use href="#i-burger"></use></svg> You ate out for this one — the serving is still in the fridge.</div>
          <button class="mini-btn add" data-pd-unout="${meal.key}"><svg class="px" aria-hidden="true"><use href="#i-undo"></use></svg> NO, I ATE THE PREP</button>`
        : `<div class="pd-actions">
            ${left ? `<button class="mini-btn" data-pd-ate="${meal.key}"><svg class="px" aria-hidden="true"><use href="#i-check"></use></svg> ATE THIS</button>` : ''}
            <button class="mini-btn" data-pd-out="${meal.key}"><svg class="px" aria-hidden="true"><use href="#i-burger"></use></svg> ATE OUT</button>
          </div>`}
      </div>`;
    }).join('') + (state.prep.schedule.length > 1 ? `
      <div class="panel">
        <div class="slot-label" style="margin-bottom:6px;"><svg class="px" aria-hidden="true"><use href="#i-swap"></use></svg> SWAP THIS DAY'S FOOD WITH</div>
        <div class="day-strip">${state.prep.schedule.map((row, i)=> i === dayIdx ? '' :
          `<button class="day-chip${hasSplit() && row.kind === 'train' ? ' train' : ''}"
            data-pd-swap="${i}" aria-label="Swap day ${dayIdx+1} with day ${i+1}">${i+1}` +
          (hasSplit() ? `<span class="kd">${ic(DAY_KIND_ICON[row.kind || 'rest'])}</span>` : '') +
          `</button>`).join('')}</div>
        <p class="swap-note">The food moves; the day stays ${hasSplit()
          ? 'a training or rest day, and the portions resize to match'
          : 'where it is'}. Nothing needs re-shopping.</p>
      </div>` : '') + `
      <button class="btn-ghost" id="pdEditDay"><svg class="px" aria-hidden="true"><use href="#i-edit"></use></svg> EDIT THIS DAY</button>
      <button class="btn-ghost" id="pdLogDay"><svg class="px" aria-hidden="true"><use href="#i-journal"></use></svg> LOG THIS DAY TO THE JOURNAL</button>`;

    body.querySelectorAll('[data-pd-amt]').forEach(b=>b.addEventListener('click', ()=>{
      const [mealKey, slot, idx] = b.getAttribute('data-pd-amt').split('|');
      openPortionEditor(mealKey, slot, parseInt(idx,10), ()=>{
        openPrepDay(dayIdx); renderPrepDays();
      });
    }));
    body.querySelectorAll('[data-pd-ate]').forEach(b=>b.addEventListener('click', ()=>{
      eatOneServing(dayIdx, b.getAttribute('data-pd-ate'));
      openPrepDay(dayIdx);
      renderPrepDays();
    }));
    body.querySelectorAll('[data-pd-out]').forEach(b=>b.addEventListener('click', ()=>
      logAteOut(dayIdx, b.getAttribute('data-pd-out'))));
    body.querySelectorAll('[data-pd-unout]').forEach(b=>b.addEventListener('click', ()=>{
      setAteOut(dayIdx, b.getAttribute('data-pd-unout'), false);
      openPrepDay(dayIdx);
      renderPrepDays();
    }));
    body.querySelectorAll('[data-pd-swap]').forEach(b=>b.addEventListener('click', ()=>{
      const other = parseInt(b.getAttribute('data-pd-swap'), 10);
      if (!swapPrepDays(dayIdx, other)) return;
      openPrepDay(dayIdx);
      renderPrepDays();
      toast('Day ' + (dayIdx+1) + ' and day ' + (other+1) + ' swapped', 'swap');
    }));
    document.getElementById('pdEditDay').addEventListener('click', ()=>{
      closeModal('modalPrepDay');
      applyDayToSelections(dayIdx + 1);
      renderEatenPanel(); renderMealTimeline(); refreshTargets();
      showScreen('screen-loadout');
    });
    document.getElementById('pdLogDay').addEventListener('click', ()=>{
      logPrepDayToJournal(dayIdx);
      closeModal('modalPrepDay');
    });

    openModal('modalPrepDay');
    // the modal reads from the working copy, so leave it where it was found
    applyDayToSelections(keep);
  }

  /* Drop a whole prepped day into today's journal in one go */
  function logPrepDayToJournal(dayIdx){
    const keep = state.activeDay;
    applyDayToSelections(dayIdx + 1);
    const slots = journalSlots() || [];
    MEALS.forEach((meal, mi)=>{
      const slotName = (slots[mi] || {}).name || meal.name;
      journalCopyFromPlan(meal.key, slotName);
    });
    applyDayToSelections(keep);
    state.journalDate = todayKey();
    renderJournal();
    goTab('journal');
    saveState();
  }

