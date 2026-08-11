# 📈 Trade Journal

A personal, image-heavy trading journal. It works like a simple document, one
per day: pick a date, paste your charts, and type anything around them.

## Features

- **Date tracking** — every day you've journaled, listed newest-first, with a
  note preview and image count. Pick any date to open or start it.
- **Plain, doc-like day** — each day is an ordered stack of **blocks**: paste an
  image (shown big) or add a note and type freely. Reorder or delete any block.
- **Paste screenshots directly** — click the paste box and press **Ctrl/⌘+V** to
  drop in a TradingView capture. Images render large; click one for fullscreen
  with left/right navigation and captions.
- **Local-first, offline-ready** — everything is stored in your browser
  (IndexedDB) so the app is instant and works with no connection.
- **Optional cloud sync** — sign in with your email (one-time code, no password)
  to sync your days, notes and images across all your devices. See below.

## Tech

Vite · React · TypeScript · Tailwind CSS v4 · Dexie (IndexedDB) · Supabase (optional sync).

## Cloud sync across devices (optional)

Sync is off until you connect a free [Supabase](https://supabase.com) project. Once
configured, a **Sync** bar appears on the home screen: sign in with your email and a
6-digit code, and every device signed in with the same email shares one journal
(your days — notes and chart images). It stays local-first — edits are saved to
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
