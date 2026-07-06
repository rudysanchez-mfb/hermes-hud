import { createTheme, type Theme } from '@mui/material/styles'
import type { ThemeId } from '../hooks/useTheme'

// ── Per-theme palettes (hex only — no CSS named colors) ──

type Palette = {
  primary: string; secondary: string; success: string
  warning: string; error: string
  bgDeep: string; bgPanel: string
  text: string; textDim: string; divider: string
}

const PALETTES: Record<ThemeId, Palette> = {
  ai: {
    primary: '#00d4ff', secondary: '#00ffff', success: '#00ffaa',
    warning: '#e6c300', error: '#ff4444',
    bgDeep: '#0a0a12', bgPanel: '#141830',
    text: '#dadada', textDim: '#6a7490',
    divider: 'rgba(0,212,255,0.25)',
  },
  'hermes-official': {
    primary: '#ffe6cb', secondary: '#ffbd38', success: '#4ade80',
    warning: '#e6a832', error: '#ff7a82',
    bgDeep: '#041c1c', bgPanel: '#0d3030',
    text: '#ffe6cb', textDim: 'rgba(255,230,203,0.55)',
    divider: 'rgba(255,230,203,0.15)',
  },
  'blade-runner': {
    primary: '#ffaf00', secondary: '#ffd7af', success: '#00afff',
    warning: '#d77800', error: '#ff0087',
    bgDeep: '#0a0800', bgPanel: '#1c1810',
    text: '#ffd7af', textDim: '#8a7a60',
    divider: 'rgba(255,175,0,0.25)',
  },
  fsociety: {
    primary: '#00ff00', secondary: '#00ff00', success: '#00ff00',
    warning: '#e6e600', error: '#d70000',
    bgDeep: '#000000', bgPanel: '#101010',
    text: '#c0c0c0', textDim: '#505050',
    divider: 'rgba(0,255,0,0.2)',
  },
  anime: {
    primary: '#af5fff', secondary: '#ff5fff', success: '#50fa7b',
    warning: '#d9d95b', error: '#ff5555',
    bgDeep: '#0d001a', bgPanel: '#1a0030',
    text: '#e0d0f0', textDim: '#7a6a9a',
    divider: 'rgba(175,95,255,0.25)',
  },
}

export function buildMuiTheme(hudTheme: ThemeId): Theme {
  const p = PALETTES[hudTheme] || PALETTES['hermes-official']

  return createTheme({
    palette: {
      mode: 'dark',
      primary:   { main: p.primary },
      secondary: { main: p.secondary },
      success:   { main: p.success },
      warning:   { main: p.warning },
      error:     { main: p.error },
      background: {
        default: p.bgDeep,
        paper:   p.bgPanel,
      },
      text: {
        primary: p.text,
        secondary: p.textDim,
      },
      divider: p.divider,
    },
    typography: {
      fontFamily: "'Funnel Sans', system-ui, -apple-system, sans-serif",
      fontSize: 15,
    },
    shape: { borderRadius: 4 },
  })
}
