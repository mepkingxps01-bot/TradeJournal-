// Tiny dependency-free event bus so the local data layer (db.ts) can tell the
// sync engine "the user just changed something" without importing it directly
// (which would create a cycle). The sync engine registers a listener; if none
// is registered (e.g. sync not configured) emitting is a no-op.

type Listener = () => void

let listener: Listener | null = null

/** Register the (single) sync listener. Returns an unsubscribe function. */
export function onLocalChange(cb: Listener): () => void {
  listener = cb
  return () => {
    if (listener === cb) listener = null
  }
}

/** Called by db.ts after any user-initiated write. */
export function emitLocalChange(): void {
  listener?.()
}
