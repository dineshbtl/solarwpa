/**
 * Client-side image compression using Canvas API.
 * Resizes images to a max dimension and compresses to JPEG.
 * This runs entirely in the browser – no server round-trip.
 */

const MAX_WIDTH = 1920
const MAX_HEIGHT = 1920
const JPEG_QUALITY = 0.7 // 0–1, 0.7 ≈ good quality at ~70% size reduction
const MAX_FILE_SIZE_BYTES = 800 * 1024 // Skip compression for files already under 800 KB

/**
 * Compress an image File. Returns a smaller File (JPEG) if the original is
 * larger than the threshold; otherwise returns the original unchanged.
 */
export async function compressImage(file: File): Promise<File> {
  // Only compress images
  if (!file.type.startsWith('image/')) return file

  // Already small enough – skip
  if (file.size <= MAX_FILE_SIZE_BYTES) return file

  try {
    const bitmap = await createImageBitmap(file)
    let { width, height } = bitmap

    // Calculate scaled dimensions keeping aspect ratio
    if (width > MAX_WIDTH || height > MAX_HEIGHT) {
      const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height)
      width = Math.round(width * ratio)
      height = Math.round(height * ratio)
    }

    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d')
    if (!ctx) return file // Fallback: can't get context

    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    const blob = await canvas.convertToBlob({
      type: 'image/jpeg',
      quality: JPEG_QUALITY,
    })

    // Build a new File with the same name but .jpg extension
    const compressedName = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], compressedName, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    })
  } catch {
    // If anything fails (e.g. unsupported format), return original
    return file
  }
}
