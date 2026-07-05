import { createTheme, type Theme } from '@mui/material/styles'

// ── Build MUI theme from the active [data-theme] CSS variables ──
// Call AFTER the data-theme attribute changes so getComputedStyle reads the new values.

function cssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

export function buildMuiTheme(): Theme {
  return createTheme({
    palette: {
      mode: 'dark',
      primary:   { main: cssVar('--hud-primary', '#00d4ff') },
      secondary: { main: cssVar('--hud-secondary', '#00ffff') },
      success:   { main: cssVar('--hud-success', '#00ffaa') },
      warning:   { main: cssVar('--hud-warning', '#ffd700') },
      error:     { main: cssVar('--hud-error', '#ff4444') },
      background: {
        default: cssVar('--hud-bg-deep', '#0a0a12'),
        paper:   cssVar('--hud-bg-panel', '#141830'),
      },
      text: {
        primary:   cssVar('--hud-text', '#dadada'),
        secondary: cssVar('--hud-text-dim', '#6a7490'),
      },
      divider: cssVar('--hud-border', 'rgba(0,212,255,0.25)'),
    },
    typography: {
      fontFamily: "'Funnel Sans', system-ui, -apple-system, sans-serif",
      fontSize: 15,
    },
    shape: { borderRadius: 4 },
  })
}
