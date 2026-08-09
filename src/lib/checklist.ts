export interface ChecklistItem {
  key: string
  label: string
  /** Optional helper text shown under the item. */
  hint?: string
  /** If set, an inline text box is shown; value stored on the given entry field. */
  noteField?: 'pdArraysNote' | 'expectedRR'
  notePlaceholder?: string
}

export const CHECKLIST_ITEMS: ChecklistItem[] = [
  { key: 'htfBias', label: 'HTF Bias clear?' },
  { key: 'narrative', label: 'Narrative clear?' },
  { key: 'pdZone', label: 'Premium & Discount zone?' },
  {
    key: 'pdArrays',
    label: 'In quality PD arrays?',
    hint: 'FVG · OB · Inv FVG · Breaker block',
    noteField: 'pdArraysNote',
    notePlaceholder: 'Which array? (FVG / OB / Inv FVG / Breaker...)',
  },
  { key: 'orderFlow', label: 'In good order flow?' },
  { key: 'liquidity', label: 'Time-based liquidity not hit yet?' },
  { key: 'swing', label: 'A swing is confirmed?' },
  {
    key: 'rr',
    label: 'Efficient RR?',
    noteField: 'expectedRR',
    notePlaceholder: 'Expected RR (e.g. 1:3)',
  },
  { key: 'risk', label: 'Risk as usual?' },
  { key: 'h4h1', label: 'Go with the H4 and H1 candle?' },
]
