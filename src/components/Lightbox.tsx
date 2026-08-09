import { useEffect, useState } from 'react'
import { updateImageCaption } from '../lib/db'
import type { StoredImage } from '../types'

interface Props {
  images: StoredImage[]
  index: number
  onIndexChange: (i: number) => void
  onClose: () => void
}

export default function Lightbox({ images, index, onIndexChange, onClose }: Props) {
  const image = images[index]
  const [url, setUrl] = useState('')
  const [caption, setCaption] = useState(image?.caption ?? '')

  useEffect(() => {
    if (!image) return
    const u = URL.createObjectURL(image.blob)
    setUrl(u)
    setCaption(image.caption)
    return () => URL.revokeObjectURL(u)
  }, [image])

  const go = (delta: number) => {
    const next = index + delta
    if (next >= 0 && next < images.length) onIndexChange(next)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!image) return null

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="flex items-center justify-between px-4 py-2 text-sm text-slate-300">
        <span>
          {index + 1} / {images.length}
        </span>
        <button
          onClick={onClose}
          className="rounded-md px-3 py-1 hover:bg-white/10"
        >
          Close ✕
        </button>
      </div>

      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden px-2"
        onClick={(e) => e.stopPropagation()}
      >
        {images.length > 1 && (
          <button
            onClick={() => go(-1)}
            disabled={index === 0}
            className="absolute left-2 z-10 rounded-full bg-white/10 px-3 py-2 text-xl hover:bg-white/20 disabled:opacity-30"
          >
            ‹
          </button>
        )}
        {url && (
          <img
            src={url}
            alt={caption || 'chart'}
            className="max-h-full max-w-full object-contain"
          />
        )}
        {images.length > 1 && (
          <button
            onClick={() => go(1)}
            disabled={index === images.length - 1}
            className="absolute right-2 z-10 rounded-full bg-white/10 px-3 py-2 text-xl hover:bg-white/20 disabled:opacity-30"
          >
            ›
          </button>
        )}
      </div>

      <div className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          onBlur={() => updateImageCaption(image.id, caption)}
          placeholder="Add a caption / timeframe (e.g. H4, Weekly)…"
          className="mx-auto block w-full max-w-2xl rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
        />
      </div>
    </div>
  )
}
