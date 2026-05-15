/**
 * Client-side image compression using Canvas API.
 * Resizes images to a max dimension and compresses to JPEG.
 * This runs entirely in the browser – no server round-trip.
 *
 * Two render paths:
 *   1. OffscreenCanvas + createImageBitmap (modern Chrome/Firefox/Safari 16+).
 *   2. HTMLCanvasElement + <img> fallback (older Android WebView, Samsung
 *      Internet, in-app browsers used by some PWA shells).
 *
 * Without the fallback, a phone that lacks OffscreenCanvas silently uploads
 * full-resolution 3–8 MB camera shots, which blows past Nginx limits and
 * times out the installation submit on weak networks.
 */

/**
 * Aggressive mobile-first preset:
 * - Faster uplink on weak 4G/3G for multi-photo installation submissions
 * - Enough resolution for verification and evidence workflows
 *
 * Each photo is forced under TARGET_FILE_SIZE_BYTES by progressively reducing
 * JPEG quality, and as a final fallback scaling the image down. This makes the
 * total install/inspection submission payload predictable (~4 panels × ~80 KB
 * ≈ 320 KB) regardless of source camera resolution.
 */
const MAX_WIDTH = 1280
const MAX_HEIGHT = 1280
const INITIAL_QUALITY = 0.55
const MIN_QUALITY = 0.22
const QUALITY_STEP = 0.07
/** Hard ceiling per photo before upload (all uploads stay in KB range, not MB). */
const TARGET_FILE_SIZE_BYTES = 100 * 1024
/** Skip work for already-small files (saves CPU on slow phones). */
const SKIP_COMPRESSION_BELOW = 60 * 1024
/** Keep scaling until under TARGET or both sides hit this floor (px). */
const MIN_LONG_EDGE = 256

type DrawSource = ImageBitmap | HTMLImageElement

type Canvasish = OffscreenCanvas | HTMLCanvasElement

function hasOffscreenCanvas(): boolean {
  return typeof OffscreenCanvas !== 'undefined' && typeof createImageBitmap === 'function'
}

function makeCanvas(width: number, height: number): Canvasish | null {
  if (hasOffscreenCanvas()) {
    return new OffscreenCanvas(width, height)
  }
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas')
    c.width = width
    c.height = height
    return c
  }
  return null
}

async function loadImage(file: File): Promise<DrawSource | null> {
  if (hasOffscreenCanvas()) {
    try {
      return await createImageBitmap(file)
    } catch {
      // fall through to <img> path
    }
  }
  if (typeof document === 'undefined') return null
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

function disposeImage(image: DrawSource | null) {
  if (!image) return
  if ('close' in image && typeof image.close === 'function') {
    image.close()
    return
  }
  if (image instanceof HTMLImageElement && image.src.startsWith('blob:')) {
    URL.revokeObjectURL(image.src)
  }
}

function imageSize(image: DrawSource): { width: number; height: number } {
  if (image instanceof HTMLImageElement) {
    return { width: image.naturalWidth, height: image.naturalHeight }
  }
  return { width: image.width, height: image.height }
}

function drawTo(canvas: Canvasish, image: DrawSource, width: number, height: number): boolean {
  const ctx = canvas.getContext('2d') as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null
  if (!ctx) return false
  ctx.drawImage(image as CanvasImageSource, 0, 0, width, height)
  return true
}

async function encodeJpeg(canvas: Canvasish, quality: number): Promise<Blob | null> {
  if (canvas instanceof HTMLCanvasElement) {
    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality)
    })
  }
  return canvas.convertToBlob({ type: 'image/jpeg', quality })
}

/**
 * Compress an image File. Returns JPEG typically **≤100 KB** (see TARGET_FILE_SIZE_BYTES).
 * If we cannot beat the target without going below MIN_LONG_EDGE, may return a JPEG
 * still in the **hundreds of KB** — never multi‑MB unless the pipeline errors and
 * falls back to the original `file`.
 */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  if (file.size <= SKIP_COMPRESSION_BELOW) return file

  let image: DrawSource | null = null
  try {
    image = await loadImage(file)
    if (!image) return file

    let { width, height } = imageSize(image)
    if (!width || !height) return file

    if (width > MAX_WIDTH || height > MAX_HEIGHT) {
      const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height)
      width = Math.round(width * ratio)
      height = Math.round(height * ratio)
    }

    let canvas = makeCanvas(width, height)
    if (!canvas) return file
    if (!drawTo(canvas, image, width, height)) return file

    let quality = INITIAL_QUALITY
    let blob = await encodeJpeg(canvas, quality)
    if (!blob) return file

    while (blob.size > TARGET_FILE_SIZE_BYTES && quality - QUALITY_STEP >= MIN_QUALITY) {
      quality -= QUALITY_STEP
      const next = await encodeJpeg(canvas, quality)
      if (!next) break
      blob = next
    }

    let scaleAttempts = 0
    while (blob.size > TARGET_FILE_SIZE_BYTES && scaleAttempts < 2) {
      width = Math.max(640, Math.round(width * 0.75))
      height = Math.max(640, Math.round(height * 0.75))
      canvas = makeCanvas(width, height)
      if (!canvas) break
      if (!drawTo(canvas, image, width, height)) break
      const next = await encodeJpeg(canvas, MIN_QUALITY)
      if (!next) break
      blob = next
      scaleAttempts += 1
    }

    // Busy scenes at 640×640 can still exceed 100 KB at MIN_QUALITY — keep
    // shrinking until we hit the target or a safe minimum dimension (KB-only uploads).
    while (
      blob.size > TARGET_FILE_SIZE_BYTES &&
      Math.max(width, height) > MIN_LONG_EDGE
    ) {
      const factor = 0.72
      const nextW = Math.max(MIN_LONG_EDGE, Math.round(width * factor))
      const nextH = Math.max(MIN_LONG_EDGE, Math.round(height * factor))
      if (nextW === width && nextH === height) break
      width = nextW
      height = nextH
      canvas = makeCanvas(width, height)
      if (!canvas) break
      if (!drawTo(canvas, image, width, height)) break
      const next = await encodeJpeg(canvas, MIN_QUALITY)
      if (!next) break
      blob = next
    }

    // Under the cap, or strictly smaller than the upload — use the JPEG (KB-range uploads).
    // If the JPEG is larger than an already-small original (e.g. tiny PNG → big JPEG), keep original.
    if (blob.size <= TARGET_FILE_SIZE_BYTES || blob.size < file.size) {
      const compressedName = file.name.replace(/\.[^.]+$/, '') + '.jpg'
      return new File([blob], compressedName, {
        type: 'image/jpeg',
        lastModified: Date.now(),
      })
    }

    return file
  } catch {
    return file
  } finally {
    disposeImage(image)
  }
}

/** Total byte count helper for pre-flight size checks before multipart submit. */
export function totalBytesOfFiles(files: ReadonlyArray<{ size: number } | null | undefined>): number {
  return files.reduce<number>((sum, f) => sum + (f?.size ?? 0), 0)
}
