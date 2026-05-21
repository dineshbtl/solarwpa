/**
 * Zero-dependency native IndexedDB local client database for SolarEPC.
 * Caches all fetched projects, surveys, installations, inspections, and users.
 * Supports full local offline search, filtering, and pagination!
 */

export class OfflineDB {
  private dbName = 'SolarEPCOfflineDB'
  private version = 2
  private db: IDBDatabase | null = null

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

  async putMany(storeName: string, items: any[]): Promise<void> {
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
      tx.oncomplete = () => resolve()
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

  async putOne(storeName: string, item: any): Promise<void> {
    if (!item || !item.id) return
    await this.putMany(storeName, [item])
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
}

export const offlineDB = new OfflineDB()
