import type { PreparePhotoWithGpsStampOptions } from "@/lib/photo-gps-stamp"

/** Site GPS from survey GPRS Cam card — same idea as installation wizard `siteGps`. */
export type SurveySiteGpsState = {
  gpsLat?: string
  gpsLng?: string
  accuracyMeters?: number
} | null | undefined

/**
 * After site location is captured, use it as stamp fallback (fast, no per-photo geolocation).
 * Before capture, only EXIF GPS on the file — avoids blocking the file picker on device GPS.
 */
export function stampOptionsFromSurveySiteDetails(site: SurveySiteGpsState): PreparePhotoWithGpsStampOptions {
  const lat = site?.gpsLat?.trim()
  const lng = site?.gpsLng?.trim()
  const la = lat ? Number(lat) : NaN
  const lo = lng ? Number(lng) : NaN
  if (Number.isFinite(la) && Number.isFinite(lo)) {
    return {
      fallbackGps: {
        latitude: la,
        longitude: lo,
        gpsAccuracyMeters: site?.accuracyMeters,
      },
    }
  }
  return { exifGpsOnly: true }
}
