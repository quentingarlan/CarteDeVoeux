export type Lang = 'fr' | 'en'

/** La langue est fixée par la page servie : / (fr) ou /en/ (en). Changer de langue recharge la page. */
export const lang: Lang = document.documentElement.lang === 'en' ? 'en' : 'fr'

const HOME: Record<Lang, string> = { fr: '/', en: '/en/' }
const STORAGE_KEY = 'lang'
const BOTS = /bot|crawler|spider|crawling|facebookexternalhit|slurp|bingpreview|lighthouse/i

/**
 * Premier passage sans préférence enregistrée : un navigateur qui ne parle pas français part sur /en/.
 * Les robots ne sont jamais redirigés, sinon la version française disparaîtrait des moteurs de recherche.
 */
export function redirectToPreferredLanguage(): boolean {
  if (lang !== 'fr' || BOTS.test(navigator.userAgent)) return false
  let stored: string | null = null
  try {
    stored = localStorage.getItem(STORAGE_KEY)
  } catch {
    // stockage indisponible (navigation privée stricte…)
  }
  if (stored) return false
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language]
  if (languages.some((l) => l.toLowerCase().startsWith('fr'))) return false
  location.replace(HOME.en + location.search + location.hash)
  return true
}

export function switchLanguage(target: Lang) {
  try {
    localStorage.setItem(STORAGE_KEY, target)
  } catch {
    // tant pis : le choix ne sera pas retenu
  }
  location.href = HOME[target]
}

const nextYear = new Date().getMonth() >= 9 ? new Date().getFullYear() + 1 : new Date().getFullYear()

const fr = {
  switchTo: { lang: 'en' as Lang, label: '🇬🇧 English' },
  tagline: "Une photo. Des déformations. Des vœux que personne n'oubliera (malheureusement).",
  apiUnreachable: "Impossible de joindre l'API. Elle est peut-être partie fêter la nouvelle année.",
  step1: '1. Choisissez une photo',
  focusHint: '👆 Cliquez sur la photo pour placer le centre de la déformation (visez le nez).',
  step2: "2. Réglez le n'importe quoi",
  intensity: 'Intensité :',
  uploading: 'Envoi de la photo…',
  distorting: 'Déformation en cours… 🌀',
  distort: '🤪 Déformer !',
  resultsTitle: 'Le résultat (désolé)',
  resultsHint: 'Choisissez votre préférée pour en faire une carte.',
  coffee: '☕ Offrez-moi un café',
  privacy: "Vos photos sont supprimées automatiquement sous 24 h. Aucun visage n'a été blessé durablement.",
  drop: {
    change: '📷 Changer de photo',
    title: 'Glissez une photo ici',
    subtitle: 'ou cliquez pour en choisir une (tonton Michel au réveillon, le chat, le boss…)',
  },
  yourPhoto: 'Votre photo',
  photo: {
    notImage: "Ce fichier n'est pas une image.",
    conversionFailed: 'Conversion impossible.',
    loadFailed: "Impossible de charger l'image.",
  },
  api: {
    uploadFailed: "L'envoi de la photo a échoué.",
    status: (status: number) => `Le serveur a répondu ${status}`,
    // En français, le message renvoyé par l'API est déjà le bon.
    byStatus: {} as Record<number, string>,
  },
  editor: {
    step3: '3. Composez la carte',
    chosenEffect: 'Effet choisi :',
    defaultTitle: `Bonne année ${nextYear} !`,
    title: 'Titre',
    message: 'Message',
    template: 'Modèle',
    templates: { 'tete-xxl': 'Tête XXL (visage plein cadre)', classique: 'Classique', 'plein-cadre': 'Plein cadre', polaroid: 'Polaroïd' },
    framing: 'Cadrage du visage',
    recenterHint: "👆 Cliquez sur le nez dans l'aperçu pour recentrer.",
    zoom: 'Zoom',
    forehead: 'Hauteur du front',
    stretch: 'Étirement du front',
    nose: 'Position du nez',
    font: 'Police',
    color: 'Couleur',
    format: 'Format',
    postcard: 'A6 (carte postale)',
    landscape: 'Paysage',
    bleed: 'Fond perdu de 3 mm (pour un imprimeur pro)',
    size: (w: number, h: number) => `${w} × ${h} mm à 300 dpi`,
    download: '⬇️ Télécharger (PNG)',
    print: '🖨️ Imprimer',
    printTitle: 'Impression',
    allowPopups: 'Autorisez les pop-ups pour imprimer.',
    loading: 'Chargement',
    fileName: (format: string) => `carte-de-voeux-debile-${format}.png`,
  },
  percent: (value: number) => `${Math.round(value * 100)} %`,
  /** Ponctuation avant une valeur : espace insécable en français. */
  colon: ' :',
  /** Vide : on garde les noms renvoyés par l'API. */
  effects: {} as Record<string, string>,
}

type Messages = typeof fr

const en: Messages = {
  switchTo: { lang: 'fr', label: '🇫🇷 Français' },
  tagline: 'One photo. A few distortions. Greetings nobody will ever forget (sadly).',
  apiUnreachable: "Can't reach the API. It probably went out to celebrate New Year's Eve.",
  step1: '1. Pick a photo',
  focusHint: '👆 Click the photo to set the centre of the distortion (aim for the nose).',
  step2: '2. Tune the nonsense',
  intensity: 'Intensity:',
  uploading: 'Uploading the photo…',
  distorting: 'Distorting… 🌀',
  distort: '🤪 Distort!',
  resultsTitle: 'The result (sorry)',
  resultsHint: 'Pick your favourite to turn it into a card.',
  coffee: '☕ Buy me a coffee',
  privacy: 'Your photos are automatically deleted within 24 hours. No face was permanently harmed.',
  drop: {
    change: '📷 Change photo',
    title: 'Drop a photo here',
    subtitle: 'or click to choose one (uncle Bob at the New Year party, the cat, the boss…)',
  },
  yourPhoto: 'Your photo',
  photo: {
    notImage: "This file isn't an image.",
    conversionFailed: 'Conversion failed.',
    loadFailed: "Couldn't load the image.",
  },
  api: {
    uploadFailed: 'Photo upload failed.',
    status: (status: number) => `The server responded ${status}`,
    byStatus: {
      400: 'Invalid request. Please try again.',
      404: 'Photo not found (expired?). Please upload it again.',
      413: 'The photo is larger than 15 MB.',
      429: 'Too many requests. Please wait a few seconds.',
    },
  },
  editor: {
    step3: '3. Design the card',
    chosenEffect: 'Chosen effect:',
    defaultTitle: `Happy New Year ${nextYear}!`,
    title: 'Title',
    message: 'Message',
    template: 'Template',
    templates: { 'tete-xxl': 'Giant head (full-frame face)', classique: 'Classic', 'plein-cadre': 'Full bleed', polaroid: 'Polaroid' },
    framing: 'Face framing',
    recenterHint: '👆 Click the nose in the preview to recentre.',
    zoom: 'Zoom',
    forehead: 'Forehead height',
    stretch: 'Forehead stretch',
    nose: 'Nose position',
    font: 'Font',
    color: 'Colour',
    format: 'Size',
    postcard: 'A6 (postcard)',
    landscape: 'Landscape',
    bleed: '3 mm bleed (for a professional printer)',
    size: (w: number, h: number) => `${w} × ${h} mm at 300 dpi`,
    download: '⬇️ Download (PNG)',
    print: '🖨️ Print',
    printTitle: 'Print',
    allowPopups: 'Please allow pop-ups to print.',
    loading: 'Loading',
    fileName: (format: string) => `silly-greeting-card-${format}.png`,
  },
  percent: (value: number) => `${Math.round(value * 100)}%`,
  /** Ponctuation avant une valeur : espace insécable en français. */
  colon: ':',
  effects: {
    tourbillon: 'Whirlpool',
    'grosse-tete': 'Big head',
    'tete-de-fourmi': 'Ant head',
    'mal-de-mer': 'Seasick',
    'tete-d-oeuf': 'Egghead',
    'tete-de-crepe': 'Pancake face',
    jumeaux: 'Twins',
    quadruples: 'Quadruplets',
    fondu: 'Melted in the sun',
  },
}

export const t: Messages = lang === 'en' ? en : fr

export const effectName = (id: string, fallback: string) => t.effects[id] ?? fallback
