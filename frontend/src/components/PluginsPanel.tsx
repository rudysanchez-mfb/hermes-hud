import { useMemo } from 'react'
import { useApi } from '../hooks/useApi'
import { useI18n } from '../i18n'
import MuiPanel from './MuiPanel'

interface PluginInfo {
  name: string
  label: string
  description: string
  version: string
  source: string
  path: string
  runtime_status: string
  has_dashboard_manifest: boolean
  has_api: boolean
  user_hidden: boolean
  entry: string
  css?: string | null
  icon: string
  tab_path: string
  tab_position: string
  slots: string[]
  provides_tools: string[]
  auth_required: boolean
  auth_command: string
  can_update_git: boolean
}

interface PluginsState {
  plugins: PluginInfo[]
  total_plugins: number
  dashboard_count: number
  agent_count: number
  hidden_count: number
  by_source: Record<string, number>
}

function StatusBadge({ label, tone = 'neutral' }: { label: string; tone?: 'ok' | 'warn' | 'neutral' }) {
  const color = tone === 'ok' ? 'var(--hud-success)' : tone === 'warn' ? 'var(--hud-warning)' : 'var(--hud-text-dim)'
  return (
    <span
      className="px-1.5 py-0.5 text-xs uppercase tracking-widest"
      style={{ color, border: `1px solid ${color}` }}
    >
      {label}
    </span>
  )
}

function pluginTone(plugin: PluginInfo): 'ok' | 'warn' | 'neutral' {
  if (plugin.runtime_status === 'enabled') return 'ok'
  if (plugin.runtime_status === 'disabled' || plugin.user_hidden) return 'warn'
  return 'neutral'
}

export default function PluginsPanel() {
  const { t } = useI18n()
  const { data, isLoading } = useApi<PluginsState>('/plugins', 30000)

  const plugins = data?.plugins || []
  const dashboardPlugins = useMemo(
    () => plugins.filter(plugin => plugin.has_dashboard_manifest),
    [plugins]
  )
  const agentPlugins = useMemo(
    () => plugins.filter(plugin => plugin.provides_tools.length || plugin.runtime_status !== 'inactive'),
    [plugins]
  )
  const authPlugins = useMemo(
    () => plugins.filter(plugin => plugin.auth_required),
    [plugins]
  )

  if (isLoading) {
    return <MuiPanel title={t('plugins.title')} className="col-span-full"><div className="glow text-sm animate-pulse">{t('plugins.loading')}</div></MuiPanel>
  }

  return (
    <>
      <MuiPanel title={t('plugins.overview')} className="col-span-full">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            [t('plugins.total'), data?.total_plugins || 0],
            [t('plugins.dashboard'), data?.dashboard_count || 0],
            [t('plugins.agent'), data?.agent_count || 0],
            [t('plugins.hidden'), data?.hidden_count || 0],
          ].map(([label, value]) => (
            <div key={String(label)} className="p-3 border" style={{ borderColor: 'var(--hud-border)' }}>
              <div className="text-xs uppercase tracking-widest" style={{ color: 'var(--hud-text-dim)' }}>{label}</div>
              <div className="text-2xl font-bold glow" style={{ color: 'var(--hud-primary)' }}>{value}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(data?.by_source || {}).map(([source, count]) => (
            <StatusBadge key={source} label={`${source}: ${count}`} />
          ))}
        </div>
      </MuiPanel>

      <MuiPanel title={`${t('plugins.title')} — ${plugins.length}`} className="col-span-full">
        {plugins.length === 0 ? (
          <div className="text-sm" style={{ color: 'var(--hud-text-dim)' }}>{t('plugins.none')}</div>
        ) : (
          <div className="space-y-2">
            {plugins.map(plugin => (
              <div key={plugin.name} className="p-3 border" style={{ borderColor: 'var(--hud-border)' }}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold" style={{ color: 'var(--hud-text)' }}>{plugin.label}</span>
                      <span className="text-xs" style={{ color: 'var(--hud-text-dim)' }}>{plugin.version}</span>
                    </div>
                    <div className="text-xs mt-1" style={{ color: 'var(--hud-text-dim)' }}>{plugin.description || plugin.name}</div>
                  </div>
                  <div className="flex flex-wrap gap-1 justify-end">
                    <StatusBadge label={plugin.source} />
                    <StatusBadge label={plugin.runtime_status} tone={pluginTone(plugin)} />
                    {plugin.has_dashboard_manifest && <StatusBadge label={t('plugins.dashboard')} tone="ok" />}
                    {plugin.has_api && <StatusBadge label={t('plugins.api')} tone="ok" />}
                    {plugin.user_hidden && <StatusBadge label={t('plugins.hidden')} tone="warn" />}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                  <div>
                    <span style={{ color: 'var(--hud-text-dim)' }}>{t('plugins.tab')}</span>
                    <div style={{ color: 'var(--hud-text)' }}>{plugin.has_dashboard_manifest ? plugin.tab_path : t('plugins.noneShort')}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--hud-text-dim)' }}>{t('plugins.tools')}</span>
                    <div style={{ color: 'var(--hud-text)' }}>{plugin.provides_tools.length ? plugin.provides_tools.join(', ') : t('plugins.noneShort')}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--hud-text-dim)' }}>{t('plugins.slots')}</span>
                    <div style={{ color: 'var(--hud-text)' }}>{plugin.slots.length ? plugin.slots.join(', ') : t('plugins.noneShort')}</div>
                  </div>
                </div>
                {plugin.auth_required && (
                  <div className="mt-2 text-xs" style={{ color: 'var(--hud-warning)' }}>
                    {t('plugins.authRequired')}: <span className="font-mono">{plugin.auth_command || `hermes auth ${plugin.name}`}</span>
                  </div>
                )}
                <div className="mt-2 truncate text-xs" style={{ color: 'var(--hud-text-dim)' }}>{plugin.path}</div>
              </div>
            ))}
          </div>
        )}
      </MuiPanel>

      <MuiPanel title={t('plugins.dashboardExtensions')}>
        <div className="space-y-2">
          {dashboardPlugins.length ? dashboardPlugins.map(plugin => (
            <div key={plugin.name} className="flex items-center justify-between gap-2 text-sm">
              <span style={{ color: 'var(--hud-text)' }}>{plugin.label}</span>
              <span style={{ color: 'var(--hud-text-dim)' }}>{plugin.entry || plugin.tab_path}</span>
            </div>
          )) : <div className="text-sm" style={{ color: 'var(--hud-text-dim)' }}>{t('plugins.none')}</div>}
        </div>
      </MuiPanel>

      <MuiPanel title={t('plugins.agentPlugins')}>
        <div className="space-y-2">
          {agentPlugins.length ? agentPlugins.map(plugin => (
            <div key={plugin.name} className="flex items-center justify-between gap-2 text-sm">
              <span style={{ color: 'var(--hud-text)' }}>{plugin.label}</span>
              <StatusBadge label={plugin.runtime_status} tone={pluginTone(plugin)} />
            </div>
          )) : <div className="text-sm" style={{ color: 'var(--hud-text-dim)' }}>{t('plugins.none')}</div>}
        </div>
      </MuiPanel>

      <MuiPanel title={t('plugins.authRequired')}>
        <div className="space-y-2">
          {authPlugins.length ? authPlugins.map(plugin => (
            <div key={plugin.name} className="text-sm">
              <div style={{ color: 'var(--hud-text)' }}>{plugin.label}</div>
              <div className="font-mono text-xs" style={{ color: 'var(--hud-warning)' }}>{plugin.auth_command || `hermes auth ${plugin.name}`}</div>
            </div>
          )) : <div className="text-sm" style={{ color: 'var(--hud-text-dim)' }}>{t('plugins.none')}</div>}
        </div>
      </MuiPanel>
    </>
  )
}
