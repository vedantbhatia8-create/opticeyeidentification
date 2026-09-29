/** Minimal promise wrapper around IndexedDB with an in-memory fallback. */

export interface KeyValueStore {
  get<T>(store: string, key: string): Promise<T | undefined>
  getAll<T>(store: string): Promise<T[]>
  put<T>(store: string, value: T, key?: string): Promise<void>
  delete(store: string, key: string): Promise<void>
  clear(store: string): Promise<void>
  readonly persistent: boolean
}

const DB_NAME = 'optic-access'
const DB_VERSION = 2
export const STORES = { identities: 'identities', scans: 'scans', keys: 'keys', suite: 'suite' } as const

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

class IdbStore implements KeyValueStore {
  readonly persistent = true
  private readonly db: IDBDatabase
  constructor(db: IDBDatabase) {
    this.db = db
  }
  private tx(store: string, mode: IDBTransactionMode) {
    return this.db.transaction(store, mode).objectStore(store)
  }
  get<T>(store: string, key: string) {
    return req(this.tx(store, 'readonly').get(key)) as Promise<T | undefined>
  }
  getAll<T>(store: string) {
    return req(this.tx(store, 'readonly').getAll()) as Promise<T[]>
  }
  async put<T>(store: string, value: T, key?: string) {
    await req(this.tx(store, 'readwrite').put(value, key))
  }
  async delete(store: string, key: string) {
    await req(this.tx(store, 'readwrite').delete(key))
  }
  async clear(store: string) {
    await req(this.tx(store, 'readwrite').clear())
  }
}

class MemoryStore implements KeyValueStore {
  readonly persistent = false
  private data = new Map<string, Map<string, unknown>>()
  private bucket(store: string) {
    if (!this.data.has(store)) this.data.set(store, new Map())
    return this.data.get(store)!
  }
  async get<T>(store: string, key: string) {
    return this.bucket(store).get(key) as T | undefined
  }
  async getAll<T>(store: string) {
    return [...this.bucket(store).values()] as T[]
  }
  async put<T>(store: string, value: T, key?: string) {
    this.bucket(store).set(key ?? (value as { id: string }).id, value)
  }
  async delete(store: string, key: string) {
    this.bucket(store).delete(key)
  }
  async clear(store: string) {
    this.bucket(store).clear()
  }
}

export async function openStore(): Promise<KeyValueStore> {
  try {
    if (typeof indexedDB === 'undefined') throw new Error('no indexedDB')
    const open = indexedDB.open(DB_NAME, DB_VERSION)
    open.onupgradeneeded = () => {
      const db = open.result
      if (!db.objectStoreNames.contains(STORES.identities)) db.createObjectStore(STORES.identities, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(STORES.scans)) db.createObjectStore(STORES.scans, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(STORES.keys)) db.createObjectStore(STORES.keys)
      // v2: sealed records for Optic apps (vault items, eyes-only documents)
      if (!db.objectStoreNames.contains(STORES.suite)) db.createObjectStore(STORES.suite, { keyPath: 'id' })
    }
    return new IdbStore(await req(open))
  } catch (err) {
    console.warn('[optic] IndexedDB unavailable — enrollments will not persist', err)
    return new MemoryStore()
  }
}
