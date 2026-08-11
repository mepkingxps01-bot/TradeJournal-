import Dexie, { type Table } from 'dexie'
import type { Block, BlockType, DayEntry } from '../types'
import { emptyDay } from '../types'
import { CHECKLIST_ITEMS } from './checklist'
import { emitLocalChange } from './syncBus'

/**
 * A pending deletion that still needs to be pushed to the cloud. Additions and
 * edits are recoverable by scanning `updatedAt`, but a deleted row leaves no
 * trace to scan — so we record a tombstone here until sync soft-deletes it
 * remotely, then clear it. Local-only setups never read this table.
 */
export interface Outbox {
  seq?: number
  type: 'delete-entry' | 'delete-block'
  /** entry date (both kinds carry it). */
  date: string
  /** block id, for delete-block only. */
  id?: string
  at: number
}

class TradeJournalDB extends Dexie {
  entries!: Table<DayEntry, string>
  blocks!: Table<Block, string>
  outbox!: Table<Outbox, number>
  // legacy store, kept only so migration can read old image rows
  images!: Table<Record<string, unknown>, string>

  constructor() {
    super('TradeJournalDB')
    this.version(1).stores({
      entries: 'date, updatedAt, result',
      images: 'id, entryDate, [entryDate+section]',
    })
    this.version(2).stores({
      entries: 'date, updatedAt, result',
      images: 'id, entryDate, [entryDate+section]',
      outbox: '++seq, type',
    })
    // v3: the plain doc model. Blocks replace the old structured fields +
    // per-section images. Existing data is migrated lazily on first open
    // (see getOrCreateDay), so the upgrade itself is a no-op schema change.
    this.version(3).stores({
      entries: 'date, updatedAt',
      images: 'id, entryDate, [entryDate+section]',
      blocks: 'id, entryDate, [entryDate+order]',
      outbox: '++seq, type',
    })
  }
}

export const db = new TradeJournalDB()

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}

// ---------------------------------------------------------------------------
// Days
// ---------------------------------------------------------------------------

/** Load a day (migrating legacy data if needed), or create a fresh blank one. */
export async function getOrCreateDay(date: string): Promise<DayEntry> {
  const existing = await db.entries.get(date)
  if (existing) {
    if (!existing.migrated) {
      await migrateDay(date)
      return (await db.entries.get(date)) ?? emptyDay(date)
    }
    return existing
  }
  const fresh = emptyDay(date)
  await db.entries.put(fresh)
  return fresh
}

export async function setDayTitle(date: string, title: string): Promise<void> {
  await db.entries.update(date, { title, updatedAt: Date.now() })
  emitLocalChange()
}

/** Delete a day and all of its blocks. */
export async function deleteDay(date: string): Promise<void> {
  await db.transaction('rw', db.entries, db.blocks, db.outbox, async () => {
    const blocks = await db.blocks.where('entryDate').equals(date).toArray()
    await db.blocks.where('entryDate').equals(date).delete()
    await db.entries.delete(date)
    await db.outbox.add({ type: 'delete-entry', date, at: Date.now() })
    for (const b of blocks) {
      await db.outbox.add({ type: 'delete-block', date, id: b.id, at: Date.now() })
    }
  })
  emitLocalChange()
}

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

export function listBlocks(date: string): Promise<Block[]> {
  return db.blocks.where('entryDate').equals(date).sortBy('order')
}

async function nextOrder(date: string): Promise<number> {
  const last = await db.blocks
    .where('[entryDate+order]')
    .between([date, Dexie.minKey], [date, Dexie.maxKey])
    .last()
  return last ? last.order + 1 : 0
}

async function touchDay(date: string, now = Date.now()): Promise<void> {
  const existing = await db.entries.get(date)
  if (existing) await db.entries.update(date, { updatedAt: now })
  else await db.entries.put({ ...emptyDay(date), createdAt: now, updatedAt: now })
}

export async function addTextBlock(date: string, text = ''): Promise<string> {
  const now = Date.now()
  const id = uid()
  await db.blocks.put({
    id,
    entryDate: date,
    type: 'text',
    order: await nextOrder(date),
    text,
    createdAt: now,
    updatedAt: now,
  })
  await touchDay(date, now)
  emitLocalChange()
  return id
}

export async function addImageBlocks(
  date: string,
  files: File[] | Blob[],
): Promise<void> {
  if (!files.length) return
  const now = Date.now()
  let order = await nextOrder(date)
  const rows: Block[] = Array.from(files).map((blob, i) => ({
    id: uid(),
    entryDate: date,
    type: 'image' as BlockType,
    order: order++,
    blob,
    caption: '',
    createdAt: now + i,
    updatedAt: now + i,
  }))
  await db.blocks.bulkPut(rows)
  await touchDay(date, now)
  emitLocalChange()
}

export async function updateBlockText(id: string, text: string): Promise<void> {
  const b = await db.blocks.get(id)
  if (!b) return
  await db.blocks.update(id, { text, updatedAt: Date.now() })
  await touchDay(b.entryDate)
  emitLocalChange()
}

export async function updateBlockCaption(id: string, caption: string): Promise<void> {
  const b = await db.blocks.get(id)
  if (!b) return
  await db.blocks.update(id, { caption, updatedAt: Date.now() })
  await touchDay(b.entryDate)
  emitLocalChange()
}

export async function deleteBlock(id: string): Promise<void> {
  const b = await db.blocks.get(id)
  if (!b) return
  await db.blocks.delete(id)
  await db.outbox.add({ type: 'delete-block', date: b.entryDate, id, at: Date.now() })
  await touchDay(b.entryDate)
  emitLocalChange()
}

/** Swap a block with its neighbour above/below (visual reorder). */
export async function moveBlock(id: string, dir: 'up' | 'down'): Promise<void> {
  const b = await db.blocks.get(id)
  if (!b) return
  const siblings = await listBlocks(b.entryDate)
  const idx = siblings.findIndex((s) => s.id === id)
  const swapWith = dir === 'up' ? siblings[idx - 1] : siblings[idx + 1]
  if (!swapWith) return
  const now = Date.now()
  await db.transaction('rw', db.blocks, async () => {
    await db.blocks.update(b.id, { order: swapWith.order, updatedAt: now })
    await db.blocks.update(swapWith.id, { order: b.order, updatedAt: now })
  })
  await touchDay(b.entryDate, now)
  emitLocalChange()
}

// ---------------------------------------------------------------------------
// Lazy migration: old structured entry (+ per-section images) -> blocks.
// Non-destructive to the actual image data (blobs are moved into blocks).
// ---------------------------------------------------------------------------

async function migrateDay(date: string): Promise<void> {
  try {
    await db.transaction('rw', db.entries, db.blocks, db.images, async () => {
      // Read the legacy entry record with its old fields.
      const legacy = (await db.entries.get(date)) as Record<string, unknown> | undefined
      const oldImages = (await db.images
        .where('entryDate')
        .equals(date)
        .toArray()) as Array<Record<string, unknown>>

      const now = Date.now()
      let order = 0
      const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

      const addText = (t: string) => {
        if (!t) return
        db.blocks.put({
          id: uid(),
          entryDate: date,
          type: 'text',
          order: order++,
          text: t,
          createdAt: now,
          updatedAt: now + order,
        })
      }
      const addImagesFor = (section: string) => {
        oldImages
          .filter((im) => im.section === section)
          .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
          .forEach((im) => {
            if (!(im.blob instanceof Blob)) return
            db.blocks.put({
              id: uid(),
              entryDate: date,
              type: 'image',
              order: order++,
              blob: im.blob,
              caption: str(im.caption),
              createdAt: now,
              updatedAt: now + order,
            })
          })
      }

      if (legacy) {
        // Reconstruct roughly in the old section order, interleaving each
        // section's images with its text.
        addImagesFor('htf')
        addText(
          [
            str(legacy.bias) && `Bias: ${str(legacy.bias)}`,
            str(legacy.marketPhase) && `Market phase: ${str(legacy.marketPhase)}`,
            str(legacy.target) && `Target: ${str(legacy.target)}`,
          ]
            .filter(Boolean)
            .join('\n'),
        )

        addImagesFor('plan')
        addText(str(legacy.plan))

        addImagesFor('entry')
        {
          const cl = (legacy.checklist ?? {}) as Record<string, string>
          const lines = CHECKLIST_ITEMS.map((it) => {
            const v = cl[it.key]
            if (v !== 'yes' && v !== 'no') return ''
            return `${v === 'yes' ? '✓' : '✗'} ${it.label}`
          }).filter(Boolean)
          addText(
            [
              lines.length ? lines.join('\n') : '',
              str(legacy.pdArraysNote) && `PD arrays: ${str(legacy.pdArraysNote)}`,
              str(legacy.expectedRR) && `Expected RR: ${str(legacy.expectedRR)}`,
            ]
              .filter(Boolean)
              .join('\n'),
          )
        }

        addImagesFor('management')
        addText(str(legacy.management))

        addText(
          [
            str(legacy.result) && `Result: ${str(legacy.result)}`,
            str(legacy.pnl) && `P&L: ${str(legacy.pnl)}`,
            str(legacy.note) && `Note: ${str(legacy.note)}`,
          ]
            .filter(Boolean)
            .join('\n'),
        )
      }

      // Remove the old image rows (their blobs now live in blocks).
      await db.images.where('entryDate').equals(date).delete()

      // Rewrite the entry to the clean DayEntry shape.
      await db.entries.put({
        date,
        title: '',
        createdAt: (legacy?.createdAt as number) ?? now,
        updatedAt: now,
        migrated: true,
      })
    })
  } catch {
    // If anything goes wrong, don't brick the day — mark it migrated so we
    // stop retrying, keeping whatever blocks were written.
    await db.entries.update(date, { migrated: true })
  }
  emitLocalChange()
}
