import { useMemo } from 'react'
import {
  AppBar, Toolbar, Tabs, Tab, IconButton, SwipeableDrawer,
  List, ListItemButton, ListItemText, BottomNavigation,
  BottomNavigationAction, useMediaQuery, Box, Menu, MenuItem,
  Typography, Divider, Chip,
} from '@mui/material'
import { useTheme as useMuiTheme } from '@mui/material/styles'
import MenuIcon from '@mui/icons-material/Menu'
import { TABS } from '../routes'
import { useTheme, THEMES } from '../hooks/useTheme'
import { useI18n } from '../i18n'
import { useState, useEffect, useCallback } from 'react'

const MFB_LINKS = [
  { label: 'MFB Labs', href: 'https://labs.mfbservicesinc.com' },
  { label: 'GitHub', href: 'https://github.com/rudysanchez-mfb' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/rudy10sanchez/' },
]

const TOP_5 = ['dashboard', 'token-costs', 'debrid', 'music', 'services']

interface NavShellProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

export default function NavShell({ activeTab, onTabChange }: NavShellProps) {
  const muiTheme = useMuiTheme()
  const isDesktop = useMediaQuery(muiTheme.breakpoints.up('md'))
  const { theme: hudTheme, setTheme, scanlines, setScanlines } = useTheme()
  const { t, lang, setLang } = useI18n()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [themeAnchor, setThemeAnchor] = useState<HTMLElement | null>(null)
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const num = parseInt(e.key)
      if (!isNaN(num) && num >= 1 && num <= 9) {
        const tab = TABS.find(t => t.key === String(num))
        if (tab) { onTabChange(tab.id); return }
      }
      if (e.key === '0') { onTabChange('profiles'); return }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onTabChange])

  const handleTabClick = useCallback((id: string) => {
    setDrawerOpen(false)
    onTabChange(id)
  }, [onTabChange])

  const bottomTab = useMemo(() => {
    if (TOP_5.includes(activeTab)) return activeTab
    return TOP_5[0]
  }, [activeTab])

  return (
    <>
      {/* ── Desktop: AppBar with Tabs ── */}
      {isDesktop ? (
        <AppBar position="static" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Toolbar variant="dense" sx={{ gap: 0.5, minHeight: 40 }}>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 700, cursor: 'pointer', mr: 2,
                background: `linear-gradient(90deg, ${muiTheme.palette.primary.main}, ${muiTheme.palette.secondary.main})`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                letterSpacing: '0.15em',
              }}
              onClick={() => onTabChange('dashboard')}
            >
              ☤ HERMES
            </Typography>

            <Tabs
              value={activeTab}
              variant="scrollable"
              scrollButtons="auto"
              allowScrollButtonsMobile
              sx={{ flex: 1, minHeight: 0, '& .MuiTabs-indicator': { height: 2 } }}
            >
              {TABS.map(tab => (
                <Tab
                  key={tab.id}
                  value={tab.id}
                  label={
                    <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {tab.key && <Typography variant="caption" sx={{ opacity: 0.4, fontSize: '0.75rem' }}>{tab.key}</Typography>}
                      {t(tab.labelKey as any)}
                    </Box>
                  }
                  onClick={() => handleTabClick(tab.id)}
                  sx={{
                    minHeight: 36, py: 0.5, px: 1.5, fontSize: '0.8rem',
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                    fontWeight: activeTab === tab.id ? 700 : 400,
                    opacity: activeTab === tab.id ? 1 : 0.65,
                  }}
                  disableRipple
                />
              ))}
            </Tabs>

            {/* Theme button */}
            <IconButton size="small" onClick={e => setThemeAnchor(e.currentTarget)} sx={{ color: 'text.secondary' }}>
              ◆
            </IconButton>

            {/* Clock */}
            <Typography variant="caption" sx={{ mr: 1, fontVariantNumeric: 'tabular-nums', opacity: 0.6 }}>
              {time.toLocaleTimeString('en-US', { hour12: false })}
            </Typography>

            {/* Lang toggle */}
            <Chip
              label={lang === 'en' ? '中文' : 'EN'}
              size="small"
              variant="outlined"
              onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}
              sx={{ fontSize: '0.75rem', height: 24 }}
            />
          </Toolbar>
        </AppBar>
      ) : (
        // ── Mobile: slim AppBar + drawer + bottom nav ──
        <AppBar position="static" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Toolbar variant="dense" sx={{ minHeight: 44 }}>
            <IconButton edge="start" size="small" onClick={() => setDrawerOpen(true)} sx={{ mr: 1 }}>
              <MenuIcon />
            </IconButton>

            <Typography
              variant="body2"
              sx={{ fontWeight: 700, flex: 1, textAlign: 'center', fontSize: '0.9rem', letterSpacing: '0.1em' }}
              onClick={() => onTabChange('dashboard')}
            >
              ☤ HERMES · {t(TABS.find(tab => tab.id === activeTab)?.labelKey as any || '')}
            </Typography>

            <IconButton size="small" onClick={e => setThemeAnchor(e.currentTarget)} sx={{ color: 'text.secondary' }}>
              ◆
            </IconButton>
          </Toolbar>
        </AppBar>
      )}

      {/* ── Mobile drawer ── */}
      <SwipeableDrawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onOpen={() => setDrawerOpen(true)}
        slotProps={{ paper: { sx: { bgcolor: 'background.paper', minWidth: 240 } } }}
      >
        <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle2" sx={{ letterSpacing: '0.1em' }}>☤ HERMES HUD</Typography>
          <Typography variant="caption" color="text.secondary">
            {time.toLocaleTimeString('en-US', { hour12: false })}
          </Typography>
        </Box>
        <List dense>
          {TABS.map(tab => (
            <ListItemButton
              key={tab.id}
              selected={activeTab === tab.id}
              onClick={() => handleTabClick(tab.id)}
              sx={{ py: 1 }}
            >
              {tab.key && (
                <Typography variant="caption" sx={{ opacity: 0.4, mr: 1, minWidth: 16 }}>
                  {tab.key}
                </Typography>
              )}
              <ListItemText
                primary={t(tab.labelKey as any)}
                slotProps={{ primary: { variant: 'body2' } }}
              />
            </ListItemButton>
          ))}
        </List>
        <Divider />
        <List dense>
          {MFB_LINKS.map(link => (
            <ListItemButton
              key={link.href}
              component="a"
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ py: 0.5 }}
            >
              <ListItemText
                primary={`${link.label} ↗`}
                slotProps={{ primary: { variant: 'caption', color: 'text.secondary' } }}
              />
            </ListItemButton>
          ))}
        </List>
      </SwipeableDrawer>

      {/* ── Mobile bottom nav ── */}
      {!isDesktop && (
        <BottomNavigation
          value={bottomTab}
          onChange={(_e, val) => handleTabClick(val)}
          showLabels
          sx={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1100,
            borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper',
            '& .MuiBottomNavigationAction-root': { minWidth: 0, py: 0.5 },
            '& .MuiBottomNavigationAction-label': { fontSize: '0.75rem', mt: 0.25 },
          }}
        >
          {TOP_5.map(id => (
            <BottomNavigationAction
              key={id}
              value={id}
              label={t((TABS.find(tab => tab.id === id)?.labelKey || '') as any)}
              icon={
                <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                  {TABS.find(tab => tab.id === id)?.key || id[0]}
                </Typography>
              }
            />
          ))}
        </BottomNavigation>
      )}

      {/* ── Theme picker menu (shared) ── */}
      <Menu
        anchorEl={themeAnchor}
        open={Boolean(themeAnchor)}
        onClose={() => setThemeAnchor(null)}
        slotProps={{ paper: { sx: { minWidth: 180, bgcolor: 'background.paper' } } }}
      >
        {THEMES.map(item => (
          <MenuItem
            key={item.id}
            selected={hudTheme === item.id}
            onClick={() => { setTheme(item.id); setThemeAnchor(null) }}
            dense
          >
            <Typography variant="body2" sx={{ mr: 1 }}>{item.icon}</Typography>
            {t(item.labelKey as any)}
          </MenuItem>
        ))}
        <Divider />
        <MenuItem dense onClick={() => { setScanlines(!scanlines); setThemeAnchor(null) }}>
          {scanlines ? '▣' : '□'} {t('theme.scanlines')}
        </MenuItem>
        <Divider />
        {MFB_LINKS.map(link => (
          <MenuItem
            key={link.href}
            dense
            component="a"
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setThemeAnchor(null)}
          >
            {link.label} ↗
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}
