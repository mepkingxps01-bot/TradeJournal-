import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../lib/db'
import { addDaysISO, formatMoney, formatRR, mondayOf, parsePnl, shortDate, todayISO } from '../../lib/format'
import { dayCommission, dayPnl, dayRR, hasCommission, hasRR, patchDay, tradesCommission, tradesRR } from '../../lib/journal'
import { ALL_PAIRS, DAY_NAMES, PAIRS } from '../../lib/template'
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
 * Small box typed straight into the calendar (RR or commission). Saves on
 * blur / Enter; an empty box falls back to the day's trades (placeholder).
 */
function DayInput({
  kind,
  pair,
  ws,
  dow,
  day,
  fallback,
  className = '',
}: {
  kind: 'rr' | 'comm'
  pair: string
  ws: string
  dow: number
  day?: Day
  /** Value used when the box is empty (defaults to the day's trades). */
  fallback?: number
  className?: string
}) {
  const key = kind === 'rr' ? 'rrManual' : 'commManual'
  const stored = day?.[key] ?? ''
  const [v, setV] = useState(stored)
  useEffect(() => setV(stored), [stored])
  const save = () => {
    if (v.trim() !== stored.trim()) void patchDay(pair, ws, dow, { [key]: v.trim() })
  }
  const n = v.trim() ? parsePnl(v) : 0
  const sum = fallback ?? (kind === 'rr' ? tradesRR(day) : tradesCommission(day))
  const placeholder = kind === 'rr' ? (sum ? formatRR(sum) : 'RR') : sum ? `คอม ${formatMoney(sum)}` : 'คอม'
  const color = kind === 'comm' ? 'text-amber-200' : n > 0 ? 'text-emerald-300' : n < 0 ? 'text-rose-300' : 'text-slate-200'
  return (
    <input
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
      onClick={(e) => e.stopPropagation()}
      placeholder={placeholder}
      inputMode="decimal"
      title={kind === 'rr' ? 'ใส่ RR ของวันนี้ (เว้นว่าง = รวมจากไม้เทรด)' : 'ใส่ค่าคอมของวันนี้ (เว้นว่าง = รวมจากไม้เทรด)'}
      className={`w-full min-w-0 rounded border border-slate-700/70 bg-slate-950/70 px-1 py-0.5 text-[11px] outline-none placeholder:text-slate-600 focus:border-sky-500 ${color} ${className}`}
    />
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
    if (!pair) {
      const all = await db.pdays.toArray()
      return {
        days: all.filter((d) => d.pair !== ALL_PAIRS),
        totals: all.filter((d) => d.pair === ALL_PAIRS),
        charts: new Set<string>(),
        preppedWeeks: new Set<string>(),
      }
    }
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
    return { days, totals: [] as Day[], charts, preppedWeeks }
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

  /** All-pairs total record for a date (RR / commission typed in this calendar). */
  const totalOn = (iso: string) => {
    const ws = mondayOf(iso)
    const dow = dowOf(iso)
    return (data?.totals ?? []).find((x) => x.weekStart === ws && x.dow === dow)
  }
  /** A date's RR / commission across pairs: the typed total, else the pairs' sum. */
  const combined = (iso: string) => {
    const ds = daysOn(iso)
    const t = totalOn(iso)
    const rrSum = ds.reduce((s, d) => s + dayRR(d), 0)
    const commSum = ds.reduce((s, d) => s + dayCommission(d), 0)
    return {
      rrSum,
      commSum,
      rr: t?.rrManual?.trim() ? dayRR(t) : rrSum,
      hasRR: !!t?.rrManual?.trim() || ds.some((d) => hasRR(d)),
      comm: t?.commManual?.trim() ? dayCommission(t) : commSum,
    }
  }

  // Month totals: days whose date falls in this month.
  const inMonth = (data?.days ?? []).filter((d) => addDaysISO(d.weekStart, d.dow).startsWith(month))
  const monthPnl = inMonth.reduce((s, d) => s + dayPnl(d), 0)
  const monthTrades = inMonth.reduce((s, d) => s + d.trades.length, 0)
  let monthRR = inMonth.reduce((s, d) => s + dayRR(d), 0)
  let monthHasRR = inMonth.some((d) => hasRR(d))
  let monthComm = inMonth.reduce((s, d) => s + dayCommission(d), 0)
  // Typed all-pairs totals replace that date's pair sums.
  for (const t of data?.totals ?? []) {
    const iso = addDaysISO(t.weekStart, t.dow)
    if (!iso.startsWith(month)) continue
    const c = combined(iso)
    if (t.rrManual?.trim()) {
      monthRR += c.rr - c.rrSum
      monthHasRR = true
    }
    if (t.commManual?.trim()) monthComm += c.comm - c.commSum
  }

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
        {(monthTrades > 0 || monthHasRR || monthComm > 0) && (
          <span className="ml-auto text-sm text-slate-400">
            รวมเดือนนี้
            {monthTrades > 0 && (
              <>
                {' '}
                {monthTrades} ไม้ · <b className={pnlCls(monthPnl)}>{formatMoney(monthPnl)}</b>
              </>
            )}
            {monthHasRR && (
              <>
                {monthTrades > 0 ? ' · ' : ' '}
                <b className={pnlCls(monthRR)}>{formatRR(monthRR)}</b>
              </>
            )}
            {monthComm > 0 && (
              <>
                {' '}· ค่าคอม <b className="text-amber-300">{formatMoney(-monthComm)}</b> · สุทธิ{' '}
                <b className={pnlCls(monthPnl - monthComm)}>{formatMoney(monthPnl - monthComm)}</b>
              </>
            )}
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
            const traded = daysOn(iso).filter((d) => d.trades.length > 0 || hasRR(d) || hasCommission(d))
            const total = traded.reduce((s, d) => s + dayPnl(d), 0)
            const trades = traded.reduce((s, d) => s + d.trades.length, 0)
            const c = combined(iso)
            const toggle = () => setSel(iso === sel ? null : iso)
            return (
              <div
                key={iso}
                role="button"
                tabIndex={0}
                onClick={toggle}
                onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && toggle()}
                className={`${base} flex min-h-14 cursor-pointer flex-col hover:border-slate-500 sm:min-h-16 ${
                  trades || c.hasRR || c.comm > 0 ? 'bg-slate-800/60' : 'bg-slate-950/30'
                }`}
              >
                <span className={`text-xs ${isToday ? 'font-bold text-sky-300' : 'text-slate-300'}`}>{dateNum}</span>
                {traded.length > 0 && (
                  <div className="mt-1 text-[10px] leading-tight sm:text-[11px]">
                    {trades > 0 && <div className={`font-semibold ${pnlCls(total)}`}>{formatMoney(total)}</div>}
                    {trades > 0 && <div className="text-slate-500">{trades} ไม้</div>}
                    <div className="mt-0.5 hidden space-y-px sm:block">
                      {traded.map((d) => (
                        <div key={d.pair} className="flex justify-between gap-1 text-[10px]">
                          <span className="truncate text-slate-500">{d.pair}</span>
                          <span className={pnlCls(dayPnl(d))}>
                            {d.trades.length > 0 && formatMoney(dayPnl(d))}
                            {hasRR(d) && <span className={`ml-1 ${pnlCls(dayRR(d))}`}>{formatRR(dayRR(d))}</span>}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mt-auto space-y-0.5 pt-1">
                  <DayInput kind="rr" pair={ALL_PAIRS} ws={ws} dow={dow} day={totalOn(iso)} fallback={c.rrSum} className="font-semibold" />
                  <DayInput kind="comm" pair={ALL_PAIRS} ws={ws} dow={dow} day={totalOn(iso)} fallback={c.commSum} />
                </div>
              </div>
            )
          }

          const d = data?.days.find((x) => x.weekStart === ws && x.dow === dow)
          const filled = hasContent(d, data?.charts ?? new Set())
          const v = verdictMark(d?.narrative ?? '')
          const pnl = dayPnl(d)
          const trades = d?.trades.length ?? 0
          return (
            <div
              key={iso}
              role="button"
              tabIndex={0}
              onClick={() => navigate(dayPath(pair, ws, dow))}
              onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && navigate(dayPath(pair, ws, dow))}
              className={`${base} flex min-h-14 cursor-pointer flex-col hover:border-slate-500 sm:min-h-16 ${
                filled || hasRR(d) || hasCommission(d) ? 'bg-slate-800/60' : 'bg-slate-950/30'
              }`}
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
              <div className="mt-auto space-y-0.5 pt-1">
                <DayInput kind="rr" pair={pair} ws={ws} dow={dow} day={d} className="font-semibold" />
                <DayInput kind="comm" pair={pair} ws={ws} dow={dow} day={d} />
              </div>
            </div>
          )
        })}
      </div>

      {!pair && sel && <DayBreakdown iso={sel} days={daysOn(sel)} total={totalOn(sel)} />}

      <p className="mt-2 text-[11px] text-slate-500">
        {pair ? (
          <>
            ✓ ถูก · ~ ถูกแต่ Timing ผิด · ✗ ผิด · <span className="text-sky-400">●</span> มีบันทึก · ช่อง RR / ค่าคอม พิมพ์ได้เลย (เว้นว่าง = รวมจากไม้เทรด) · เสาร์–อาทิตย์ = Weekend Prep สัปดาห์ถัดไป
          </>
        ) : (
          'P&L รวมทุกคู่ต่อวัน · ช่อง RR / ค่าคอม = รวมทั้งวัน พิมพ์ได้เลย (เว้นว่าง = รวมจากทุกคู่) · กดที่วันเพื่อดูแยกตามคู่'
        )}
      </p>
    </section>
  )
}

/** One day across every pair, with links into each pair's day page. */
function DayBreakdown({ iso, days, total: typed }: { iso: string; days: Day[]; total?: Day }) {
  const ws = mondayOf(iso)
  const dow = dowOf(iso)
  const total = days.reduce((s, d) => s + dayPnl(d), 0)
  const rr = typed?.rrManual?.trim() ? dayRR(typed) : days.reduce((s, d) => s + dayRR(d), 0)
  const anyRR = !!typed?.rrManual?.trim() || days.some((d) => hasRR(d))
  const comm = typed?.commManual?.trim() ? dayCommission(typed) : days.reduce((s, d) => s + dayCommission(d), 0)
  return (
    <div className="mt-3 rounded-lg border border-slate-700 bg-slate-950/60 p-3">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-semibold text-white">
          {DAY_NAMES[dow].short} {shortDate(iso)}
        </span>
        <span className="text-slate-400">
          รวม <b className={pnlCls(total)}>{formatMoney(total)}</b>
          {anyRR && (
            <>
              {' '}· <b className={pnlCls(rr)}>{formatRR(rr)}</b>
            </>
          )}
          {comm > 0 && (
            <>
              {' '}· ค่าคอม <b className="text-amber-300">{formatMoney(-comm)}</b> · สุทธิ{' '}
              <b className={pnlCls(total - comm)}>{formatMoney(total - comm)}</b>
            </>
          )}
        </span>
      </div>
      <ul className="divide-y divide-slate-800 text-sm">
        {PAIRS.map((p) => {
          const d = days.find((x) => x.pair === p)
          const v = verdictMark(d?.narrative ?? '')
          const trades = d?.trades.length ?? 0
          return (
            <li key={p} className="flex items-center gap-3 py-1.5">
              <span className="w-20 font-semibold text-amber-300">{p}</span>
              <span className={`w-4 ${v.cls}`}>{v.mark}</span>
              <span className="flex-1 text-slate-400">{trades ? `${trades} ไม้` : '—'}</span>
              <span className={pnlCls(dayPnl(d))}>{trades ? formatMoney(dayPnl(d)) : ''}</span>
              <DayInput kind="rr" pair={p} ws={ws} dow={dow} day={d} className="!w-16 text-sm" />
              <DayInput kind="comm" pair={p} ws={ws} dow={dow} day={d} className="!w-20 text-sm" />
              <Link to={dayPath(p, ws, dow)} className="text-xs text-sky-400 hover:underline">
                เปิด →
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
