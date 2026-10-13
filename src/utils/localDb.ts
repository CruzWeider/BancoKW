import { GameState, BoardSpace, MatchStats, RoomRecord, Transaction } from '../types/game';

const IDB_NAME = 'BancoImobiliarioTabletDB';
const IDB_VERSION = 1;
const STORE_KV = 'keyval';

export interface TabletDatabaseSnapshot {
  version: number;
  updatedAt: number;
  activeRoomId: string;
  roomCounter: number;
  activeState: GameState | null;
  rooms: RoomRecord[];
  boardSpaces: BoardSpace[];
  history: MatchStats[];
}

function openIndexedDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(IDB_NAME, IDB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_KV)) {
          db.createObjectStore(STORE_KV);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.warn('IndexedDB open error:', request.error);
        resolve(null);
      };
    } catch (e) {
      console.warn('IndexedDB exception:', e);
      resolve(null);
    }
  });
}

export async function idbSet(key: string, value: any): Promise<void> {
  const db = await openIndexedDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_KV, 'readwrite');
      const store = tx.objectStore(STORE_KV);
      store.put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openIndexedDB();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_KV, 'readonly');
      const store = tx.objectStore(STORE_KV);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function idbClearAll(): Promise<void> {
  const db = await openIndexedDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_KV, 'readwrite');
      const store = tx.objectStore(STORE_KV);
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Sincroniza o snapshot do banco local com o servidor local (data/local_database.json)
 */
export async function syncWithLocalServer(snapshot: Partial<TabletDatabaseSnapshot>): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await fetch('/api/db/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot),
    });
  } catch {
    // Caso esteja offline no tablet, o IndexedDB e o LocalStorage continuam salvando normalmente
  }
}

export async function fetchFromLocalServer(): Promise<TabletDatabaseSnapshot | null> {
  if (typeof window === 'undefined') return null;
  try {
    const res = await fetch('/api/db');
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
