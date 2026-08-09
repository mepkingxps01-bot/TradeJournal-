import Dexie, { type Table } from 'dexie'
import type { JournalEntry, StoredImage, ImageSection } from '../types'
import { emptyEntry } from '../types'

class TradeJournalDB extends Dexie {
  entries!: Table<JournalEntry, string>
  images!: Table<StoredImage, string>

  constructor() {
    super('TradeJournalDB')
    this.version(1).stores({
      // primary key `date`, plus indexes used for sorting/filtering
      entries: 'date, updatedAt, result',
      // compound index lets us load one section's images in order
      images: 'id, entryDate, [entryDate+section]',
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
}

/** Delete a day and all of its images. */
export async function deleteDay(date: string): Promise<void> {
  await db.transaction('rw', db.entries, db.images, async () => {
    await db.images.where('entryDate').equals(date).delete()
    await db.entries.delete(date)
  })
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
  }))
  await db.images.bulkPut(rows)
  // touch the entry so the day shows up / re-sorts in the list
  await db.entries.update(date, { updatedAt: now })
}

export async function deleteImage(id: string): Promise<void> {
  await db.images.delete(id)
}

export async function updateImageCaption(id: string, caption: string): Promise<void> {
  await db.images.update(id, { caption })
}
