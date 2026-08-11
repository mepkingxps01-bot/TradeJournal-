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

export function emptyDay(date: string): DayEntry {
  const now = Date.now()
  return { date, title: '', createdAt: now, updatedAt: now, migrated: true }
}
