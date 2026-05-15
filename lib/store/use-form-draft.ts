'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/**
 * Generic form-draft persistence hook backed by localStorage.
 *
 * - Debounces writes (default 250ms) so per-keystroke watchers don't thrash storage.
 * - Versioned envelope so old/incompatible drafts are silently ignored after a schema change.
 * - SSR-safe: no-ops while `typeof window === 'undefined'`.
 * - Quota-safe: every storage access is wrapped in try/catch.
 *
 * Files (e.g. photos) are intentionally not persisted — browser File objects are not JSON
 * serialisable and photos are too large for localStorage. Callers should keep file inputs
 * outside the value passed here and surface a "re-attach photos" hint to users on restore.
 *
 * Usage:
 * ```tsx
 * const watched = form.watch()
 * const { restore, clear, hasDraft, savedAt } = useFormDraft('surveys.new', watched)
 * useEffect(() => {
 *   const d = restore()
 *   if (d) form.reset(d)
 * }, [])
 * // on successful save: clear()
 * ```
 */

export const FORM_DRAFT_PREFIX = 'solarepc.draft.'

type DraftEnvelope<T> = {
  v: number
  savedAt: string
  data: T
}

type UseFormDraftOptions = {
  /** Bump when the underlying schema changes to invalidate stale drafts. Default 1. */
  version?: number
  /** Turn persistence off (e.g. while initial server data is loading). Default true. */
  enabled?: boolean
  /** Storage write debounce in ms. Default 250. */
  debounceMs?: number
}

export type UseFormDraftReturn<T> = {
  /** ISO timestamp of the last successful write, or null if no draft has been written yet this session. */
  savedAt: string | null
  /** Read the stored draft. Returns null if missing, malformed, or from a different version. */
  restore: () => T | null
  /** Remove the stored draft and reset savedAt to null. Call this after a successful save. */
  clear: () => void
  /** True if a draft is currently stored under this key. */
  hasDraft: () => boolean
  /**
   * Read the savedAt timestamp from storage without restoring the body — useful for the
   * "Restore draft (saved N ago)?" banner shown immediately on mount, before this session
   * has had a chance to write.
   */
  peekSavedAt: () => string | null
}

export function useFormDraft<T>(
  key: string,
  value: T,
  options: UseFormDraftOptions = {},
): UseFormDraftReturn<T> {
  const version = options.version ?? 1
  const enabled = options.enabled ?? true
  const debounceMs = options.debounceMs ?? 250
  const storageKey = FORM_DRAFT_PREFIX + key
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const mountedRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    if (typeof window === 'undefined') return
    const id = setTimeout(() => {
      try {
        const envelope: DraftEnvelope<T> = {
          v: version,
          savedAt: new Date().toISOString(),
          data: value,
        }
        window.localStorage.setItem(storageKey, JSON.stringify(envelope))
        if (mountedRef.current) setSavedAt(envelope.savedAt)
      } catch {
        // quota exceeded, private browsing, or localStorage unavailable — ignore
      }
    }, debounceMs)
    return () => clearTimeout(id)
  }, [storageKey, value, version, enabled, debounceMs])

  const restore = useCallback((): T | null => {
    if (typeof window === 'undefined') return null
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) return null
      const env = JSON.parse(raw) as DraftEnvelope<T>
      if (!env || typeof env !== 'object') return null
      if (env.v !== version) return null
      return env.data
    } catch {
      return null
    }
  }, [storageKey, version])

  const clear = useCallback(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.removeItem(storageKey)
    } catch {
      // ignore
    }
    if (mountedRef.current) setSavedAt(null)
  }, [storageKey])

  const hasDraft = useCallback((): boolean => {
    if (typeof window === 'undefined') return false
    try {
      return window.localStorage.getItem(storageKey) != null
    } catch {
      return false
    }
  }, [storageKey])

  const peekSavedAt = useCallback((): string | null => {
    if (typeof window === 'undefined') return null
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) return null
      const env = JSON.parse(raw) as DraftEnvelope<T>
      if (!env || typeof env !== 'object') return null
      if (env.v !== version) return null
      return typeof env.savedAt === 'string' ? env.savedAt : null
    } catch {
      return null
    }
  }, [storageKey, version])

  return useMemo(
    () => ({ savedAt, restore, clear, hasDraft, peekSavedAt }),
    [savedAt, restore, clear, hasDraft, peekSavedAt],
  )
}
