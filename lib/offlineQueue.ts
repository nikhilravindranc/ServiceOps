/** Durable storage for changes that have not reached the server yet, keyed by user id. IndexedDB, with localStorage as the fallback. */
export type PendingChanges = {
  changes: [kind: string, key: string, baseVersion: number, json: string][];
  deletes: [kind: string, key: string, baseVersion: number][];
};

const DB = "serviceops-offline", STORE = "pending", LS_PREFIX = "serviceops-pending:";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idb<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}

export async function savePending(userId: string, p: PendingChanges): Promise<void> {
  try { await idb("readwrite", s => s.put(p, userId)); try { localStorage.removeItem(LS_PREFIX + userId); } catch { /* ignore */ } return; } catch { /* fall back */ }
  try { localStorage.setItem(LS_PREFIX + userId, JSON.stringify(p)); } catch { /* storage full or unavailable: changes stay in memory only */ }
}

export async function clearPending(userId: string): Promise<void> {
  try { await idb("readwrite", s => s.delete(userId)); } catch { /* ignore */ }
  try { localStorage.removeItem(LS_PREFIX + userId); } catch { /* ignore */ }
}

export async function loadPending(userId: string): Promise<PendingChanges | null> {
  try {
    const v = await idb<PendingChanges | undefined>("readonly", s => s.get(userId));
    if (v && Array.isArray(v.changes) && Array.isArray(v.deletes)) return v;
  } catch { /* fall back */ }
  try {
    const raw = localStorage.getItem(LS_PREFIX + userId);
    if (raw) { const v = JSON.parse(raw); if (Array.isArray(v?.changes) && Array.isArray(v?.deletes)) return v; }
  } catch { /* ignore */ }
  return null;
}
