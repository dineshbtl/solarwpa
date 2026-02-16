export function safeParseJSON<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function readLocalStorageJSON<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  return safeParseJSON<T>(window.localStorage.getItem(key))
}

export function writeLocalStorageJSON<T>(key: string, value: T) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(key, JSON.stringify(value))
}

