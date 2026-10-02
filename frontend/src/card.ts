export type PaperFormat = 'A6' | 'A5'
export type CardTemplate = 'tete-xxl' | 'classique' | 'plein-cadre' | 'polaroid'

export type CardOptions = {
  format: PaperFormat
  landscape: boolean
  bleed: boolean
  template: CardTemplate
  title: string
  message: string
  font: string
  accent: string
  /** Modèle « Tête XXL » : point de la photo (0..1) placé au niveau du nez sur la carte. */
  focusX: number
  focusY: number
  /** Modèle « Tête XXL » : 1 = photo entière en largeur, 3 = un tiers de la largeur. */
  zoom: number
  /** Modèle « Tête XXL » : part de la hauteur de la carte occupée par le front étiré (0..1). */
  forehead: number
  /** Modèle « Tête XXL » : force de l'étirement du front (1 = aucun). */
  stretch: number
  /** Modèle « Tête XXL » : hauteur du nez sur la carte (0..1). */
  nose: number
}

export const FONTS = ['Bangers', 'Lobster', 'Pacifico', 'Permanent Marker', 'Nunito'] as const

export const TEMPLATES: { id: CardTemplate; label: string }[] = [
  { id: 'tete-xxl', label: 'Tête XXL (visage plein cadre)' },
  { id: 'classique', label: 'Classique' },
  { id: 'plein-cadre', label: 'Plein cadre' },
  { id: 'polaroid', label: 'Polaroïd' },
]

const DPI = 300
const MM_PER_INCH = 25.4
const BLEED_MM = 3
const PAPER_MM: Record<PaperFormat, [number, number]> = { A6: [105, 148], A5: [148, 210] }

export function paperSizeMm(options: Pick<CardOptions, 'format' | 'landscape' | 'bleed'>): [number, number] {
  const [short, long] = PAPER_MM[options.format]
  const extra = options.bleed ? 2 * BLEED_MM : 0
  return options.landscape ? [long + extra, short + extra] : [short + extra, long + extra]
}

const mmToPx = (mm: number) => Math.round((mm / MM_PER_INCH) * DPI)

/** Dessine la carte à 300 dpi, prête pour l'impression. */
export async function renderCard(canvas: HTMLCanvasElement, photo: HTMLImageElement, options: CardOptions) {
  const [wMm, hMm] = paperSizeMm(options)
  canvas.width = mmToPx(wMm)
  canvas.height = mmToPx(hMm)

  await Promise.all([
    document.fonts.load(`100px "${options.font}"`),
    document.fonts.load('900 100px "Nunito"'),
  ])

  const ctx = canvas.getContext('2d')!
  const W = canvas.width
  const H = canvas.height
  // La zone « sûre » évite que le texte soit rogné à la découpe.
  const safe = mmToPx((options.bleed ? BLEED_MM : 0) + 6)

  ctx.save()
  switch (options.template) {
    case 'tete-xxl':
      drawGiantFace(ctx, photo, options, W, H, safe)
      break
    case 'plein-cadre':
      drawFullBleed(ctx, photo, options, W, H, safe)
      break
    case 'polaroid':
      drawPolaroid(ctx, photo, options, W, H, safe)
      break
    default:
      drawClassic(ctx, photo, options, W, H, safe)
  }
  ctx.restore()
}

export type GiantFaceLayout = {
  /** Bord gauche du recadrage dans la photo (px source). */
  sx: number
  /** Ligne source affichée au niveau de la jonction front / visage. */
  seamSource: number
  /** Pixels carte par pixel source sous la jonction. */
  scale: number
  /** Ordonnée de la jonction sur la carte (px carte). */
  seam: number
  /** Hauteur de la bande source étirée pour remplir le front (px source). */
  band: number
  stretch: number
}

export function giantFaceLayout(photo: HTMLImageElement, o: CardOptions, W: number, H: number): GiantFaceLayout {
  const iw = photo.naturalWidth
  const cropW = iw / Math.max(1, o.zoom)
  const scale = W / cropW
  const seam = H * o.forehead
  const sx = Math.min(Math.max(o.focusX * iw - cropW / 2, 0), iw - cropW)
  const seamSource = o.focusY * photo.naturalHeight - (H * o.nose - seam) / scale
  // Choisi pour que la pente soit continue à la jonction : pas de cassure visible.
  const band = seam / (scale * o.stretch)
  return { sx, seamSource, scale, seam, band, stretch: o.stretch }
}

/**
 * Ligne de la photo à afficher sur la ligne y de la carte. Sous la jonction : échelle normale.
 * Au-dessus : courbe puissance, peu étirée près des sourcils et de plus en plus vers le haut.
 */
export function giantFaceSourceRow(l: GiantFaceLayout, y: number): number {
  if (y >= l.seam) return l.seamSource + (y - l.seam) / l.scale
  return l.seamSource - l.band * (1 - Math.pow(y / l.seam, l.stretch))
}

function drawGiantFace(ctx: CanvasRenderingContext2D, photo: HTMLImageElement, o: CardOptions, W: number, H: number, safe: number) {
  const layout = giantFaceLayout(photo, o, W, H)
  const ih = photo.naturalHeight
  const cropW = W / layout.scale
  ctx.imageSmoothingQuality = 'high'

  // Ligne par ligne : chaque ligne de la carte reçoit une tranche fine de la photo.
  // En dehors de la photo, on répète la ligne du bord plutôt que de laisser du vide.
  for (let y = 0; y < H; y++) {
    const top = giantFaceSourceRow(layout, y)
    const bottom = giantFaceSourceRow(layout, y + 1)
    const sy = Math.min(Math.max(top, 0), ih - 1)
    const sh = Math.max(0.01, Math.min(bottom - top, ih - sy))
    ctx.drawImage(photo, layout.sx, sy, cropW, sh, 0, y, W, 1)
  }

  const box = { x: safe, y: safe, w: W - 2 * safe, h: Math.max(layout.seam - safe * 1.5, H * 0.1) }
  drawTexts(ctx, o, box, o.accent, '#ffffff', 0.22)
}

function drawClassic(ctx: CanvasRenderingContext2D, photo: HTMLImageElement, o: CardOptions, W: number, H: number, safe: number) {
  ctx.fillStyle = '#fffaf0'
  ctx.fillRect(0, 0, W, H)
  drawSnow(ctx, W, H, o.accent, 0.18)

  const textBlock = o.landscape ? 0 : H * 0.28
  const photoBox = o.landscape
    ? { x: safe, y: safe, w: W * 0.58 - safe, h: H - 2 * safe }
    : { x: safe, y: safe, w: W - 2 * safe, h: H - 2 * safe - textBlock }

  ctx.save()
  roundedRect(ctx, photoBox.x, photoBox.y, photoBox.w, photoBox.h, W * 0.03)
  ctx.clip()
  drawCover(ctx, photo, photoBox.x, photoBox.y, photoBox.w, photoBox.h)
  ctx.restore()
  ctx.lineWidth = W * 0.012
  ctx.strokeStyle = o.accent
  roundedRect(ctx, photoBox.x, photoBox.y, photoBox.w, photoBox.h, W * 0.03)
  ctx.stroke()

  const text = o.landscape
    ? { x: W * 0.58 + safe * 0.5, y: safe, w: W * 0.42 - safe * 1.5, h: H - 2 * safe }
    : { x: safe, y: photoBox.y + photoBox.h, w: W - 2 * safe, h: textBlock }
  drawTexts(ctx, o, text, '#2b2b2b', null)
}

function drawFullBleed(ctx: CanvasRenderingContext2D, photo: HTMLImageElement, o: CardOptions, W: number, H: number, safe: number) {
  drawCover(ctx, photo, 0, 0, W, H)

  const gradient = ctx.createLinearGradient(0, H * 0.55, 0, H)
  gradient.addColorStop(0, 'rgba(0,0,0,0)')
  gradient.addColorStop(1, 'rgba(0,0,0,0.7)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, W, H)
  drawSnow(ctx, W, H, '#ffffff', 0.5)

  const blockH = H * 0.3
  drawTexts(ctx, o, { x: safe, y: H - safe - blockH, w: W - 2 * safe, h: blockH }, '#ffffff', o.accent)
}

function drawPolaroid(ctx: CanvasRenderingContext2D, photo: HTMLImageElement, o: CardOptions, W: number, H: number, safe: number) {
  ctx.fillStyle = o.accent
  ctx.fillRect(0, 0, W, H)
  drawSnow(ctx, W, H, '#ffffff', 0.35)

  const frameW = Math.min(W - 2 * safe, (H - 2 * safe) * 0.82) * 0.92
  const frameH = frameW * 1.18
  const border = frameW * 0.06

  ctx.save()
  ctx.translate(W / 2, H / 2)
  ctx.rotate((-3 * Math.PI) / 180)
  ctx.shadowColor = 'rgba(0,0,0,0.35)'
  ctx.shadowBlur = W * 0.03
  ctx.shadowOffsetY = W * 0.01
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(-frameW / 2, -frameH / 2, frameW, frameH)
  ctx.shadowColor = 'transparent'

  const photoSize = frameW - 2 * border
  drawCover(ctx, photo, -frameW / 2 + border, -frameH / 2 + border, photoSize, photoSize)

  const captionY = -frameH / 2 + border + photoSize
  drawTexts(ctx, o, { x: -frameW / 2 + border, y: captionY, w: photoSize, h: frameH - photoSize - border }, '#2b2b2b', null)
  ctx.restore()
}

type Box = { x: number; y: number; w: number; h: number }

/** Titre en grand, message en dessous, chacun réduit jusqu'à tenir dans la boîte. */
function drawTexts(ctx: CanvasRenderingContext2D, o: CardOptions, box: Box, color: string, outline: string | null, outlineRatio = 0.12) {
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const cx = box.x + box.w / 2
  const hasMessage = o.message.trim().length > 0
  const titleH = hasMessage ? box.h * 0.58 : box.h
  const titleSize = fitLines(ctx, o.title, `"${o.font}"`, box.w, titleH, '')
  const titleLines = wrap(ctx, o.title, box.w)
  drawLines(ctx, titleLines, cx, box.y + titleH / 2, titleSize * 1.1, color, outline, titleSize, outlineRatio)

  if (!hasMessage) return
  const messageH = box.h - titleH
  const messageSize = fitLines(ctx, o.message, '"Nunito"', box.w, messageH, '700', titleSize * 0.45)
  const messageLines = wrap(ctx, o.message, box.w)
  drawLines(ctx, messageLines, cx, box.y + titleH + messageH / 2, messageSize * 1.25, color, outline, messageSize, outlineRatio)
}

function fitLines(ctx: CanvasRenderingContext2D, text: string, family: string, maxW: number, maxH: number, weight: string, maxSize = Infinity) {
  let size = Math.min(maxSize, maxH * 0.8)
  while (size > 12) {
    ctx.font = `${weight} ${size}px ${family}`
    const lines = wrap(ctx, text, maxW)
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width))
    if (lines.length * size * 1.15 <= maxH && widest <= maxW) break
    size *= 0.92
  }
  ctx.font = `${weight} ${size}px ${family}`
  return size
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    let line = ''
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word
      if (line && ctx.measureText(candidate).width > maxW) {
        lines.push(line)
        line = word
      } else {
        line = candidate
      }
    }
    lines.push(line)
  }
  return lines
}

function drawLines(ctx: CanvasRenderingContext2D, lines: string[], cx: number, cy: number, lineHeight: number, color: string, outline: string | null, size: number, outlineRatio: number) {
  const top = cy - ((lines.length - 1) * lineHeight) / 2
  lines.forEach((line, i) => {
    const y = top + i * lineHeight
    if (outline) {
      ctx.lineJoin = 'round'
      ctx.lineWidth = size * outlineRatio
      ctx.strokeStyle = outline
      ctx.strokeText(line, cx, y)
    }
    ctx.fillStyle = color
    ctx.fillText(line, cx, y)
  })
}

function drawCover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight)
  const sw = w / scale
  const sh = h / scale
  ctx.drawImage(image, (image.naturalWidth - sw) / 2, (image.naturalHeight - sh) / 2, sw, sh, x, y, w, h)
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

/** Flocons pseudo-aléatoires mais stables d'un rendu à l'autre. */
function drawSnow(ctx: CanvasRenderingContext2D, W: number, H: number, color: string, opacity: number) {
  let seed = 42
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  ctx.save()
  ctx.globalAlpha = opacity
  ctx.fillStyle = color
  for (let i = 0; i < 90; i++) {
    ctx.beginPath()
    ctx.arc(random() * W, random() * H, (0.002 + random() * 0.008) * W, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}
