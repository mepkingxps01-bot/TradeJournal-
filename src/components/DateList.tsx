import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { formatDate, formatMoney, parsePnl, todayISO } from '../lib/format'
import type { JournalEntry } from '../types'
import SyncBar from './SyncBar'
import { isSupabaseConfigured } from '../lib/supabase'

function ResultBadge({ result }: { result: JournalEntry['result'] }) {
  if (result === 'Win')
    return (
      <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
        Win
      </span>
    )
  if (result === 'Loss')
    return (
      <span className="rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-semibold text-red-300">
        Loss
      </span>
    )
  return (
    <span className="rounded-full bg-slate-700/50 px-2.5 py-0.5 text-xs font-semibold text-slate-400">
      Open
    </span>
  )
}

export default function DateList() {
  const navigate = useNavigate()
  const [pick, setPick] = useState(todayISO())

  const entries =
    useLiveQuery(async () => {
      const all = await db.entries.toArray()
      return all.sort((a, b) => (a.date < b.date ? 1 : -1))
    }, []) ?? []

  const decided = entries.filter((e) => e.result)
  const wins = decided.filter((e) => e.result === 'Win').length
  const losses = decided.filter((e) => e.result === 'Loss').length
  const net = entries.reduce((s, e) => s + parsePnl(e.pnl), 0)
  const winRate = decided.length
    ? Math.round((wins / decided.length) * 100)
    : 0

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          📈 Trade Journal
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Pick a date to review or log your day.
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

      {/* Stats */}
      {entries.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Days logged" value={String(entries.length)} />
          <Stat label="Win rate" value={`${winRate}%`} sub={`${wins}W · ${losses}L`} />
          <Stat
            label="Net P&L"
            value={formatMoney(net)}
            tone={net > 0 ? 'green' : net < 0 ? 'red' : 'neutral'}
          />
          <Stat label="Decided" value={String(decided.length)} />
        </div>
      )}

      {/* Date list */}
      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 py-16 text-center text-slate-500">
          No entries yet. Choose a date above and start your first journal.
        </div>
      ) : (
        <ul className="space-y-2">
          {entries.map((e) => {
            const pnl = parsePnl(e.pnl)
            return (
              <li key={e.date}>
                <button
                  onClick={() => navigate(`/day/${e.date}`)}
                  className="flex w-full items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-left transition hover:border-slate-600 hover:bg-slate-900"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-slate-100">
                      {formatDate(e.date)}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-slate-500">
                      {e.marketPhase || 'No phase'}
                      {e.bias ? ` · ${e.bias}` : ''}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {e.pnl && (
                      <span
                        className={`text-sm font-semibold ${
                          pnl > 0
                            ? 'text-emerald-400'
                            : pnl < 0
                              ? 'text-red-400'
                              : 'text-slate-400'
                        }`}
                      >
                        {formatMoney(pnl)}
                      </span>
                    )}
                    <ResultBadge result={e.result} />
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <footer className="mt-10 text-center text-xs text-slate-600">
        {isSupabaseConfigured
          ? 'Stored on this device (IndexedDB) and synced to the cloud when signed in.'
          : 'Data is stored locally in this browser (IndexedDB).'}
      </footer>
    </div>
  )
}

function Stat({
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  label: string
  value: string
  sub?: string
  tone?: 'green' | 'red' | 'neutral'
}) {
  const color =
    tone === 'green'
      ? 'text-emerald-400'
      : tone === 'red'
        ? 'text-red-400'
        : 'text-slate-100'
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`mt-1 text-xl font-bold ${color}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  )
}
