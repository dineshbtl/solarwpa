import { getDeviceGpsOnly } from "@/lib/geolocation"
import { compressImage } from "@/lib/image-compress"
import { extractGpsFromImageFile, type InstallationPhotoGps } from "@/lib/installation-photo-gps"

function formatStampText(gps: InstallationPhotoGps | null): string {
  const ts = new Date().toLocaleString()
  if (!gps) return `GPS unavailable | ${ts}`
  const lat = gps.latitude.toFixed(6)
  const lng = gps.longitude.toFixed(6)
  return `GPS ${lat}, ${lng} | ${ts}`
}

type StampDrawSource = ImageBitmap | HTMLImageElement
type StampCanvas = OffscreenCanvas | HTMLCanvasElement

function stampHasOffscreenCanvas(): boolean {
  return typeof OffscreenCanvas !== "undefined" && typeof createImageBitmap === "function"
}

async function stampLoadImage(file: File): Promise<StampDrawSource | null> {
  if (stampHasOffscreenCanvas()) {
    try {
      return await createImageBitmap(file)
    } catch {
      // fall through to <img>
    }
  }
  if (typeof document === "undefined") return null
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    img.src = url
  })
}

function stampDisposeImage(image: StampDrawSource | null) {
  if (!image) return
  if ("close" in image && typeof image.close === "function") {
    image.close()
    return
  }
  if (image instanceof HTMLImageElement && image.src.startsWith("blob:")) {
    URL.revokeObjectURL(image.src)
  }
}

function stampImageSize(image: StampDrawSource): { width: number; height: number } {
  if (image instanceof HTMLImageElement) {
    return { width: image.naturalWidth, height: image.naturalHeight }
  }
  return { width: image.width, height: image.height }
}

function stampMakeCanvas(width: number, height: number): StampCanvas | null {
  if (stampHasOffscreenCanvas()) return new OffscreenCanvas(width, height)
  if (typeof document === "undefined") return null
  const c = document.createElement("canvas")
  c.width = width
  c.height = height
  return c
}

async function stampEncodeJpeg(canvas: StampCanvas, quality: number): Promise<Blob | null> {
  if (canvas instanceof HTMLCanvasElement) {
    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality)
    })
  }
  return canvas.convertToBlob({ type: "image/jpeg", quality })
}

async function stampTextOnImage(raw: File, text: string): Promise<File> {
  let image: StampDrawSource | null = null
  try {
    image = await stampLoadImage(raw)
    if (!image) return raw

    const { width, height } = stampImageSize(image)
    if (!width || !height) return raw

    const canvas = stampMakeCanvas(width, height)
    if (!canvas) return raw
    const ctx = canvas.getContext("2d") as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null
    if (!ctx) return raw

    ctx.drawImage(image as CanvasImageSource, 0, 0, width, height)

    const fontSize = Math.max(20, Math.round(width * 0.022))
    const pad = Math.max(10, Math.round(width * 0.012))
    ctx.font = `600 ${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`
    ctx.textBaseline = "bottom"
    const textWidth = ctx.measureText(text).width
    const boxHeight = fontSize + pad * 2
    const boxWidth = Math.min(width - pad * 2, textWidth + pad * 2)
    const x = pad
    const y = height - pad

    ctx.fillStyle = "rgba(0, 0, 0, 0.55)"
    ctx.fillRect(x, y - boxHeight, boxWidth, boxHeight)
    ctx.fillStyle = "#ffffff"
    ctx.fillText(text, x + pad, y - pad)

    const stampedBlob = await stampEncodeJpeg(canvas, 0.88)
    if (!stampedBlob) return raw

    const stampedName = raw.name.replace(/\.[^.]+$/, "") + "_gps.jpg"
    return new File([stampedBlob], stampedName, {
      type: "image/jpeg",
      lastModified: Date.now(),
    })
  } catch {
    return raw
  } finally {
    stampDisposeImage(image)
  }
}

export type PreparePhotoWithGpsStampOptions = {
  /**
   * When true, never waits on browser/device GPS (only EXIF from the file).
   * Use for optional uploads (e.g. warehouse inward) so save is not blocked by permission prompts or 10–15s timeouts.
   */
  exifGpsOnly?: boolean
  /**
   * Already-captured site GPS (e.g. wizard step 1 `siteGps`). When provided,
   * the helper uses it instead of triggering a fresh navigator.geolocation
   * lookup. Keeps photo upload responsive on Android, where each request can
   * stall the file picker for many seconds.
   */
  fallbackGps?: {
    latitude: number
    longitude: number
    gpsAccuracyMeters?: number
  } | null
  /**
   * Max time to wait on `navigator.geolocation.getCurrentPosition`. Defaults
   * to 3000 ms — long enough on a warm cache, short enough to avoid blocking
   * the camera/gallery picker on a per-photo basis.
   */
  gpsTimeoutMs?: number
}

/**
 * Camera-photo processing:
 * 1) Resolve GPS from EXIF
 * 2) Otherwise use the caller-supplied fallback GPS (e.g. wizard site GPS)
 * 3) Otherwise device GPS with a short timeout (unless exifGpsOnly)
 * 4) Always stamp date/time (+ GPS when available)
 * 5) Compress for upload
 */
export async function preparePhotoWithGpsStamp(
  raw: File,
  options?: PreparePhotoWithGpsStampOptions
): Promise<{
  file: File
  gps: InstallationPhotoGps | null
}> {
  const exifGps = await extractGpsFromImageFile(raw)
  let gps: InstallationPhotoGps | null = exifGps ?? null

  if (!gps && options?.fallbackGps) {
    const { latitude, longitude, gpsAccuracyMeters } = options.fallbackGps
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      gps = {
        latitude,
        longitude,
        gpsAccuracyMeters,
        source: "device",
      }
    }
  }

  if (!gps && !options?.exifGpsOnly) {
    const timeoutMs = options?.gpsTimeoutMs ?? 3000
    const fresh = await getDeviceGpsOnly(timeoutMs)
    if (fresh) {
      gps = {
        latitude: fresh.lat,
        longitude: fresh.lng,
        gpsAccuracyMeters: fresh.accuracyMeters,
        source: "device",
      }
    }
  }

  const stamped = await stampTextOnImage(raw, formatStampText(gps))
  const file = await compressImage(stamped)
  return { file, gps }
}
