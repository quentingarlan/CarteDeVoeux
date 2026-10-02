import { useEffect, useRef, useState } from 'react'
import {
  FONTS,
  TEMPLATES,
  giantFaceLayout,
  giantFaceSourceRow,
  paperSizeMm,
  renderCard,
  type CardOptions,
  type PaperFormat,
} from '../card'
import { loadImage } from '../photo'
import type { Focus } from './FocusPicker'

type Props = { imageUrl: string; effectName: string; focus: Focus }

const ACCENTS = ['#c62828', '#1b5e20', '#0d47a1', '#6a1b9a', '#ef6c00', '#212121']

const nextYear = new Date().getMonth() >= 9 ? new Date().getFullYear() + 1 : new Date().getFullYear()

export function CardEditor({ imageUrl, effectName, focus }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [options, setOptions] = useState<CardOptions>({
    format: 'A6',
    landscape: false,
    bleed: false,
    template: 'tete-xxl',
    title: `Bonne année ${nextYear} !`,
    message: '',
    font: 'Bangers',
    accent: ACCENTS[1],
    focusX: focus.x,
    focusY: focus.y,
    zoom: 2.5,
    forehead: 0.4,
    stretch: 4,
    nose: 0.72,
  })
  const giantFace = options.template === 'tete-xxl'
  const set = <K extends keyof CardOptions>(key: K, value: CardOptions[K]) => setOptions((o) => ({ ...o, [key]: value }))

  // Le parent remonte le composant (key) à chaque changement d'image : pas besoin de réinitialiser photo.
  useEffect(() => {
    let cancelled = false
    loadImage(imageUrl)
      .then((img) => !cancelled && setPhoto(img))
      .catch((e: Error) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [imageUrl])

  useEffect(() => {
    if (photo && canvas.current) renderCard(canvas.current, photo, options).catch((e: Error) => setError(e.message))
  }, [photo, options])

  /** Tête XXL : le point cliqué dans l'aperçu devient le nouveau centre (placé au niveau du nez). */
  const recenter = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const el = canvas.current
    if (!giantFace || !photo || !el) return
    const rect = el.getBoundingClientRect()
    const x = ((e.clientX - rect.left) * el.width) / rect.width
    const y = ((e.clientY - rect.top) * el.height) / rect.height
    const layout = giantFaceLayout(photo, options, el.width, el.height)
    const clamp = (v: number) => Math.min(1, Math.max(0, v))
    setOptions((o) => ({
      ...o,
      focusX: clamp((layout.sx + x / layout.scale) / photo.naturalWidth),
      focusY: clamp(giantFaceSourceRow(layout, y) / photo.naturalHeight),
    }))
  }

  const download = () => {
    canvas.current?.toBlob((blob) => {
      if (!blob) return
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `carte-de-voeux-debile-${options.format.toLowerCase()}.png`
      link.click()
      setTimeout(() => URL.revokeObjectURL(link.href), 10_000)
    }, 'image/png')
  }

  const print = () => {
    if (!canvas.current) return
    const [w, h] = paperSizeMm(options)
    const dataUrl = canvas.current.toDataURL('image/jpeg', 0.95)
    const win = window.open('', '_blank')
    if (!win) return setError('Autorisez les pop-ups pour imprimer.')
    win.document.write(`<!doctype html><title>Impression</title>
      <style>@page{size:${w}mm ${h}mm;margin:0}html,body{margin:0}img{display:block;width:${w}mm;height:${h}mm}</style>
      <img src="${dataUrl}" onload="setTimeout(()=>{print();close()},100)">`)
    win.document.close()
  }

  const [wMm, hMm] = paperSizeMm(options)

  return (
    <section className="panel editor">
      <h2>3. Composez la carte</h2>
      <p className="hint">Effet choisi : <strong>{effectName}</strong></p>
      <div className="editor-layout">
        <div className="editor-controls">
          <label>
            Titre
            <input value={options.title} onChange={(e) => set('title', e.target.value)} maxLength={60} />
          </label>
          <label>
            Message
            <textarea value={options.message} onChange={(e) => set('message', e.target.value)} rows={3} maxLength={200} />
          </label>
          <label>
            Modèle
            <select value={options.template} onChange={(e) => set('template', e.target.value as CardOptions['template'])}>
              {TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </label>
          {giantFace && (
            <fieldset className="giant-face">
              <legend>Cadrage du visage</legend>
              <p className="hint">👆 Cliquez sur le nez dans l'aperçu pour recentrer.</p>
              <Slider label="Zoom" value={options.zoom} min={1} max={6} step={0.05} onChange={(v) => set('zoom', v)} format={(v) => `×${v.toFixed(1)}`} />
              <Slider label="Hauteur du front" value={options.forehead} min={0.1} max={0.6} step={0.01} onChange={(v) => set('forehead', v)} />
              <Slider label="Étirement du front" value={options.stretch} min={1} max={10} step={0.1} onChange={(v) => set('stretch', v)} format={(v) => `×${v.toFixed(1)}`} />
              <Slider label="Position du nez" value={options.nose} min={0.4} max={0.95} step={0.01} onChange={(v) => set('nose', v)} />
            </fieldset>
          )}
          <label>
            Police
            <select value={options.font} onChange={(e) => set('font', e.target.value)} style={{ fontFamily: options.font }}>
              {FONTS.map((f) => (
                <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
              ))}
            </select>
          </label>
          <div className="field">
            Couleur
            <div className="swatches">
              {ACCENTS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`swatch ${options.accent === c ? 'active' : ''}`}
                  style={{ background: c }}
                  onClick={() => set('accent', c)}
                  aria-label={`Couleur ${c}`}
                />
              ))}
            </div>
          </div>
          <div className="row">
            <label>
              Format
              <select value={options.format} onChange={(e) => set('format', e.target.value as PaperFormat)}>
                <option value="A6">A6 (carte postale)</option>
                <option value="A5">A5</option>
              </select>
            </label>
            <label className="checkbox">
              <input type="checkbox" checked={options.landscape} onChange={(e) => set('landscape', e.target.checked)} />
              Paysage
            </label>
          </div>
          <label className="checkbox">
            <input type="checkbox" checked={options.bleed} onChange={(e) => set('bleed', e.target.checked)} />
            Fond perdu de 3 mm (pour un imprimeur pro)
          </label>
          <p className="hint">
            {wMm} × {hMm} mm à 300 dpi
          </p>
          <div className="actions">
            <button className="primary" onClick={download} disabled={!photo}>⬇️ Télécharger (PNG)</button>
            <button onClick={print} disabled={!photo}>🖨️ Imprimer</button>
          </div>
          {error && <p className="error">{error}</p>}
        </div>
        <div className="editor-preview">
          {!photo && <div className="spinner" aria-label="Chargement" />}
          <canvas ref={canvas} hidden={!photo} onClick={recenter} className={giantFace ? 'clickable' : undefined} />
        </div>
      </div>
    </section>
  )
}

type SliderProps = {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  format?: (value: number) => string
}

function Slider({ label, value, min, max, step, onChange, format = (v) => `${Math.round(v * 100)} %` }: SliderProps) {
  return (
    <label>
      <span>
        {label} : <strong>{format(value)}</strong>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}
