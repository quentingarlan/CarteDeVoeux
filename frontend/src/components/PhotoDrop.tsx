import { useRef, useState } from 'react'
import { t } from '../i18n'

type Props = { onFile: (file: File) => void; compact?: boolean }

export function PhotoDrop({ onFile, compact }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  return (
    <div
      className={`dropzone ${dragging ? 'dragging' : ''} ${compact ? 'compact' : ''}`}
      onClick={() => input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        const file = e.dataTransfer.files[0]
        if (file) onFile(file)
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
    >
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
          e.target.value = ''
        }}
      />
      {compact ? (
        <span>{t.drop.change}</span>
      ) : (
        <>
          <span className="dropzone-icon">📸</span>
          <strong>{t.drop.title}</strong>
          <span>{t.drop.subtitle}</span>
        </>
      )}
    </div>
  )
}
