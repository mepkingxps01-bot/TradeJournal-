import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base is set for GitHub Pages project-site hosting (repo name has a trailing dash).
// Override with VITE_BASE if deploying elsewhere.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: process.env.VITE_BASE ?? '/',
})
