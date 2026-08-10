import { useEffect, useState, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, addImages, deleteImage, updateImageCaption } from '../lib/db'
import type { ImageSection, StoredImage } from '../types'
import Lightbox from './Lightbox'

interface Props {
  date: string
  section: ImageSection
  label?: string
  /** When true, show an editable note textbox under each image. */
  perImageNote?: boolean
}

/** Manages an object URL for a blob, revoking it when the blob changes/unmounts. */
function useObjectUrl(blob: Blob): string {
  const [url, setUrl] = useState('')
  useEffect(() => {
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}

function LargeImage({
  image,
  perImageNote,
  onOpen,
  onDelete,
}: {
  image: StoredImage
  perImageNote?: boolean
  onOpen: () => void
  onDelete: () => void
}) {
  const url = useObjectUrl(image.blob)
  return (
    <figure className="group relative overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
      {url && (
        <img
          src={url}
          alt={image.caption || 'chart'}
          onClick={onOpen}
          className="block max-h-[85vh] w-full cursor-zoom-in object-contain"
        />
      )}
      <button
        onClick={onDelete}
        title="Delete image"
        className="absolute right-2 top-2 hidden h-8 w-8 items-center justify-center rounded-md bg-black/70 text-base text-white hover:bg-red-600 group-hover:flex"
      >
        ✕
      </button>
      {perImageNote ? (
        <textarea
          defaultValue={image.caption}
          onBlur={(e) => updateImageCaption(image.id, e.target.value)}
          placeholder="Note for this chart…"
          rows={2}
          className="block w-full resize-y border-t border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:bg-slate-900"
        />
      ) : (
        image.caption && (
          <figcaption className="border-t border-slate-800 px-3 py-1.5 text-xs text-slate-300">
            {image.caption}
          </figcaption>
        )
      )}
    </figure>
  )
}

export default function ImageGallery({ date, section, label, perImageNote }: Props) {
  const images =
    useLiveQuery(
      () =>
        db.images
          .where('[entryDate+section]')
          .equals([date, section])
          .sortBy('order'),
      [date, section],
    ) ?? []

  const [focused, setFocused] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const onPaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      const blobs: Blob[] = []
      for (const it of items) {
        if (it.kind === 'file' && it.type.startsWith('image/')) {
          const f = it.getAsFile()
          if (f) blobs.push(f)
        }
      }
      if (blobs.length) {
        e.preventDefault()
        addImages(date, section, blobs)
      }
    },
    [date, section],
  )

  return (
    <div>
      {/* Paste-only capture box */}
      <div
        tabIndex={0}
        onPaste={onPaste}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={`flex cursor-text flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-4 text-center text-sm outline-none transition ${
          focused
            ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
            : 'border-slate-600 text-slate-400 hover:border-slate-500'
        }`}
      >
        <span className="font-medium">
          {focused
            ? `Ready — press Ctrl/⌘+V to paste your ${label ?? 'image'}`
            : `Click here, then paste your ${label ?? 'image'} (Ctrl/⌘+V)`}
        </span>
      </div>

      {images.length > 0 && (
        <div className="mt-3 space-y-4">
          {images.map((img, i) => (
            <LargeImage
              key={img.id}
              image={img}
              perImageNote={perImageNote}
              onOpen={() => setLightboxIndex(i)}
              onDelete={() => deleteImage(img.id)}
            />
          ))}
        </div>
      )}

      {lightboxIndex !== null && images[lightboxIndex] && (
        <Lightbox
          images={images}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  )
}
