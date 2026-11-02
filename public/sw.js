/* ServiceOps service worker. Plain JS, no build step.
 * - /_next/static and icons: cache-first.
 * - page navigations: network-first, cached copy when offline, offline.html as the last resort.
 * - GET /api/workspace and GET /api/auth/session: network-first, cached copy when offline.
 * - every other /api route and every non-GET request goes straight to the network and is never stored.
 * Cached data is private to the signed-in user: the page tells us who that is and when they sign out. */
const VERSION = "v1";
const STATIC = `serviceops-static-${VERSION}`;
const PAGES = `serviceops-pages-${VERSION}`;
const DATA = `serviceops-data-${VERSION}`;
const KEEP = [STATIC, PAGES, DATA];
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", event => {
  // Only the offline page is precached. The new worker waits until the page says it is safe to switch (see SwRegister).
  event.waitUntil(caches.open(STATIC).then(c => c.add(new Request(OFFLINE_URL, { cache: "reload" }))));
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name.startsWith("serviceops-") && !KEEP.includes(name)) await caches.delete(name);
    await self.clients.claim();
  })());
});

self.addEventListener("message", event => {
  const d = event.data || {};
  if (d.type === "SKIP_WAITING") self.skipWaiting();
  else if (d.type === "CLEAR_CACHES") event.waitUntil(clearUserCaches(true));
  else if (d.type === "SET_USER") event.waitUntil(setUser(String(d.userId || "")));
});

// Page caches and user data are removed on sign-out. The static cache holds nothing user specific and stays.
async function clearUserCaches() {
  await caches.delete(PAGES);
  await caches.delete(DATA);
}

// When a different person signs in, whatever was cached for the previous user is dropped.
async function setUser(userId) {
  if (!userId) return;
  const cache = await caches.open(DATA);
  const marker = new Request("/__sw_user__");
  const prev = await cache.match(marker);
  const prevId = prev ? await prev.text() : "";
  if (prevId && prevId !== userId) { await caches.delete(PAGES); await caches.delete(DATA); }
  await (await caches.open(DATA)).put(marker, new Response(userId));
}

const isStaticAsset = url => url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname === "/logo.png" || url.pathname === "/logo-light.png" || url.pathname === "/manifest.webmanifest";

async function cacheFirst(request) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone()).catch(() => {});
  return res;
}

async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    // Only plain successful responses are kept (not redirects to the login page, not errors).
    if (res.ok && !res.redirected && res.type === "basic") cache.put(request, res.clone()).catch(() => {});
    return res;
  } catch (err) {
    const hit = await cache.match(request, { ignoreVary: true });
    if (hit) return hit;
    if (fallbackUrl) { const off = await (await caches.open(STATIC)).match(fallbackUrl); if (off) return off; }
    throw err;
  }
}

self.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname === "/api/workspace" || url.pathname === "/api/auth/session") {
    event.respondWith(networkFirst(request, DATA));
    return;
  }
  if (url.pathname.startsWith("/api/")) return; // never cached
  if (isStaticAsset(url)) { event.respondWith(cacheFirst(request)); return; }
  if (request.mode === "navigate") {
    // Keyed by path only, so a page opened with a different query string still has a cached copy.
    const key = new Request(url.origin + url.pathname);
    event.respondWith((async () => {
      const cache = await caches.open(PAGES);
      try {
        const res = await fetch(request);
        if (res.ok && !res.redirected && res.type === "basic") cache.put(key, res.clone()).catch(() => {});
        return res;
      } catch (err) {
        const hit = await cache.match(key);
        if (hit) return hit;
        const off = await (await caches.open(STATIC)).match(OFFLINE_URL);
        if (off) return off;
        throw err;
      }
    })());
  }
});
