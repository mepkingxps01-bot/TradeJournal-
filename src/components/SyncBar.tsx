import { useSyncExternalStore } from 'react'
import { isSupabaseConfigured } from '../lib/supabase'
import { subscribeStatus, getStatus, fullSync } from '../lib/sync'

function useStatus() {
  return useSyncExternalStore(subscribeStatus, getStatus)
}

function timeAgo(ts: number | null): string {
  if (!ts) return 'not yet'
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  return `${h}h ago`
}

export default function SyncBar() {
  const status = useStatus()
  // Sync isn't configured for this build — stay silent.
  if (!isSupabaseConfigured) return null

  const signedIn = Boolean(status.userId)

  const dot =
    status.state === 'error'
      ? 'bg-red-500'
      : status.state === 'syncing'
        ? 'bg-amber-400 animate-pulse'
        : status.state === 'offline'
          ? 'bg-slate-500'
          : signedIn
            ? 'bg-emerald-500'
            : 'bg-slate-500'

  const label = !signedIn
    ? 'Not synced'
    : status.state === 'error'
      ? 'Sync error'
      : status.state === 'syncing'
        ? 'Syncing…'
        : status.state === 'offline'
          ? 'Offline'
          : `Synced ${timeAgo(status.lastSyncedAt)}`

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/50 p-3">
      <div className="flex items-center gap-2 text-sm text-slate-300">
        <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
        <span className="font-medium">{label}</span>
        {status.state === 'error' && status.error && (
          <span className="text-xs text-red-400">· {status.error}</span>
        )}
      </div>
      <button
        onClick={() => void fullSync()}
        disabled={status.state === 'syncing'}
        className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-slate-500 disabled:opacity-50"
      >
        Sync now
      </button>
    </div>
  )
}
