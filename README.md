# 📈 Trade Journal

A personal, image-heavy trading journal built for an ICT / Smart-Money workflow.
Pick a date, log your higher-timeframe analysis, run your entry checklist, track
management and results — all in one place.

## Features

- **Date list home** — every logged day at a glance, with Win/Loss and net P&L stats.
- **HTF Analysis** — attach *unlimited* higher-timeframe charts (Weekly → H4), plus
  Bias, Market Phase (Expansion / Consolidation / Retracement / Reversal) and today's target.
- **Entry checklist** — 10-point green-check / red-X confirmation checklist
  (HTF bias, narrative, PD zones, PD arrays, order flow, liquidity, swing, RR, risk, H4/H1),
  with inline notes for PD arrays and expected RR.
- **Intratrade management** — notes + screenshots for pyramiding, trailing stops, partials.
- **Result** — Win/Loss toggle and Profit/Loss amount.
- **Reminder note** — a message to your future self.
- **Paste screenshots directly** — focus any image box and press **Ctrl/⌘+V** to drop in a
  TradingView capture. Drag-and-drop and file browsing also work.
- **Fully local & private** — everything is stored in your browser (IndexedDB). No account,
  no server, works offline.

## Tech

Vite · React · TypeScript · Tailwind CSS v4 · Dexie (IndexedDB).

## Run locally

```bash
npm install
npm run dev
```

Then open the printed URL (default http://localhost:5173).

## Build

```bash
npm run build     # outputs to dist/
npm run preview   # preview the production build
```

## Notes

- Data lives in **this browser on this device**. Cross-device sync is a planned Phase 2.
- To deploy on GitHub Pages under a project path, build with
  `VITE_BASE=/TradeJournal-/ npm run build`.
