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
    divider: 'rgba(0,212,255,0.1)',
  },
  'hermes-official': {
    primary: '#2979ff', secondary: '#ffbd38', success: '#00bcd4',
    warning: '#e6a832', error: '#ff5252',
    bgDeep: '#050d1a', bgPanel: '#0e1a2e',
    text: '#d0d8e8', textDim: 'rgba(208,216,232,0.55)',
    divider: 'rgba(41,121,255,0.08)',
  },
  'blade-runner': {
    primary: '#ffaf00', secondary: '#ffd7af', success: '#00afff',
    warning: '#d77800', error: '#ff0087',
    bgDeep: '#0a0800', bgPanel: '#1c1810',
    text: '#ffd7af', textDim: '#8a7a60',
    divider: 'rgba(255,175,0,0.1)',
  },
  fsociety: {
    primary: '#2979ff', secondary: '#448aff', success: '#00e5ff',
    warning: '#ffab00', error: '#ff1744',
    bgDeep: '#070b14', bgPanel: '#0f1628',
    text: '#b0bec5', textDim: '#546e7a',
    divider: 'rgba(41,121,255,0.1)',
  },
  anime: {
    primary: '#af5fff', secondary: '#ff5fff', success: '#50fa7b',
    warning: '#d9d95b', error: '#ff5555',
    bgDeep: '#0d001a', bgPanel: '#1a0030',
    text: '#e0d0f0', textDim: '#7a6a9a',
    divider: 'rgba(175,95,255,0.1)',
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
    components: {
      MuiPaper: {
        styleOverrides: {
          outlined: ({ theme }) => ({
            borderColor: theme.palette.divider,
          }),
        },
      },
      MuiAccordion: {
        styleOverrides: {
          root: ({ theme }) => ({
            '&::before': { display: 'none' },
            '&.MuiAccordion-outlined': {
              borderColor: theme.palette.divider,
            },
          }),
        },
      },
      MuiChip: {
        styleOverrides: {
          outlined: ({ theme }) => ({
            borderColor: theme.palette.divider,
          }),
        },
      },
    },
  })
}
