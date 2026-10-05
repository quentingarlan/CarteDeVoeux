import { useEffect, useState } from 'react'
import { generateImages, getEffects, uploadPhoto, type Effect, type GeneratedImage } from './api'
import { CardEditor } from './components/CardEditor'
import { FocusPicker, type Focus } from './components/FocusPicker'
import { PhotoDrop } from './components/PhotoDrop'
import { effectName, switchLanguage, t } from './i18n'
import { preparePhoto, rotatePhoto, type PreparedPhoto } from './photo'

const BUY_ME_A_COFFEE_URL = 'https://buymeacoffee.com/quentingarlan'

export default function App() {
  const [, setEffects] = useState<Effect[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null)
  const [uploadId, setUploadId] = useState<string | null>(null)
  const [focus, setFocus] = useState<Focus>({ x: 0.5, y: 0.4 })
  const [intensity, setIntensity] = useState(0.7)
  const [results, setResults] = useState<GeneratedImage[]>([])
  const [chosen, setChosen] = useState<GeneratedImage | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getEffects()
      .then((list) => {
        setEffects(list)
        setSelected(new Set(list.map((e) => e.id)))
      })
      .catch(() => setError(t.apiUnreachable))
  }, [])

  const choosePhoto = async (file: File) => {
    setError(null)
    try {
      const prepared = await preparePhoto(file)
      if (photo) URL.revokeObjectURL(photo.previewUrl)
      setPhoto(prepared)
      setUploadId(null)
      setResults([])
      setChosen(null)
      setFocus({ x: 0.5, y: 0.4 })
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const rotate = async () => {
    if (!photo) return
    setError(null)
    try {
      const rotated = await rotatePhoto(photo)
      URL.revokeObjectURL(photo.previewUrl)
      setPhoto(rotated)
      setUploadId(null)
      setResults([])
      setChosen(null)
      // Le point visé suit la rotation horaire : (x, y) → (1 - y, x).
      setFocus((f) => ({ x: 1 - f.y, y: f.x }))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const generate = async () => {
    if (!photo) return
    setError(null)
    setChosen(null)
    try {
      let id = uploadId
      if (!id) {
        setBusy(t.uploading)
        id = await uploadPhoto(photo.blob)
        setUploadId(id)
      }
      setBusy(t.distorting)
      const images = await generateImages({
        uploadId: id,
        effects: [...selected],
        focusX: focus.x,
        focusY: focus.y,
        intensity,
      })
      setResults(images.map((image) => ({ ...image, name: effectName(image.effectId, image.name) })))
      setTimeout(() => document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const choose = (image: GeneratedImage) => {
    setChosen(image)
    setTimeout(() => document.getElementById('editor')?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  return (
    <>
      <header className="hero">
        <button className="lang-switch" onClick={() => switchLanguage(t.switchTo.lang)} lang={t.switchTo.lang}>
          {t.switchTo.label}
        </button>
        <h1>
          CarteDeVoeux<span>Debiles</span>
        </h1>
        <p>{t.tagline}</p>
      </header>

      <main>
        <section className="panel">
          <h2>{t.step1}</h2>
          {!photo ? (
            <PhotoDrop onFile={choosePhoto} />
          ) : (
            <div className="setup">
              <div>
                <FocusPicker src={photo.previewUrl} focus={focus} onChange={setFocus} />
                <p className="hint">{t.focusHint}</p>
                <button type="button" onClick={rotate} disabled={!!busy}>
                  {t.rotate}
                </button>
                <PhotoDrop onFile={choosePhoto} compact />
              </div>
              <div className="settings">
                <h3>{t.step2}</h3>
                <label>
                  {t.intensity} <strong>{t.percent(intensity)}</strong>
                  <input type="range" min={0.1} max={1} step={0.05} value={intensity} onChange={(e) => setIntensity(Number(e.target.value))} />
                </label>
                <button className="primary big" onClick={generate} disabled={!!busy || selected.size === 0}>
                  {busy ?? t.distort}
                </button>
              </div>
            </div>
          )}
          {error && <p className="error">{error}</p>}
        </section>

        {results.length > 0 && (
          <section className="panel" id="results">
            <h2>{t.resultsTitle}</h2>
            <p className="hint">{t.resultsHint}</p>
            <div className="grid">
              {results.map((image) => (
                <button
                  key={image.url}
                  className={`result ${chosen?.url === image.url ? 'active' : ''}`}
                  onClick={() => choose(image)}
                >
                  <img src={image.url} alt={image.name} crossOrigin="anonymous" loading="lazy" />
                  <span>{image.name}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {chosen && (
          <div id="editor">
            <CardEditor key={chosen.url} imageUrl={chosen.url} effectName={chosen.name} focus={focus} />
          </div>
        )}
      </main>

      <footer>
        <a className="coffee" href={BUY_ME_A_COFFEE_URL} target="_blank" rel="noopener noreferrer">
          {t.coffee}
        </a>
        <p>{t.privacy}</p>
      </footer>
    </>
  )
}
