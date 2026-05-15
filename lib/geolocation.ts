/**
 * Geolocation helper: tries GPS first, falls back to IP-based geolocation.
 * GPS (getCurrentPosition) requires secure context (HTTPS); IP fallback works on HTTP.
 */
export type LocationResult = {
  lat: string
  lng: string
  accuracyMeters?: number
  source: 'gps' | 'ip'
}

export async function getCurrentLocation(): Promise<LocationResult> {
  // Try GPS first (only works on HTTPS / localhost)
  const gpsResult = await tryGps()
  if (gpsResult) return gpsResult
  // GPS failed (HTTP, denied, or unsupported) – use IP fallback
  return tryIpFallback()
}

/**
 * Device GPS only (no IP fallback). Use when attaching coordinates to a specific photo.
 *
 * `timeoutMs` keeps mobile photo capture responsive — the wizard captures the
 * site GPS once on step 1, so per-photo lookups can fail fast (3s) rather than
 * blocking the file picker for 15s × N photos.
 */
export async function getDeviceGpsOnly(timeoutMs = 15000): Promise<{
  lat: number
  lng: number
  accuracyMeters?: number
} | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracyMeters: Math.round(position.coords.accuracy),
        })
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 }
    )
  })
}

/** Ask browser location permission right after login; returns true when granted. */
export async function requestDeviceLocationPermission(): Promise<boolean> {
  const pos = await getDeviceGpsOnly()
  return !!pos
}

function tryGps(): Promise<LocationResult | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude.toFixed(6),
          lng: position.coords.longitude.toFixed(6),
          accuracyMeters: Math.round(position.coords.accuracy),
          source: 'gps',
        })
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  })
}

async function tryIpFallback(): Promise<LocationResult> {
  // Try multiple free IP geolocation APIs in order
  const apis = [
    // ip-api.com: free tier uses HTTP only (no HTTPS!)
    async () => {
      const res = await fetch('http://ip-api.com/json/?fields=status,lat,lon')
      if (!res.ok) throw new Error('ip-api failed')
      const d = (await res.json()) as { status?: string; lat?: number; lon?: number }
      if (d.status !== 'success' || typeof d.lat !== 'number' || typeof d.lon !== 'number') throw new Error('bad data')
      return { lat: d.lat, lng: d.lon }
    },
    // ipapi.co: supports HTTPS, generous free tier
    async () => {
      const res = await fetch('https://ipapi.co/json/')
      if (!res.ok) throw new Error('ipapi.co failed')
      const d = (await res.json()) as { latitude?: number; longitude?: number }
      if (typeof d.latitude !== 'number' || typeof d.longitude !== 'number') throw new Error('bad data')
      return { lat: d.latitude, lng: d.longitude }
    },
  ]

  for (const apiFn of apis) {
    try {
      const { lat, lng } = await apiFn()
      return {
        lat: lat.toFixed(6),
        lng: lng.toFixed(6),
        accuracyMeters: 15000, // IP geolocation is city-level (~5-20 km)
        source: 'ip',
      }
    } catch {
      // try next API
    }
  }

  throw new Error('Could not determine location via GPS or IP. Please enter coordinates manually.')
}
