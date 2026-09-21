import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

// Apply saved theme immediately to prevent flash of wrong theme
const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

// Pre-warm backend (Render free-tier wakeup) silently in the background
const API_BASE = import.meta.env.VITE_API_BASE || '/api';
try {
  fetch(`${API_BASE}/health`, { method: 'GET' }).catch(() => {});
} catch {
  // Silent catch
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

