import { useState, useSyncExternalStore } from 'react'
import { isSupabaseConfigured } from '../lib/supabase'
import {
  subscribeStatus,
  getStatus,
  sendOtp,
  verifyOtp,
  signOut,
  fullSync,
  makeThisDeviceMaster,
} from '../lib/sync'

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
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [stage, setStage] = useState<'email' | 'code'>('email')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  // Sync isn't configured for this build — stay silent so the app is exactly
  // the original local-only journal.
  if (!isSupabaseConfigured) return null

  const signedIn = Boolean(status.userId)

  async function handleSendCode() {
    setBusy(true)
    setMsg(null)
    try {
      await sendOtp(email.trim())
      setStage('code')
      setMsg('Check your email for a 6-digit code.')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Could not send code.')
    } finally {
      setBusy(false)
    }
  }

  async function handleVerify() {
    setBusy(true)
    setMsg(null)
    try {
      await verifyOtp(email.trim(), code.trim())
      setOpen(false)
      setStage('email')
      setCode('')
      setMsg(null)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Invalid code.')
    } finally {
      setBusy(false)
    }
  }

  async function handleMaster() {
    if (
      !window.confirm(
        'Make THIS device the master?\n\nThis overwrites the cloud (and every other device) with the data currently on this device. Use this on your computer to keep its data and discard the phone’s.\n\nContinue?',
      )
    )
      return
    setBusy(true)
    try {
      await makeThisDeviceMaster()
      setMsg('Done — cloud now matches this device.')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed.')
    } finally {
      setBusy(false)
    }
  }

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
    <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900/50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 text-sm text-slate-300 hover:text-white"
        >
          <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
          <span className="font-medium">{label}</span>
          {signedIn && (
            <span className="hidden text-xs text-slate-500 sm:inline">
              · {status.email}
            </span>
          )}
          <span className="text-slate-500">{open ? '▲' : '▾'}</span>
        </button>

        {signedIn && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => void fullSync()}
              disabled={status.state === 'syncing'}
              className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-slate-500 disabled:opacity-50"
            >
              Sync now
            </button>
          </div>
        )}
      </div>

      {open && (
        <div className="mt-3 border-t border-slate-800 pt-3">
          {!signedIn ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Sign in with your email to sync this journal across your devices.
                No password — we email you a one-time code.
              </p>
              {stage === 'email' ? (
                <div className="flex flex-wrap gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
                  />
                  <button
                    onClick={handleSendCode}
                    disabled={busy || !email.includes('@')}
                    className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
                  >
                    {busy ? 'Sending…' : 'Send code'}
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <input
                    inputMode="numeric"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="6-digit code"
                    className="w-40 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm tracking-widest text-slate-100 outline-none focus:border-sky-500"
                  />
                  <button
                    onClick={handleVerify}
                    disabled={busy || code.trim().length < 6}
                    className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {busy ? 'Verifying…' : 'Verify & sign in'}
                  </button>
                  <button
                    onClick={() => {
                      setStage('email')
                      setMsg(null)
                    }}
                    className="px-2 py-2 text-xs text-slate-400 hover:text-slate-200"
                  >
                    Change email
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Signed in as{' '}
                <span className="text-slate-200">{status.email}</span>. Your days,
                notes and chart images sync automatically.
              </p>
              {status.state === 'error' && status.error && (
                <p className="text-xs text-red-400">Last error: {status.error}</p>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleMaster}
                  disabled={busy}
                  className="rounded-md border border-amber-700/60 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-600/10 disabled:opacity-50"
                >
                  Make this device the master
                </button>
                <button
                  onClick={() => void signOut()}
                  className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-500"
                >
                  Sign out
                </button>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500">
                “Make this device the master” overwrites the cloud and every other
                device with the data on this device. Use it once on your computer
                to keep its journal and discard the phone’s.
              </p>
            </div>
          )}

          {msg && <p className="mt-3 text-xs text-slate-400">{msg}</p>}
        </div>
      )}
    </div>
  )
}
