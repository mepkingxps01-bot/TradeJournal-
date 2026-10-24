import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../lib/db'
import { addDaysISO, formatMoney, shortDate, weekLabel } from '../../lib/format'
import {
  computeStats,
  dayPnl,
  deleteWeek,
  listDays,
  patchDay,
  setWeekField,
  weekId,
  weekOwner,
  type Stats,
} from '../../lib/journal'
import {
  DAY_NAMES,
  NARRATIVE_OPTIONS,
  NARRATIVE_RIGHT,
  NARRATIVE_TIMING,
  PAIRS,
  WEEK_PREP,
  WEEK_REFLECTION,
} from '../../lib/template'
import type { Day } from '../../types'
import DayTab from './DayTab'
import { Card, QuestionField } from './ui'

const TAB_KEYS = DAY_NAMES.map((d) => d.short.toLowerCase())

/** Small coloured mark for a day's narrative verdict. */
export function verdictMark(narrative: string): { mark: string; cls: string } {
  if (narrative === NARRATIVE_RIGHT) return { mark: '✓', cls: 'text-emerald-400' }
  if (narrative === NARRATIVE_TIMING) return { mark: '~', cls: 'text-amber-400' }
  if (narrative) return { mark: '✗', cls: 'text-rose-400' }
  return { mark: '·', cls: 'text-slate-600' }
}

export function StatsLine({ s, of }: { s: Stats; of?: number }) {
  const top = s.mistakes[0]
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
      <span>
        Narrative ถูก{' '}
        <b className="text-emerald-400">
          {s.right}/{of ?? s.graded}
        </b>
        {s.rightLate > 0 && <span className="text-amber-400"> (+{s.rightLate} Timing ผิด)</span>}
      </span>
      <span>
        เทรด <b className="text-white">{s.trades}</b> ไม้
        {s.wins + s.losses > 0 && (
          <span className="text-slate-400">
            {' '}
            · ชนะ {s.wins}/{s.wins + s.losses} ({Math.round((s.wins / (s.wins + s.losses)) * 100)}%)
          </span>
        )}
      </span>
      <span>
        P&L{' '}
        <b className={s.pnl > 0 ? 'text-emerald-400' : s.pnl < 0 ? 'text-rose-400' : 'text-white'}>
          {formatMoney(s.pnl)}
        </b>
      </span>
      {top && (
        <span>
          พลาดบ่อยสุด: <b className="text-rose-300">{top[0]}</b> ({top[1]})
        </span>
      )}
    </div>
  )
}

function Scoreboard({
  pair,
  ws,
  days,
  onOpen,
}: {
  pair: string
  ws: string
  days: Day[]
  onOpen: (dow: number) => void
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-left text-sm">
        <thead className="text-xs text-slate-400">
          <tr className="border-b border-slate-800">
            <th className="py-2 pr-3 font-medium">วัน</th>
            <th className="py-2 pr-3 font-medium">Narrative</th>
            <th className="py-2 pr-3 font-medium">พลาดเพราะ</th>
            <th className="py-2 pr-3 font-medium">ไม้</th>
            <th className="py-2 text-right font-medium">P&L</th>
          </tr>
        </thead>
        <tbody>
          {DAY_NAMES.map((name, dow) => {
            const d = days.find((x) => x.dow === dow)
            const pnl = dayPnl(d)
            return (
              <tr key={dow} className="border-b border-slate-800/60">
                <td className="py-2 pr-3">
                  <button onClick={() => onOpen(dow)} className="text-sky-300 hover:underline">
                    {name.short} {shortDate(addDaysISO(ws, dow))}
                  </button>
                </td>
                <td className="py-2 pr-3">
                  <select
                    value={d?.narrative ?? ''}
                    onChange={(e) => patchDay(pair, ws, dow, { narrative: e.target.value })}
                    className={`rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm outline-none focus:border-sky-500 ${
                      verdictMark(d?.narrative ?? '').cls
                    }`}
                  >
                    <option value="">–</option>
                    {NARRATIVE_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2 pr-3 text-rose-300">{d?.mistakes.join(', ') || <span className="text-slate-600">–</span>}</td>
                <td className="py-2 pr-3 text-slate-300">{d?.trades.length || '–'}</td>
                <td className={`py-2 text-right ${pnl > 0 ? 'text-emerald-400' : pnl < 0 ? 'text-rose-400' : 'text-slate-500'}`}>
                  {d?.trades.length ? formatMoney(pnl) : '–'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function WeekTab({
  pair,
  ws,
  fields,
  days,
  onOpen,
}: {
  pair: string
  ws: string
  fields: Record<string, string>
  days: Day[]
  onOpen: (dow: number) => void
}) {
  const navigate = useNavigate()
  const owner = weekOwner(pair, ws)
  const stats = computeStats(days)
  const field = (key: string, label: string, options?: string[]) => (
    <QuestionField
      key={key}
      label={label}
      options={options}
      value={fields[key] ?? ''}
      onSave={(v) => setWeekField(pair, ws, key, v)}
      owner={owner}
      slot={key}
    />
  )

  async function remove() {
    if (!window.confirm(`ลบ ${pair} สัปดาห์ ${weekLabel(ws)}? ข้อความและรูปทั้งหมดของสัปดาห์นี้จะหายไป`)) return
    await deleteWeek(pair, ws)
    navigate(`/p/${pair}`)
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="mb-1 text-lg font-semibold text-white">ก่อนเริ่มสัปดาห์ (Weekend Prep)</h2>
        <p className="text-sm text-slate-500">วางรูปกราฟ W/D ลงในช่องไหนก็ได้ด้วย Ctrl+V รูปจะอยู่ใต้คำถามนั้น</p>
      </div>
      {WEEK_PREP.map((sec) => (
        <Card key={sec.title} title={sec.title}>
          {sec.questions.map((q) => field(q.key, q.label, q.options))}
        </Card>
      ))}

      <Card title="Scoreboard">
        <StatsLine s={stats} />
        <Scoreboard pair={pair} ws={ws} days={days} onOpen={onOpen} />
        <p className="text-xs text-slate-500">
          เลือก Narrative ได้ที่นี่หรือท้ายหน้าแต่ละวัน · P&L รวมจาก Trades ของวันนั้น
        </p>
      </Card>

      <Card title="จบสัปดาห์ (Weekly Reflection)">
        <div className="text-sm text-slate-300">
          Narrative ถูกกี่วัน:{' '}
          <b className="text-emerald-400">{stats.right}/5</b>
          {stats.rightLate > 0 && <span className="text-amber-400"> (+{stats.rightLate} ถูกแต่ Timing ผิด)</span>}
          {stats.mistakes.length > 0 && (
            <div className="mt-1 text-slate-400">
              ที่ติ๊กไว้ทั้งสัปดาห์:{' '}
              {stats.mistakes.map(([m, n]) => (
                <span key={m} className="mr-2 text-rose-300">
                  {m} ×{n}
                </span>
              ))}
            </div>
          )}
        </div>
        {WEEK_REFLECTION.map((q) => field(q.key, q.label, q.options))}
      </Card>

      <div className="border-t border-slate-800 pt-6">
        <button onClick={remove} className="text-sm text-red-400/80 hover:text-red-400">
          ลบสัปดาห์นี้ ({pair})
        </button>
      </div>
    </div>
  )
}

export default function WeekPage() {
  const { pair = '', ws = '', day } = useParams()
  const navigate = useNavigate()
  const week = useLiveQuery(() => db.pweeks.get(weekId(pair, ws)), [pair, ws])
  const days = useLiveQuery(() => listDays(pair, ws), [pair, ws])

  if (!PAIRS.includes(pair)) return <Navigate to="/" replace />
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ws)) return <Navigate to={`/p/${pair}`} replace />
  const dow = day ? TAB_KEYS.indexOf(day) : -1
  const base = `/p/${pair}/week/${ws}`
  if (day && dow < 0) return <Navigate to={base} replace />
  if (days === undefined) {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-slate-500">Loading…</div>
  }

  const open = (d: number) => navigate(`${base}/${TAB_KEYS[d]}`)
  const tail = day ? `/${day}` : ''
  const tabCls = (active: boolean) =>
    `shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
      active ? 'bg-sky-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
    }`

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <Link to={`/p/${pair}`} className="text-sm text-slate-400 hover:text-slate-200">
          ← {pair} ทุกสัปดาห์
        </Link>
        {/* Same week, other pair */}
        <div className="flex gap-1 rounded-lg border border-slate-800 p-0.5">
          {PAIRS.map((p) => (
            <Link
              key={p}
              to={`/p/${p}/week/${ws}${tail}`}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                p === pair ? 'bg-amber-500/20 text-amber-200' : 'text-slate-500 hover:text-slate-200'
              }`}
            >
              {p}
            </Link>
          ))}
        </div>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <Link to={`/p/${pair}/week/${addDaysISO(ws, -7)}${tail}`} title="Previous week" className="rounded-md px-2 py-1 text-slate-400 hover:bg-slate-800">
          ‹
        </Link>
        <h1 className="text-xl font-bold text-white">
          <span className="mr-2 text-amber-300">{pair}</span>
          {weekLabel(ws)}
        </h1>
        <Link to={`/p/${pair}/week/${addDaysISO(ws, 7)}${tail}`} title="Next week" className="rounded-md px-2 py-1 text-slate-400 hover:bg-slate-800">
          ›
        </Link>
        <span className="ml-auto text-xs text-slate-500">บันทึกอัตโนมัติ</span>
      </div>

      {/* Sticky tab bar: Week + Mon–Fri */}
      <nav className="sticky top-0 z-10 -mx-4 mb-5 flex gap-1 overflow-x-auto border-b border-slate-800 bg-[#0b0f17]/95 px-4 py-2 backdrop-blur">
        <button onClick={() => navigate(base)} className={tabCls(dow < 0)}>
          Week
        </button>
        {DAY_NAMES.map((n, i) => {
          const v = verdictMark(days.find((d) => d.dow === i)?.narrative ?? '')
          return (
            <button key={n.short} onClick={() => open(i)} className={tabCls(dow === i)}>
              {n.short} <span className="text-xs opacity-70">{shortDate(addDaysISO(ws, i)).split(' ')[0]}</span>{' '}
              <span className={dow === i ? '' : v.cls}>{v.mark}</span>
            </button>
          )
        })}
      </nav>

      {dow < 0 ? (
        <WeekTab pair={pair} ws={ws} fields={week?.fields ?? {}} days={days} onOpen={open} />
      ) : (
        <DayTab
          key={`${pair}:${ws}:${dow}`}
          pair={pair}
          ws={ws}
          dow={dow}
          day={days.find((d) => d.dow === dow)}
          onNext={dow < 4 ? () => open(dow + 1) : () => navigate(base)}
          nextLabel={dow < 4 ? `${DAY_NAMES[dow + 1].short} →` : 'Week (สรุป) →'}
        />
      )}
    </div>
  )
}
