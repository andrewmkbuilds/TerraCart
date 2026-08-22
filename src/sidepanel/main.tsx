import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import '../styles/global.css'

// Load Google Fonts via JS to avoid CSP @import restrictions
try {
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap'
  document.head.appendChild(link)
} catch { /* fonts are optional */ }

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
