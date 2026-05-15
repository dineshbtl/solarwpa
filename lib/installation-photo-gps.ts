export type InstallationPhotoGpsSource = "exif" | "device" | "manual"

/** GPS data stored on each installation photo (JSON in DB / localStorage). */
export type InstallationPhotoGps = {
  latitude: number
  longitude: number
  gpsAccuracyMeters?: number
  source: InstallationPhotoGpsSource
}

/**
 * Read GPS from image EXIF (common on phone camera JPEG/HEIC).
 * Call on the original file before compression — re-encoding often strips EXIF.
 */
export async function extractGpsFromImageFile(file: File): Promise<InstallationPhotoGps | null> {
  try {
    const exifr = (await import("exifr")).default
    const exif = await exifr.parse(file, { gps: true })
    if (!exif) return null
    const lat = exif.latitude
    const lng = exif.longitude
    if (lat == null || lng == null) return null
    const latitude = typeof lat === "number" ? lat : parseFloat(String(lat))
    const longitude = typeof lng === "number" ? lng : parseFloat(String(lng))
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null
    return { latitude, longitude, source: "exif" }
  } catch {
    return null
  }
}

export function parseStoredGps(raw: Record<string, unknown>): InstallationPhotoGps | null {
  const lat = parseOptionalNumber(raw.latitude)
  const lng = parseOptionalNumber(raw.longitude)
  if (lat == null || lng == null) return null
  const acc = parseOptionalNumber(raw.gpsAccuracyMeters)
  const src = raw.gpsSource
  const source: InstallationPhotoGpsSource =
    src === "exif" || src === "device" || src === "manual" ? src : "manual"
  return {
    latitude: lat,
    longitude: lng,
    ...(acc != null ? { gpsAccuracyMeters: Math.round(acc) } : {}),
    source,
  }
}

function parseOptionalNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string" && v.trim() !== "") {
    const n = parseFloat(v)
    if (Number.isFinite(n)) return n
  }
  return undefined
}

/** Build optional fields persisted on installation photos from local state. */
export function gpsFieldsForPayload(state: {
  latitude?: number
  longitude?: number
  gpsAccuracyMeters?: number
  gpsSource?: InstallationPhotoGpsSource
}): {
  latitude: number
  longitude: number
  gpsAccuracyMeters?: number
  gpsSource?: InstallationPhotoGpsSource
} | Record<string, never> {
  const { latitude, longitude, gpsAccuracyMeters, gpsSource } = state
  if (latitude == null || longitude == null) return {}
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return {}
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return {}
  return {
    latitude,
    longitude,
    ...(gpsAccuracyMeters != null && Number.isFinite(gpsAccuracyMeters)
      ? { gpsAccuracyMeters: Math.round(gpsAccuracyMeters) }
      : {}),
    ...(gpsSource ? { gpsSource } : {}),
  }
}
