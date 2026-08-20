/* ==========================================================================
   SERVICE WORKER  —  makes Loadout launch without a network.

   Bump CACHE_VERSION on every deploy. The name is the whole update
   mechanism: a new name means a new cache, the install below fills it,
   and activate deletes every older one. Forget to bump it and users keep
   running the old shell forever, because nothing tells them otherwise.

   Two strategies, deliberately different:

     - The app shell (this list) is PRECACHED at install and served
       cache-first. It never changes between deploys, so reading it from
       disk is both faster and correct.

     - Everything else same-origin — fonts, mostly — is cached lazily the
       first time it is fetched. Precaching all 55 font files would add
       1.2MB to an install that must finish before the app is usable,
       to guarantee offline access to faces most users never render.

   Cross-origin requests (Open Food Facts, the ZXing CDN) are passed
   straight through. They are lookups, not app code: offline they should
   fail honestly and let the caller show its own error, not serve a stale
   answer that looks live.
   ========================================================================== */

const CACHE_VERSION = 'loadout-v5';

/* Kept in the same order index.html loads them, so a missing file here is
   easy to spot against the <script> block there. */
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './fonts.css',
  './icons.js',
  './privacy.html',
  './manifest.webmanifest',
  './icon.svg',
  './app-icons/icon-180.png',
  './app-icons/icon-192.png',
  './app-icons/icon-512.png',
  './fonts/pressstart2p_v16_e3t4euO8T-267oIAQAu6jDQyK3nVivM.woff2',
  './fonts/sharetechmono_v16_J7aHnp1uDWRBEqV98dVQztYldFcLowEF.woff2',
  './js/01-boot.js',
  './js/02-themes.js',
  './js/03-data-tiers.js',
  './js/04-nutrition.js',
  './js/05-food-families.js',
  './js/06-dish-templates.js',
  './js/07-method.js',
  './js/08-sauces.js',
  './js/09-state.js',
  './js/10-recipe-book.js',
  './js/11-goal-fit.js',
  './js/12-journal.js',
  './js/13-prep-cook.js',
  './js/14-containers-flex.js',
  './js/15-quest-log.js',
  './js/16-tabs.js',
  './js/17-onboarding.js',
  './js/18-tier-select.js',
  './js/19-preferences.js',
  './js/20-cravings.js',
  './js/21-food-lookup.js',
  './js/22-eating-style.js',
  './js/23-suggested-loadout.js',
  './js/24-daily-loadout.js',
  './js/25-persistence.js',
  './js/26-shopping-pantry.js',
  './js/27-init.js',
  './js/28-legal.js',
  './js/29-scanner.js',
  './js/30-timers.js',
  './js/31-journal-scan.js',
  './js/32-method-check.js',
  './js/33-native-backup.js',
  './js/34-health-import.js'
];

/* Install: fill the new cache, then take over immediately rather than
   waiting for every old tab to close. A half-updated app is worse than a
   fully updated one, and the activate handler below clears the old cache
   in the same beat. */
self.addEventListener('install', function(event){
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(function(cache){ return cache.addAll(SHELL); })
      .then(function(){ return self.skipWaiting(); })
  );
});

/* Activate: drop every cache that is not the current version, then claim
   open pages so the first load after an update is already controlled. */
self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys()
      .then(function(names){
        return Promise.all(names.map(function(name){
          return name === CACHE_VERSION ? null : caches.delete(name);
        }));
      })
      .then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(event){
  const req = event.request;

  /* Only GET is cacheable. POSTs to Open Food Facts must never be
     replayed from disk. */
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // see header note

  /* Navigations resolve to the shell. Without this a deep reload offline
     would miss the cache, because the cached key is './' and the request
     may carry a query string or hash. */
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then(function(hit){
        return hit || fetch(req);
      })
    );
    return;
  }

  /* Cache-first for assets, filling the cache on the way past. Only
     genuine 200s are stored: caching a 404 would persist the mistake
     until the next version bump. */
  event.respondWith(
    caches.match(req).then(function(hit){
      if (hit) return hit;
      return fetch(req).then(function(res){
        if (!res || res.status !== 200 || res.type !== 'basic') return res;
        const copy = res.clone();
        caches.open(CACHE_VERSION).then(function(cache){ cache.put(req, copy); });
        return res;
      });
    })
  );
});
