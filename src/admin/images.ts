/**
 * Photo upload: shrink in the browser, then store.
 *
 * A phone photo is 3–8 MB at 4000px. Stored as-is it would eat the free
 * storage tier in a few hundred uploads and take seconds per image for a
 * visitor on ship wifi. So every photo is re-encoded here, before it leaves
 * the device, into two files:
 *
 *   full   2000px on the long edge — the full-screen viewer
 *   thumb   640px — grids and lists
 *
 * together typically 250–450 KB. There is no server step to do this later:
 * Supabase's image resizing is a paid feature, and this costs nothing.
 */
import { MEDIA_BUCKET } from '@/content/backend'
import type { Photo, Table } from '@/content/types'
import { db } from './client'

const FULL_EDGE = 2000
const THUMB_EDGE = 640

export class PhotoError extends Error {}

type Decoded = { source: CanvasImageSource; width: number; height: number; release: () => void }

async function decode(file: File): Promise<Decoded> {
  // createImageBitmap applies the EXIF rotation, so a portrait phone photo
  // does not arrive lying on its side.
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() }
  } catch {
    // Some formats (HEIC in Safari, notably) decode through <img> but not
    // createImageBitmap.
  }
  const url = URL.createObjectURL(file)
  const image = new Image()
  image.src = url
  try {
    await image.decode()
  } catch {
    URL.revokeObjectURL(url)
    throw new PhotoError(`“${file.name}” is not an image this browser can open. Try a JPEG or PNG.`)
  }
  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    release: () => URL.revokeObjectURL(url),
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

async function encode(image: Decoded, maxEdge: number): Promise<{ blob: Blob; w: number; h: number }> {
  const scale = Math.min(1, maxEdge / Math.max(image.width, image.height))
  const w = Math.max(1, Math.round(image.width * scale))
  const h = Math.max(1, Math.round(image.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const context = canvas.getContext('2d')
  if (!context) throw new PhotoError('This browser cannot process images.')
  context.imageSmoothingQuality = 'high'
  context.drawImage(image.source, 0, 0, w, h)

  let blob = await toBlob(canvas, 'image/webp', 0.82)
  // Safari cannot ENCODE WebP: asked for it, it quietly hands back a PNG
  // several times the size. Fall back to JPEG there.
  if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg', 0.85)
  if (!blob) throw new PhotoError('Could not process this photo.')
  return { blob, w, h }
}

/** crypto.randomUUID only exists on https and localhost — not on a LAN
    address, which is how the panel gets tried out on a phone in dev. */
function uniqueId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

const extension = (blob: Blob) => (blob.type === 'image/webp' ? 'webp' : 'jpg')

/** Shrinks `file` and uploads both sizes into the table's folder. */
export async function uploadPhoto(file: File, table: Table): Promise<Photo> {
  const image = await decode(file)
  let full, thumb
  try {
    full = await encode(image, FULL_EDGE)
    thumb = await encode(image, THUMB_EDGE)
  } finally {
    image.release()
  }

  const id = uniqueId()
  const paths = {
    full: `${table}/${id}.${extension(full.blob)}`,
    thumb: `${table}/${id}-thumb.${extension(thumb.blob)}`,
  }

  const bucket = db().storage.from(MEDIA_BUCKET)
  const upload = (path: string, blob: Blob) =>
    bucket.upload(path, blob, {
      contentType: blob.type,
      // The name is unique and never reused, so the file never changes:
      // browsers and the CDN may keep it forever.
      cacheControl: '31536000',
      upsert: false,
    })

  const first = await upload(paths.full, full.blob)
  if (first.error) throw new PhotoError(`Upload failed: ${first.error.message}`)
  const second = await upload(paths.thumb, thumb.blob)
  if (second.error) {
    await bucket.remove([paths.full])
    throw new PhotoError(`Upload failed: ${second.error.message}`)
  }

  return { ...paths, w: full.w, h: full.h }
}

/** Deletes the photos' files. Best effort: a leftover file costs a few
    hundred KB of storage, and is not worth failing a save over. */
export async function removePhotos(photos: readonly Photo[]): Promise<void> {
  if (photos.length === 0) return
  try {
    await db()
      .storage.from(MEDIA_BUCKET)
      .remove(photos.flatMap((photo) => [photo.full, photo.thumb]))
  } catch {
    // See above.
  }
}
