import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../lib/db'
import { addDaysISO, formatMoney, mondayOf, shortDate, todayISO } from '../../lib/format'
import { dayPnl } from '../../lib/journal'
import { DAY_NAMES, PAIRS } from '../../lib/template'
import type { Day } from '../../types'
import { verdictMark } from './WeekPage'

const MONTHS_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const HEAD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const pnlCls = (n: number) => (n > 0 ? 'text-emerald-400' : n < 0 ? 'text-rose-400' : 'text-slate-500')
const dayPath = (pair: string, ws: string, dow: number) => `/p/${pair}/week/${ws}/${DAY_NAMES[dow].short.toLowerCase()}`
const dowOf = (iso: string) => (new Date(iso + 'T00:00').getDay() + 6) % 7 // Mon = 0

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
 * Month view of the journal. With a pair, weekday cells show the narrative
 * mark, trade count and P&L, and weekend cells lead to the next week's
 * Weekend Prep. Without one, each day sums P&L across every pair; clicking a
 * day shows the per-pair breakdown.
 */
export default function Calendar({ pair }: { pair?: string }) {
  const navigate = useNavigate()
  const today = todayISO()
  const [month, setMonth] = useState(today.slice(0, 7)) // YYYY-MM
  const [sel, setSel] = useState<string | null>(null)

  const data = useLiveQuery(async () => {
    if (!pair) return { days: await db.pdays.toArray(), charts: new Set<string>(), preppedWeeks: new Set<string>() }
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

  const daysOn = (iso: string) => {
    const ws = mondayOf(iso)
    const dow = dowOf(iso)
    return (data?.days ?? []).filter((x) => x.weekStart === ws && x.dow === dow)
  }

  // Month totals: days whose date falls in this month.
  const inMonth = (data?.days ?? []).filter((d) => addDaysISO(d.weekStart, d.dow).startsWith(month))
  const monthPnl = inMonth.reduce((s, d) => s + dayPnl(d), 0)
  const monthTrades = inMonth.reduce((s, d) => s + d.trades.length, 0)

  const shift = (n: number) => {
    const dt = new Date(y, m - 1 + n, 1)
    setMonth(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`)
    setSel(null)
  }

  return (
    <section className="mb-6 rounded-xl border border-slate-800 bg-slate-900/30 p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
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
          <button
            onClick={() => {
              setMonth(today.slice(0, 7))
              setSel(null)
            }}
            className="ml-1 text-xs text-sky-400 hover:underline"
          >
            วันนี้
          </button>
        )}
        {monthTrades > 0 && (
          <span className="ml-auto text-sm text-slate-400">
            รวมเดือนนี้ {monthTrades} ไม้ · <b className={pnlCls(monthPnl)}>{formatMoney(monthPnl)}</b>
          </span>
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
          const dow = dowOf(iso)
          const isToday = iso === today
          const dateNum = Number(iso.slice(8))
          const base = `rounded-lg border p-1 text-left transition ${iso.startsWith(month) ? '' : 'opacity-35'} ${
            isToday || iso === sel ? 'border-sky-500' : 'border-slate-800'
          }`

          if (dow > 4) {
            if (!pair) {
              return (
                <div key={iso} className={`${base} min-h-14 bg-slate-950/30`}>
                  <div className="text-xs text-slate-600">{dateNum}</div>
                </div>
              )
            }
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

          if (!pair) {
            const traded = daysOn(iso).filter((d) => d.trades.length > 0)
            const total = traded.reduce((s, d) => s + dayPnl(d), 0)
            const trades = traded.reduce((s, d) => s + d.trades.length, 0)
            return (
              <button
                key={iso}
                onClick={() => setSel(iso === sel ? null : iso)}
                className={`${base} min-h-14 hover:border-slate-500 sm:min-h-16 ${trades ? 'bg-slate-800/60' : 'bg-slate-950/30'}`}
              >
                <span className={`text-xs ${isToday ? 'font-bold text-sky-300' : 'text-slate-300'}`}>{dateNum}</span>
                {trades > 0 && (
                  <div className="mt-1 text-[10px] leading-tight sm:text-[11px]">
                    <div className={`font-semibold ${pnlCls(total)}`}>{formatMoney(total)}</div>
                    <div className="text-slate-500">{trades} ไม้</div>
                    <div className="mt-0.5 hidden space-y-px sm:block">
                      {traded.map((d) => (
                        <div key={d.pair} className="flex justify-between gap-1 text-[10px]">
                          <span className="truncate text-slate-500">{d.pair}</span>
                          <span className={pnlCls(dayPnl(d))}>{formatMoney(dayPnl(d))}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
              onClick={() => navigate(dayPath(pair, ws, dow))}
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
                  <div className={pnlCls(pnl)}>{formatMoney(pnl)}</div>
                </div>
              )}
            </button>
          )
        })}
      </div>

      {!pair && sel && <DayBreakdown iso={sel} days={daysOn(sel)} />}

      <p className="mt-2 text-[11px] text-slate-500">
        {pair ? (
          <>
            ✓ ถูก · ~ ถูกแต่ Timing ผิด · ✗ ผิด · <span className="text-sky-400">●</span> มีบันทึก · เสาร์–อาทิตย์ = Weekend Prep สัปดาห์ถัดไป
          </>
        ) : (
          'P&L รวมทุกคู่ต่อวัน · กดที่วันเพื่อดูแยกตามคู่'
        )}
      </p>
    </section>
  )
}

/** One day across every pair, with links into each pair's day page. */
function DayBreakdown({ iso, days }: { iso: string; days: Day[] }) {
  const ws = mondayOf(iso)
  const dow = dowOf(iso)
  const total = days.reduce((s, d) => s + dayPnl(d), 0)
  return (
    <div className="mt-3 rounded-lg border border-slate-700 bg-slate-950/60 p-3">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-semibold text-white">
          {DAY_NAMES[dow].short} {shortDate(iso)}
        </span>
        <span className="text-slate-400">
          รวม <b className={pnlCls(total)}>{formatMoney(total)}</b>
        </span>
      </div>
      <ul className="divide-y divide-slate-800 text-sm">
        {PAIRS.map((p) => {
          const d = days.find((x) => x.pair === p)
          const v = verdictMark(d?.narrative ?? '')
          const trades = d?.trades.length ?? 0
          return (
            <li key={p}>
              <Link to={dayPath(p, ws, dow)} className="flex items-center gap-3 py-1.5 hover:text-white">
                <span className="w-20 font-semibold text-amber-300">{p}</span>
                <span className={`w-4 ${v.cls}`}>{v.mark}</span>
                <span className="flex-1 text-slate-400">{trades ? `${trades} ไม้` : '—'}</span>
                <span className={pnlCls(dayPnl(d))}>{trades ? formatMoney(dayPnl(d)) : ''}</span>
                <span className="text-xs text-sky-400">เปิด →</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
