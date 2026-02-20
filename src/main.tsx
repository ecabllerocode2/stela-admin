import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Quitar splash inyectado en index.html (si existe) tan pronto React monta
const _splash = document.getElementById('splash');
if (_splash) _splash.remove();

// Registrar Service Worker en producción
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // silencioso
    })
  })
}
