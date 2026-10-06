// Mesure d'audience Umami (sans cookies) : le script est chargé dans index.html et en/index.html.
// Il n'envoie rien hors de cartesvoeuxdebiles.com (data-domains) et peut être bloqué : on ne compte jamais sur lui.

type EventData = Record<string, string | number | boolean>

declare global {
  interface Window {
    umami?: { track: (event: string, data?: EventData) => void }
  }
}

export type AnalyticsEvent =
  | 'photo_chosen'
  | 'cards_generated'
  | 'generation_failed'
  | 'card_chosen'
  | 'background_chosen'
  | 'card_downloaded'
  | 'card_printed'
  | 'coffee_clicked'

export function track(event: AnalyticsEvent, data?: EventData) {
  try {
    window.umami?.track(event, data)
  } catch {
    // la mesure d'audience ne doit jamais casser le site
  }
}
