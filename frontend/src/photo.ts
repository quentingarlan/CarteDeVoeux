import { t } from './i18n'

export type PreparedPhoto = { blob: Blob; previewUrl: string; width: number; height: number }

const MAX_SIDE = 2400

/**
 * Redimensionne la photo côté navigateur et la réencode en JPEG : l'envoi est plus rapide,
 * l'orientation EXIF est appliquée par le navigateur et les métadonnées (GPS…) disparaissent.
 */
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  if (!file.type.startsWith('image/')) throw new Error(t.photo.notImage)

  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const ratio = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * ratio)
  const height = Math.round(bitmap.height * ratio)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  return toPreparedPhoto(canvas)
}

/** Pivote la photo d'un quart de tour dans le sens horaire. */
export async function rotatePhoto(photo: PreparedPhoto): Promise<PreparedPhoto> {
  const bitmap = await createImageBitmap(photo.blob)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.height
  canvas.height = bitmap.width
  const ctx = canvas.getContext('2d')!
  ctx.translate(canvas.width, 0)
  ctx.rotate(Math.PI / 2)
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()
  return toPreparedPhoto(canvas)
}

async function toPreparedPhoto(canvas: HTMLCanvasElement): Promise<PreparedPhoto> {
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error(t.photo.conversionFailed))), 'image/jpeg', 0.92),
  )
  return { blob, previewUrl: URL.createObjectURL(blob), width: canvas.width, height: canvas.height }
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    // Nécessaire pour dessiner une image S3 dans un canvas puis l'exporter.
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(t.photo.loadFailed))
    image.src = url
  })
}
