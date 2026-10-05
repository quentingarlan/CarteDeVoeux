export type BackgroundId = 'aucun' | 'plage' | 'montagne' | 'bureau' | 'espace' | 'disco'

export const BACKGROUNDS: BackgroundId[] = ['aucun', 'plage', 'montagne', 'bureau', 'espace', 'disco']

type Ctx = CanvasRenderingContext2D

/** Générateur pseudo-aléatoire à graine fixe : le décor est identique d'un rendu à l'autre. */
function seeded(seed: number) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647
}

function vertical(ctx: Ctx, h: number, stops: [number, string][], y0 = 0, y1 = h) {
  const gradient = ctx.createLinearGradient(0, y0, 0, y1)
  for (const [at, color] of stops) gradient.addColorStop(at, color)
  return gradient
}

function circle(ctx: Ctx, x: number, y: number, r: number, color: string | CanvasGradient) {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
}

function sun(ctx: Ctx, x: number, y: number, r: number) {
  ctx.save()
  ctx.strokeStyle = '#ffd166'
  ctx.lineWidth = r * 0.12
  ctx.lineCap = 'round'
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6
    ctx.beginPath()
    ctx.moveTo(x + Math.cos(a) * r * 1.3, y + Math.sin(a) * r * 1.3)
    ctx.lineTo(x + Math.cos(a) * r * 1.7, y + Math.sin(a) * r * 1.7)
    ctx.stroke()
  }
  ctx.restore()
  circle(ctx, x, y, r, '#ffd166')
}

function cloud(ctx: Ctx, x: number, y: number, s: number) {
  for (const [dx, dy, r] of [[0, 0, 1], [0.9, 0.15, 0.75], [-0.9, 0.2, 0.7], [0.35, -0.45, 0.7]])
    circle(ctx, x + dx * s, y + dy * s, r * s, 'rgba(255,255,255,0.95)')
}

function beach(ctx: Ctx, w: number, h: number, u: number) {
  const horizon = h * 0.55
  ctx.fillStyle = vertical(ctx, h, [[0, '#4fc3f7'], [1, '#b3e5fc']], 0, horizon)
  ctx.fillRect(0, 0, w, horizon)
  sun(ctx, w * 0.82, h * 0.16, u * 0.08)
  cloud(ctx, w * 0.2, h * 0.14, u * 0.06)
  cloud(ctx, w * 0.55, h * 0.24, u * 0.045)

  ctx.fillStyle = vertical(ctx, h, [[0, '#0288d1'], [1, '#26c6da']], horizon, h * 0.75)
  ctx.fillRect(0, horizon, w, h * 0.25)
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'
  ctx.lineWidth = u * 0.006
  ctx.lineCap = 'round'
  const random = seeded(7)
  for (let i = 0; i < 18; i++) {
    const x = random() * w
    const y = horizon + random() * h * 0.17
    ctx.beginPath()
    ctx.arc(x, y, u * 0.025, Math.PI * 1.15, Math.PI * 1.85)
    ctx.stroke()
  }

  ctx.fillStyle = '#f6d7a7'
  ctx.beginPath()
  ctx.moveTo(0, h * 0.72)
  ctx.bezierCurveTo(w * 0.3, h * 0.66, w * 0.65, h * 0.78, w, h * 0.7)
  ctx.lineTo(w, h)
  ctx.lineTo(0, h)
  ctx.fill()
  for (let i = 0; i < 60; i++) circle(ctx, random() * w, h * 0.76 + random() * h * 0.24, u * 0.004, 'rgba(160,110,60,0.25)')

  // Palmier
  const px = w * 0.1
  ctx.strokeStyle = '#8d6e63'
  ctx.lineWidth = u * 0.035
  ctx.beginPath()
  ctx.moveTo(px, h * 0.95)
  ctx.quadraticCurveTo(px + u * 0.12, h * 0.6, px + u * 0.05, h * 0.32)
  ctx.stroke()
  ctx.fillStyle = '#2e7d32'
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i - 2.5) * 0.55
    ctx.save()
    ctx.translate(px + u * 0.05, h * 0.32)
    ctx.rotate(a)
    ctx.beginPath()
    ctx.ellipse(u * 0.13, 0, u * 0.14, u * 0.035, 0.25, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  // Parasol
  const ux = w * 0.88
  ctx.strokeStyle = '#5d4037'
  ctx.lineWidth = u * 0.012
  ctx.beginPath()
  ctx.moveTo(ux, h * 0.95)
  ctx.lineTo(ux - u * 0.03, h * 0.6)
  ctx.stroke()
  const stripes = ['#e53935', '#ffffff', '#e53935', '#ffffff', '#e53935']
  stripes.forEach((color, i) => {
    ctx.beginPath()
    ctx.moveTo(ux - u * 0.03, h * 0.6 - u * 0.09)
    ctx.arc(ux - u * 0.03, h * 0.6, u * 0.16, Math.PI + (i * Math.PI) / 5, Math.PI + ((i + 1) * Math.PI) / 5)
    ctx.closePath()
    ctx.fillStyle = color
    ctx.fill()
  })
}

function mountains(ctx: Ctx, w: number, h: number, u: number) {
  ctx.fillStyle = vertical(ctx, h, [[0, '#64b5f6'], [1, '#e3f2fd']], 0, h * 0.7)
  ctx.fillRect(0, 0, w, h)
  sun(ctx, w * 0.18, h * 0.15, u * 0.06)
  cloud(ctx, w * 0.7, h * 0.12, u * 0.05)

  const ranges: { color: string; base: number; peaks: [number, number][]; snow: boolean }[] = [
    { color: '#90a4ae', base: h * 0.75, peaks: [[0.15, 0.3], [0.45, 0.18], [0.78, 0.26]], snow: true },
    { color: '#607d8b', base: h * 0.85, peaks: [[0, 0.45], [0.3, 0.36], [0.62, 0.42], [0.95, 0.34]], snow: true },
  ]
  for (const range of ranges) {
    for (const [px, py] of range.peaks) {
      const x = px * w
      const y = py * h
      const half = (range.base - y) * 1.1
      ctx.fillStyle = range.color
      ctx.beginPath()
      ctx.moveTo(x - half, range.base)
      ctx.lineTo(x, y)
      ctx.lineTo(x + half, range.base)
      ctx.fill()
      if (range.snow) {
        const cap = (range.base - y) * 0.28
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.moveTo(x - cap * 1.1, y + cap)
        ctx.lineTo(x, y)
        ctx.lineTo(x + cap * 1.1, y + cap)
        ctx.lineTo(x + cap * 0.4, y + cap * 0.75)
        ctx.lineTo(x, y + cap * 1.05)
        ctx.lineTo(x - cap * 0.45, y + cap * 0.8)
        ctx.fill()
      }
    }
  }

  ctx.fillStyle = vertical(ctx, h, [[0, '#7cb342'], [1, '#558b2f']], h * 0.78, h)
  ctx.beginPath()
  ctx.moveTo(0, h * 0.82)
  ctx.bezierCurveTo(w * 0.35, h * 0.76, w * 0.6, h * 0.86, w, h * 0.8)
  ctx.lineTo(w, h)
  ctx.lineTo(0, h)
  ctx.fill()

  const random = seeded(3)
  for (let i = 0; i < 14; i++) {
    const x = (i < 7 ? random() * 0.25 : 0.75 + random() * 0.25) * w
    const base = h * (0.86 + random() * 0.12)
    const size = u * (0.06 + random() * 0.05)
    ctx.fillStyle = '#5d4037'
    ctx.fillRect(x - size * 0.08, base - size * 0.3, size * 0.16, size * 0.3)
    ctx.fillStyle = '#1b5e20'
    for (let k = 0; k < 3; k++) {
      ctx.beginPath()
      ctx.moveTo(x - size * (0.5 - k * 0.1), base - size * (0.25 + k * 0.4))
      ctx.lineTo(x, base - size * (1.0 + k * 0.4))
      ctx.lineTo(x + size * (0.5 - k * 0.1), base - size * (0.25 + k * 0.4))
      ctx.fill()
    }
  }
}

function office(ctx: Ctx, w: number, h: number, u: number) {
  ctx.fillStyle = '#ece4d4'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#d7ccb8'
  ctx.fillRect(0, h * 0.68, w, h * 0.32)

  // Fenêtre avec vue sur la ville
  const win = { x: w * 0.06, y: h * 0.08, w: w * 0.36, h: h * 0.42 }
  ctx.fillStyle = vertical(ctx, h, [[0, '#81d4fa'], [1, '#e1f5fe']], win.y, win.y + win.h)
  ctx.fillRect(win.x, win.y, win.w, win.h)
  const random = seeded(11)
  for (let x = win.x; x < win.x + win.w; ) {
    const bw = win.w * (0.08 + random() * 0.1)
    const bh = win.h * (0.3 + random() * 0.55)
    ctx.fillStyle = random() > 0.5 ? '#78909c' : '#90a4ae'
    ctx.fillRect(x, win.y + win.h - bh, bw, bh)
    ctx.fillStyle = 'rgba(255,241,118,0.8)'
    for (let wy = win.y + win.h - bh + bw * 0.2; wy < win.y + win.h - bw * 0.2; wy += bw * 0.35)
      for (let wx = x + bw * 0.2; wx < x + bw - bw * 0.2; wx += bw * 0.35) if (random() > 0.4) ctx.fillRect(wx, wy, bw * 0.15, bw * 0.15)
    x += bw + win.w * 0.01
  }
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = u * 0.018
  ctx.strokeRect(win.x, win.y, win.w, win.h)
  ctx.beginPath()
  ctx.moveTo(win.x + win.w / 2, win.y)
  ctx.lineTo(win.x + win.w / 2, win.y + win.h)
  ctx.stroke()

  // Tableau blanc avec un graphique qui monte (forcément)
  const board = { x: w * 0.56, y: h * 0.1, w: w * 0.36, h: h * 0.3 }
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(board.x, board.y, board.w, board.h)
  ctx.strokeStyle = '#9e9e9e'
  ctx.lineWidth = u * 0.01
  ctx.strokeRect(board.x, board.y, board.w, board.h)
  ctx.strokeStyle = '#e53935'
  ctx.lineWidth = u * 0.008
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(board.x + board.w * 0.1, board.y + board.h * 0.8)
  ctx.lineTo(board.x + board.w * 0.3, board.y + board.h * 0.6)
  ctx.lineTo(board.x + board.w * 0.45, board.y + board.h * 0.7)
  ctx.lineTo(board.x + board.w * 0.65, board.y + board.h * 0.4)
  ctx.lineTo(board.x + board.w * 0.85, board.y + board.h * 0.15)
  ctx.stroke()
  ctx.fillStyle = '#1565c0'
  ;[0.25, 0.45, 0.65].forEach((at, i) =>
    ctx.fillRect(board.x + board.w * at, board.y + board.h * (0.85 - 0.12 * (i + 1)), board.w * 0.08, board.h * 0.12 * (i + 1)),
  )

  // Horloge
  const cx = w * 0.5
  const cy = h * 0.16
  circle(ctx, cx, cy, u * 0.05, '#ffffff')
  ctx.strokeStyle = '#424242'
  ctx.lineWidth = u * 0.008
  ctx.beginPath()
  ctx.arc(cx, cy, u * 0.05, 0, Math.PI * 2)
  ctx.moveTo(cx, cy)
  ctx.lineTo(cx, cy - u * 0.035)
  ctx.moveTo(cx, cy)
  ctx.lineTo(cx + u * 0.025, cy + u * 0.01)
  ctx.stroke()

  // Bureau, écran et plante
  ctx.fillStyle = '#8d6e63'
  ctx.fillRect(0, h * 0.8, w, h * 0.05)
  ctx.fillStyle = '#6d4c41'
  ctx.fillRect(0, h * 0.85, w, h * 0.15)
  ctx.fillStyle = '#263238'
  ctx.fillRect(w * 0.72, h * 0.58, w * 0.2, h * 0.17)
  ctx.fillStyle = '#4fc3f7'
  ctx.fillRect(w * 0.73, h * 0.595, w * 0.18, h * 0.14)
  ctx.fillStyle = '#263238'
  ctx.fillRect(w * 0.81, h * 0.75, w * 0.02, h * 0.05)
  ctx.fillStyle = '#e65100'
  ctx.beginPath()
  ctx.moveTo(w * 0.06, h * 0.8)
  ctx.lineTo(w * 0.07, h * 0.7)
  ctx.lineTo(w * 0.15, h * 0.7)
  ctx.lineTo(w * 0.16, h * 0.8)
  ctx.fill()
  ctx.fillStyle = '#388e3c'
  for (let i = 0; i < 7; i++) {
    ctx.save()
    ctx.translate(w * 0.11, h * 0.7)
    ctx.rotate(-Math.PI / 2 + (i - 3) * 0.35)
    ctx.beginPath()
    ctx.ellipse(u * 0.07, 0, u * 0.07, u * 0.018, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

function space(ctx: Ctx, w: number, h: number, u: number) {
  ctx.fillStyle = vertical(ctx, h, [[0, '#0d0221'], [0.6, '#261447'], [1, '#3d1e6d']])
  ctx.fillRect(0, 0, w, h)
  const random = seeded(5)
  for (let i = 0; i < 260; i++) circle(ctx, random() * w, random() * h, u * (0.001 + random() * 0.004), `rgba(255,255,255,${0.4 + random() * 0.6})`)

  const planet = { x: w * 0.8, y: h * 0.25, r: u * 0.16 }
  const glow = ctx.createRadialGradient(planet.x - planet.r * 0.4, planet.y - planet.r * 0.4, planet.r * 0.1, planet.x, planet.y, planet.r)
  glow.addColorStop(0, '#ffb74d')
  glow.addColorStop(1, '#e65100')
  ctx.save()
  ctx.strokeStyle = 'rgba(255,224,178,0.85)'
  ctx.lineWidth = u * 0.02
  ctx.beginPath()
  ctx.ellipse(planet.x, planet.y, planet.r * 1.7, planet.r * 0.45, -0.35, Math.PI, Math.PI * 2)
  ctx.stroke()
  circle(ctx, planet.x, planet.y, planet.r, glow)
  ctx.beginPath()
  ctx.ellipse(planet.x, planet.y, planet.r * 1.7, planet.r * 0.45, -0.35, 0, Math.PI)
  ctx.stroke()
  ctx.restore()

  circle(ctx, w * 0.15, h * 0.2, u * 0.07, '#cfd8dc')
  for (const [dx, dy, r] of [[-0.02, -0.01, 0.015], [0.025, 0.02, 0.01], [0.01, -0.03, 0.008]])
    circle(ctx, w * 0.15 + dx * u, h * 0.2 + dy * u, r * u, '#b0bec5')

  // Fusée
  ctx.save()
  ctx.translate(w * 0.12, h * 0.7)
  ctx.rotate(0.5)
  const s = u * 0.12
  ctx.fillStyle = '#ff7043'
  ctx.beginPath()
  ctx.moveTo(-s * 0.18, s * 0.5)
  ctx.lineTo(0, s * 0.95)
  ctx.lineTo(s * 0.18, s * 0.5)
  ctx.fill()
  ctx.fillStyle = '#eceff1'
  ctx.beginPath()
  ctx.ellipse(0, 0, s * 0.22, s * 0.55, 0, 0, Math.PI * 2)
  ctx.fill()
  circle(ctx, 0, -s * 0.12, s * 0.09, '#29b6f6')
  ctx.restore()
}

function disco(ctx: Ctx, w: number, h: number, u: number) {
  ctx.fillStyle = vertical(ctx, h, [[0, '#1a0033'], [1, '#4a148c']])
  ctx.fillRect(0, 0, w, h)

  const colors = ['rgba(255,64,129,0.35)', 'rgba(0,229,255,0.3)', 'rgba(255,234,0,0.3)', 'rgba(118,255,3,0.28)']
  colors.forEach((color, i) => {
    const x = w * (0.1 + i * 0.27)
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x - w * 0.18 + i * w * 0.08, h)
    ctx.lineTo(x + w * 0.02 + i * w * 0.08, h)
    ctx.fill()
  })

  // Sol lumineux
  const floorTop = h * 0.72
  const tiles = 8
  const tw = w / tiles
  const random = seeded(9)
  const tileColors = ['#ff4081', '#00e5ff', '#ffea00', '#76ff03', '#7c4dff']
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < tiles; col++) {
      ctx.fillStyle = tileColors[Math.floor(random() * tileColors.length)]
      ctx.globalAlpha = 0.75
      ctx.fillRect(col * tw + u * 0.004, floorTop + (row * (h - floorTop)) / 3 + u * 0.004, tw - u * 0.008, (h - floorTop) / 3 - u * 0.008)
    }
  ctx.globalAlpha = 1

  // Boule à facettes
  const bx = w / 2
  const by = h * 0.13
  const br = u * 0.09
  ctx.strokeStyle = '#bdbdbd'
  ctx.lineWidth = u * 0.005
  ctx.beginPath()
  ctx.moveTo(bx, 0)
  ctx.lineTo(bx, by - br)
  ctx.stroke()
  ctx.save()
  ctx.beginPath()
  ctx.arc(bx, by, br, 0, Math.PI * 2)
  ctx.clip()
  const facet = br / 4
  for (let y = by - br; y < by + br; y += facet)
    for (let x = bx - br; x < bx + br; x += facet) {
      const shade = 150 + Math.floor(random() * 105)
      ctx.fillStyle = `rgb(${shade},${shade},${Math.min(255, shade + 20)})`
      ctx.fillRect(x, y, facet - u * 0.002, facet - u * 0.002)
    }
  ctx.restore()

  for (let i = 0; i < 40; i++) {
    const x = random() * w
    const y = random() * floorTop
    const r = u * (0.004 + random() * 0.01)
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.beginPath()
    ctx.moveTo(x, y - r * 2)
    ctx.lineTo(x + r * 0.5, y)
    ctx.lineTo(x, y + r * 2)
    ctx.lineTo(x - r * 0.5, y)
    ctx.fill()
  }
}

const SCENES: Record<Exclude<BackgroundId, 'aucun'>, (ctx: Ctx, w: number, h: number, u: number) => void> = {
  plage: beach,
  montagne: mountains,
  bureau: office,
  espace: space,
  disco,
}

/**
 * Pose la personne détourée sur un décor dessiné à la taille de la photo.
 * Renvoie une image, pour que les modèles de carte la traitent comme n'importe quelle photo.
 */
export async function composeOnBackground(cutout: HTMLCanvasElement, background: Exclude<BackgroundId, 'aucun'>): Promise<HTMLImageElement> {
  const canvas = document.createElement('canvas')
  canvas.width = cutout.width
  canvas.height = cutout.height
  const ctx = canvas.getContext('2d')!
  SCENES[background](ctx, canvas.width, canvas.height, Math.min(canvas.width, canvas.height))
  ctx.drawImage(cutout, 0, 0)

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('compose'))), 'image/jpeg', 0.92),
  )
  const image = new Image()
  image.src = URL.createObjectURL(blob)
  await image.decode()
  return image
}
