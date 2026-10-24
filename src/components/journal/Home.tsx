import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../lib/db'
import { currentWeekStart, formatMoney, weekLabel } from '../../lib/format'
import { computeStats } from '../../lib/journal'
import { PAIRS } from '../../lib/template'

/** Start page: one card per pair's journal. */
export default function Home() {
  const thisWeek = currentWeekStart()
  const data = useLiveQuery(async () => {
    const [days, weeks, oldDays] = await Promise.all([db.pdays.toArray(), db.pweeks.toArray(), db.entries.count()])
    return { days, weeks, oldDays }
  }, [])

  if (!data) return null

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-white">📈 Narrative Training Journal</h1>
        <p className="mt-1 text-sm text-slate-400">แยก Template ตามคู่เงิน เลือกคู่ที่จะเขียน</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {PAIRS.map((pair) => {
          const s = computeStats(data.days.filter((d) => d.pair === pair))
          const weeks = data.weeks.filter((w) => w.pair === pair).length
          return (
            <div key={pair} className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/50 p-5">
              <Link to={`/p/${pair}`} className="group">
                <div className="text-xs text-slate-500">Template</div>
                <div className="text-2xl font-bold text-amber-300 group-hover:text-amber-200">{pair}</div>
              </Link>
              <div className="mt-3 flex-1 space-y-1 text-sm text-slate-300">
                {weeks === 0 ? (
                  <p className="text-slate-500">ยังไม่มีบันทึก</p>
                ) : (
                  <>
                    <p>
                      {weeks} สัปดาห์ · Narrative ถูก <b className="text-emerald-400">{s.right}/{s.graded}</b>
                    </p>
                    <p>
                      {s.trades} ไม้ · P&L{' '}
                      <b className={s.pnl > 0 ? 'text-emerald-400' : s.pnl < 0 ? 'text-rose-400' : 'text-white'}>
                        {formatMoney(s.pnl)}
                      </b>
                    </p>
                    {s.mistakes[0] && (
                      <p className="text-slate-400">
                        พลาดบ่อยสุด: <span className="text-rose-300">{s.mistakes[0][0]}</span>
                      </p>
                    )}
                  </>
                )}
              </div>
              <div className="mt-4 flex gap-2">
                <Link
                  to={`/p/${pair}/week/${thisWeek}`}
                  className="flex-1 rounded-md bg-sky-600 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-sky-500"
                >
                  สัปดาห์นี้ ({weekLabel(thisWeek)})
                </Link>
                <Link
                  to={`/p/${pair}`}
                  className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-500"
                >
                  ทุกสัปดาห์
                </Link>
              </div>
            </div>
          )
        })}
      </div>

      <footer className="mt-10 space-y-2 text-center text-xs text-slate-600">
        <p>ข้อมูลเก็บในเบราว์เซอร์นี้ (IndexedDB) · ใช้ได้แม้ออฟไลน์</p>
        {data.oldDays > 0 && (
          <p>
            <Link to="/old" className="text-slate-400 hover:text-slate-200">
              Journal แบบเก่า ({data.oldDays} วัน) →
            </Link>
          </p>
        )}
      </footer>
    </div>
  )
}
