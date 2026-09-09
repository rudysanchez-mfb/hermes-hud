import { useApi } from '../hooks/useApi'
import MuiPanel from './MuiPanel'
import { timeAgo } from '../lib/utils'
import { useTranslation } from '../i18n'

interface GatewayData {
  state: string
  pid: number | null
  pid_alive: boolean
  kind: string
  restart_requested: boolean
  exit_reason: string | null
  updated_at: string | null
  active_agents: number
  platforms: {
    name: string
    state: string
    updated_at: string | null
    error_code: string | null
    error_message: string | null
  }[]
  managed_tools: {
    tools: {
      key: string
      label: string
      gateway_service: string
      enabled: boolean
      available: boolean
      route: 'managed' | 'direct' | 'unavailable'
      config_section: string
      gateway_enabled: boolean
      has_direct_credential: boolean
      direct_env_vars: string[]
      configured_env_vars: string[]
      missing_config: string[]
      diagnostics: string[]
      safe_actions: string[]
      reason: string
    }[]
    nous_auth_present: boolean
    managed_count: number
    direct_count: number
    unavailable_count: number
  }
}

function platformColor(state: string): string {
  if (state === 'connected' || state === 'running') return 'var(--hud-success)'
  if (state === 'connecting' || state === 'starting') return 'var(--hud-warning, #d4a017)'
  return 'var(--hud-error)'
}

function routeColor(route: string): string {
  if (route === 'managed') return 'var(--hud-primary)'
  if (route === 'direct') return 'var(--hud-success)'
  return 'var(--hud-error)'
}

export default function GatewayPanel() {
  const { t } = useTranslation()
  const { data, isLoading } = useApi<GatewayData>('/gateway', 10000)

  if (isLoading && !data) {
    return (
      <MuiPanel title={t('gateway.title')} className="col-span-full">
        <div className="glow text-sm animate-pulse">{t('gateway.loading')}</div>
      </MuiPanel>
    )
  }

  const healthy = data?.state === 'running' && data?.pid_alive

  return (
    <>
    <MuiPanel title={t('gateway.title')} className="col-span-full">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span style={{ color: 'var(--hud-text-dim)' }}>{t('gateway.state')}</span>
              <span style={{ color: healthy ? 'var(--hud-success)' : 'var(--hud-error)' }}>
                ● {data?.state ?? 'unknown'}
              </span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--hud-text-dim)' }}>{t('gateway.pid')}</span>
              <span>{data?.pid ?? '—'}{data && !data.pid_alive && data.pid ? ` (${t('gateway.dead')})` : ''}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--hud-text-dim)' }}>{t('gateway.activeAgents')}</span>
              <span>{data?.active_agents ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--hud-text-dim)' }}>{t('gateway.updated')}</span>
              <span>{timeAgo(data?.updated_at)}</span>
            </div>
            {data?.exit_reason && (
              <div className="flex justify-between">
                <span style={{ color: 'var(--hud-text-dim)' }}>{t('gateway.exitReason')}</span>
                <span style={{ color: 'var(--hud-error)' }}>{data.exit_reason}</span>
              </div>
            )}
          </div>

          <div className="mt-4">
            <div className="text-xs mb-1" style={{ color: 'var(--hud-text-dim)' }}>
              {t('gateway.platforms')}
            </div>
            {(data?.platforms ?? []).length === 0 && (
              <div className="text-sm" style={{ color: 'var(--hud-text-dim)' }}>—</div>
            )}
            {(data?.platforms ?? []).map((p) => (
              <div key={p.name} className="flex justify-between text-sm py-0.5">
                <span>{p.name}</span>
                <span style={{ color: platformColor(p.state) }}>● {p.state}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MuiPanel>
    <MuiPanel title={t('gateway.managedTools')} className="col-span-full">
      <div className="flex flex-wrap gap-2 mb-3 text-xs">
        <span style={{ color: 'var(--hud-text-dim)' }}>{t('gateway.nousAuth')}: </span>
        <span style={{ color: data?.managed_tools?.nous_auth_present ? 'var(--hud-success)' : 'var(--hud-error)' }}>
          {data?.managed_tools?.nous_auth_present ? t('gateway.present') : t('gateway.missing')}
        </span>
        <span style={{ color: 'var(--hud-primary)' }}>{t('gateway.managed')}: {data?.managed_tools?.managed_count ?? 0}</span>
        <span style={{ color: 'var(--hud-success)' }}>{t('gateway.direct')}: {data?.managed_tools?.direct_count ?? 0}</span>
        <span style={{ color: 'var(--hud-error)' }}>{t('gateway.unavailable')}: {data?.managed_tools?.unavailable_count ?? 0}</span>
      </div>
      <div className="grid md:grid-cols-2 gap-2">
        {(data?.managed_tools?.tools ?? []).map((tool) => {
          return (
          <div key={tool.key} className="p-3 border" style={{ borderColor: 'var(--hud-border)' }}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold" style={{ color: 'var(--hud-text)' }}>{tool.label}</div>
                <div className="text-xs" style={{ color: 'var(--hud-text-dim)' }}>{tool.gateway_service}</div>
              </div>
              <span className="px-1.5 py-0.5 text-xs uppercase tracking-widest" style={{ color: routeColor(tool.route), border: `1px solid ${routeColor(tool.route)}` }}>
                {tool.route}
              </span>
            </div>
            <div className="mt-2 text-xs" style={{ color: tool.available ? 'var(--hud-text-dim)' : 'var(--hud-error)' }}>
              {tool.reason}
            </div>
            <div className="mt-3 grid sm:grid-cols-2 gap-3 text-xs">
              <div>
                <div className="uppercase tracking-widest mb-1" style={{ color: 'var(--hud-text-dim)' }}>
                  {t('gateway.diagnostics')}
                </div>
                <ul className="space-y-1">
                  {tool.diagnostics.map((diagnostic) => (
                    <li key={diagnostic} style={{ color: 'var(--hud-text-dim)' }}>
                      {diagnostic}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="uppercase tracking-widest mb-1" style={{ color: 'var(--hud-text-dim)' }}>
                  {t('gateway.missingConfig')}
                </div>
                {tool.missing_config.length > 0 ? (
                  <ul className="space-y-1">
                    {tool.missing_config.map((item) => (
                      <li key={item} style={{ color: 'var(--hud-error)' }}>
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div style={{ color: 'var(--hud-success)' }}>{t('gateway.none')}</div>
                )}
              </div>
            </div>
            {tool.configured_env_vars.length > 0 && (
              <div className="mt-2 text-xs font-mono" style={{ color: 'var(--hud-success)' }}>
                {tool.configured_env_vars.join(', ')}
              </div>
            )}
          </div>
          )
        })}
      </div>
    </MuiPanel>
    </>
  )
}
