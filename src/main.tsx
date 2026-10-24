import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createHashRouter, Navigate } from 'react-router-dom'
import './index.css'
import DateList from './components/DateList'
import DayView from './components/DayView'
import Home from './components/journal/Home'
import WeekPage from './components/journal/WeekPage'
import { startSync } from './lib/sync'

// Kick off cloud sync (no-op unless Supabase env vars are configured).
startSync()

// HashRouter keeps deep links working on GitHub Pages / static hosting.
const router = createHashRouter([
  { path: '/', element: <Home /> },
  { path: '/week/:ws', element: <WeekPage /> },
  { path: '/week/:ws/:day', element: <WeekPage /> },
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
