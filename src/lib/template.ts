// The Narrative Training template: every question on the week and day pages.
// Keys are stored in Week.fields / Day.fields, so never rename a key once it
// has data — change the label instead.

export interface Question {
  key: string
  label: string
  /** Quick-pick buttons; the answer is still stored as plain text. */
  options?: string[]
}

export interface Section {
  title: string
  questions: Question[]
}

export const WEEK_PREP: Section[] = [
  {
    title: '1. Weekly Context',
    questions: [
      { key: 'w_structure', label: 'โครงสร้าง' },
      { key: 'w_price', label: 'ราคาอยู่', options: ['Premium', 'Equilibrium', 'Discount'] },
      { key: 'w_liquidity', label: 'Liquidity ที่ยังไม่ถูกเคลียร์' },
    ],
  },
  {
    title: '2. Weekly Narrative',
    questions: [
      { key: 'w_target', label: 'สัปดาห์นี้ตลาดมีโอกาสไปเอา' },
      { key: 'w_because', label: 'เพราะ' },
      { key: 'w_first', label: 'ก่อนจะไป อาจต้อง' },
    ],
  },
]

export const WEEK_REFLECTION: Question[] = [
  { key: 'r_mistake', label: 'พลาดเพราะ' },
  { key: 'r_best', label: 'วันที่ดีที่สุด' },
  { key: 'r_worst', label: 'วันที่แย่ที่สุด' },
  { key: 'r_problem', label: 'ปัญหาหลัก' },
  { key: 'r_adjust', label: 'สิ่งที่ต้องปรับ' },
]

export const DAY_SECTIONS: Section[] = [
  {
    title: '1. Review เมื่อวาน (สำคัญมาก)',
    questions: [
      { key: 'd_yesterday', label: 'เมื่อวานตลาดทำอะไร?' },
      { key: 'd_cleared', label: 'Liquidity ที่ถูกเคลียร์' },
      { key: 'd_left', label: 'สิ่งที่ “ยังเหลือ”' },
    ],
  },
  {
    title: '2. Narrative วันนี้',
    questions: [
      { key: 'd_session', label: 'Session ก่อนหน้าทำอะไร?' },
      { key: 'd_target', label: 'วันนี้ตลาดมีโอกาสไปเอา' },
      { key: 'd_because', label: 'เพราะ' },
    ],
  },
  {
    title: '3. Context ตอนเปิดตลาด',
    questions: [
      { key: 'd_now', label: 'ตอนนี้ตลาดกำลังทำอะไร' },
      { key: 'd_orderflow', label: 'Order Flow (M15–H1)' },
    ],
  },
  {
    title: '4. Bias วันนี้',
    questions: [
      { key: 'd_bias', label: 'Bias', options: ['Buy', 'Sell', 'ไม่เทรด'] },
      { key: 'd_bias_why', label: 'เหตุผล' },
    ],
  },
  {
    title: '5. Trading Plan',
    questions: [
      { key: 'd_buy', label: 'ถ้า Buy จะรอ' },
      { key: 'd_sell', label: 'ถ้า Sell จะรอ' },
    ],
  },
  {
    title: '6. สิ่งที่ “ห้ามทำ”',
    questions: [{ key: 'd_rules', label: 'ห้ามทำ / Rules' }],
  },
]

export const LEARNED: Question = { key: 'd_learned', label: 'สิ่งที่เรียนรู้วันนี้' }

export const DAY_NAMES = [
  { short: 'Mon', th: 'จันทร์' },
  { short: 'Tue', th: 'อังคาร' },
  { short: 'Wed', th: 'พุธ' },
  { short: 'Thu', th: 'พฤหัสบดี' },
  { short: 'Fri', th: 'ศุกร์' },
]

/** One journal per pair. The first is where older, pair-less entries went. */
export const PAIRS = ['XAUUSD', 'NQ', 'EURUSD']

/** Early entries saved gold as "XAU". */
export function normPair(m: string): string {
  return m === 'XAU' ? 'XAUUSD' : m
}

export const NARRATIVE_RIGHT = 'ถูก'
export const NARRATIVE_TIMING = 'ถูก แต่ Timing ผิด'
export const NARRATIVE_OPTIONS = [NARRATIVE_RIGHT, 'ผิด', NARRATIVE_TIMING]

export const MISTAKE_OPTIONS = ['Context ยังไม่มา', 'เข้าเร็ว', 'Flip Bias', 'FOMO', 'อื่นๆ']
