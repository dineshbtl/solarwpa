import { BrowserMultiFormatReader } from "@zxing/browser"
import { DecodeHintType } from "@zxing/library"

/** PO / warehouse labels: Code 128, Code 39, ITF, etc. — camera photos often need orientation + retries. */

type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => {
  detect: (source: ImageBitmap) => Promise<Array<{ rawValue?: string }>>
}

const NATIVE_FORMATS_FULL = [
  "aztec",
  "code_128",
  "code_39",
  "code_93",
  "codabar",
  "data_matrix",
  "ean_13",
  "ean_8",
  "itf",
  "pdf417",
  "qr_code",
  "upc_a",
  "upc_e",
] as const

const NATIVE_FORMATS_FALLBACK = ["code_128", "code_39", "ean_13", "qr_code", "upc_a", "upc_e"] as const

function createNativeDetector(): InstanceType<BarcodeDetectorCtor> | null {
  const Ctor = (typeof window !== "undefined" &&
    (window as Window & { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector) as
    | BarcodeDetectorCtor
    | undefined
  if (!Ctor) return null
  try {
    return new Ctor({ formats: [...NATIVE_FORMATS_FULL] })
  } catch {
    try {
      return new Ctor({ formats: [...NATIVE_FORMATS_FALLBACK] })
    } catch {
      return null
    }
  }
}

async function loadOrientedBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" })
  } catch {
    return createImageBitmap(file)
  }
}

function drawScaledCanvas(bitmap: ImageBitmap, scale: number): HTMLCanvasElement {
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("2d context unavailable")
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(bitmap, 0, 0, w, h)
  return canvas
}

function drawRotatedScaledCanvas(bitmap: ImageBitmap, scale: number, angleDeg: number): HTMLCanvasElement {
  const rad = (angleDeg * Math.PI) / 180
  const sw = bitmap.width * scale
  const sh = bitmap.height * scale
  const cos = Math.abs(Math.cos(rad))
  const sin = Math.abs(Math.sin(rad))
  const rw = sw * cos + sh * sin
  const rh = sw * sin + sh * cos
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.ceil(rw))
  canvas.height = Math.max(1, Math.ceil(rh))
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("2d context unavailable")
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate(rad)
  ctx.drawImage(bitmap, -sw / 2, -sh / 2, sw, sh)
  return canvas
}

/** Stretch luminance — helps dim phone photos of printed PO barcodes. */
function enhanceContrastGrayscale(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  const { width, height } = canvas
  if (width < 2 || height < 2) return
  const imgData = ctx.getImageData(0, 0, width, height)
  const d = imgData.data
  let min = 255
  let max = 0
  for (let i = 0; i < d.length; i += 4) {
    const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    if (y < min) min = y
    if (y > max) max = y
  }
  const range = max - min || 1
  for (let i = 0; i < d.length; i += 4) {
    const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    const n = Math.round(((y - min) / range) * 255)
    d[i] = n
    d[i + 1] = n
    d[i + 2] = n
  }
  ctx.putImageData(imgData, 0, 0)
}

function tryDecodeCanvas(reader: BrowserMultiFormatReader, canvas: HTMLCanvasElement): string | null {
  try {
    const text = reader.decodeFromCanvas(canvas).getText().trim()
    return text || null
  } catch {
    return null
  }
}

function tryDecodeWithEnhancements(reader: BrowserMultiFormatReader, canvas: HTMLCanvasElement): string | null {
  let t = tryDecodeCanvas(reader, canvas)
  if (t) return t
  const copy = document.createElement("canvas")
  copy.width = canvas.width
  copy.height = canvas.height
  const cctx = copy.getContext("2d")
  if (!cctx) return null
  cctx.drawImage(canvas, 0, 0)
  enhanceContrastGrayscale(copy)
  return tryDecodeCanvas(reader, copy)
}

const SCALES_STRAIGHT = [1, 2, 1.5, 0.65, 2.5] as const
const ANGLES_SKEW = [-10, 10, -15, 15, -6, 6, -20, 20] as const
const SCALES_ROTATED = [1, 2] as const

function tryZxingCanvasAttempts(reader: BrowserMultiFormatReader, bitmap: ImageBitmap): string | null {
  for (const scale of SCALES_STRAIGHT) {
    const canvas = drawScaledCanvas(bitmap, scale)
    const t = tryDecodeWithEnhancements(reader, canvas)
    if (t) return t
  }
  for (const angle of ANGLES_SKEW) {
    for (const scale of SCALES_ROTATED) {
      const canvas = drawRotatedScaledCanvas(bitmap, scale, angle)
      const t = tryDecodeWithEnhancements(reader, canvas)
      if (t) return t
    }
  }
  return null
}

/**
 * Decode a barcode from a camera photo or file upload. Optimized for printed PO / label barcodes
 * (Code 128, Code 39, etc.): EXIF orientation, native detector when available, ZXing with retries.
 */
export async function detectBarcodeFromImageFile(file: File): Promise<string | null> {
  if (typeof window === "undefined") return null

  const hints = new Map<DecodeHintType, boolean>()
  hints.set(DecodeHintType.TRY_HARDER, true)
  const reader = new BrowserMultiFormatReader(hints)

  const bitmap = await loadOrientedBitmap(file)
  try {
    const detector = createNativeDetector()
    if (detector) {
      try {
        const detected = await detector.detect(bitmap)
        const native = detected.find((c) => c.rawValue?.trim())?.rawValue?.trim()
        if (native) return native
      } catch {
        // continue to ZXing
      }
    }

    const objectUrl = URL.createObjectURL(file)
    try {
      const result = await reader.decodeFromImageUrl(objectUrl)
      const fromUrl = result.getText().trim()
      if (fromUrl) return fromUrl
    } catch {
      // canvas attempts
    } finally {
      URL.revokeObjectURL(objectUrl)
    }

    return tryZxingCanvasAttempts(reader, bitmap)
  } finally {
    bitmap.close()
  }
}
