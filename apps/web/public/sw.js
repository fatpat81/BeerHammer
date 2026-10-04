// ─────────────────────────────────────────────────────────────────────────────
// ForceOrg-40k — ServiceWorker with IndexedDB Offline Persistence
// Offline-first strategy for tournament venue connectivity
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_NAME = 'forceorg-40k-v1';
const IDB_NAME = 'forceorg-offline';
const IDB_VERSION = 1;

const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/catalog',
  '/changelog',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon.svg',
];

// ── IndexedDB Helpers ─────────────────────────────────────────────────────────

function openIDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      // Roster data store — persists army lists for offline play
      if (!db.objectStoreNames.contains('rosters')) {
        const rosterStore = db.createObjectStore('rosters', { keyPath: 'id' });
        rosterStore.createIndex('userId', 'userId', { unique: false });
        rosterStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
      // Datasheets store — cached unit profiles
      if (!db.objectStoreNames.contains('datasheets')) {
        const dsStore = db.createObjectStore('datasheets', { keyPath: 'id' });
        dsStore.createIndex('factionId', 'factionId', { unique: false });
      }
      // Stratagems store — cached stratagem data
      if (!db.objectStoreNames.contains('stratagems')) {
        db.createObjectStore('stratagems', { keyPath: 'id' });
      }
      // Weapons store — cached weapon profiles
      if (!db.objectStoreNames.contains('weapons')) {
        const wepStore = db.createObjectStore('weapons', { keyPath: 'id' });
        wepStore.createIndex('slug', 'slug', { unique: true });
      }
      // Wound state store — persists in-game wound tracking between sessions
      if (!db.objectStoreNames.contains('woundState')) {
        db.createObjectStore('woundState', { keyPath: 'unitInstanceId' });
      }
      // Sync metadata — tracks what data has been cached
      if (!db.objectStoreNames.contains('syncMeta')) {
        db.createObjectStore('syncMeta', { keyPath: 'key' });
      }
    };
  });
}

async function idbPut(storeName, data) {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    if (Array.isArray(data)) {
      data.forEach(item => store.put(item));
    } else {
      store.put(data);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGetAll(storeName) {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbGet(storeName, key) {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ── Cache API Responses to IndexedDB ──────────────────────────────────────────

async function cacheApiResponse(url, responseData) {
  try {
    const parsedUrl = new URL(url);
    const path = parsedUrl.pathname;

    // Cache roster data
    if (path.match(/^\/api\/rosters\/?$/) && responseData.data) {
      const rosters = Array.isArray(responseData.data) ? responseData.data : [responseData.data];
      await idbPut('rosters', rosters);
      await idbPut('syncMeta', { key: 'rosters_cached_at', value: Date.now() });
    }

    // Cache single roster
    if (path.match(/^\/api\/rosters\/[^/]+\/?$/) && responseData.data) {
      await idbPut('rosters', responseData.data);
    }

    // Cache datasheets
    if (path.match(/^\/api\/datasheets/) && responseData.data) {
      const sheets = Array.isArray(responseData.data) ? responseData.data : [responseData.data];
      await idbPut('datasheets', sheets);
      await idbPut('syncMeta', { key: 'datasheets_cached_at', value: Date.now() });
    }

    // Cache stratagems
    if (path.match(/^\/api\/stratagems/) && responseData.data) {
      const strats = Array.isArray(responseData.data) ? responseData.data : [responseData.data];
      await idbPut('stratagems', strats);
    }

    // Cache weapons
    if (path.match(/^\/api\/weapons/) && responseData.data) {
      const weps = Array.isArray(responseData.data) ? responseData.data : [responseData.data];
      await idbPut('weapons', weps);
    }
  } catch (err) {
    console.warn('[SW] Failed to cache API response to IDB:', err);
  }
}

// ── Serve Offline Fallbacks from IndexedDB ────────────────────────────────────

async function serveFromIDB(url) {
  try {
    const parsedUrl = new URL(url);
    const path = parsedUrl.pathname;

    // Serve cached rosters
    if (path.match(/^\/api\/rosters\/?$/)) {
      const rosters = await idbGetAll('rosters');
      if (rosters.length > 0) {
        return new Response(JSON.stringify({ success: true, data: rosters, meta: { offline: true } }), {
          headers: { 'Content-Type': 'application/json', 'X-Offline': 'true' },
        });
      }
    }

    // Serve single roster
    const rosterMatch = path.match(/^\/api\/rosters\/([^/]+)\/?$/);
    if (rosterMatch) {
      const roster = await idbGet('rosters', rosterMatch[1]);
      if (roster) {
        return new Response(JSON.stringify({ success: true, data: roster, meta: { offline: true } }), {
          headers: { 'Content-Type': 'application/json', 'X-Offline': 'true' },
        });
      }
    }

    // Serve cached datasheets
    if (path.match(/^\/api\/datasheets/)) {
      const sheets = await idbGetAll('datasheets');
      if (sheets.length > 0) {
        return new Response(JSON.stringify({ success: true, data: sheets, meta: { offline: true } }), {
          headers: { 'Content-Type': 'application/json', 'X-Offline': 'true' },
        });
      }
    }

    // Serve cached stratagems
    if (path.match(/^\/api\/stratagems/)) {
      const strats = await idbGetAll('stratagems');
      if (strats.length > 0) {
        return new Response(JSON.stringify({ success: true, data: strats, meta: { offline: true } }), {
          headers: { 'Content-Type': 'application/json', 'X-Offline': 'true' },
        });
      }
    }
  } catch (err) {
    console.warn('[SW] IDB fallback failed:', err);
  }
  return null;
}

// ── Install ───────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
  self.skipWaiting();
});

// ── Activate ──────────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET for caching (but still intercept for offline fallback)
  if (request.method !== 'GET') {
    event.respondWith(fetch(request));
    return;
  }

  // API requests: network-first with IndexedDB fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response.ok) {
            // Clone and cache both in Cache API and IndexedDB
            const cloneForCache = response.clone();
            const cloneForIDB = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, cloneForCache));

            // Parse and store in IndexedDB for richer offline queries
            try {
              const jsonData = await cloneForIDB.json();
              await cacheApiResponse(request.url, jsonData);
            } catch {
              // Non-JSON response, skip IDB
            }
          }
          return response;
        })
        .catch(async () => {
          // Network failed — try IndexedDB first (richer data)
          const idbResponse = await serveFromIDB(request.url);
          if (idbResponse) return idbResponse;

          // Fall back to Cache API
          const cached = await caches.match(request);
          if (cached) return cached;

          // Return offline error response
          return new Response(
            JSON.stringify({
              success: false,
              error: { code: 'OFFLINE', message: 'No network connectivity. Using cached data.' },
              meta: { offline: true },
            }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
          );
        })
    );
    return;
  }

  // Static assets: cache-first
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|webp|svg|woff2?)$/) ||
    url.pathname.startsWith('/assets/')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Navigation: network-first with offline shell fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/'))
    );
    return;
  }

  // Default: network
  event.respondWith(fetch(request));
});

// ── Message Handler for Client Communication ──────────────────────────────────
// Allows the main thread to request IDB operations via postMessage

self.addEventListener('message', async (event) => {
  const { type, payload } = event.data || {};

  if (type === 'SAVE_WOUND_STATE') {
    try {
      await idbPut('woundState', payload);
      event.source?.postMessage({ type: 'WOUND_STATE_SAVED', success: true });
    } catch (err) {
      event.source?.postMessage({ type: 'WOUND_STATE_SAVED', success: false, error: err.message });
    }
  }

  if (type === 'LOAD_WOUND_STATE') {
    try {
      const state = await idbGet('woundState', payload.unitInstanceId);
      event.source?.postMessage({ type: 'WOUND_STATE_LOADED', data: state || null });
    } catch (err) {
      event.source?.postMessage({ type: 'WOUND_STATE_LOADED', data: null, error: err.message });
    }
  }

  if (type === 'CACHE_ROSTER') {
    try {
      await idbPut('rosters', payload);
      event.source?.postMessage({ type: 'ROSTER_CACHED', success: true });
    } catch (err) {
      event.source?.postMessage({ type: 'ROSTER_CACHED', success: false, error: err.message });
    }
  }
});
