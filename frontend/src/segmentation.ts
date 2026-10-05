import { ImageSegmenter, type MPMask } from '@mediapipe/tasks-vision'
import wasmLoaderPath from '@mediapipe/tasks-vision/vision_wasm_internal.js?url'
import wasmBinaryPath from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url'

// Module chargé à la demande (import dynamique) : rien n'est téléchargé tant qu'on ne choisit pas de décor.
// Le détourage tourne entièrement dans le navigateur, la photo ne quitte pas l'appareil.
const MODEL_URL = '/models/selfie_segmenter.tflite'

let segmenter: Promise<ImageSegmenter> | null = null

function getSegmenter() {
  segmenter ??= ImageSegmenter.createFromOptions(
    { wasmLoaderPath, wasmBinaryPath },
    {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
      runningMode: 'IMAGE',
      outputConfidenceMasks: true,
      outputCategoryMask: false,
    },
  ).catch((e) => {
    segmenter = null
    throw e
  })
  return segmenter
}

/** Confiance moyenne sur le bord de l'image : sert à savoir si le masque désigne la personne ou le décor. */
function borderMean(values: Float32Array, width: number, height: number) {
  let sum = 0
  let count = 0
  for (let x = 0; x < width; x++) {
    sum += values[x] + values[(height - 1) * width + x]
    count += 2
  }
  for (let y = 0; y < height; y++) {
    sum += values[y * width] + values[y * width + width - 1]
    count += 2
  }
  return sum / count
}

function centerMean(values: Float32Array, width: number, height: number) {
  let sum = 0
  let count = 0
  for (let y = Math.floor(height * 0.35); y < height * 0.65; y++)
    for (let x = Math.floor(width * 0.35); x < width * 0.65; x++) {
      sum += values[y * width + x]
      count++
    }
  return sum / Math.max(1, count)
}

/**
 * Renvoie la photo détourée : un canvas de même taille où le décor d'origine est transparent.
 * Les bords du masque sont adoucis pour éviter l'effet « découpé aux ciseaux ».
 */
export async function cutOut(photo: HTMLImageElement): Promise<HTMLCanvasElement> {
  const result = (await getSegmenter()).segment(photo)
  const masks = result.confidenceMasks ?? []
  const mask: MPMask | undefined = masks[masks.length - 1]
  if (!mask) throw new Error('segmentation')

  const { width, height } = mask
  const values = mask.getAsFloat32Array()
  // Selon le modèle, le masque unique peut désigner le décor : on l'inverse si le bord est plus « sûr » que le centre.
  const invert = masks.length === 1 && borderMean(values, width, height) > centerMean(values, width, height)

  const alpha = new ImageData(width, height)
  for (let i = 0; i < values.length; i++) {
    const v = invert ? 1 - values[i] : values[i]
    // Rampe douce entre 0,3 et 0,7 : bord net mais pas crénelé.
    const a = Math.min(1, Math.max(0, (v - 0.3) / 0.4))
    alpha.data[i * 4 + 3] = Math.round(a * 255)
  }
  result.close()

  const maskCanvas = document.createElement('canvas')
  maskCanvas.width = width
  maskCanvas.height = height
  maskCanvas.getContext('2d')!.putImageData(alpha, 0, 0)

  const out = document.createElement('canvas')
  out.width = photo.naturalWidth
  out.height = photo.naturalHeight
  const ctx = out.getContext('2d')!
  ctx.drawImage(photo, 0, 0)
  ctx.globalCompositeOperation = 'destination-in'
  ctx.imageSmoothingQuality = 'high'
  ctx.filter = `blur(${Math.max(1, Math.round(out.width / 600))}px)`
  ctx.drawImage(maskCanvas, 0, 0, out.width, out.height)
  return out
}
