import { db } from './db'
import { onLocalChange } from './syncBus'
import { supabase, isSupabaseConfigured, IMAGE_BUCKET } from './supabase'
import type { Block, Day, DayEntry, Shot, Week } from '../types'

/**
 * Cloud sync engine.
 *
 * The app stays local-first: every read/write hits Dexie (IndexedDB) so the UI
 * is instant and works offline. This module reconciles that local store with a
 * Supabase project in the background using last-write-wins by `updatedAt`.
 *
 * Nothing here runs unless `isSupabaseConfigured` is true and a user is signed
 * in, so an unconfigured build behaves exactly like the original local-only
 * journal.
 */

// ---------------------------------------------------------------------------
// Status store (so React can render sign-in state + sync activity)
// ---------------------------------------------------------------------------

export type SyncState = 'idle' | 'syncing' | 'error' | 'offline'

export interface SyncStatus {
  configured: boolean
  email: string | null
  userId: string | null
  state: SyncState
  lastSyncedAt: number | null
  error: string | null
}

let status: SyncStatus = {
  configured: isSupabaseConfigured,
  email: null,
  userId: null,
  state: 'idle',
  lastSyncedAt: null,
  error: null,
}

const listeners = new Set<() => void>()

function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch }
  listeners.forEach((l) => l())
}

/** For React's useSyncExternalStore. */
export function subscribeStatus(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
export function getStatus(): SyncStatus {
  return status
}

// ---------------------------------------------------------------------------
// Per-user sync cursors (stored in localStorage)
// ---------------------------------------------------------------------------

function cursorKey(kind: string): string {
  return `tj:${status.userId ?? 'anon'}:${kind}`
}
function getCursor(kind: string): number {
  const v = localStorage.getItem(cursorKey(kind))
  return v ? Number(v) || 0 : 0
}
function setCursor(kind: string, value: number) {
  localStorage.setItem(cursorKey(kind), String(value))
}

// ---------------------------------------------------------------------------
// Row shapes on the Supabase side
// ---------------------------------------------------------------------------

interface EntryRow {
  user_id: string
  date: string
  data: DayEntry | null
  updated_at: number
  deleted: boolean
}

interface BlockRow {
  user_id: string
  id: string
  entry_date: string
  type: 'text' | 'image'
  order: number
  text: string | null
  caption: string | null
  created_at: number
  updated_at: number
  storage_path: string | null
  deleted: boolean
}

function storagePath(userId: string, blockId: string): string {
  return `${userId}/${blockId}`
}


// ---------------------------------------------------------------------------
// Pair journal (Narrative Training: weeks / days / chart shots)
// ---------------------------------------------------------------------------

interface DocRow<T> {
  user_id: string
  id: string
  data: T | null
  updated_at: number
  deleted: boolean
}

interface ShotRow {
  user_id: string
  id: string
  owner: string
  slot: string
  order: number
  caption: string | null
  created_at: number
  updated_at: number
  storage_path: string | null
  deleted: boolean
}

function shotPath(userId: string, shotId: string): string {
  return `${userId}/shots/${shotId}`
}

const shotStamp = (s: Shot) => s.updatedAt ?? s.createdAt

/** Pull pweeks or pdays (whole record stored as jsonb). */
async function pullDocs(kind: 'pweeks' | 'pdays'): Promise<void> {
  if (!supabase) return
  const table = kind === 'pweeks' ? db.pweeks : db.pdays
  const since = getCursor(`pull_${kind}`)
  const { data, error } = await supabase
    .from(kind)
    .select('*')
    .gt('updated_at', since)
    .order('updated_at', { ascending: true })
  if (error) throw error
  let max = since
  for (const row of (data ?? []) as DocRow<Week & Day>[]) {
    max = Math.max(max, row.updated_at)
    if (row.deleted) {
      await table.delete(row.id)
      continue
    }
    const local = await table.get(row.id)
    if (row.data && (!local || row.updated_at > local.updatedAt)) {
      await table.put({ ...row.data, id: row.id, updatedAt: row.updated_at })
    }
  }
  setCursor(`pull_${kind}`, max)
  if (max > getCursor(`push_${kind}`)) setCursor(`push_${kind}`, max)
}

async function pullShots(): Promise<void> {
  if (!supabase) return
  const since = getCursor('pull_shots')
  const { data, error } = await supabase
    .from('shots')
    .select('*')
    .gt('updated_at', since)
    .order('updated_at', { ascending: true })
  if (error) throw error
  let max = since
  for (const row of (data ?? []) as ShotRow[]) {
    if (row.deleted) {
      await db.shots.delete(row.id)
      max = Math.max(max, row.updated_at)
      continue
    }
    const local = await db.shots.get(row.id)
    if (local && row.updated_at <= shotStamp(local)) {
      max = Math.max(max, row.updated_at)
      continue
    }
    let blob = local?.blob
    if (!blob && row.storage_path) {
      const dl = await supabase.storage.from(IMAGE_BUCKET).download(row.storage_path)
      // Image not downloadable yet: stop here so this row is retried next sync.
      if (dl.error || !dl.data) break
      blob = dl.data
    }
    if (!blob) {
      max = Math.max(max, row.updated_at)
      continue
    }
    await db.shots.put({
      id: row.id,
      owner: row.owner,
      slot: row.slot,
      order: row.order ?? 0,
      blob,
      caption: row.caption ?? '',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })
    max = Math.max(max, row.updated_at)
  }
  setCursor('pull_shots', max)
  if (max > getCursor('push_shots')) setCursor('push_shots', max)
}

async function pushDocs(userId: string, kind: 'pweeks' | 'pdays'): Promise<void> {
  if (!supabase) return
  const table = kind === 'pweeks' ? db.pweeks : db.pdays
  const since = getCursor(`push_${kind}`)
  const all: (Week | Day)[] = await table.toArray()
  const dirty = all.filter((r) => r.updatedAt > since)
  if (!dirty.length) return
  const rows = dirty.map((r) => ({
    user_id: userId,
    id: r.id,
    data: r,
    updated_at: r.updatedAt,
    deleted: false,
  }))
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabase.from(kind).upsert(rows.slice(i, i + 200))
    if (error) throw error
  }
  setCursor(`push_${kind}`, Math.max(since, ...dirty.map((r) => r.updatedAt)))
}

async function pushShots(userId: string): Promise<void> {
  if (!supabase) return
  const since = getCursor('push_shots')
  const all = await db.shots.toArray()
  const dirty = all.filter((s) => shotStamp(s) > since).sort((a, b) => shotStamp(a) - shotStamp(b))
  for (const s of dirty) {
    const path = shotPath(userId, s.id)
    const up = await supabase.storage
      .from(IMAGE_BUCKET)
      .upload(path, s.blob, { upsert: false, contentType: s.blob.type || 'image/png' })
    if (up.error) {
      const msg = up.error.message?.toLowerCase() ?? ''
      if (!msg.includes('exist') && !msg.includes('duplicate')) throw up.error
    }
    const { error } = await supabase.from('shots').upsert({
      user_id: userId,
      id: s.id,
      owner: s.owner,
      slot: s.slot,
      order: s.order ?? 0,
      caption: s.caption ?? '',
      created_at: s.createdAt,
      updated_at: shotStamp(s),
      storage_path: path,
      deleted: false,
    })
    if (error) throw error
    // Advance per shot so a failure mid-way doesn't re-upload finished ones.
    setCursor('push_shots', Math.max(getCursor('push_shots'), shotStamp(s)))
  }
}

// ---------------------------------------------------------------------------
// Pull: cloud -> local
// ---------------------------------------------------------------------------

async function pull(): Promise<void> {
  if (!supabase) return

  // --- entries (day records) ---
  {
    const since = getCursor('pullEntries')
    const { data, error } = await supabase
      .from('entries')
      .select('*')
      .gt('updated_at', since)
      .order('updated_at', { ascending: true })
    if (error) throw error

    let max = since
    for (const row of (data ?? []) as EntryRow[]) {
      max = Math.max(max, row.updated_at)
      if (row.deleted) {
        await db.entries.delete(row.date)
        continue
      }
      const local = await db.entries.get(row.date)
      if (row.data && (!local || row.updated_at > local.updatedAt)) {
        await db.entries.put({ ...row.data, date: row.date, migrated: true })
      }
    }
    setCursor('pullEntries', max)
    if (max > getCursor('pushEntries')) setCursor('pushEntries', max)
  }

  // --- blocks (text + image) ---
  {
    const since = getCursor('pullBlocks')
    const { data, error } = await supabase
      .from('blocks')
      .select('*')
      .gt('updated_at', since)
      .order('updated_at', { ascending: true })
    if (error) throw error

    let max = since
    for (const row of (data ?? []) as BlockRow[]) {
      max = Math.max(max, row.updated_at)
      if (row.deleted) {
        await db.blocks.delete(row.id)
        continue
      }
      const local = await db.blocks.get(row.id)
      if (local && row.updated_at <= local.updatedAt) continue

      let blob = local?.blob
      if (row.type === 'image' && !blob && row.storage_path) {
        const dl = await supabase.storage.from(IMAGE_BUCKET).download(row.storage_path)
        if (dl.error || !dl.data) continue // skip; retry on a later sync
        blob = dl.data
      }
      const block: Block = {
        id: row.id,
        entryDate: row.entry_date,
        type: row.type,
        order: row.order ?? 0,
        text: row.text ?? undefined,
        blob,
        caption: row.caption ?? undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
      await db.blocks.put(block)
    }
    setCursor('pullBlocks', max)
    if (max > getCursor('pushBlocks')) setCursor('pushBlocks', max)
  }

  // --- pair journal ---
  await pullDocs('pweeks')
  await pullDocs('pdays')
  await pullShots()
}

// ---------------------------------------------------------------------------
// Push: local -> cloud
// ---------------------------------------------------------------------------

async function push(userId: string): Promise<void> {
  if (!supabase) return

  // --- deletions first (tombstones from the outbox) ---
  const pending = await db.outbox.toArray()
  for (const row of pending) {
    if (row.type === 'delete-entry') {
      const { error } = await supabase.from('entries').upsert({
        user_id: userId,
        date: row.date,
        data: null,
        updated_at: Date.now(),
        deleted: true,
      })
      if (error) throw error
    } else if (row.type === 'delete-pweek' || row.type === 'delete-pday') {
      const { error } = await supabase.from(row.type === 'delete-pweek' ? 'pweeks' : 'pdays').upsert({
        user_id: userId,
        id: row.id!,
        data: null,
        updated_at: Date.now(),
        deleted: true,
      })
      if (error) throw error
    } else if (row.type === 'delete-shot') {
      const { error } = await supabase.from('shots').upsert({
        user_id: userId,
        id: row.id!,
        owner: '',
        slot: '',
        order: 0,
        caption: null,
        created_at: row.at,
        updated_at: Date.now(),
        storage_path: null,
        deleted: true,
      })
      if (error) throw error
      await supabase.storage.from(IMAGE_BUCKET).remove([shotPath(userId, row.id!)])
    } else {
      const { error } = await supabase.from('blocks').upsert({
        user_id: userId,
        id: row.id!,
        entry_date: row.date,
        type: 'text',
        order: 0,
        text: null,
        caption: null,
        created_at: row.at,
        updated_at: Date.now(),
        storage_path: storagePath(userId, row.id!),
        deleted: true,
      })
      if (error) throw error
      await supabase.storage
        .from(IMAGE_BUCKET)
        .remove([storagePath(userId, row.id!)])
    }
    if (row.seq != null) await db.outbox.delete(row.seq)
  }

  // --- entries changed locally since last push ---
  {
    const since = getCursor('pushEntries')
    const dirty = await db.entries.where('updatedAt').above(since).toArray()
    let max = since
    if (dirty.length) {
      const rows = dirty.map((e) => ({
        user_id: userId,
        date: e.date,
        data: e,
        updated_at: e.updatedAt,
        deleted: false,
      }))
      const { error } = await supabase.from('entries').upsert(rows)
      if (error) throw error
      for (const e of dirty) max = Math.max(max, e.updatedAt)
    }
    setCursor('pushEntries', max)
  }

  // --- blocks changed locally since last push ---
  {
    const since = getCursor('pushBlocks')
    const all = await db.blocks.toArray()
    const dirty = all.filter((b) => b.updatedAt > since)
    let max = since
    for (const b of dirty) {
      let path: string | null = null
      if (b.type === 'image' && b.blob) {
        path = storagePath(userId, b.id)
        const up = await supabase.storage
          .from(IMAGE_BUCKET)
          .upload(path, b.blob, {
            upsert: false,
            contentType: b.blob.type || 'image/png',
          })
        if (up.error) {
          const msg = up.error.message?.toLowerCase() ?? ''
          const dup = msg.includes('exist') || msg.includes('duplicate')
          if (!dup) throw up.error
        }
      }
      const { error } = await supabase.from('blocks').upsert({
        user_id: userId,
        id: b.id,
        entry_date: b.entryDate,
        type: b.type,
        order: b.order ?? 0,
        text: b.text ?? null,
        caption: b.caption ?? null,
        created_at: b.createdAt,
        updated_at: b.updatedAt,
        storage_path: path,
        deleted: false,
      })
      if (error) throw error
      max = Math.max(max, b.updatedAt)
    }
    setCursor('pushBlocks', max)
  }

  // --- pair journal ---
  await pushDocs(userId, 'pweeks')
  await pushDocs(userId, 'pdays')
  await pushShots(userId)
}

// ---------------------------------------------------------------------------
// Full sync (pull then push), serialized so runs never overlap
// ---------------------------------------------------------------------------

let running = false
let rerun = false

export async function fullSync(): Promise<void> {
  if (!supabase || !status.userId) return
  if (!navigator.onLine) {
    setStatus({ state: 'offline' })
    return
  }
  if (running) {
    rerun = true
    return
  }
  running = true
  setStatus({ state: 'syncing', error: null })
  try {
    await pull()
    await push(status.userId)
    setStatus({ state: 'idle', lastSyncedAt: Date.now(), error: null })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    setStatus({ state: 'error', error: msg })
  } finally {
    running = false
    if (rerun) {
      rerun = false
      void fullSync()
    }
  }
}

// ---------------------------------------------------------------------------
// "Make this device the master": mirror local -> cloud, discarding cloud rows
// (and thus other devices' data) that don't exist locally.
// ---------------------------------------------------------------------------

export async function makeThisDeviceMaster(): Promise<void> {
  if (!supabase || !status.userId) return
  const userId = status.userId
  setStatus({ state: 'syncing', error: null })
  try {
    await pull()

    const localEntries = await db.entries.toArray()
    const localBlocks = await db.blocks.toArray()
    const localDates = new Set(localEntries.map((e) => e.date))
    const localBlockIds = new Set(localBlocks.map((b) => b.id))
    const now = Date.now()

    // Soft-delete cloud entries/blocks that this device doesn't have.
    const remoteEntries = await supabase.from('entries').select('date').eq('deleted', false)
    if (remoteEntries.error) throw remoteEntries.error
    for (const r of (remoteEntries.data ?? []) as { date: string }[]) {
      if (!localDates.has(r.date)) {
        const { error } = await supabase.from('entries').upsert({
          user_id: userId,
          date: r.date,
          data: null,
          updated_at: now,
          deleted: true,
        })
        if (error) throw error
      }
    }
    const remoteBlocks = await supabase
      .from('blocks')
      .select('id, storage_path')
      .eq('deleted', false)
    if (remoteBlocks.error) throw remoteBlocks.error
    for (const r of (remoteBlocks.data ?? []) as {
      id: string
      storage_path: string | null
    }[]) {
      if (!localBlockIds.has(r.id)) {
        const { error } = await supabase.from('blocks').upsert({
          user_id: userId,
          id: r.id,
          entry_date: '',
          type: 'text',
          order: 0,
          text: null,
          caption: null,
          created_at: now,
          updated_at: now,
          storage_path: r.storage_path,
          deleted: true,
        })
        if (error) throw error
        if (r.storage_path)
          await supabase.storage.from(IMAGE_BUCKET).remove([r.storage_path])
      }
    }

    // Bump every local row's timestamp so it wins, reset cursors, push all.
    await db.transaction('rw', db.entries, db.blocks, async () => {
      for (const e of localEntries) await db.entries.put({ ...e, updatedAt: now })
      for (const b of localBlocks) await db.blocks.put({ ...b, updatedAt: now })
    })
    setCursor('pushEntries', 0)
    setCursor('pushBlocks', 0)
    await push(userId)
    setStatus({ state: 'idle', lastSyncedAt: Date.now(), error: null })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    setStatus({ state: 'error', error: msg })
    throw e
  }
}

// ---------------------------------------------------------------------------
// Lifecycle: wire up auth, auto-sync triggers, and realtime
// ---------------------------------------------------------------------------

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let started = false

function scheduleSync(delay = 1200) {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => void fullSync(), delay)
}

/**
 * Call once at app startup. Restores any existing session, keeps `status` in
 * sync with auth changes, and — while signed in — runs auto-sync on local
 * edits, on an interval, on focus/online, and on realtime cloud changes.
 */
export function startSync(): void {
  if (!supabase || started) return
  started = true

  const onSignedIn = (userId: string, email: string | null) => {
    setStatus({ userId, email })
    void fullSync()
    subscribeRealtime(userId)
  }
  const onSignedOut = () => {
    setStatus({ userId: null, email: null, state: 'idle', lastSyncedAt: null })
    unsubscribeRealtime()
  }

  supabase.auth.getUser().then(({ data }) => {
    if (data.user) onSignedIn(data.user.id, data.user.email ?? null)
  })

  supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) onSignedIn(session.user.id, session.user.email ?? null)
    else onSignedOut()
  })

  onLocalChange(() => scheduleSync())
  window.addEventListener('online', () => void fullSync())
  window.addEventListener('focus', () => void fullSync())
  setInterval(() => {
    if (status.userId) void fullSync()
  }, 30_000)
}

// Realtime: any change to this user's rows nudges a pull-driven sync.
let realtimeChannel: ReturnType<NonNullable<typeof supabase>['channel']> | null =
  null

function subscribeRealtime(userId: string) {
  if (!supabase || realtimeChannel) return
  realtimeChannel = supabase
    .channel('tj-sync')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'entries', filter: `user_id=eq.${userId}` },
      () => scheduleSync(400),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'blocks', filter: `user_id=eq.${userId}` },
      () => scheduleSync(400),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'pweeks', filter: `user_id=eq.${userId}` },
      () => scheduleSync(400),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'pdays', filter: `user_id=eq.${userId}` },
      () => scheduleSync(400),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'shots', filter: `user_id=eq.${userId}` },
      () => scheduleSync(400),
    )
    .subscribe()
}

function unsubscribeRealtime() {
  if (supabase && realtimeChannel) {
    void supabase.removeChannel(realtimeChannel)
    realtimeChannel = null
  }
}

// ---------------------------------------------------------------------------
// Auth helpers used by the sign-in UI (email one-time code)
// ---------------------------------------------------------------------------

export async function sendOtp(email: string): Promise<void> {
  if (!supabase) throw new Error('Sync is not configured.')
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  })
  if (error) throw error
}

export async function verifyOtp(email: string, token: string): Promise<void> {
  if (!supabase) throw new Error('Sync is not configured.')
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
  if (error) throw error
}

export async function signOut(): Promise<void> {
  if (!supabase) return
  await supabase.auth.signOut()
}
