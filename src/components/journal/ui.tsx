import { useCallback, useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { addShots, deleteShot, listShots, setShotCaption } from '../../lib/journal'
import type { Shot } from '../../types'
import Lightbox from '../Lightbox'

/** Image files from a paste or drop, if any. */
function imagesFrom(data: DataTransfer | null): Blob[] {
  if (!data) return []
  const out: Blob[] = []
  for (const it of data.items) {
    if (it.kind === 'file' && it.type.startsWith('image/')) {
      const f = it.getAsFile()
      if (f) out.push(f)
    }
  }
  return out
}

/**
 * Auto-growing textarea that saves while you type (debounced) and on blur.
 * Pasting or dropping an image calls `onImages` instead of inserting text.
 */
export function AutoText({
  value,
  onSave,
  onImages,
  placeholder,
  rows = 1,
}: {
  value: string
  onSave: (v: string) => void
  onImages?: (blobs: Blob[]) => void
  placeholder?: string
  rows?: number
}) {
  const [text, setText] = useState(value)
  const ref = useRef<HTMLTextAreaElement | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const focused = useRef(false)

  // Take outside changes only while not typing, so a save echoing back from
  // the database never clobbers letters typed after it.
  useEffect(() => {
    if (!focused.current) setText(value)
  }, [value])

  const grow = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [])
  useEffect(grow, [text, grow])

  function change(v: string) {
    setText(v)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => onSave(v), 400)
  }

  function takeImages(e: React.ClipboardEvent | React.DragEvent, data: DataTransfer | null) {
    if (!onImages) return
    const blobs = imagesFrom(data)
    if (!blobs.length) return
    e.preventDefault()
    onImages(blobs)
  }

  return (
    <textarea
      ref={ref}
      value={text}
      rows={rows}
      placeholder={placeholder}
      onChange={(e) => change(e.target.value)}
      onFocus={() => (focused.current = true)}
      onBlur={() => {
        focused.current = false
        if (timer.current) clearTimeout(timer.current)
        if (text !== value) onSave(text)
      }}
      onPaste={(e) => takeImages(e, e.clipboardData)}
      onDragOver={(e) => onImages && e.preventDefault()}
      onDrop={(e) => takeImages(e, e.dataTransfer)}
      className="w-full resize-none rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2 text-[15px] leading-relaxed text-sky-200 outline-none placeholder:text-slate-600 focus:border-sky-600"
    />
  )
}

function Thumb({ shot, onOpen }: { shot: Shot; onOpen: () => void }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    const u = URL.createObjectURL(shot.blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [shot.blob])
  return (
    <figure className="group relative overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
      {url && (
        <img
          src={url}
          alt={shot.caption || 'chart'}
          onClick={onOpen}
          className="block max-h-[70vh] w-full cursor-zoom-in object-contain"
        />
      )}
      <button
        onClick={() => window.confirm('ลบรูปนี้?') && deleteShot(shot.id)}
        title="Delete chart"
        className="absolute right-2 top-2 hidden h-7 w-7 rounded-md bg-black/60 text-sm text-white hover:bg-red-600 group-hover:block"
      >
        ✕
      </button>
      {/* Note under the chart; pasting another image here adds it below. */}
      <figcaption className="border-t border-slate-800 p-1.5">
        <AutoText
          value={shot.caption}
          onSave={(v) => setShotCaption(shot.id, v)}
          onImages={(blobs) => addShots(shot.owner, shot.slot, blobs)}
          placeholder="พิมพ์โน้ตใต้รูปนี้…"
        />
      </figcaption>
    </figure>
  )
}

/** The charts pasted under one question, shown big; click one to open full screen. */
export function Shots({ owner, slot }: { owner: string; slot: string }) {
  const shots = useLiveQuery(() => listShots(owner, slot), [owner, slot]) ?? []
  const [open, setOpen] = useState<number | null>(null)
  if (!shots.length) return null
  return (
    <div className="mt-2 space-y-2">
      {shots.map((s, i) => (
        <Thumb key={s.id} shot={s} onOpen={() => setOpen(i)} />
      ))}
      {open !== null && shots[open] && (
        <Lightbox
          images={shots}
          index={open}
          onIndexChange={setOpen}
          onClose={() => setOpen(null)}
          onCaption={setShotCaption}
        />
      )}
    </div>
  )
}

/** One-of-many buttons; clicking the picked one clears it. */
export function Pick({
  options,
  value,
  onChange,
  tone = 'sky',
}: {
  options: string[]
  value: string
  onChange: (v: string) => void
  tone?: 'sky' | 'amber'
}) {
  const on = tone === 'amber' ? 'border-amber-500 bg-amber-500/15 text-amber-200' : 'border-sky-500 bg-sky-500/15 text-sky-200'
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(value === o ? '' : o)}
          className={`rounded-full border px-3 py-1 text-sm transition ${
            value === o ? on : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  )
}

/** Many-of-many toggle buttons. */
export function Toggles({
  options,
  value,
  onChange,
  tone = 'rose',
}: {
  options: string[]
  value: string[]
  onChange: (v: string[]) => void
  tone?: 'rose' | 'sky'
}) {
  const onCls =
    tone === 'sky' ? 'border-sky-500 bg-sky-500/15 text-sky-200' : 'border-rose-500 bg-rose-500/15 text-rose-200'
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value.includes(o)
        return (
          <button
            key={o}
            onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}
            className={`rounded-full border px-3 py-1 text-sm transition ${
              on
                ? onCls
                : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
            }`}
          >
            {on ? '✓ ' : ''}
            {o}
          </button>
        )
      })}
    </div>
  )
}

/**
 * A question from the template: label, optional quick picks, an answer box,
 * and the charts pasted into it.
 */
export function QuestionField({
  label,
  options,
  value,
  onSave,
  owner,
  slot,
}: {
  label: string
  options?: string[]
  value: string
  onSave: (v: string) => void
  owner: string
  slot: string
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-300">{label}</label>
      {options && (
        <div className="mb-1.5">
          <Pick options={options} value={options.includes(value) ? value : ''} onChange={onSave} />
        </div>
      )}
      <AutoText
        value={value}
        onSave={onSave}
        onImages={(blobs) => addShots(owner, slot, blobs)}
        placeholder="พิมพ์คำตอบ หรือ Ctrl+V วางรูปกราฟ"
      />
      <Shots owner={owner} slot={slot} />
    </div>
  )
}

export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
      <h3 className="mb-3 text-base font-semibold text-white">{title}</h3>
      <div className="space-y-4">{children}</div>
    </section>
  )
}
