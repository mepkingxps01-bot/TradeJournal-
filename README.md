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
- **Local-first, offline-ready** — everything is stored in your browser (IndexedDB) so the
  app is instant and works with no connection.
- **Optional cloud sync** — sign in with your email (one-time code, no password) to sync
  your days, notes and chart images across all your devices. See below.

## Tech

Vite · React · TypeScript · Tailwind CSS v4 · Dexie (IndexedDB) · Supabase (optional sync).

## Cloud sync across devices (optional)

Sync is off until you connect a free [Supabase](https://supabase.com) project. Once
configured, a **Sync** bar appears on the home screen: sign in with your email and a
6-digit code, and every device signed in with the same email shares one journal
(entries, checklist, notes and chart images). It stays local-first — edits are saved to
IndexedDB instantly and pushed to the cloud in the background, live via realtime plus a
periodic safety sync.

**One-time setup:**

1. Create a project at [supabase.com](https://supabase.com) (free tier is enough).
2. In the dashboard, open **SQL Editor → New query**, paste all of
   [`supabase/schema.sql`](supabase/schema.sql), and **Run**. This creates the tables,
   the private image bucket, and the row-level-security rules that scope every row to its
   owner (so the public anon key in the app can't expose anyone else's data).
3. Grab your **Project URL** and **anon public key** from
   **Project Settings → API**.
4. Provide them to the build:
   - **Local dev:** copy `.env.example` to `.env` and fill in the two values.
   - **GitHub Pages:** add them under **Settings → Secrets and variables → Actions →
     Variables** as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then re-run the
     deploy (push to `main`). Both values are safe to be public.

**Keeping one device's data and discarding another's:** sign in on the device whose
data you want to keep (e.g. your computer) and click **Make this device the master** in
the Sync bar. That overwrites the cloud — and every other device — with this device's
journal. Then sign in on your other devices and let them pull the data down.

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

- Without Supabase configured, data lives only in **this browser on this device** —
  the app runs exactly as before, fully local.
- To deploy on GitHub Pages under a project path, build with
  `VITE_BASE=/TradeJournal-/ npm run build`.
