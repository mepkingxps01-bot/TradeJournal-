import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../lib/db'
import { currentWeekStart, mondayOf, todayISO, weekLabel } from '../../lib/format'
import { computeStats } from '../../lib/journal'
import { DAY_NAMES } from '../../lib/template'
import { StatsLine, verdictMark } from './WeekPage'

export default function Home() {
  const navigate = useNavigate()
  const [pick, setPick] = useState(todayISO())
  const thisWeek = currentWeekStart()

  const data = useLiveQuery(async () => {
    const [weeks, days, oldDays] = await Promise.all([
      db.weeks.toArray(),
      db.days.toArray(),
      db.entries.count(),
    ])
    weeks.sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1))
    return { weeks, days, oldDays }
  }, [])

  if (!data) return null
  const all = computeStats(data.days)

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-white">📈 Narrative Training Journal</h1>
        <p className="mt-1 text-sm text-slate-400">
          เสาร์–อาทิตย์ทำ Weekend Prep · ทุกวันเขียนแผนในแท็บวัน · จบวันเลือก Narrative ถูก/ผิด
        </p>
      </header>

      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <button
          onClick={() => navigate(`/week/${thisWeek}`)}
          className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
        >
          เปิดสัปดาห์นี้ ({weekLabel(thisWeek)}) →
        </button>
        <div className="ml-auto flex items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">หรือเลือกวันที่</label>
            <input
              type="date"
              value={pick}
              onChange={(e) => setPick(e.target.value)}
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
            />
          </div>
          <button
            onClick={() => pick && navigate(`/week/${mondayOf(pick)}`)}
            className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-500"
          >
            เปิด
          </button>
        </div>
      </div>

      {all.graded + all.trades > 0 && (
        <section className="mb-6 rounded-xl border border-slate-800 bg-slate-900/30 p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-300">สถิติรวมทุกสัปดาห์</h2>
          <StatsLine s={all} />
          {all.mistakes.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {all.mistakes.map(([m, n]) => (
                <div key={m} className="flex items-center gap-2 text-sm">
                  <span className="w-36 shrink-0 text-slate-300">{m}</span>
                  <div className="h-2 rounded bg-rose-500/70" style={{ width: `${(n / all.mistakes[0][1]) * 60}%` }} />
                  <span className="text-xs text-slate-400">{n} วัน</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {data.weeks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 py-16 text-center text-slate-500">
          ยังไม่มีบันทึก กด “เปิดสัปดาห์นี้” เพื่อเริ่ม
        </div>
      ) : (
        <ul className="space-y-2">
          {data.weeks.map((w) => {
            const days = data.days.filter((d) => d.weekStart === w.weekStart)
            const s = computeStats(days)
            return (
              <li key={w.weekStart}>
                <button
                  onClick={() => navigate(`/week/${w.weekStart}`)}
                  className="flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-left transition hover:border-slate-600 hover:bg-slate-900"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-slate-100">{weekLabel(w.weekStart)}</div>
                    <div className="mt-0.5 truncate text-xs text-slate-500">
                      {w.fields.w_target
                        ? `เป้า: ${w.fields.w_target}`
                        : w.fields.w_structure
                          ? `โครงสร้าง: ${w.fields.w_structure}`
                          : 'ยังไม่ได้ทำ Weekend Prep'}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="font-mono tracking-widest" title="Narrative Mon–Fri">
                      {DAY_NAMES.map((_, i) => {
                        const v = verdictMark(days.find((d) => d.dow === i)?.narrative ?? '')
                        return (
                          <span key={i} className={v.cls}>
                            {v.mark}
                          </span>
                        )
                      })}
                    </span>
                    <span className="text-slate-400">ถูก {s.right}/5</span>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}

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
