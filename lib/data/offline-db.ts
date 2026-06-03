/**
 * Zero-dependency native IndexedDB local client database for SolarEPC.
 * Caches all fetched projects, surveys, installations, inspections, and users.
 * Supports full local offline search, filtering, and pagination!
 */

export class OfflineDB {
  private dbName = 'SolarEPCOfflineDB'
  private version = 3
  private db: IDBDatabase | null = null
  private listeners = new Set<() => void>()

  subscribe(listener: () => void) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  notify() {
    this.listeners.forEach((l) => {
      try {
        l()
      } catch (e) {
        console.error('Error notifying listener:', e)
      }
    })
  }

  private getDB(): Promise<IDBDatabase> {
    if (typeof window === 'undefined') {
      return Promise.reject(new Error('IndexedDB is browser-only'))
    }
    if (this.db) return Promise.resolve(this.db)
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('IndexedDB open request timed out after 3000ms'))
      }, 3000)

      const request = indexedDB.open(this.dbName, this.version)
      
      request.onupgradeneeded = (e) => {
        const db = request.result
        const stores = ['projects', 'surveys', 'installations', 'inspections', 'users']
        stores.forEach(store => {
          if (!db.objectStoreNames.contains(store)) {
            db.createObjectStore(store, { keyPath: 'id' })
          }
        })
        if (!db.objectStoreNames.contains('sync_queue')) {
          db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true })
        }
        if (!db.objectStoreNames.contains('offline_files')) {
          db.createObjectStore('offline_files', { keyPath: 'id' })
        }
      }

      request.onsuccess = () => {
        clearTimeout(timeout)
        this.db = request.result
        
        // Handle database closing unexpectedly (e.g., user clears data)
        this.db.onclose = () => {
          this.db = null
        }
        this.db.onversionchange = () => {
          if (this.db) {
            this.db.close()
            this.db = null
          }
        }
        
        resolve(request.result)
      }

      request.onerror = () => {
        clearTimeout(timeout)
        reject(request.error)
      }

      request.onblocked = () => {
        clearTimeout(timeout)
        reject(new Error('IndexedDB upgrade blocked by another tab'))
      }
    })
  }

  async putMany(storeName: string, items: any[], options?: { silent?: boolean }): Promise<void> {
    if (typeof window === 'undefined') return
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite')
      const store = tx.objectStore(storeName)
      items.forEach(item => {
        if (item && item.id) {
          store.put(item)
        }
      })
      tx.oncomplete = () => {
        if (!options?.silent) {
          this.notify()
        }
        resolve()
      }
      tx.onerror = () => reject(tx.error)
    })
  }

  async getAll(storeName: string): Promise<any[]> {
    if (typeof window === 'undefined') return []
    try {
      const db = await this.getDB()
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly')
        const store = tx.objectStore(storeName)
        const request = store.getAll()
        request.onsuccess = () => resolve(request.result || [])
        request.onerror = () => reject(request.error)
      })
    } catch {
      return []
    }
  }

  async putOne(storeName: string, item: any, options?: { silent?: boolean }): Promise<void> {
    if (!item || !item.id) return
    await this.putMany(storeName, [item], options)
  }

  async deleteOne(storeName: string, id: string, options?: { silent?: boolean }): Promise<void> {
    if (typeof window === 'undefined') return
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite')
      const store = tx.objectStore(storeName)
      const request = store.delete(id)
      request.onsuccess = () => {
        if (!options?.silent) {
          this.notify()
        }
        resolve()
      }
      request.onerror = () => reject(request.error)
    })
  }

  async getOne(storeName: string, id: string): Promise<any | undefined> {
    if (typeof window === 'undefined') return undefined
    try {
      const db = await this.getDB()
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly')
        const store = tx.objectStore(storeName)
        const request = store.get(id)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
    } catch {
      return undefined
    }
  }

  // --- Sync Queue Helper Methods ---
  async addMutation(mutation: {
    storeName: string
    action: string
    entityId: string
    payload: any
  }): Promise<number> {
    if (typeof window === 'undefined') return 0
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_queue', 'readwrite')
      const store = tx.objectStore('sync_queue')
      const request = store.add({
        ...mutation,
        timestamp: Date.now()
      })
      request.onsuccess = () => {
        this.notify()
        resolve(request.result as number)
      }
      request.onerror = () => reject(request.error)
    })
  }

  async getPendingMutations(): Promise<any[]> {
    if (typeof window === 'undefined') return []
    try {
      const db = await this.getDB()
      return new Promise((resolve, reject) => {
        const tx = db.transaction('sync_queue', 'readonly')
        const store = tx.objectStore('sync_queue')
        const request = store.getAll()
        request.onsuccess = () => resolve(request.result || [])
        request.onerror = () => reject(request.error)
      })
    } catch {
      return []
    }
  }

  async removeMutation(id: number): Promise<void> {
    if (typeof window === 'undefined') return
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_queue', 'readwrite')
      const store = tx.objectStore('sync_queue')
      const request = store.delete(id)
      request.onsuccess = () => {
        this.notify()
        resolve()
      }
      request.onerror = () => reject(request.error)
    })
  }

  // --- Offline Files Helper Methods ---
  async saveOfflineFile(id: string, file: Blob | File, name: string, type: string): Promise<void> {
    if (typeof window === 'undefined') return
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('offline_files', 'readwrite')
      const store = tx.objectStore('offline_files')
      const request = store.put({ id, file, name, type })
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getOfflineFile(id: string): Promise<{ file: Blob | File; name: string; type: string } | undefined> {
    if (typeof window === 'undefined') return undefined
    try {
      const db = await this.getDB()
      return new Promise((resolve, reject) => {
        const tx = db.transaction('offline_files', 'readonly')
        const store = tx.objectStore('offline_files')
        const request = store.get(id)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
    } catch {
      return undefined
    }
  }

  async removeOfflineFile(id: string): Promise<void> {
    if (typeof window === 'undefined') return
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('offline_files', 'readwrite')
      const store = tx.objectStore('offline_files')
      const request = store.delete(id)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }
}

export const offlineDB = new OfflineDB()
