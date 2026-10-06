import { t } from './i18n'

export type Effect = { id: string; name: string; description: string }

export type GeneratedImage = { effectId: string; name: string; url: string }

export type GenerateRequest = {
  uploadId: string
  effects: string[]
  focusX: number
  focusY: number
  intensity: number
}

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message: string | undefined
    try {
      const problem = await response.json()
      message = problem.detail ?? problem.title
    } catch {
      // corps vide ou non JSON
    }
    throw new ApiError(t.api.byStatus[response.status] ?? message ?? t.api.status(response.status), response.status)
  }
  return response.json() as Promise<T>
}

export function getEffects(): Promise<Effect[]> {
  return fetch('/api/effects').then((r) => readJson<Effect[]>(r))
}

/** Envoie la photo directement sur S3 (POST présigné, taille plafonnée par S3) et retourne son identifiant. */
export async function uploadPhoto(photo: Blob): Promise<string> {
  const { uploadId, uploadUrl, uploadFields } = await fetch('/api/uploads', { method: 'POST' }).then((r) =>
    readJson<{ uploadId: string; uploadUrl: string; uploadFields: Record<string, string> }>(r),
  )

  const form = new FormData()
  for (const [name, value] of Object.entries(uploadFields)) form.append(name, value)
  // S3 ignore tout champ placé après le fichier.
  form.append('file', photo)
  const response = await fetch(uploadUrl, { method: 'POST', body: form })
  if (!response.ok) throw new Error(t.api.uploadFailed)
  return uploadId
}

export async function generateImages(request: GenerateRequest): Promise<GeneratedImage[]> {
  const response = await fetch('/api/cards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
  const { images } = await readJson<{ images: GeneratedImage[] }>(response)
  return images
}
