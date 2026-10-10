'use strict';
/* ============================================================
   LOADOUT - BODY: MEASUREMENTS AND PROGRESS PHOTOS

   The scale says how much; a tape and a photo say where. Both sit on
   Progress beside the weight trend, in one card.

   MEASUREMENTS are stored in inches whatever the units, the way height is,
   and converted on screen. One reading per day per site; a later entry on
   the same day replaces the earlier one.

   PHOTOS are files on this phone, never in the save blob — a photo is
   megabytes, and the save is a few hundred kilobytes that has to fit in
   web storage. Each is shrunk to 1280 px on the long side before it is
   written, which keeps a year of weekly photos to tens of megabytes. They
   live in the app's private data folder: not in the photo library, not in
   the Files app, not in an export. Native builds only.
   ============================================================ */

  const SITES = [['waist', 'Waist'], ['chest', 'Chest'], ['hips', 'Hips'],
                 ['arm', 'Arm'], ['thigh', 'Thigh'], ['neck', 'Neck']];

  function bodyFS(){
    const cap = window.Capacitor;
    return (cap && cap.isNativePlatform && cap.isNativePlatform() && cap.Plugins && cap.Plugins.Filesystem) || null;
  }

  function todayKeyBody(){
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function lenUnits(){
    return (state.units || 'imperial') === 'imperial'
      ? { unit: 'in', show: v => (Math.round(v * 4) / 4).toString(), store: n => n }
      : { unit: 'cm', show: v => (Math.round(v * 2.54 * 2) / 2).toString(), store: n => n / 2.54 };
  }

  function measureSeries(site){
    const m = state.measurements || {};
    return Object.keys(m).sort().filter(k => m[k] && m[k][site] > 0).map(k => ({key: k, v: m[k][site]}));
  }

  function bodyHtml(){
    const u = lenUnits();
    const rows = SITES.map(([site, label]) => {
      const s = measureSeries(site);
      if (!s.length) return '';
      const now = s[s.length - 1].v, first = s[0].v;
      const diff = now - first;
      const shown = parseFloat(u.show(Math.abs(diff)));
      return `<div class="vital vital-wide">
        <span class="vital-lbl">${label}</span>
        <span class="vital-edit">${s.length > 1 && shown ? `<span class="bd-diff ${diff < 0 ? 'down' : 'up'}">${diff < 0 ? '−' : '+'}${shown}</span>` : ''}
          <strong>${u.show(now)}</strong><span class="vital-unit">${u.unit}</span></span>
      </div>`;
    }).join('');
    const photos = (state.photos || []).slice().sort((a, b) => b.key.localeCompare(a.key));
    const fs = bodyFS();
    return `
      ${rows || '<div class="jm-empty">No measurements yet.</div>'}
      <button class="btn-ghost" id="bdMeasure" style="margin-top:12px;"><svg class="px" aria-hidden="true"><use href="#i-scales"></use></svg> Log measurements</button>
      ${fs ? `
        <label class="field-label" style="margin-top:20px;">Photos</label>
        <div class="bd-photos">
          <label class="bd-add" for="bdPhotoIn" aria-label="Add a progress photo"><svg class="px" aria-hidden="true"><use href="#i-camera"></use></svg><span>Add</span></label>
          ${photos.map(p => `<button class="bd-ph" data-bd-ph="${escapeHtml(p.file)}" aria-label="Photo from ${p.key}">
              <img alt="" data-bd-src="${escapeHtml(p.file)}"><span>${shortBodyDay(p.key)}</span></button>`).join('')}
        </div>
        <input type="file" id="bdPhotoIn" accept="image/*" hidden>
        <p class="subtitle bd-note">Kept on this phone only.</p>` : ''}`;
  }

  function shortBodyDay(key){
    const p = key.split('-').map(Number);
    return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][p[1] - 1] + ' ' + p[2];
  }

  function renderBodyPanel(){
    const host = document.getElementById('bodyPanel');
    if (!host) return;
    host.innerHTML = bodyHtml();
    document.getElementById('bdMeasure').addEventListener('click', openMeasureForm);
    const input = document.getElementById('bdPhotoIn');
    if (input) input.addEventListener('change', e => {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (f) addPhoto(f);
    });
    host.querySelectorAll('[data-bd-src]').forEach(img => photoSrc(img.getAttribute('data-bd-src')).then(src => { if (src) img.src = src; }));
    host.querySelectorAll('[data-bd-ph]').forEach(b => b.addEventListener('click', ()=> openPhoto(b.getAttribute('data-bd-ph'))));
  }

  /* ---- measurements form ------------------------------------------------- */
  function openMeasureForm(){
    const u = lenUnits();
    const key = todayKeyBody();
    const latest = site => { const s = measureSeries(site); return s.length ? u.show(s[s.length - 1].v) : ''; };
    openSimpleSheet('Measurements', `
      <div class="bd-form">${SITES.map(([site, label]) => `
        <label class="bd-field"><span>${label}</span>
          <input type="number" inputmode="decimal" step="0.25" data-bd-site="${site}" placeholder="${latest(site)}">
          <em>${u.unit}</em></label>`).join('')}
      </div>
      <p class="subtitle" style="font-size:12px; margin:8px 0 0;">Leave a box empty to skip it today.</p>
      <button class="btn-primary" data-ss-save style="margin-top:14px;">Save</button>`, body => {
      body.querySelector('[data-ss-save]').addEventListener('click', ()=>{
        const today = {};
        body.querySelectorAll('[data-bd-site]').forEach(inp => {
          const n = parseFloat(inp.value);
          if (n > 0) today[inp.getAttribute('data-bd-site')] = Math.round(u.store(n) * 100) / 100;
        });
        if (Object.keys(today).length){
          state.measurements = state.measurements || {};
          state.measurements[key] = Object.assign({}, state.measurements[key] || {}, today);
          saveState();
        }
        closeModal('modalSimple');
        renderBodyPanel();
      });
    });
  }

  /* ---- photos -------------------------------------------------------------- */
  function shrink(file){
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = ()=>{
        const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.82).split(',')[1]);
      };
      img.onerror = ()=>{ URL.revokeObjectURL(url); reject(new Error('unreadable image')); };
      img.src = url;
    });
  }

  function addPhoto(file){
    const FS = bodyFS();
    if (!FS) return;
    const key = todayKeyBody();
    const name = 'photos/' + key + '-' + Date.now().toString(36) + '.jpg';
    shrink(file)
      .then(data => FS.writeFile({ path: name, directory: 'DATA', data, recursive: true }))
      .then(()=>{
        state.photos = (state.photos || []).concat([{ key, file: name }]);
        saveState(); renderBodyPanel();
      })
      .catch(()=>{ if (typeof toast === 'function') toast('That photo could not be saved', 'warn'); });
  }

  const srcCache = {};
  function photoSrc(file){
    const FS = bodyFS();
    if (!FS) return Promise.resolve(null);
    if (srcCache[file]) return Promise.resolve(srcCache[file]);
    return FS.getUri({ path: file, directory: 'DATA' })
      .then(r => (srcCache[file] = window.Capacitor.convertFileSrc(r.uri)))
      .catch(()=> null);
  }

  function openPhoto(file){
    const entry = (state.photos || []).find(p => p.file === file);
    if (!entry) return;
    openSimpleSheet(shortBodyDay(entry.key), `
      <img class="bd-big" alt="Progress photo from ${entry.key}" id="bdBig">
      <button class="text-link danger-link" data-ss-del>Delete this photo</button>`, body => {
      photoSrc(file).then(src => { if (src) body.querySelector('#bdBig').src = src; });
      body.querySelector('[data-ss-del]').addEventListener('click', ()=>{
        const FS = bodyFS();
        state.photos = (state.photos || []).filter(p => p.file !== file);
        saveState();
        if (FS) FS.deleteFile({ path: file, directory: 'DATA' }).catch(()=>{});
        closeModal('modalSimple'); renderBodyPanel();
      });
    });
  }

  /* ---- drawing the new panels on Progress, and Today once they exist ----
     Progress is drawn by renderCalendar, so the panels hang off it the way
     the steps and weight panels hang off the character sheet. Today was
     first drawn before these files loaded, so it is drawn once more now
     that water and workouts can join it. */
  if (typeof window.renderCalendar === 'function'){
    const original = window.renderCalendar;
    window.renderCalendar = function(){
      const out = original.apply(this, arguments);
      [renderCheckin, renderBodyPanel, renderWorkoutHistory].forEach(fn => {
        try { if (typeof fn === 'function') fn(); } catch (e){ console.error('Loadout: progress panel', e); }
      });
      return out;
    };
  }
  if (typeof renderJournal === 'function' && typeof characterExists === 'function' && characterExists()) renderJournal();
