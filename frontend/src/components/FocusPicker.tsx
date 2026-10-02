import { t } from '../i18n'

export type Focus = { x: number; y: number }

type Props = { src: string; focus: Focus; onChange: (focus: Focus) => void }

/** Cliquer sur la photo place le centre des déformations (le nez, de préférence). */
export function FocusPicker({ src, focus, onChange }: Props) {
  return (
    <div
      className="focus-picker"
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        onChange({
          x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
          y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
        })
      }}
    >
      <img src={src} alt={t.yourPhoto} draggable={false} />
      <span className="focus-marker" style={{ left: `${focus.x * 100}%`, top: `${focus.y * 100}%` }} aria-hidden />
    </div>
  )
}
