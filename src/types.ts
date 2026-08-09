export type MarketPhase =
  | 'Expansion'
  | 'Consolidation'
  | 'Retracement'
  | 'Reversal'

export type TradeResult = 'Win' | 'Loss'

/** Checklist state: 'yes' = green check, 'no' = red X, null = not answered. */
export type Check = 'yes' | 'no' | null

export type ImageSection = 'htf' | 'plan' | 'entry' | 'management'

export interface StoredImage {
  id: string
  entryDate: string
  section: ImageSection
  blob: Blob
  caption: string
  order: number
  createdAt: number
  /** Last time this image's metadata changed — used by cloud sync (optional
   * for records created before sync existed; treat missing as createdAt). */
  updatedAt?: number
}

export interface JournalEntry {
  /** YYYY-MM-DD — primary key, one entry per trading day. */
  date: string

  // 1. HTF analysis
  bias: string
  marketPhase: MarketPhase | ''
  target: string

  // 2. Plan for today (manual typing)
  plan: string

  // 3. Entry checklist (keyed by CHECKLIST_ITEMS[].key)
  checklist: Record<string, Check>
  pdArraysNote: string
  expectedRR: string

  // 3. Intratrade management
  management: string

  // 4. Result
  result: TradeResult | ''
  pnl: string

  // 5. Reminder note
  note: string

  createdAt: number
  updatedAt: number
}

export function emptyEntry(date: string): JournalEntry {
  const now = Date.now()
  return {
    date,
    bias: '',
    marketPhase: '',
    target: '',
    plan: '',
    checklist: {},
    pdArraysNote: '',
    expectedRR: '',
    management: '',
    result: '',
    pnl: '',
    note: '',
    createdAt: now,
    updatedAt: now,
  }
}
