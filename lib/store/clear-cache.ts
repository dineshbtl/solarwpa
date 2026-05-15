/**
 * Wipe every app-owned client-side cache key without touching Supabase auth.
 *
 * Scope:
 *  - localStorage AND sessionStorage entries whose key starts with `solarepc.`
 *    (form drafts, list filters, last-seen tabs — anything we persist ourselves).
 *  - Auth cookies (`sb-*`) and Supabase session storage entries (`sb-*`) are left alone
 *    so the user does not get logged out when they click "Clear cache".
 *
 * Returns the total number of keys removed (sum across both storages) so the caller can
 * surface a confirmation toast like "Cleared 7 cached items".
 *
 * SSR-safe: no-ops cleanly when `window` is unavailable.
 */

import { FORM_DRAFT_PREFIX } from './use-form-draft'

const APP_PREFIXES = ['solarepc.'] as const

function shouldClearKey(key: string): boolean {
  return APP_PREFIXES.some((p) => key.startsWith(p)) || key.startsWith(FORM_DRAFT_PREFIX)
}

function clearStorage(storage: Storage | null): number {
  if (!storage) return 0
  let count = 0
  try {
    const keys: string[] = []
    for (let i = 0; i < storage.length; i += 1) {
      const k = storage.key(i)
      if (k && shouldClearKey(k)) keys.push(k)
    }
    for (const k of keys) {
      try {
        storage.removeItem(k)
        count += 1
      } catch {
        // ignore individual failures
      }
    }
  } catch {
    // SecurityError on private browsing — return what we have
  }
  return count
}

export function clearAppCache(): number {
  if (typeof window === 'undefined') return 0
  return clearStorage(window.localStorage) + clearStorage(window.sessionStorage)
}
