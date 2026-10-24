import { db } from './db'
import { parsePnl } from './format'
import { NARRATIVE_RIGHT, NARRATIVE_TIMING, normMarket } from './template'
import type { Day, Shot, Trade } from '../types'

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}

export const dayId = (weekStart: string, dow: number) => `${weekStart}:${dow}`
export const weekOwner = (weekStart: string) => `week:${weekStart}`
export const dayOwner = (weekStart: string, dow: number) => `day:${weekStart}:${dow}`

// ---------------------------------------------------------------------------
// Weeks & days
// ---------------------------------------------------------------------------

export async function ensureWeek(weekStart: string): Promise<void> {
  if (await db.weeks.get(weekStart)) return
  const now = Date.now()
  await db.weeks.put({ weekStart, fields: {}, createdAt: now, updatedAt: now })
}

async function ensureDay(weekStart: string, dow: number): Promise<string> {
  const id = dayId(weekStart, dow)
  if (!(await db.days.get(id))) {
    const now = Date.now()
    await ensureWeek(weekStart)
    await db.days.put({
      id,
      weekStart,
      dow,
      markets: [],
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

export async function setWeekField(weekStart: string, key: string, value: string) {
  await ensureWeek(weekStart)
  await db.weeks.update(weekStart, (w) => {
    w.fields[key] = value
    w.updatedAt = Date.now()
  })
}

export async function setDayField(weekStart: string, dow: number, key: string, value: string) {
  const id = await ensureDay(weekStart, dow)
  await db.days.update(id, (d) => {
    d.fields[key] = value
    d.updatedAt = Date.now()
  })
}

export async function patchDay(
  weekStart: string,
  dow: number,
  patch: Partial<Pick<Day, 'markets' | 'narrative' | 'mistakes'>>,
) {
  const id = await ensureDay(weekStart, dow)
  await db.days.update(id, { ...patch, updatedAt: Date.now() })
}

/** Delete a whole week: its days and every pasted chart. */
export async function deleteWeek(weekStart: string) {
  await db.transaction('rw', db.weeks, db.days, db.shots, async () => {
    await db.shots.where('owner').startsWith(`day:${weekStart}:`).delete()
    await db.shots.where('owner').equals(weekOwner(weekStart)).delete()
    await db.days.where('weekStart').equals(weekStart).delete()
    await db.weeks.delete(weekStart)
  })
}

// ---------------------------------------------------------------------------
// Trades (stored inline on the day)
// ---------------------------------------------------------------------------

async function editTrades(weekStart: string, dow: number, fn: (t: Trade[]) => Trade[]) {
  const id = await ensureDay(weekStart, dow)
  await db.transaction('rw', db.days, async () => {
    const day = await db.days.get(id)
    if (!day) return
    await db.days.update(id, { trades: fn(day.trades), updatedAt: Date.now() })
  })
}

/** New trade; starts on the day's pair when exactly one is picked. */
export async function addTrade(weekStart: string, dow: number) {
  const day = await db.days.get(dayId(weekStart, dow))
  const markets = (day?.markets ?? []).map(normMarket)
  const pair = markets.length === 1 ? markets[0] : ''
  return editTrades(weekStart, dow, (t) => [
    ...t,
    { id: uid(), pair, reason: '', setup: '', result: '', pnl: '' },
  ])
}

export async function updateTrade(weekStart: string, dow: number, id: string, patch: Partial<Trade>) {
  await editTrades(weekStart, dow, (t) => t.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  // Trading a pair means the day covered it, so tick it in the day's markets too.
  if (patch.pair) {
    const day = await db.days.get(dayId(weekStart, dow))
    const markets = (day?.markets ?? []).map(normMarket)
    if (!markets.includes(patch.pair)) await patchDay(weekStart, dow, { markets: [...markets, patch.pair] })
  }
}

export async function deleteTrade(weekStart: string, dow: number, id: string) {
  await editTrades(weekStart, dow, (t) => t.filter((x) => x.id !== id))
  await db.shots
    .where('[owner+slot]')
    .equals([dayOwner(weekStart, dow), `trade:${id}`])
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
  /** Per traded pair, most trades first; trades without a pair are left out. */
  pairs: { pair: string; trades: number; wins: number; losses: number; pnl: number }[]
}

export function computeStats(days: Day[]): Stats {
  const s: Stats = { graded: 0, right: 0, rightLate: 0, trades: 0, wins: 0, losses: 0, pnl: 0, mistakes: [], pairs: [] }
  const counts = new Map<string, number>()
  const pairs = new Map<string, Stats['pairs'][number]>()
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
      if (t.pair) {
        const p = pairs.get(t.pair) ?? { pair: t.pair, trades: 0, wins: 0, losses: 0, pnl: 0 }
        p.trades++
        if (t.result === 'win') p.wins++
        if (t.result === 'loss') p.losses++
        p.pnl += parsePnl(t.pnl)
        pairs.set(t.pair, p)
      }
    }
  }
  s.mistakes = [...counts.entries()].sort((a, b) => b[1] - a[1])
  s.pairs = [...pairs.values()].sort((a, b) => b.trades - a.trades)
  return s
}

export function dayPnl(day?: Day): number {
  return (day?.trades ?? []).reduce((sum, t) => sum + parsePnl(t.pnl), 0)
}
