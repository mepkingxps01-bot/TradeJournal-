import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { getOrCreateEntry, saveEntry, deleteDay } from '../lib/db'
import { formatDate } from '../lib/format'
import type { Check, JournalEntry, MarketPhase, TradeResult } from '../types'
import ImageGallery from './ImageGallery'
import Checklist from './Checklist'

const PHASES: MarketPhase[] = [
  'Expansion',
  'Consolidation',
  'Retracement',
  'Reversal',
]

export default function DayView() {
  const { date = '' } = useParams()
  const navigate = useNavigate()
  const [entry, setEntry] = useState<JournalEntry | null>(null)
  const [saved, setSaved] = useState(true)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let alive = true
    getOrCreateEntry(date).then((e) => {
      if (alive) setEntry(e)
    })
    return () => {
      alive = false
    }
  }, [date])

  function patch(partial: Partial<JournalEntry>) {
    setEntry((prev) => {
      if (!prev) return prev
      const next = { ...prev, ...partial }
      setSaved(false)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        saveEntry(next).then(() => setSaved(true))
      }, 400)
      return next
    })
  }

  if (!entry) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-slate-500">
        Loading…
      </div>
    )
  }

  async function handleDelete() {
    if (
      !window.confirm(
        `Delete the entire journal for ${formatDate(date)}? This removes all images and notes for this day.`,
      )
    )
      return
    await deleteDay(date)
    navigate('/')
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link
          to="/"
          className="text-sm text-slate-400 hover:text-slate-200"
        >
          ← All dates
        </Link>
        <span className="text-xs text-slate-500">
          {saved ? 'All changes saved' : 'Saving…'}
        </span>
      </div>

      <h1 className="mb-6 text-2xl font-bold text-white">
        {formatDate(date)}
      </h1>

      {/* 1. HTF Analysis */}
      <Section title="1 · HTF Analysis" subtitle="Higher-timeframe bias (Weekly → H4)">
        <ImageGallery date={date} section="htf" label="HTF charts" />
        <div className="mt-4 space-y-4">
          <Field label="Bias">
            <input
              value={entry.bias}
              onChange={(e) => patch({ bias: e.target.value })}
              placeholder="e.g. Bullish — expecting continuation after Weekly OB tap"
              className={inputCls}
            />
          </Field>

          <Field label="Market Phase">
            <div className="flex flex-wrap gap-2">
              {PHASES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() =>
                    patch({ marketPhase: entry.marketPhase === p ? '' : p })
                  }
                  className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                    entry.marketPhase === p
                      ? 'bg-sky-600 text-white'
                      : 'border border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Target for today">
            <textarea
              value={entry.target}
              onChange={(e) => patch({ target: e.target.value })}
              placeholder="Draw on liquidity / target level for today…"
              rows={2}
              className={inputCls}
            />
          </Field>
        </div>
      </Section>

      {/* 2. Entry */}
      <Section title="2 · Entry" subtitle="Entry chart + confirmation checklist">
        <ImageGallery date={date} section="entry" label="entry charts" />
        <div className="mt-4">
          <Checklist
            entry={entry}
            onCheck={(key: string, value: Check) =>
              patch({ checklist: { ...entry.checklist, [key]: value } })
            }
            onNote={(field, value) => patch({ [field]: value })}
          />
        </div>
      </Section>

      {/* 3. Intratrade management */}
      <Section
        title="3 · Intratrade Management"
        subtitle="e.g. pyramid entries, trailing stop-loss"
      >
        <ImageGallery date={date} section="management" label="management screenshots" />
        <textarea
          value={entry.management}
          onChange={(e) => patch({ management: e.target.value })}
          placeholder="How you managed the trade — pyramiding, moving stops, partials…"
          rows={3}
          className={`mt-4 ${inputCls}`}
        />
      </Section>

      {/* 4. Result */}
      <Section title="4 · Result">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex gap-2">
            {(['Win', 'Loss'] as TradeResult[]).map((r) => {
              const active = entry.result === r
              const tone =
                r === 'Win'
                  ? active
                    ? 'bg-emerald-600 text-white'
                    : 'border border-emerald-700/50 text-emerald-300 hover:bg-emerald-600/10'
                  : active
                    ? 'bg-red-600 text-white'
                    : 'border border-red-700/50 text-red-300 hover:bg-red-600/10'
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => patch({ result: active ? '' : r })}
                  className={`rounded-lg px-6 py-2 text-sm font-bold transition ${tone}`}
                >
                  {r}
                </button>
              )
            })}
          </div>
          <Field label="Profit / Loss">
            <input
              value={entry.pnl}
              onChange={(e) => patch({ pnl: e.target.value })}
              inputMode="decimal"
              placeholder="e.g. +250 or -80"
              className={`${inputCls} w-40`}
            />
          </Field>
        </div>
      </Section>

      {/* 5. Additional note */}
      <Section title="5 · Additional Note" subtitle="A reminder to your future self">
        <textarea
          value={entry.note}
          onChange={(e) => patch({ note: e.target.value })}
          placeholder="What to remember / do differently next time…"
          rows={3}
          className={inputCls}
        />
      </Section>

      <div className="mt-8 border-t border-slate-800 pt-6">
        <button
          onClick={handleDelete}
          className="text-sm text-red-400/80 hover:text-red-400"
        >
          Delete this day
        </button>
      </div>
    </div>
  )
}

const inputCls =
  'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500'

function Section({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-5 rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {subtitle && (
          <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
        )}
      </div>
      {children}
    </section>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate-400">
        {label}
      </label>
      {children}
    </div>
  )
}
