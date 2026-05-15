'use client'

import { useEffect, useMemo, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'

export const INSTALLATION_PHOTOS_BUCKET = 'solar_bucket'

/** Same rules as server upload (`installations-server` / `installations.ts`). */
export function sanitizeInstallationPhotoFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120)
}

export function buildInstallationPhotoStoragePath(
  installationId: string,
  photoId: string,
  category: string,
  fileName: string
): string {
  const safe = sanitizeInstallationPhotoFileName(fileName)
  return `${installationId}/${photoId}_${category}_${safe}`
}

export type InstallationPhotoUrlInput = {
  id: string
  url?: string | null
  category?: string
  file?: { name?: string }
}

/** Extract object path (within bucket) from a Supabase public, sign, or legacy URL. */
export function extractStoragePathFromUrl(publicUrl: string): string | null {
  if (!publicUrl || typeof publicUrl !== "string") return null
  const url = publicUrl.trim()
  const b = INSTALLATION_PHOTOS_BUCKET
  const markers = [
    `/object/public/${b}/`,
    `/storage/v1/object/public/${b}/`,
    `/object/sign/${b}/`,
    `/storage/v1/object/sign/${b}/`,
  ]
  for (const marker of markers) {
    const idx = url.indexOf(marker)
    if (idx >= 0) {
      let rest = url.slice(idx + marker.length)
      const q = rest.indexOf("?")
      if (q >= 0) rest = rest.slice(0, q)
      try {
        return decodeURIComponent(rest)
      } catch {
        return rest
      }
    }
  }
  const legacy = url.match(new RegExp(`/${b}/([^?]+)`))
  if (legacy?.[1]) {
    try {
      return decodeURIComponent(legacy[1])
    } catch {
      return legacy[1]
    }
  }
  return null
}

/** Normalize URL host to current project (fixes env drift). */
export function rewriteStorageUrl(url: string): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl || !url) return url
  const storagePath = extractStoragePathFromUrl(url)
  if (!storagePath) return url
  return `${supabaseUrl}/storage/v1/object/public/${INSTALLATION_PHOTOS_BUCKET}/${storagePath}`
}

/**
 * Map photo id → display URL (signed when bucket is private; same pattern as survey uploads).
 * When `url` is missing but `installationId` + `category` + `file.name` are present, reconstructs
 * the storage path used at upload time so images still load for older rows without `url` in JSON.
 */
export function useInstallationPhotoDisplayUrls(
  photos: InstallationPhotoUrlInput[] | undefined,
  installationId?: string | null
): Record<string, string> {
  const signature = useMemo(
    () =>
      JSON.stringify({
        installationId: installationId ?? '',
        items: (photos ?? []).map((p) => ({
          id: p.id,
          url: p.url ?? '',
          category: p.category ?? '',
          fileName: p.file?.name ?? '',
        })),
      }),
    [photos, installationId]
  )
  const [byId, setById] = useState<Record<string, string>>({})

  useEffect(() => {
    const list = photos ?? []
    if (list.length === 0) {
      setById({})
      return
    }
    let cancelled = false

    async function resolve() {
      const fallback: Record<string, string> = {}
      const entries: { id: string; path: string; url: string }[] = []

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

      for (const p of list) {
        let url = typeof p.url === 'string' ? p.url.trim() : ''

        if (
          !url &&
          installationId &&
          p.category &&
          p.file?.name &&
          supabaseUrl &&
          isSupabaseConfigured()
        ) {
          const path = buildInstallationPhotoStoragePath(
            installationId,
            p.id,
            p.category,
            p.file.name
          )
          url = `${supabaseUrl}/storage/v1/object/public/${INSTALLATION_PHOTOS_BUCKET}/${path}`
        }

        if (!url) continue
        if (url.startsWith('data:')) {
          fallback[p.id] = url
          continue
        }
        if (!isSupabaseConfigured()) {
          fallback[p.id] = url
          continue
        }
        const path = extractStoragePathFromUrl(url)
        fallback[p.id] = rewriteStorageUrl(url)
        if (path) {
          entries.push({ id: p.id, path, url })
        }
      }

      if (!isSupabaseConfigured()) {
        if (!cancelled) setById(fallback)
        return
      }

      if (!cancelled) setById(fallback)

      try {
        const supabase = getSupabaseBrowserClient()
        if (entries.length === 0) return
        const { data, error } = await supabase.storage
          .from(INSTALLATION_PHOTOS_BUCKET)
          .createSignedUrls(
            entries.map((e) => e.path),
            3600
          )
        if (error || !data || cancelled) return
        const map: Record<string, string> = { ...fallback }
        data.forEach((item, i) => {
          if (item.signedUrl) map[entries[i].id] = item.signedUrl
        })
        if (!cancelled) setById(map)
      } catch {
        // keep public URL fallback
      }
    }

    resolve()
    return () => {
      cancelled = true
    }
  }, [signature])

  return byId
}
