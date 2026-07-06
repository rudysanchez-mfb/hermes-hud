import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { I18nProvider } from './i18n'

// Set default theme before render to avoid flash
const VALID_BOOT_THEMES = ['ai', 'hermes-official', 'blade-runner', 'fsociety', 'anime']
if (!document.documentElement.getAttribute('data-theme')) {
  const stored = localStorage.getItem('hud-theme')
  document.documentElement.setAttribute('data-theme', stored && VALID_BOOT_THEMES.includes(stored) ? stored : 'hermes-official')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <I18nProvider>
        <App />
      </I18nProvider>
    </HashRouter>
  </StrictMode>,
)
