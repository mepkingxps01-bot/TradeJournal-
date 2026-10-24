import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../lib/db'
import { addDaysISO, formatMoney, mondayOf, todayISO } from '../../lib/format'
import { dayPnl } from '../../lib/journal'
import { DAY_NAMES } from '../../lib/template'
import type { Day } from '../../types'
import { verdictMark } from './WeekPage'

const MONTHS_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const HEAD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Has the person written or picked anything on this day? */
function hasContent(d: Day | undefined, withCharts: Set<string>): boolean {
  if (!d) return false
  return (
    !!d.narrative ||
    d.mistakes.length > 0 ||
    d.trades.length > 0 ||
    Object.values(d.fields).some((v) => v.trim()) ||
    withCharts.has(`${d.weekStart}:${d.dow}`)
  )
}

/**
 * Month view of one pair's journal. Weekday cells show the narrative mark,
 * trade count and P&L; weekend cells lead to the next week's Weekend Prep.
 */
export default function Calendar({ pair }: { pair: string }) {
  const navigate = useNavigate()
  const today = todayISO()
  const [month, setMonth] = useState(today.slice(0, 7)) // YYYY-MM

  const data = useLiveQuery(async () => {
    const [days, weeks, owners] = await Promise.all([
      db.pdays.where('pair').equals(pair).toArray(),
      db.pweeks.where('pair').equals(pair).toArray(),
      db.shots.where('owner').startsWith(`day:${pair}:`).keys(),
    ])
    const charts = new Set(owners.map((o) => String(o).split(':').slice(2).join(':')))
    const weekShots = await db.shots.where('owner').startsWith(`week:${pair}:`).keys()
    const preppedWeeks = new Set([
      ...weeks.filter((w) => Object.values(w.fields).some((v) => v.trim())).map((w) => w.weekStart),
      ...weekShots.map((o) => String(o).split(':')[2]),
    ])
    return { days, charts, preppedWeeks }
  }, [pair])

  const [y, m] = month.split('-').map(Number)
  const first = `${month}-01`
  const lastDay = new Date(y, m, 0).getDate()
  const gridStart = mondayOf(first) // a Sunday 1st maps to the Monday before
  const last = `${month}-${String(lastDay).padStart(2, '0')}`
  const cells: string[] = []
  for (let d = gridStart; d <= last || cells.length % 7 !== 0; d = addDaysISO(d, 1)) cells.push(d)

  const shift = (n: number) => {
    const dt = new Date(y, m - 1 + n, 1)
    setMonth(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`)
  }

  return (
    <section className="mb-6 rounded-xl border border-slate-800 bg-slate-900/30 p-3 sm:p-4">
      <div className="mb-3 flex items-center gap-2">
        <button onClick={() => shift(-1)} title="Previous month" className="rounded-md px-2 py-1 text-slate-400 hover:bg-slate-800">
          ‹
        </button>
        <h2 className="min-w-28 text-center font-semibold text-white">
          {MONTHS_TH[m - 1]} {y}
        </h2>
        <button onClick={() => shift(1)} title="Next month" className="rounded-md px-2 py-1 text-slate-400 hover:bg-slate-800">
          ›
        </button>
        {month !== today.slice(0, 7) && (
          <button onClick={() => setMonth(today.slice(0, 7))} className="ml-1 text-xs text-sky-400 hover:underline">
            วันนี้
          </button>
        )}
      </div>

      <div className="grid grid-cols-[repeat(5,minmax(0,1fr))_minmax(0,0.6fr)_minmax(0,0.6fr)] gap-1 text-center text-[11px] text-slate-500">
        {HEAD.map((h) => (
          <div key={h} className="pb-1">
            {h}
          </div>
        ))}

        {cells.map((iso) => {
          const ws = mondayOf(iso)
          const dow = (new Date(iso + 'T00:00').getDay() + 6) % 7 // Mon = 0
          const inMonth = iso.startsWith(month)
          const isToday = iso === today
          const dateNum = Number(iso.slice(8))
          const base = `rounded-lg border p-1 text-left transition ${inMonth ? '' : 'opacity-35'} ${
            isToday ? 'border-sky-500' : 'border-slate-800'
          }`

          if (dow > 4) {
            // Weekend → prep for the coming week.
            const next = addDaysISO(ws, 7)
            const prepped = data?.preppedWeeks.has(next)
            return (
              <button
                key={iso}
                onClick={() => navigate(`/p/${pair}/week/${next}`)}
                title="Weekend Prep ของสัปดาห์ถัดไป"
                className={`${base} min-h-14 bg-slate-950/30 hover:border-slate-600`}
              >
                <div className="text-xs text-slate-500">{dateNum}</div>
                {prepped && <div className="mt-1 text-[10px] text-sky-300">Prep ✓</div>}
              </button>
            )
          }

          const d = data?.days.find((x) => x.weekStart === ws && x.dow === dow)
          const filled = hasContent(d, data?.charts ?? new Set())
          const v = verdictMark(d?.narrative ?? '')
          const pnl = dayPnl(d)
          const trades = d?.trades.length ?? 0
          return (
            <button
              key={iso}
              onClick={() => navigate(`/p/${pair}/week/${ws}/${DAY_NAMES[dow].short.toLowerCase()}`)}
              className={`${base} min-h-14 hover:border-slate-500 sm:min-h-16 ${filled ? 'bg-slate-800/60' : 'bg-slate-950/30'}`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs ${isToday ? 'font-bold text-sky-300' : 'text-slate-300'}`}>{dateNum}</span>
                {d?.narrative ? (
                  <span className={`text-sm leading-none ${v.cls}`}>{v.mark}</span>
                ) : (
                  filled && <span className="h-1.5 w-1.5 rounded-full bg-sky-400" title="มีบันทึก" />
                )}
              </div>
              {trades > 0 && (
                <div className="mt-1 text-[10px] leading-tight sm:text-[11px]">
                  <div className="text-slate-400">{trades} ไม้</div>
                  <div className={pnl > 0 ? 'text-emerald-400' : pnl < 0 ? 'text-rose-400' : 'text-slate-500'}>
                    {formatMoney(pnl)}
                  </div>
                </div>
              )}
            </button>
          )
        })}
      </div>

      <p className="mt-2 text-[11px] text-slate-500">
        ✓ ถูก · ~ ถูกแต่ Timing ผิด · ✗ ผิด · <span className="text-sky-400">●</span> มีบันทึก · เสาร์–อาทิตย์ = Weekend Prep สัปดาห์ถัดไป
      </p>
    </section>
  )
}
