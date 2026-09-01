'use strict';
/* Covers export and import in 50-data-export.js.

   This is the one feature whose failure mode is silent and permanent. An
   export that quietly omits a key produces a file that looks fine and
   restores an incomplete person; an import that half-applies leaves a save
   that is part one history and part another. So most of what is checked
   here is refusal — that a bad file is turned away before anything is
   written, and that a good one leaves nothing of the old data behind. */

const {loadFunctions, suite} = require('./helpers');

const KEYS = ['gfl.state.v1', 'loadout.timers.v1', 'loadout.disclaimer.v1',
              'gfl.health.write.v1', 'gfl.reminders.v1'];

function rig(initial){
  const store = Object.assign({}, initial || {});
  const session = {};
  const localStorage = {
    getItem: k => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  };
  const ctx = loadFunctions('50-data-export.js',
    ['exportBlob', 'exportFilename', 'validateImport', 'importData'],
    {
      localStorage,
      sessionStorage: {removeItem: k => { delete session[k]; },
                       getItem: k => session[k] || null,
                       setItem: (k, v) => { session[k] = v; }},
      window: {},
      Date,
      EXPORT_KEYS: KEYS,
      EXPORT_VERSION: 1,
    });
  ctx.store = store;
  return ctx;
}

const SAVE = JSON.stringify({goal: 'loss', bodyweight: 184, log: {'2026-09-01': {meals: {}}}});

module.exports = () => suite('data export', t => {

  t.section('what an export carries');
  {
    const c = rig({'gfl.state.v1': SAVE, 'loadout.timers.v1': '[]'});
    const blob = c.exportBlob();
    t.equal('it names itself', blob.app, 'Loadout');
    t.equal('and its version', blob.version, 1);
    t.check('with a timestamp', typeof blob.exportedAt === 'string' && blob.exportedAt.length > 10);
    t.equal('the main save is carried verbatim', blob.keys['gfl.state.v1'], SAVE);
    t.equal('and so are the timers', blob.keys['loadout.timers.v1'], '[]');
  }
  {
    /* Keys that are not the app's are not swept up. Another page on the
       same origin is not this app's data to hand out. */
    const c = rig({'gfl.state.v1': SAVE, 'some.other.app': 'secret'});
    const blob = c.exportBlob();
    t.equal('a foreign key is left alone',
      blob.keys['some.other.app'], undefined);
  }
  {
    const c = rig({'gfl.state.v1': SAVE});
    t.check('the filename is dated', /^loadout-\d{4}-\d{2}-\d{2}\.json$/.test(c.exportFilename()),
      c.exportFilename());
  }

  t.section('refusing a file that is not one of ours');
  {
    const c = rig({});
    t.equal('not JSON at all', c.validateImport('hello').ok, false);
    t.equal('JSON but not an export', c.validateImport('{"hello":1}').ok, false);
    t.equal('an array', c.validateImport('[]').ok, false);
    t.equal('null', c.validateImport('null').ok, false);
  }
  {
    const c = rig({});
    const newer = JSON.stringify({app: 'Loadout', version: 99, keys: {'gfl.state.v1': SAVE}});
    const res = c.validateImport(newer);
    t.equal('a file from a newer version is refused', res.ok, false);
    t.check('and says so', /newer version/.test(res.why), res.why);
  }
  {
    const c = rig({});
    const empty = JSON.stringify({app: 'Loadout', version: 1, keys: {}});
    t.equal('an export with no save in it', c.validateImport(empty).ok, false);
  }
  {
    /* The one that would otherwise boot the app into a broken state and
       look like it worked. */
    const c = rig({});
    const damaged = JSON.stringify({app: 'Loadout', version: 1,
                                    keys: {'gfl.state.v1': '{not json'}});
    const res = c.validateImport(damaged);
    t.equal('a damaged save inside a valid wrapper is caught', res.ok, false);
    t.check('and named as such', /damaged/.test(res.why), res.why);
  }

  t.section('a refused import writes nothing');
  {
    const c = rig({'gfl.state.v1': SAVE, 'loadout.timers.v1': '[]'});
    c.importData('{"app":"NotLoadout"}');
    t.equal('the existing save is untouched', c.store['gfl.state.v1'], SAVE);
    t.equal('and so is everything else', c.store['loadout.timers.v1'], '[]');
  }

  t.section('a good import replaces rather than merges');
  {
    const incoming = JSON.stringify({
      app: 'Loadout', version: 1,
      keys: {'gfl.state.v1': SAVE, 'gfl.reminders.v1': '{"log":true}'},
    });
    const c = rig({'gfl.state.v1': '{"old":true}', 'loadout.timers.v1': '[{"id":"stale"}]'});
    const res = c.importData(incoming);
    t.equal('it succeeds', res.ok, true);
    t.equal('the save is replaced', c.store['gfl.state.v1'], SAVE);
    t.equal('a key the export carries is written',
      c.store['gfl.reminders.v1'], '{"log":true}');
    /* The failure this guards: importing onto a phone that already had
       data would otherwise leave yesterday's timers running against
       today's imported journal. */
    t.equal('a key the export does NOT carry is cleared, not left behind',
      c.store['loadout.timers.v1'], undefined);
  }
  {
    const c = rig({'gfl.state.v1': '{"old":true}', 'some.other.app': 'keep me'});
    c.importData(JSON.stringify({app:'Loadout', version:1, keys:{'gfl.state.v1': SAVE}}));
    t.equal('a foreign key is not cleared either', c.store['some.other.app'], 'keep me');
  }

  t.section('the backup mirror carries the same keys');
  {
    /* 33-native-backup.js keeps its own copy of the key list, because it
       runs its restore before 50-data-export.js is loaded. Two lists that
       must agree will eventually stop agreeing, so this is the thing that
       notices. A key in one and not the other means data that survives an
       export but not an eviction, or the reverse. */
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'js', '33-native-backup.js'), 'utf8');
    const block = src.slice(src.indexOf('var KEYS'), src.indexOf(';', src.indexOf('var KEYS')));
    const mirrored = new Set(
      (block.match(/'[a-z.0-9]+'/g) || []).map(x => x.replace(/'/g, '')));
    /* PRIMARY is referenced by name rather than as a literal. */
    mirrored.add('gfl.state.v1');

    KEYS.forEach(k =>
      t.check(`${k} is mirrored to the backup file too`, mirrored.has(k),
        Array.from(mirrored)));
    t.equal('and the mirror carries nothing extra', mirrored.size, KEYS.length);
  }

  t.section('a round trip');
  {
    const original = {'gfl.state.v1': SAVE, 'loadout.timers.v1': '[]',
                      'gfl.reminders.v1': '{"weigh":true}'};
    const out = rig(original).exportBlob();
    const fresh = rig({});
    const res = fresh.importData(JSON.stringify(out));
    t.equal('it imports', res.ok, true);
    KEYS.forEach(k => {
      if (original[k] === undefined) return;
      t.equal('survives the round trip: ' + k, fresh.store[k], original[k]);
    });
  }
});
