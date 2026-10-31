import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createHashRouter, Navigate, useParams } from 'react-router-dom'
import './index.css'
import DateList from './components/DateList'
import DayView from './components/DayView'
import Home from './components/journal/Home'
import PairHome from './components/journal/PairHome'
import WeekPage from './components/journal/WeekPage'
import { PAIRS } from './lib/template'
import { startSync } from './lib/sync'

function LegacyWeek() {
  const { ws = '', '*': rest = '' } = useParams()
  return <Navigate to={`/p/${PAIRS[0]}/week/${ws}${rest ? `/${rest}` : ''}`} replace />
}

// Ask the browser not to auto-clear this site's local journal (IndexedDB)
// when disk space runs low. Best-effort; some browsers decide on their own.
void navigator.storage?.persist?.().catch(() => false)

// Kick off cloud sync (no-op unless Supabase env vars are configured).
startSync()

// HashRouter keeps deep links working on GitHub Pages / static hosting.
const router = createHashRouter([
  { path: '/', element: <Home /> },
  { path: '/p/:pair', element: <PairHome /> },
  { path: '/p/:pair/week/:ws', element: <WeekPage /> },
  { path: '/p/:pair/week/:ws/:day', element: <WeekPage /> },
  // Links from before pairs existed go to the first pair's journal.
  { path: '/week/:ws/*', element: <LegacyWeek /> },
  // The older plain-doc journal, kept so existing entries stay reachable.
  { path: '/old', element: <DateList /> },
  { path: '/day/:date', element: <DayView /> },
  { path: '*', element: <Navigate to="/" replace /> },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
