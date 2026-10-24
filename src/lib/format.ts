/** Parse a P&L string like "+120", "-45.5", "$1,200" into a number (0 if empty/invalid). */
export function parsePnl(raw: string): number {
  if (!raw) return 0
  const cleaned = raw.replace(/[^0-9.\-+]/g, '')
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : 0
}

export function formatMoney(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '-' : ''
  const abs = Math.abs(n)
  return `${sign}${abs.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

/** "2026-08-09" -> "Sun, 9 Aug 2026" (parsed as local, no timezone shift). */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const dt = new Date(y, m - 1, d)
  return `${WEEKDAYS[dt.getDay()]}, ${d} ${MONTHS[m - 1]} ${y}`
}

function toISO(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function fromISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayISO(): string {
  return toISO(new Date())
}

export function addDaysISO(iso: string, n: number): string {
  const d = fromISO(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

/** The Monday of the week containing `iso` (Sat/Sun belong to the week before, as prep days). */
export function mondayOf(iso: string): string {
  const day = fromISO(iso).getDay() // 0 = Sun
  return addDaysISO(iso, day === 0 ? -6 : 1 - day)
}

/** Week you'd be journaling today: on Sat/Sun that's next week's prep. */
export function currentWeekStart(): string {
  const today = todayISO()
  const day = fromISO(today).getDay()
  return day === 0 || day === 6 ? addDaysISO(mondayOf(today), 7) : mondayOf(today)
}

/** "2026-10-19" -> "19–23 Oct 2026" (Mon–Fri). */
export function weekLabel(weekStart: string): string {
  const a = fromISO(weekStart)
  const b = fromISO(addDaysISO(weekStart, 4))
  const left =
    a.getMonth() === b.getMonth() ? `${a.getDate()}` : `${a.getDate()} ${MONTHS[a.getMonth()]}`
  return `${left}–${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`
}

/** "2026-10-19" -> "19 Oct". */
export function shortDate(iso: string): string {
  const d = fromISO(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}
