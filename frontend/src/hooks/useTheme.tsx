import { createContext, useContext, useState, useLayoutEffect, type ReactNode } from 'react'
import { ThemeProvider as MuiThemeProvider, type Theme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { buildMuiTheme } from '../theme/muiTheme'

export type ThemeId = 'ai' | 'hermes-official' | 'blade-runner' | 'fsociety' | 'anime'

interface ThemeContextValue {
  theme: ThemeId
  setTheme: (t: ThemeId) => void
  scanlines: boolean
  setScanlines: (s: boolean) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'hermes-official',
  setTheme: () => {},
  scanlines: false,
  setScanlines: () => {},
})

export const THEMES: { id: ThemeId; labelKey: string; icon: string }[] = [
  { id: 'ai', labelKey: 'theme.neuralAwakening', icon: '◆' },
  { id: 'hermes-official', labelKey: 'theme.hermesOfficial', icon: '☤' },
  { id: 'blade-runner', labelKey: 'theme.bladeRunner', icon: '◈' },
  { id: 'fsociety', labelKey: 'theme.fsociety', icon: '▣' },
  { id: 'anime', labelKey: 'theme.anime', icon: '◎' },
]

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    return (localStorage.getItem('hud-theme') as ThemeId) || 'hermes-official'
  })
  const [scanlines, setScanlinesState] = useState(() => {
    return localStorage.getItem('hud-scanlines') === 'true'
  })
  const [muiTheme, setMuiTheme] = useState<Theme>(() => buildMuiTheme())

  const setTheme = (t: ThemeId) => {
    setThemeState(t)
    localStorage.setItem('hud-theme', t)
  }

  const setScanlines = (s: boolean) => {
    setScanlinesState(s)
    localStorage.setItem('hud-scanlines', String(s))
  }

  // Apply data-theme attribute BEFORE MUI theme reads the CSS vars
  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    // After a tick for CSS to apply, rebuild MUI from the new vars
    requestAnimationFrame(() => {
      setMuiTheme(buildMuiTheme())
    })
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, scanlines, setScanlines }}>
      <MuiThemeProvider theme={muiTheme}>
        <CssBaseline enableColorScheme />
        <div className={scanlines ? 'scanlines' : ''} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {children}
        </div>
      </MuiThemeProvider>
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
