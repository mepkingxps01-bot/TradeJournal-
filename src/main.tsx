import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createHashRouter, Navigate } from 'react-router-dom'
import './index.css'
import DateList from './components/DateList'
import DayView from './components/DayView'

// HashRouter keeps deep links working on GitHub Pages / static hosting.
const router = createHashRouter([
  { path: '/', element: <DateList /> },
  { path: '/day/:date', element: <DayView /> },
  { path: '*', element: <Navigate to="/" replace /> },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
