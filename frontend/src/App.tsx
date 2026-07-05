import { useState, useCallback, useMemo, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { ThemeProvider } from './hooks/useTheme'
import { useWebSocket } from './hooks/useWebSocket'
import { TABS, REDIRECTS, type TabId } from './routes'
import NavShell from './components/NavShell'
import CommandPalette from './components/CommandPalette'
import BootScreen from './components/BootScreen'
import DashboardPanel from './components/DashboardPanel'
import MemoryPanel from './components/MemoryPanel'
import SkillsPanel from './components/SkillsPanel'
import SessionsPanel from './components/SessionsPanel'
import ReplayPanel from './components/ReplayPanel'
import CronPanel from './components/CronPanel'
import HealthPanel from './components/HealthPanel'
import AgentsPanel from './components/AgentsPanel'
import ChatPanel from './components/ChatPanel'
import TokenCostsPanel from './components/TokenCostsPanel'
import CorrectionsPanel from './components/CorrectionsPanel'
import SubTabs from './components/SubTabs'
import SystemPanel from './components/SystemPanel'
import DebridPanel from './components/pipeline/DebridPanel'
import MusicPanel from './components/pipeline/MusicPanel'
import { useI18n } from './i18n'

// ── Tab panel resolve ─────────────────────────────────────

function SessionsWrapper() {
  const { t } = useI18n()
  return (
    <SubTabs
      tabs={[
        { id: 'sessions',    label: t('tab.sessions'),    element: <SessionsPanel /> },
        { id: 'replay',      label: t('tab.replay'),      element: <ReplayPanel /> },
      ]}
    />
  )
}

function MemoryWrapper() {
  const { t } = useI18n()
  return (
    <SubTabs
      tabs={[
        { id: 'memory',      label: t('tab.memory'),      element: <MemoryPanel /> },
        { id: 'corrections', label: t('tab.corrections'), element: <CorrectionsPanel /> },
      ]}
    />
  )
}

function tabPanel(tab: TabId) {
  switch (tab) {
    case 'dashboard':   return <DashboardPanel />
    case 'token-costs': return <TokenCostsPanel />
    case 'debrid':      return <DebridPanel />
    case 'music':       return <MusicPanel />
    case 'services':    return <HealthPanel />          // component name unchanged
    case 'cron':        return <CronPanel />
    case 'chat':        return <ChatPanel />
    case 'sessions':    return <SessionsWrapper />       // Sessions + Replay
    case 'memory':      return <MemoryWrapper />          // Memory + Corrections
    case 'skills':      return <SkillsPanel />
    case 'agents':      return <AgentsPanel />
    case 'system':      return <SystemPanel />
    // ── Old-tab redirects (handled at route level) ──
    default:            return <DashboardPanel />
  }
}

// ── Grid layout per tab ───────────────────────────────────

const GRID_CLASS: Record<TabId, string> = {
  dashboard:   'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  memory:      'grid-cols-1',
  skills:      'grid-cols-1 lg:grid-cols-[2fr_1fr]',
  sessions:    'grid-cols-1',
  cron:        'grid-cols-1',
  services:    'grid-cols-1 sm:grid-cols-2',
  agents:      'grid-cols-1 lg:grid-cols-2',
  chat:        'grid-cols-1',
  'token-costs': 'grid-cols-1 lg:grid-cols-2',
  debrid:      'grid-cols-1 lg:grid-cols-2',
  music:       'grid-cols-1 lg:grid-cols-2',
  system:      'grid-cols-1',
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
              {/* Redirect old tabs */}
              {Object.entries(REDIRECTS).map(([oldId, newId]) => (
                <Route key={`redir-${oldId}`} path={`/${oldId}`} element={<Navigate to={`/${newId}`} replace />} />
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
              {Object.entries(REDIRECTS).map(([oldId, newId]) => (
                <Route key={`redir-${oldId}`} path={`/${oldId}`} element={<Navigate to={`/${newId}`} replace />} />
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
          ☤ {t('boot.version')} v0.10.0
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
