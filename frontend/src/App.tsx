import { useState, useCallback, useMemo, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { ThemeProvider } from './hooks/useTheme'
import { useWebSocket } from './hooks/useWebSocket'
import { TABS, type TabId } from './routes'
import NavShell from './components/NavShell'
import CommandPalette from './components/CommandPalette'
import BootScreen from './components/BootScreen'
import DashboardPanel from './components/DashboardPanel'
import MemoryPanel from './components/MemoryPanel'
import SkillsPanel from './components/SkillsPanel'
import SessionsPanel from './components/SessionsPanel'
import ReplayPanel from './components/ReplayPanel'
import CronPanel from './components/CronPanel'
import ProjectsPanel from './components/ProjectsPanel'
import HealthPanel from './components/HealthPanel'
import AgentsPanel from './components/AgentsPanel'
import ChatPanel from './components/ChatPanel'
import ProfilesPanel from './components/ProfilesPanel'
import TokenCostsPanel from './components/TokenCostsPanel'
import CorrectionsPanel from './components/CorrectionsPanel'
import PatternsPanel from './components/PatternsPanel'
import SudoPanel from './components/SudoPanel'
import ProvidersPanel from './components/ProvidersPanel'
import GatewayPanel from './components/GatewayPanel'
import ModelInfoPanel from './components/ModelInfoPanel'
import PluginsPanel from './components/PluginsPanel'
import { useI18n } from './i18n'

// ── Tab panel resolve ─────────────────────────────────────

function tabPanel(tab: TabId) {
  switch (tab) {
    case 'dashboard':   return <DashboardPanel />
    case 'memory':      return <MemoryPanel />
    case 'skills':      return <SkillsPanel />
    case 'sessions':    return <SessionsPanel />
    case 'replay':      return <ReplayPanel />
    case 'cron':        return <CronPanel />
    case 'projects':    return <ProjectsPanel />
    case 'health':      return <HealthPanel />
    case 'agents':      return <AgentsPanel />
    case 'chat':        return <ChatPanel />
    case 'profiles':    return <ProfilesPanel />
    case 'token-costs': return <TokenCostsPanel />
    case 'corrections': return <CorrectionsPanel />
    case 'patterns':    return <PatternsPanel />
    case 'sudo':        return <SudoPanel />
    case 'providers':   return <ProvidersPanel />
    case 'gateway':     return <GatewayPanel />
    case 'model-info':  return <ModelInfoPanel />
    case 'plugins':     return <PluginsPanel />
    default:            return <DashboardPanel />
  }
}

// ── Grid layout per tab ───────────────────────────────────

const GRID_CLASS: Record<TabId, string> = {
  dashboard:   'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  memory:      'grid-cols-1 sm:grid-cols-2',
  skills:      'grid-cols-1 lg:grid-cols-[2fr_1fr]',
  sessions:    'grid-cols-1 lg:grid-cols-[2fr_1fr]',
  replay:      'grid-cols-1 lg:grid-cols-[360px_1fr]',
  cron:        'grid-cols-1',
  projects:    'grid-cols-1',
  health:      'grid-cols-1 sm:grid-cols-2',
  agents:      'grid-cols-1 lg:grid-cols-2',
  chat:        'grid-cols-1',
  profiles:    'grid-cols-1',
  'token-costs': 'grid-cols-1 lg:grid-cols-2',
  corrections: 'grid-cols-1',
  patterns:    'grid-cols-1 lg:grid-cols-2',
  sudo:        'grid-cols-1 lg:grid-cols-2',
  providers:   'grid-cols-1',
  gateway:     'grid-cols-1',
  'model-info': 'grid-cols-1 lg:grid-cols-2',
  plugins:     'grid-cols-1 lg:grid-cols-2',
}

// ── App ────────────────────────────────────────────────────

export default function App() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()

  const activeTab = location.pathname.replace(/^\//, '') || 'dashboard'

  const [booted, setBooted] = useState(() => {
    return sessionStorage.getItem('hud-booted') === 'true'
  })

  const handleBootComplete = useCallback(() => {
    setBooted(true)
    sessionStorage.setItem('hud-booted', 'true')
  }, [])

  const { status: wsStatus } = useWebSocket()

  const handleTabChange = useCallback(
    (tab: TabId) => { navigate('/' + tab) },
    [navigate],
  )

  // Command palette — tabs with keyboard shortcuts + supplementary
  const commands = useMemo(() => [
    ...TABS.filter(tab => tab.key !== null).map(tab => ({
      id: tab.id,
      label: `${tab.labelKey}`,
      shortcut: tab.key as string,
      action: () => handleTabChange(tab.id),
    })),
    { id: 'token-costs', label: 'tab.token-costs', shortcut: '', action: () => handleTabChange('token-costs') },
    { id: 'replay',      label: 'tab.replay',      shortcut: '', action: () => handleTabChange('replay') },
    { id: 'plugins',     label: 'tab.plugins',     shortcut: '', action: () => handleTabChange('plugins') },
    { id: 'sudo',        label: 'tab.sudo',        shortcut: '', action: () => handleTabChange('sudo') },
  ], [handleTabChange])

  const handleCommandSelect = useCallback(
    (id: string) => { handleTabChange(id as TabId) },
    [handleTabChange],
  )

  // Custom event: hud:navigate
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ tab?: string }>).detail
      const tab = detail?.tab as TabId | undefined
      if (tab && TABS.some(item => item.id === tab)) {
        handleTabChange(tab)
      }
    }
    window.addEventListener('hud:navigate', handler)
    return () => window.removeEventListener('hud:navigate', handler)
  }, [handleTabChange])

  return (
    <ThemeProvider>
      {!booted && <BootScreen onComplete={handleBootComplete} />}

      <CommandPalette
        commands={commands}
        onSelect={handleCommandSelect}
      />

      <NavShell activeTab={activeTab} onTabChange={handleTabChange} />

      {/* Chat tab gets a fixed-height flex container so the message
          thread scrolls internally instead of page-scrolling. */}
      {activeTab === 'chat' ? (
        <div style={{ flex: '1 1 0', height: 0, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="p-2 h-full">
            <Routes>
              {TABS.map(tab => (
                <Route key={tab.id} path={`/${tab.id}`} element={tabPanel(tab.id)} />
              ))}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </div>
        </div>
      ) : (
        <div className="overflow-y-auto" style={{ flex: '1 1 0', height: 0, minHeight: 0 }}>
          <div className={`grid gap-2 p-2 ${GRID_CLASS[activeTab] || 'grid-cols-1'}`}>
            <Routes>
              {TABS.map(tab => (
                <Route key={tab.id} path={`/${tab.id}`} element={tabPanel(tab.id)} />
              ))}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </div>
        </div>
      )}

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-0.5 text-[13px] border-t shrink-0"
           style={{ borderColor: 'var(--hud-border)', color: 'var(--hud-text-dim)', background: 'var(--hud-bg-surface)' }}>
        <span className="flex items-center gap-2">
          ☤ {t('boot.version')} v0.9.1
          <span
            className="text-[10px] px-1.5 py-0.5 rounded"
            style={{
              background: wsStatus === 'connected' ? 'var(--hud-success)' :
                         wsStatus === 'connecting' ? 'var(--hud-warning)' : 'var(--hud-error)',
              color: 'var(--hud-bg-deep)',
              opacity: 0.8
            }}
            title={wsStatus === 'connected' ? t('status.live') : `WebSocket: ${wsStatus}`}
          >
            {wsStatus === 'connected' ? '● ' + t('status.live') : wsStatus}
          </span>
        </span>
        <span className="hidden sm:inline">
          <span className="opacity-40">Ctrl+K</span> {t('status.palette')}
          <span className="mx-2">·</span>
          <span className="opacity-40">1-9</span> {t('status.tabs')}
          <span className="mx-2">·</span>
          <span className="opacity-40">t</span> {t('status.theme')}
        </span>
        <span className="sm:hidden">
          <span className="opacity-40">Ctrl+K</span> {t('status.commands')}
        </span>
      </div>
    </ThemeProvider>
  )
}
