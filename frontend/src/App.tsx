import { useEffect, useState } from 'react'
import { generateImages, getEffects, uploadPhoto, type Effect, type GeneratedImage } from './api'
import { CardEditor } from './components/CardEditor'
import { FocusPicker, type Focus } from './components/FocusPicker'
import { PhotoDrop } from './components/PhotoDrop'
import { preparePhoto, type PreparedPhoto } from './photo'

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
      .catch(() => setError("Impossible de joindre l'API. Elle est peut-être partie fêter la nouvelle année."))
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

  const generate = async () => {
    if (!photo) return
    setError(null)
    setChosen(null)
    try {
      let id = uploadId
      if (!id) {
        setBusy('Envoi de la photo…')
        id = await uploadPhoto(photo.blob)
        setUploadId(id)
      }
      setBusy('Déformation en cours… 🌀')
      const images = await generateImages({
        uploadId: id,
        effects: [...selected],
        focusX: focus.x,
        focusY: focus.y,
        intensity,
      })
      setResults(images)
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
        <h1>
          CarteDeVoeux<span>Debiles</span>
        </h1>
        <p>Une photo. Des déformations. Des vœux que personne n'oubliera (malheureusement).</p>
      </header>

      <main>
        <section className="panel">
          <h2>1. Choisissez une photo</h2>
          {!photo ? (
            <PhotoDrop onFile={choosePhoto} />
          ) : (
            <div className="setup">
              <div>
                <FocusPicker src={photo.previewUrl} focus={focus} onChange={setFocus} />
                <p className="hint">👆 Cliquez sur la photo pour placer le centre de la déformation (visez le nez).</p>
                <PhotoDrop onFile={choosePhoto} compact />
              </div>
              <div className="settings">
                <h3>2. Réglez le n'importe quoi</h3>
                <label>
                  Intensité : <strong>{Math.round(intensity * 100)} %</strong>
                  <input type="range" min={0.1} max={1} step={0.05} value={intensity} onChange={(e) => setIntensity(Number(e.target.value))} />
                </label>
                <button className="primary big" onClick={generate} disabled={!!busy || selected.size === 0}>
                  {busy ?? '🤪 Déformer !'}
                </button>
              </div>
            </div>
          )}
          {error && <p className="error">{error}</p>}
        </section>

        {results.length > 0 && (
          <section className="panel" id="results">
            <h2>Le résultat (désolé)</h2>
            <p className="hint">Choisissez votre préférée pour en faire une carte.</p>
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
          ☕ Offrez-moi un café
        </a>
        <p>Vos photos sont supprimées automatiquement sous 24 h. Aucun visage n'a été blessé durablement.</p>
      </footer>
    </>
  )
}
