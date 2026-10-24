import { useEffect, useRef, useState } from 'react'
import { addDaysISO, formatMoney, parsePnl, shortDate } from '../../lib/format'
import {
  addShots,
  addTrade,
  dayOwner,
  deleteTrade,
  patchDay,
  setDayField,
  updateTrade,
} from '../../lib/journal'
import {
  DAY_NAMES,
  DAY_SECTIONS,
  LEARNED,
  MARKETS,
  MISTAKE_OPTIONS,
  NARRATIVE_OPTIONS,
  normMarket,
} from '../../lib/template'
import type { Day, Trade, TradeResult } from '../../types'
import { AutoText, Card, Pick, QuestionField, Shots, Toggles } from './ui'

const RESULTS: { value: TradeResult; label: string; cls: string }[] = [
  { value: 'win', label: 'Win', cls: 'border-emerald-500 bg-emerald-500/15 text-emerald-200' },
  { value: 'loss', label: 'Loss', cls: 'border-rose-500 bg-rose-500/15 text-rose-200' },
  { value: 'be', label: 'BE', cls: 'border-slate-400 bg-slate-500/15 text-slate-200' },
]

function TradeCard({ ws, dow, trade, n }: { ws: string; dow: number; trade: Trade; n: number }) {
  const owner = dayOwner(ws, dow)
  const slot = `trade:${trade.id}`
  const [pnl, setPnl] = useState(trade.pnl)
  const pnlTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => setPnl(trade.pnl), [trade.pnl])
  const save = (patch: Partial<Trade>) => updateTrade(ws, dow, trade.id, patch)
  function changePnl(v: string) {
    setPnl(v)
    if (pnlTimer.current) clearTimeout(pnlTimer.current)
    pnlTimer.current = setTimeout(() => save({ pnl: v }), 400)
  }
  const value = parsePnl(pnl)

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="mr-1 font-semibold text-white">Trade #{n}</span>
        <Pick options={MARKETS} value={trade.pair ?? ''} onChange={(pair) => save({ pair })} />
        <span className="mx-1 h-5 w-px bg-slate-700" />
        {RESULTS.map((r) => (
          <button
            key={r.value}
            onClick={() => save({ result: trade.result === r.value ? '' : r.value })}
            className={`rounded-full border px-3 py-0.5 text-sm ${
              trade.result === r.value ? r.cls : 'border-slate-700 text-slate-400 hover:border-slate-500'
            }`}
          >
            {r.label}
          </button>
        ))}
        <input
          value={pnl}
          onChange={(e) => changePnl(e.target.value)}
          placeholder="P&L เช่น +120"
          inputMode="decimal"
          className={`w-32 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm outline-none focus:border-sky-500 ${
            value > 0 ? 'text-emerald-300' : value < 0 ? 'text-rose-300' : 'text-slate-200'
          }`}
        />
        <button
          onClick={() => window.confirm(`ลบ Trade #${n} และรูปของไม้นี้?`) && deleteTrade(ws, dow, trade.id)}
          className="ml-auto text-xs text-slate-500 hover:text-red-400"
        >
          ลบ
        </button>
      </div>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300">เหตุผล</label>
          <AutoText
            value={trade.reason}
            onSave={(reason) => save({ reason })}
            onImages={(b) => addShots(owner, slot, b)}
            placeholder="เช่น Liquidate BSL + M15 OB + M3 MSS · Ctrl+V วางรูป entry"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300">Entry / SL / TP</label>
          <AutoText
            value={trade.setup}
            onSave={(setup) => save({ setup })}
            onImages={(b) => addShots(owner, slot, b)}
            placeholder="เช่น TP: Asia Low"
          />
        </div>
        <Shots owner={owner} slot={slot} />
      </div>
    </div>
  )
}

export default function DayTab({
  ws,
  dow,
  day,
  onNext,
  nextLabel,
}: {
  ws: string
  dow: number
  day?: Day
  onNext: () => void
  nextLabel: string
}) {
  const owner = dayOwner(ws, dow)
  const fields = day?.fields ?? {}
  const trades = day?.trades ?? []
  const total = trades.reduce((s, t) => s + parsePnl(t.pnl), 0)
  const field = (key: string, label: string, options?: string[]) => (
    <QuestionField
      key={key}
      label={label}
      options={options}
      value={fields[key] ?? ''}
      onSave={(v) => setDayField(ws, dow, key, v)}
      owner={owner}
      slot={key}
    />
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">
          {DAY_NAMES[dow].th} ({DAY_NAMES[dow].short}) · {shortDate(addDaysISO(ws, dow))}
        </h2>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          ตลาด
          <Toggles
            tone="sky"
            options={MARKETS}
            value={(day?.markets ?? []).map(normMarket)}
            onChange={(markets) => patchDay(ws, dow, { markets })}
          />
        </div>
      </div>

      {DAY_SECTIONS.map((sec) => (
        <Card key={sec.title} title={sec.title}>
          {sec.questions.map((q) => field(q.key, q.label, q.options))}
        </Card>
      ))}

      <Card title={`Trades${trades.length ? ` · ${trades.length} ไม้ · ${formatMoney(total)}` : ''}`}>
        {trades.map((t, i) => (
          <TradeCard key={t.id} ws={ws} dow={dow} trade={t} n={i + 1} />
        ))}
        <button
          onClick={() => addTrade(ws, dow)}
          className="w-full rounded-lg border border-dashed border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-400 hover:border-slate-500 hover:text-slate-200"
        >
          + เพิ่ม Trade
        </button>
        {field('d_notes', 'โน้ตระหว่างวัน (ไม่เข้า / รอ setup / ฯลฯ)')}
      </Card>

      <Card title="หลังจบวัน (Daily Reflection)">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-300">วันนี้ Narrative ถูกไหม?</label>
          <Pick
            tone="amber"
            options={NARRATIVE_OPTIONS}
            value={day?.narrative ?? ''}
            onChange={(narrative) => patchDay(ws, dow, { narrative })}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-300">พลาดเพราะอะไร (เลือกได้หลายข้อ)</label>
          <Toggles
            options={MISTAKE_OPTIONS}
            value={day?.mistakes ?? []}
            onChange={(mistakes) => patchDay(ws, dow, { mistakes })}
          />
        </div>
        {field(LEARNED.key, LEARNED.label)}
      </Card>

      <button
        onClick={() => {
          onNext()
          window.scrollTo({ top: 0 })
        }}
        className="w-full rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-700"
      >
        {nextLabel}
      </button>
    </div>
  )
}
