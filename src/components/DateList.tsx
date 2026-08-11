import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { formatDate, todayISO } from '../lib/format'
import SyncBar from './SyncBar'
import { isSupabaseConfigured } from '../lib/supabase'

interface DaySummary {
  date: string
  images: number
  snippet: string
  title: string
}

export default function DateList() {
  const navigate = useNavigate()
  const [pick, setPick] = useState(todayISO())

  const days: DaySummary[] =
    useLiveQuery(async () => {
      const entries = await db.entries.toArray()
      const summaries = await Promise.all(
        entries.map(async (e) => {
          const blocks = await db.blocks.where('entryDate').equals(e.date).toArray()
          const images = blocks.filter((b) => b.type === 'image').length
          const text = blocks
            .filter((b) => b.type === 'text' && (b.text ?? '').trim())
            .map((b) => (b.text ?? '').trim())
            .join(' · ')
          return {
            date: e.date,
            images,
            title: (e.title ?? '').trim(),
            snippet: text.slice(0, 120),
          }
        }),
      )
      return summaries.sort((a, b) => (a.date < b.date ? 1 : -1))
    }, []) ?? []

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          📈 Trade Journal
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Pick a date, then paste your charts and type your notes.
        </p>
      </header>

      <SyncBar />

      {/* Open / create a day */}
      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">
            Date
          </label>
          <input
            type="date"
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
          />
        </div>
        <button
          onClick={() => pick && navigate(`/day/${pick}`)}
          className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
        >
          Open this day →
        </button>
      </div>

      {/* Date list */}
      {days.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 py-16 text-center text-slate-500">
          No entries yet. Choose a date above and start your first journal.
        </div>
      ) : (
        <ul className="space-y-2">
          {days.map((d) => (
            <li key={d.date}>
              <button
                onClick={() => navigate(`/day/${d.date}`)}
                className="flex w-full items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-left transition hover:border-slate-600 hover:bg-slate-900"
              >
                <div className="min-w-0">
                  <div className="font-medium text-slate-100">
                    {formatDate(d.date)}
                    {d.title && (
                      <span className="ml-2 font-normal text-slate-400">
                        — {d.title}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-slate-500">
                    {d.snippet || 'No notes yet'}
                  </div>
                </div>
                {d.images > 0 && (
                  <span className="shrink-0 rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-slate-300">
                    🖼 {d.images}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      <footer className="mt-10 text-center text-xs text-slate-600">
        {isSupabaseConfigured
          ? 'Stored on this device and synced to the cloud when signed in.'
          : 'Data is stored locally in this browser (IndexedDB).'}
      </footer>
    </div>
  )
}
