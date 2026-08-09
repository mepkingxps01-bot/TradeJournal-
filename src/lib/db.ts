import Dexie, { type Table } from 'dexie'
import type { JournalEntry, StoredImage, ImageSection } from '../types'
import { emptyEntry } from '../types'
import { emitLocalChange } from './syncBus'

/**
 * A pending deletion that still needs to be pushed to the cloud. Additions and
 * edits are recoverable by scanning `updatedAt`, but a deleted row leaves no
 * trace to scan — so we record a tombstone here until sync soft-deletes it
 * remotely, then clear it. Local-only setups never read this table.
 */
export interface Outbox {
  seq?: number
  type: 'delete-entry' | 'delete-image'
  /** entry date (for both kinds — image rows carry it so we can key storage). */
  date: string
  /** image id, for delete-image only. */
  id?: string
  at: number
}

class TradeJournalDB extends Dexie {
  entries!: Table<JournalEntry, string>
  images!: Table<StoredImage, string>
  outbox!: Table<Outbox, number>

  constructor() {
    super('TradeJournalDB')
    this.version(1).stores({
      // primary key `date`, plus indexes used for sorting/filtering
      entries: 'date, updatedAt, result',
      // compound index lets us load one section's images in order
      images: 'id, entryDate, [entryDate+section]',
    })
    // v2 adds the sync outbox (deletion tombstones). Existing data is kept.
    this.version(2).stores({
      entries: 'date, updatedAt, result',
      images: 'id, entryDate, [entryDate+section]',
      outbox: '++seq, type',
    })
  }
}

export const db = new TradeJournalDB()

function uid(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
  )
}

/** Load an entry, or create a fresh blank one for the date if none exists. */
export async function getOrCreateEntry(date: string): Promise<JournalEntry> {
  const existing = await db.entries.get(date)
  if (existing) return existing
  const fresh = emptyEntry(date)
  await db.entries.put(fresh)
  return fresh
}

export async function saveEntry(entry: JournalEntry): Promise<void> {
  await db.entries.put({ ...entry, updatedAt: Date.now() })
  emitLocalChange()
}

/** Delete a day and all of its images. */
export async function deleteDay(date: string): Promise<void> {
  await db.transaction('rw', db.entries, db.images, db.outbox, async () => {
    const imgs = await db.images.where('entryDate').equals(date).toArray()
    await db.images.where('entryDate').equals(date).delete()
    await db.entries.delete(date)
    await db.outbox.add({ type: 'delete-entry', date, at: Date.now() })
    for (const img of imgs) {
      await db.outbox.add({
        type: 'delete-image',
        date,
        id: img.id,
        at: Date.now(),
      })
    }
  })
  emitLocalChange()
}

export async function addImages(
  date: string,
  section: ImageSection,
  files: File[] | Blob[],
): Promise<void> {
  if (!files.length) return
  const count = await db.images
    .where('[entryDate+section]')
    .equals([date, section])
    .count()
  const now = Date.now()
  const rows: StoredImage[] = files.map((blob, i) => ({
    id: uid(),
    entryDate: date,
    section,
    blob,
    caption: '',
    order: count + i,
    createdAt: now + i,
    updatedAt: now + i,
  }))
  await db.images.bulkPut(rows)
  // touch the entry so the day shows up / re-sorts in the list
  await db.entries.update(date, { updatedAt: now })
  emitLocalChange()
}

export async function deleteImage(id: string): Promise<void> {
  const img = await db.images.get(id)
  await db.images.delete(id)
  if (img) {
    await db.outbox.add({
      type: 'delete-image',
      date: img.entryDate,
      id,
      at: Date.now(),
    })
  }
  emitLocalChange()
}

export async function updateImageCaption(id: string, caption: string): Promise<void> {
  await db.images.update(id, { caption, updatedAt: Date.now() })
  emitLocalChange()
}
