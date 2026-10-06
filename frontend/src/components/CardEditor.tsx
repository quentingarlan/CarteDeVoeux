import { useEffect, useRef, useState } from 'react'
import { track } from '../analytics'
import { BACKGROUNDS, composeOnBackground, type BackgroundId } from '../backgrounds'
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
import { t } from '../i18n'
import { loadImage } from '../photo'
import type { Focus } from './FocusPicker'

type Props = { imageUrl: string; effectName: string; focus: Focus }

const ACCENTS = ['#c62828', '#1b5e20', '#0d47a1', '#6a1b9a', '#ef6c00', '#212121']

export function CardEditor({ imageUrl, effectName, focus }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null)
  const [background, setBackground] = useState<BackgroundId>('aucun')
  /** Photo posée sur le décor choisi (null : photo telle quelle). */
  const [composed, setComposed] = useState<HTMLImageElement | null>(null)
  const [cuttingOut, setCuttingOut] = useState(false)
  // Le détourage est coûteux : calculé une seule fois par photo, puis réutilisé pour chaque décor.
  const cutout = useRef<Promise<HTMLCanvasElement> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [options, setOptions] = useState<CardOptions>({
    format: 'A6',
    landscape: false,
    bleed: false,
    template: 'tete-xxl',
    title: t.editor.defaultTitle,
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

  const chooseBackground = async (id: BackgroundId) => {
    setBackground(id)
    if (composed) URL.revokeObjectURL(composed.src)
    setComposed(null)
    if (!photo || id === 'aucun') return
    setError(null)
    setCuttingOut(true)
    try {
      cutout.current ??= import('../segmentation').then(({ cutOut }) => cutOut(photo))
      setComposed(await composeOnBackground(await cutout.current, id))
      track('background_chosen', { background: id })
    } catch {
      cutout.current = null
      setError(t.editor.backgroundFailed)
      setBackground('aucun')
    } finally {
      setCuttingOut(false)
    }
  }

  const cardPhoto = composed ?? photo

  useEffect(() => {
    if (cardPhoto && canvas.current) renderCard(canvas.current, cardPhoto, options).catch((e: Error) => setError(e.message))
  }, [cardPhoto, options])

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

  /** Ce qui décrit la carte finale, pour la mesure d'audience. */
  const cardDetails = () => ({ format: options.format, template: options.template, background })

  const download = () => {
    track('card_downloaded', cardDetails())
    canvas.current?.toBlob((blob) => {
      if (!blob) return
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = t.editor.fileName(options.format.toLowerCase())
      link.click()
      setTimeout(() => URL.revokeObjectURL(link.href), 10_000)
    }, 'image/png')
  }

  const print = () => {
    if (!canvas.current) return
    const [w, h] = paperSizeMm(options)
    const dataUrl = canvas.current.toDataURL('image/jpeg', 0.95)
    const win = window.open('', '_blank')
    if (!win) return setError(t.editor.allowPopups)
    track('card_printed', cardDetails())
    win.document.write(`<!doctype html><title>${t.editor.printTitle}</title>
      <style>@page{size:${w}mm ${h}mm;margin:0}html,body{margin:0}img{display:block;width:${w}mm;height:${h}mm}</style>
      <img src="${dataUrl}" onload="setTimeout(()=>{print();close()},100)">`)
    win.document.close()
  }

  const [wMm, hMm] = paperSizeMm(options)

  return (
    <section className="panel editor">
      <h2>{t.editor.step3}</h2>
      <p className="hint">{t.editor.chosenEffect} <strong>{effectName}</strong></p>
      <div className="editor-layout">
        <div className="editor-controls">
          <label>
            {t.editor.title}
            <input value={options.title} onChange={(e) => set('title', e.target.value)} maxLength={60} />
          </label>
          <label>
            {t.editor.message}
            <textarea value={options.message} onChange={(e) => set('message', e.target.value)} rows={3} maxLength={200} />
          </label>
          <label>
            {t.editor.template}
            <select value={options.template} onChange={(e) => set('template', e.target.value as CardOptions['template'])}>
              {TEMPLATES.map((template) => (
                <option key={template.id} value={template.id}>{t.editor.templates[template.id]}</option>
              ))}
            </select>
          </label>
          <label>
            {t.editor.background}
            <select value={background} onChange={(e) => chooseBackground(e.target.value as BackgroundId)} disabled={!photo || cuttingOut}>
              {BACKGROUNDS.map((id) => (
                <option key={id} value={id}>{t.editor.backgrounds[id]}</option>
              ))}
            </select>
          </label>
          {cuttingOut && <p className="hint">{t.editor.cuttingOut}</p>}
          {background !== 'aucun' && giantFace && !cuttingOut && <p className="hint">{t.editor.backgroundHint}</p>}
          {giantFace && (
            <fieldset className="giant-face">
              <legend>{t.editor.framing}</legend>
              <p className="hint">{t.editor.recenterHint}</p>
              <Slider label={t.editor.zoom} value={options.zoom} min={1} max={6} step={0.05} onChange={(v) => set('zoom', v)} format={(v) => `×${v.toFixed(1)}`} />
              <Slider label={t.editor.forehead} value={options.forehead} min={0.1} max={0.6} step={0.01} onChange={(v) => set('forehead', v)} />
              <Slider label={t.editor.stretch} value={options.stretch} min={1} max={10} step={0.1} onChange={(v) => set('stretch', v)} format={(v) => `×${v.toFixed(1)}`} />
              <Slider label={t.editor.nose} value={options.nose} min={0.4} max={0.95} step={0.01} onChange={(v) => set('nose', v)} />
            </fieldset>
          )}
          <label>
            {t.editor.font}
            <select value={options.font} onChange={(e) => set('font', e.target.value)} style={{ fontFamily: options.font }}>
              {FONTS.map((f) => (
                <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
              ))}
            </select>
          </label>
          <div className="field">
            {t.editor.color}
            <div className="swatches">
              {ACCENTS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`swatch ${options.accent === c ? 'active' : ''}`}
                  style={{ background: c }}
                  onClick={() => set('accent', c)}
                  aria-label={`${t.editor.color} ${c}`}
                />
              ))}
            </div>
          </div>
          <div className="row">
            <label>
              {t.editor.format}
              <select value={options.format} onChange={(e) => set('format', e.target.value as PaperFormat)}>
                <option value="A6">{t.editor.postcard}</option>
                <option value="A5">A5</option>
              </select>
            </label>
            <label className="checkbox">
              <input type="checkbox" checked={options.landscape} onChange={(e) => set('landscape', e.target.checked)} />
              {t.editor.landscape}
            </label>
          </div>
          <label className="checkbox">
            <input type="checkbox" checked={options.bleed} onChange={(e) => set('bleed', e.target.checked)} />
            {t.editor.bleed}
          </label>
          <p className="hint">
            {t.editor.size(wMm, hMm)}
          </p>
          <div className="actions">
            <button className="primary" onClick={download} disabled={!photo}>{t.editor.download}</button>
            <button onClick={print} disabled={!photo}>{t.editor.print}</button>
          </div>
          {error && <p className="error">{error}</p>}
        </div>
        <div className="editor-preview">
          {!photo && <div className="spinner" aria-label={t.editor.loading} />}
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

function Slider({ label, value, min, max, step, onChange, format = t.percent }: SliderProps) {
  return (
    <label>
      <span>
        {label}{t.colon} <strong>{format(value)}</strong>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}
