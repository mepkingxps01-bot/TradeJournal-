import { CHECKLIST_ITEMS } from '../lib/checklist'
import type { Check, JournalEntry } from '../types'

interface Props {
  entry: JournalEntry
  onCheck: (key: string, value: Check) => void
  onNote: (field: 'pdArraysNote' | 'expectedRR', value: string) => void
}

function ToggleButton({
  active,
  tone,
  onClick,
  children,
}: {
  active: boolean
  tone: 'green' | 'red'
  onClick: () => void
  children: React.ReactNode
}) {
  const base =
    'flex h-8 w-9 items-center justify-center rounded-md border text-base font-bold transition'
  const styles = active
    ? tone === 'green'
      ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
      : 'border-red-500 bg-red-500/20 text-red-300'
    : 'border-slate-700 bg-slate-800 text-slate-500 hover:border-slate-500'
  return (
    <button type="button" onClick={onClick} className={`${base} ${styles}`}>
      {children}
    </button>
  )
}

export default function Checklist({ entry, onCheck, onNote }: Props) {
  const answered = CHECKLIST_ITEMS.filter(
    (it) => entry.checklist[it.key] === 'yes',
  ).length

  return (
    <div>
      <div className="mb-3 text-sm text-slate-400">
        {answered} / {CHECKLIST_ITEMS.length} confirmed
      </div>
      <ul className="space-y-2">
        {CHECKLIST_ITEMS.map((item, i) => {
          const value = entry.checklist[item.key] ?? null
          return (
            <li
              key={item.key}
              className="rounded-lg border border-slate-800 bg-slate-900/60 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm text-slate-200">
                    <span className="mr-1.5 text-slate-500">{i + 1}.</span>
                    {item.label}
                  </div>
                  {item.hint && (
                    <div className="mt-0.5 text-xs text-slate-500">
                      {item.hint}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <ToggleButton
                    tone="green"
                    active={value === 'yes'}
                    onClick={() => onCheck(item.key, value === 'yes' ? null : 'yes')}
                  >
                    ✓
                  </ToggleButton>
                  <ToggleButton
                    tone="red"
                    active={value === 'no'}
                    onClick={() => onCheck(item.key, value === 'no' ? null : 'no')}
                  >
                    ✕
                  </ToggleButton>
                </div>
              </div>
              {item.noteField && (
                <input
                  value={entry[item.noteField]}
                  onChange={(e) => onNote(item.noteField!, e.target.value)}
                  placeholder={item.notePlaceholder}
                  className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-100 outline-none focus:border-sky-500"
                />
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
