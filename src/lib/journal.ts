import { db } from './db'
import { parsePnl } from './format'
import { NARRATIVE_RIGHT, NARRATIVE_TIMING } from './template'
import type { Day, Shot, Trade } from '../types'

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}

export const weekId = (pair: string, weekStart: string) => `${pair}|${weekStart}`
export const dayId = (pair: string, weekStart: string, dow: number) => `${pair}|${weekStart}|${dow}`
export const weekOwner = (pair: string, weekStart: string) => `week:${pair}:${weekStart}`
export const dayOwner = (pair: string, weekStart: string, dow: number) => `day:${pair}:${weekStart}:${dow}`

// ---------------------------------------------------------------------------
// Weeks & days
// ---------------------------------------------------------------------------

export function listDays(pair: string, weekStart: string): Promise<Day[]> {
  return db.pdays.where('[pair+weekStart]').equals([pair, weekStart]).toArray()
}

async function ensureWeek(pair: string, weekStart: string): Promise<string> {
  const id = weekId(pair, weekStart)
  if (!(await db.pweeks.get(id))) {
    const now = Date.now()
    await db.pweeks.put({ id, pair, weekStart, fields: {}, createdAt: now, updatedAt: now })
  }
  return id
}

async function ensureDay(pair: string, weekStart: string, dow: number): Promise<string> {
  const id = dayId(pair, weekStart, dow)
  if (!(await db.pdays.get(id))) {
    const now = Date.now()
    await ensureWeek(pair, weekStart)
    await db.pdays.put({
      id,
      pair,
      weekStart,
      dow,
      narrative: '',
      mistakes: [],
      fields: {},
      trades: [],
      createdAt: now,
      updatedAt: now,
    })
  }
  return id
}

export async function setWeekField(pair: string, weekStart: string, key: string, value: string) {
  const id = await ensureWeek(pair, weekStart)
  await db.pweeks.update(id, (w) => {
    w.fields[key] = value
    w.updatedAt = Date.now()
  })
}

export async function setDayField(pair: string, weekStart: string, dow: number, key: string, value: string) {
  const id = await ensureDay(pair, weekStart, dow)
  await db.pdays.update(id, (d) => {
    d.fields[key] = value
    d.updatedAt = Date.now()
  })
}

export async function patchDay(
  pair: string,
  weekStart: string,
  dow: number,
  patch: Partial<Pick<Day, 'narrative' | 'mistakes'>>,
) {
  const id = await ensureDay(pair, weekStart, dow)
  await db.pdays.update(id, { ...patch, updatedAt: Date.now() })
}

/** Delete a whole week of one pair: its days and every pasted chart. */
export async function deleteWeek(pair: string, weekStart: string) {
  await db.transaction('rw', db.pweeks, db.pdays, db.shots, async () => {
    await db.shots.where('owner').startsWith(`day:${pair}:${weekStart}:`).delete()
    await db.shots.where('owner').equals(weekOwner(pair, weekStart)).delete()
    await db.pdays.where('[pair+weekStart]').equals([pair, weekStart]).delete()
    await db.pweeks.delete(weekId(pair, weekStart))
  })
}

// ---------------------------------------------------------------------------
// Trades (stored inline on the day)
// ---------------------------------------------------------------------------

async function editTrades(pair: string, weekStart: string, dow: number, fn: (t: Trade[]) => Trade[]) {
  const id = await ensureDay(pair, weekStart, dow)
  await db.transaction('rw', db.pdays, async () => {
    const day = await db.pdays.get(id)
    if (!day) return
    await db.pdays.update(id, { trades: fn(day.trades), updatedAt: Date.now() })
  })
}

export function addTrade(pair: string, weekStart: string, dow: number) {
  return editTrades(pair, weekStart, dow, (t) => [
    ...t,
    { id: uid(), reason: '', setup: '', result: '', pnl: '' },
  ])
}

export function updateTrade(pair: string, weekStart: string, dow: number, id: string, patch: Partial<Trade>) {
  return editTrades(pair, weekStart, dow, (t) => t.map((x) => (x.id === id ? { ...x, ...patch } : x)))
}

export async function deleteTrade(pair: string, weekStart: string, dow: number, id: string) {
  await editTrades(pair, weekStart, dow, (t) => t.filter((x) => x.id !== id))
  await db.shots
    .where('[owner+slot]')
    .equals([dayOwner(pair, weekStart, dow), `trade:${id}`])
    .delete()
}

// ---------------------------------------------------------------------------
// Pasted charts
// ---------------------------------------------------------------------------

export function listShots(owner: string, slot: string): Promise<Shot[]> {
  return db.shots.where('[owner+slot]').equals([owner, slot]).sortBy('order')
}

export async function addShots(owner: string, slot: string, blobs: Blob[]) {
  if (!blobs.length) return
  const existing = await listShots(owner, slot)
  let order = existing.length ? existing[existing.length - 1].order + 1 : 0
  const now = Date.now()
  await db.shots.bulkPut(
    blobs.map((blob, i) => ({
      id: uid(),
      owner,
      slot,
      order: order++,
      blob,
      caption: '',
      createdAt: now + i,
    })),
  )
}

export function deleteShot(id: string) {
  return db.shots.delete(id)
}

export function setShotCaption(id: string, caption: string) {
  return db.shots.update(id, { caption })
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export interface Stats {
  /** Days with a narrative verdict picked. */
  graded: number
  right: number
  rightLate: number
  trades: number
  wins: number
  losses: number
  pnl: number
  /** Mistake → number of days it was ticked, most frequent first. */
  mistakes: [string, number][]
}

export function computeStats(days: Day[]): Stats {
  const s: Stats = { graded: 0, right: 0, rightLate: 0, trades: 0, wins: 0, losses: 0, pnl: 0, mistakes: [] }
  const counts = new Map<string, number>()
  for (const d of days) {
    if (d.narrative) s.graded++
    if (d.narrative === NARRATIVE_RIGHT) s.right++
    if (d.narrative === NARRATIVE_TIMING) s.rightLate++
    for (const m of d.mistakes) counts.set(m, (counts.get(m) ?? 0) + 1)
    for (const t of d.trades) {
      s.trades++
      if (t.result === 'win') s.wins++
      if (t.result === 'loss') s.losses++
      s.pnl += parsePnl(t.pnl)
    }
  }
  s.mistakes = [...counts.entries()].sort((a, b) => b[1] - a[1])
  return s
}

export function dayPnl(day?: Day): number {
  return (day?.trades ?? []).reduce((sum, t) => sum + parsePnl(t.pnl), 0)
}
