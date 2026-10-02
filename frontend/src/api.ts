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

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message: string | undefined
    try {
      const problem = await response.json()
      message = problem.detail ?? problem.title
    } catch {
      // corps vide ou non JSON
    }
    throw new Error(t.api.byStatus[response.status] ?? message ?? t.api.status(response.status))
  }
  return response.json() as Promise<T>
}

export function getEffects(): Promise<Effect[]> {
  return fetch('/api/effects').then((r) => readJson<Effect[]>(r))
}

/** Envoie la photo directement sur S3 (URL présignée) et retourne son identifiant. */
export async function uploadPhoto(photo: Blob): Promise<string> {
  const { uploadId, uploadUrl, contentType } = await fetch('/api/uploads', { method: 'POST' }).then((r) =>
    readJson<{ uploadId: string; uploadUrl: string; contentType: string }>(r),
  )

  const response = await fetch(uploadUrl, { method: 'PUT', body: photo, headers: { 'Content-Type': contentType } })
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
