import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  getOrCreateDay,
  listBlocks,
  addImageBlocks,
  addTextBlock,
  updateBlockText,
  deleteBlock,
  moveBlock,
  setDayTitle,
  deleteDay,
} from '../lib/db'
import { formatDate } from '../lib/format'
import type { Block } from '../types'
import Lightbox from './Lightbox'

/** Manages an object URL for a blob, revoking it when the blob changes/unmounts. */
function useObjectUrl(blob?: Blob): string {
  const [url, setUrl] = useState('')
  useEffect(() => {
    if (!blob) return
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}

function ImageBlock({
  block,
  onOpen,
  onDelete,
  onUp,
  onDown,
}: {
  block: Block
  onOpen: () => void
  onDelete: () => void
  onUp: () => void
  onDown: () => void
}) {
  const url = useObjectUrl(block.blob)
  return (
    <figure className="group relative overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
      {url && (
        <img
          src={url}
          alt={block.caption || 'image'}
          onClick={onOpen}
          className="block max-h-[85vh] w-full cursor-zoom-in object-contain"
        />
      )}
      <BlockControls onDelete={onDelete} onUp={onUp} onDown={onDown} />
      {block.caption && (
        <figcaption className="border-t border-slate-800 px-3 py-1.5 text-xs text-slate-300">
          {block.caption}
        </figcaption>
      )}
    </figure>
  )
}

function TextBlock({
  block,
  onDelete,
  onUp,
  onDown,
}: {
  block: Block
  onDelete: () => void
  onUp: () => void
  onDown: () => void
}) {
  const [value, setValue] = useState(block.text ?? '')
  const ref = useRef<HTMLTextAreaElement | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep local text in sync if the block changes underneath us (e.g. sync).
  useEffect(() => {
    setValue(block.text ?? '')
  }, [block.text])

  // Auto-grow to fit content.
  const grow = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [])
  useEffect(grow, [value, grow])

  function onChange(v: string) {
    setValue(v)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => updateBlockText(block.id, v), 400)
  }

  return (
    <div className="group relative">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => updateBlockText(block.id, value)}
        placeholder="Type anything…"
        rows={2}
        className="w-full resize-none rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 text-[15px] leading-relaxed text-slate-100 outline-none focus:border-sky-600"
      />
      <BlockControls onDelete={onDelete} onUp={onUp} onDown={onDown} />
    </div>
  )
}

function BlockControls({
  onDelete,
  onUp,
  onDown,
}: {
  onDelete: () => void
  onUp: () => void
  onDown: () => void
}) {
  return (
    <div className="absolute right-2 top-2 hidden gap-1 group-hover:flex">
      <button
        onClick={onUp}
        title="Move up"
        className="h-7 w-7 rounded-md bg-black/60 text-sm text-white hover:bg-black/80"
      >
        ↑
      </button>
      <button
        onClick={onDown}
        title="Move down"
        className="h-7 w-7 rounded-md bg-black/60 text-sm text-white hover:bg-black/80"
      >
        ↓
      </button>
      <button
        onClick={onDelete}
        title="Delete"
        className="h-7 w-7 rounded-md bg-black/60 text-sm text-white hover:bg-red-600"
      >
        ✕
      </button>
    </div>
  )
}

export default function DayView() {
  const { date = '' } = useParams()
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [title, setTitle] = useState('')
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    getOrCreateDay(date).then((d) => {
      if (alive) {
        setTitle(d.title ?? '')
        setReady(true)
      }
    })
    return () => {
      alive = false
    }
  }, [date])

  const blocks = useLiveQuery(() => listBlocks(date), [date]) ?? []
  const imageBlocks = blocks.filter((b) => b.type === 'image')

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
        addImageBlocks(date, blobs)
      }
    },
    [date],
  )

  async function handleDelete() {
    if (
      !window.confirm(
        `Delete everything for ${formatDate(date)}? This removes all images and notes for this day.`,
      )
    )
      return
    await deleteDay(date)
    navigate('/')
  }

  if (!ready) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-slate-500">
        Loading…
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link to="/" className="text-sm text-slate-400 hover:text-slate-200">
          ← All dates
        </Link>
        <span className="text-xs text-slate-500">Saved automatically</span>
      </div>

      <h1 className="text-2xl font-bold text-white">{formatDate(date)}</h1>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => setDayTitle(date, title)}
        placeholder="Add a title (optional)…"
        className="mt-2 mb-5 w-full border-0 border-b border-transparent bg-transparent px-0 py-1 text-lg text-slate-200 outline-none placeholder:text-slate-600 focus:border-slate-700"
      />

      {/* The document: blocks in order */}
      <div className="space-y-3">
        {blocks.map((b) =>
          b.type === 'image' ? (
            <ImageBlock
              key={b.id}
              block={b}
              onOpen={() =>
                setLightboxIndex(imageBlocks.findIndex((im) => im.id === b.id))
              }
              onDelete={() => deleteBlock(b.id)}
              onUp={() => moveBlock(b.id, 'up')}
              onDown={() => moveBlock(b.id, 'down')}
            />
          ) : (
            <TextBlock
              key={b.id}
              block={b}
              onDelete={() => deleteBlock(b.id)}
              onUp={() => moveBlock(b.id, 'up')}
              onDown={() => moveBlock(b.id, 'down')}
            />
          ),
        )}
      </div>

      {/* Paste zone sits BELOW the blocks: each new image stacks above it, so
          the box stays at the bottom and you can keep pasting without scrolling up. */}
      <div
        tabIndex={0}
        onPaste={onPaste}
        className="mt-3 flex cursor-text items-center justify-center rounded-xl border-2 border-dashed border-slate-700 px-4 py-6 text-center text-sm text-slate-400 outline-none transition hover:border-slate-500 focus:border-emerald-500 focus:bg-emerald-500/5 focus:text-emerald-300"
      >
        {blocks.length > 0
          ? 'Click here, then paste your next image (Ctrl/⌘+V)'
          : 'Click here, then paste an image (Ctrl/⌘+V) — or add a note below.'}
      </div>

      <button
        onClick={() => addTextBlock(date)}
        className="mt-3 w-full rounded-xl border border-dashed border-slate-700 px-4 py-3 text-sm font-medium text-slate-400 hover:border-slate-500 hover:text-slate-200"
      >
        + Add note
      </button>

      <div className="mt-10 border-t border-slate-800 pt-6">
        <button
          onClick={handleDelete}
          className="text-sm text-red-400/80 hover:text-red-400"
        >
          Delete this day
        </button>
      </div>

      {lightboxIndex !== null && imageBlocks[lightboxIndex] && (
        <Lightbox
          images={imageBlocks}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  )
}
