// ---------------------------------------------------------------------------
// A day is a plain, doc-like page: an ordered stack of blocks. Each block is
// either free text you type, or a big pasted image. That's the whole model.
// ---------------------------------------------------------------------------

export type BlockType = 'text' | 'image'

export interface Block {
  id: string
  /** YYYY-MM-DD — the day this block belongs to. */
  entryDate: string
  type: BlockType
  /** Position within the day (ascending). */
  order: number
  /** Text blocks only. */
  text?: string
  /** Image blocks only. */
  blob?: Blob
  /** Optional caption under an image. */
  caption?: string
  createdAt: number
  updatedAt: number
}

export interface DayEntry {
  /** YYYY-MM-DD — primary key, one entry per day. */
  date: string
  /** Optional free-text title for the day. */
  title?: string
  createdAt: number
  updatedAt: number
  /** Set once the day has been migrated from the old structured format. */
  migrated?: boolean
}

// ---------------------------------------------------------------------------
// Narrative Training journal: one week = Weekend Prep + Mon–Fri day pages +
// Weekly Reflection. Text answers live in `fields` keyed by the question key
// in lib/template.ts; pasted charts live in the `shots` table.
// ---------------------------------------------------------------------------

// Each pair (XAUUSD, NQ) is its own journal, so weeks, days and charts all
// carry the pair in their keys.

export interface Week {
  /** `${pair}|${weekStart}` — primary key. */
  id: string
  pair: string
  /** YYYY-MM-DD of the week's Monday. */
  weekStart: string
  fields: Record<string, string>
  createdAt: number
  updatedAt: number
}

export type TradeResult = '' | 'win' | 'loss' | 'be'

export interface Trade {
  id: string
  reason: string
  setup: string
  result: TradeResult
  /** Free text like "+120" or "-45.5"; parsed with parsePnl for totals. */
  pnl: string
}

export interface Day {
  /** `${pair}|${weekStart}|${dow}` — dow 0 = Mon … 4 = Fri. */
  id: string
  pair: string
  weekStart: string
  dow: number
  /** '' until picked; otherwise one of NARRATIVE_OPTIONS. */
  narrative: string
  mistakes: string[]
  fields: Record<string, string>
  trades: Trade[]
  createdAt: number
  updatedAt: number
}

/** A pasted chart, attached to one question (`slot`) on a week or day page. */
export interface Shot {
  id: string
  /** `week:<pair>:<weekStart>` or `day:<pair>:<weekStart>:<dow>`. */
  owner: string
  /** Question key, or `trade:<tradeId>`. */
  slot: string
  order: number
  blob: Blob
  caption: string
  createdAt: number
  /** Last local change (caption edit etc.); drives cloud sync. Older rows lack it. */
  updatedAt?: number
}

export function emptyDay(date: string): DayEntry {
  const now = Date.now()
  return { date, title: '', createdAt: now, updatedAt: now, migrated: true }
}
