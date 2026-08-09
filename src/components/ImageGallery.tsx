import { useEffect, useRef, useState, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, addImages, deleteImage } from '../lib/db'
import type { ImageSection, StoredImage } from '../types'
import Lightbox from './Lightbox'

interface Props {
  date: string
  section: ImageSection
  label?: string
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

function Thumb({
  image,
  onOpen,
  onDelete,
}: {
  image: StoredImage
  onOpen: () => void
  onDelete: () => void
}) {
  const url = useObjectUrl(image.blob)
  return (
    <div className="group relative aspect-video overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
      {url && (
        <img
          src={url}
          alt={image.caption || 'chart'}
          onClick={onOpen}
          className="h-full w-full cursor-zoom-in object-cover"
        />
      )}
      <button
        onClick={onDelete}
        title="Delete image"
        className="absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded-md bg-black/70 text-sm text-white hover:bg-red-600 group-hover:flex"
      >
        ✕
      </button>
      {image.caption && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/80 to-transparent px-2 py-1 text-xs text-slate-200">
          {image.caption}
        </div>
      )}
    </div>
  )
}

export default function ImageGallery({ date, section, label }: Props) {
  const images =
    useLiveQuery(
      () =>
        db.images
          .where('[entryDate+section]')
          .equals([date, section])
          .sortBy('order'),
      [date, section],
    ) ?? []

  const [dragOver, setDragOver] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback(
    (files: FileList | File[] | null) => {
      if (!files) return
      const imgs = Array.from(files).filter((f) => f.type.startsWith('image/'))
      if (imgs.length) addImages(date, section, imgs)
    },
    [date, section],
  )

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
      <div
        tabIndex={0}
        onPaste={onPaste}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          handleFiles(e.dataTransfer.files)
        }}
        onClick={() => fileInput.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-5 text-center text-sm outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-500 ${
          dragOver
            ? 'border-sky-500 bg-sky-500/10 text-sky-300'
            : 'border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-300'
        }`}
      >
        <span className="font-medium">
          + Add {label ?? 'images'}
        </span>
        <span className="mt-0.5 text-xs text-slate-500">
          Click to browse · drag &amp; drop · or focus here and paste (Ctrl/⌘+V)
        </span>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          handleFiles(e.target.files)
          e.target.value = ''
        }}
      />

      {images.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((img, i) => (
            <Thumb
              key={img.id}
              image={img}
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
