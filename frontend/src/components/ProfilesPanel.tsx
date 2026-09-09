import { useApi } from '../hooks/useApi'
import MuiPanel, { CapacityBar } from './MuiPanel'
import { timeAgo, formatTokens } from '../lib/utils'
import { useTranslation } from '../i18n'

interface Profile {
  name: string
  is_default?: boolean
  is_local?: boolean
  model?: string
  provider?: string
  base_url?: string
  context_length?: number
  skin?: string
  soul_summary?: string
  session_count?: number
  message_count?: number
  tool_call_count?: number
  total_tokens?: number
  total_input_tokens?: number
  total_output_tokens?: number
  last_active?: string | null
  memory_chars?: number
  memory_max_chars?: number
  memory_entries?: number
  user_chars?: number
  user_max_chars?: number
  user_entries?: number
  skill_count?: number
  cron_job_count?: number
  toolsets?: string[]
  compression_enabled?: boolean
  compression_model?: string
  gateway_status?: string
  server_status?: string
  api_keys?: string[]
  has_alias?: boolean
}

interface ProfilesResponse {
  profiles?: Profile[]
  total?: number
  active_count?: number
}

function StatusDot({ status }: { status: string }) {
  const color = status === 'active' || status === 'running'
    ? 'var(--hud-success)'
    : status === 'inactive' || status === 'stopped'
    ? 'var(--hud-error)'
    : status === 'n/a'
    ? 'var(--hud-text-dim)'
    : 'var(--hud-warning)'

  return <span style={{ color }}>●</span>
}

function ProfileCard({ p }: { p: Profile }) {
  const { t } = useTranslation()
  const gatewayStatus = p.gateway_status || 'unknown'
  const serverStatus = p.server_status || 'unknown'
  return (
    <div className="p-4" style={{ background: 'var(--hud-bg-panel)', border: '1px solid var(--hud-border)' }}>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <StatusDot status={gatewayStatus} />
        <span className="font-bold text-sm" style={{ color: 'var(--hud-primary)' }}>
          {p.name}
        </span>
        {p.is_default && <span className="text-sm" style={{ color: 'var(--hud-text-dim)' }}>({t('profiles.default')})</span>}
        <span className="text-sm px-1.5 py-0.5 ml-auto"
          style={{ background: 'var(--hud-bg-hover)', color: p.is_local ? 'var(--hud-secondary)' : 'var(--hud-accent)' }}>
          {p.is_local ? t('profiles.local') : p.provider}
        </span>
        {gatewayStatus === 'active' && (
          <span className="text-sm" style={{ color: 'var(--hud-success)' }}>{t('profiles.gatewayUp')}</span>
        )}
        {serverStatus === 'running' && (
          <span className="text-sm" style={{ color: 'var(--hud-success)' }}>{t('profiles.serverUp')}</span>
        )}
      </div>

      <div className="space-y-1 text-sm mb-3">
        <div className="grid grid-cols-[80px_1fr] gap-1">
          <span style={{ color: 'var(--hud-text-dim)' }}>{t('profiles.model')}</span>
          <span>
            <span className="font-bold">{p.model || t('profiles.notSet')}</span>
            {p.provider && <span style={{ color: 'var(--hud-text-dim)' }}> {t('profiles.via')} {p.provider}</span>}
          </span>
        </div>

        {p.base_url && (
          <div className="grid grid-cols-[80px_1fr] gap-1">
            <span style={{ color: 'var(--hud-text-dim)' }}>{t('profiles.backend')}</span>
            <span>
              <span style={{ color: 'var(--hud-text-dim)' }}>{p.base_url}</span>
              {' '}<StatusDot status={serverStatus} />
            </span>
          </div>
        )}

        {!!p.context_length && p.context_length > 0 && (
          <div className="grid grid-cols-[80px_1fr] gap-1">
            <span style={{ color: 'var(--hud-text-dim)' }}>{t('profiles.context')}</span>
            <span style={{ color: 'var(--hud-text-dim)' }}>{p.context_length.toLocaleString()} {t('profiles.tokens')}</span>
          </div>
        )}

        {p.skin && (
          <div className="grid grid-cols-[80px_1fr] gap-1">
            <span style={{ color: 'var(--hud-text-dim)' }}>{t('profiles.skin')}</span>
            <span style={{ color: 'var(--hud-text-dim)' }}>{p.skin}</span>
          </div>
        )}

        {p.soul_summary && (
          <div className="grid grid-cols-[80px_1fr] gap-1">
            <span style={{ color: 'var(--hud-text-dim)' }}>{t('profiles.soul')}</span>
            <span className="italic" style={{ color: 'var(--hud-text)' }}>{p.soul_summary.slice(0, 80)}{p.soul_summary.length > 80 ? '...' : ''}</span>
          </div>
        )}
      </div>

      <div className="text-sm mb-3 py-2" style={{ borderTop: '1px solid var(--hud-border)', borderBottom: '1px solid var(--hud-border)' }}>
        <div className="grid grid-cols-3 gap-2 mb-2">
          <div>
            <span style={{ color: 'var(--hud-primary)' }} className="font-bold">{p.session_count || 0}</span>
            <span style={{ color: 'var(--hud-text-dim)' }}> {t('profiles.sessions')}</span>
          </div>
          <div>
            <span style={{ color: 'var(--hud-primary)' }} className="font-bold">{(p.message_count || 0).toLocaleString()}</span>
            <span style={{ color: 'var(--hud-text-dim)' }}> {t('profiles.messages')}</span>
          </div>
          <div>
            <span style={{ color: 'var(--hud-primary)' }} className="font-bold">{(p.tool_call_count || 0).toLocaleString()}</span>
            <span style={{ color: 'var(--hud-text-dim)' }}> {t('profiles.tools')}</span>
          </div>
        </div>
        <div className="grid grid-cols-[80px_1fr] gap-1">
          <span style={{ color: 'var(--hud-text-dim)' }}>{t('profiles.tokensLabel')}</span>
          <span style={{ color: 'var(--hud-text-dim)' }}>
            {formatTokens(p.total_tokens || 0)} {t('profiles.totalTokens')} ({formatTokens(p.total_input_tokens || 0)} {t('profiles.in')} / {formatTokens(p.total_output_tokens || 0)} {t('profiles.out')})
          </span>
        </div>
        <div className="grid grid-cols-[80px_1fr] gap-1">
          <span style={{ color: 'var(--hud-text-dim)' }}>{t('profiles.active')}</span>
          <span style={{ color: 'var(--hud-text-dim)' }}>{timeAgo(p.last_active)}</span>
        </div>
      </div>

      <div className="mb-3">
        <CapacityBar value={p.memory_chars || 0} max={p.memory_max_chars || 2200} label={t('profiles.memory')} />
        <div className="text-sm mb-1" style={{ color: 'var(--hud-text-dim)' }}>
          {p.memory_entries || 0} {t('profiles.entries')}, {p.memory_chars || 0}/{p.memory_max_chars || 2200} {t('profiles.chars')}
        </div>
        <CapacityBar value={p.user_chars || 0} max={p.user_max_chars || 1375} label={t('profiles.user')} />
        <div className="text-sm" style={{ color: 'var(--hud-text-dim)' }}>
          {p.user_entries || 0} {t('profiles.entries')}, {p.user_chars || 0}/{p.user_max_chars || 1375} {t('profiles.chars')}
        </div>
      </div>

      <div className="space-y-1 text-sm">
        <div className="grid grid-cols-[80px_1fr] gap-1">
          <span style={{ color: 'var(--hud-text-dim)' }}>{t('profiles.skills')}</span>
          <span>
            <span className="font-bold">{p.skill_count || 0}</span>
            <span style={{ color: 'var(--hud-text-dim)' }}> · {t('profiles.cronJobs')} </span>
            <span className="font-bold">{p.cron_job_count || 0}</span>
          </span>
        </div>

        {!!p.toolsets?.length && (
          <div className="grid grid-cols-[80px_1fr] gap-1">
            <span style={{ color: 'var(--hud-text-dim)' }}>{t('profiles.toolsets')}</span>
            <span style={{ color: 'var(--hud-text-dim)' }}>{p.toolsets.join(', ')}</span>
          </div>
        )}

        {p.compression_enabled && (
          <div className="grid grid-cols-[80px_1fr] gap-1">
            <span style={{ color: 'var(--hud-text-dim)' }}>{t('profiles.compress')}</span>
            <span>
              <span style={{ color: 'var(--hud-success)' }}>{t('profiles.on')}</span>
              {p.compression_model && <span style={{ color: 'var(--hud-text-dim)' }}> · {p.compression_model}</span>}
            </span>
          </div>
        )}

        <div className="grid grid-cols-[80px_1fr] gap-1">
          <span style={{ color: 'var(--hud-text-dim)' }}>{t('profiles.gateway')}</span>
          <span><StatusDot status={gatewayStatus} /> {gatewayStatus}
            <span className="ml-3">{t('profiles.server')} <StatusDot status={serverStatus} /> {serverStatus}</span>
          </span>
        </div>

        {!!p.api_keys?.length && (
          <div className="grid grid-cols-[80px_1fr] gap-1">
            <span style={{ color: 'var(--hud-text-dim)' }}>{t('profiles.keys')}</span>
            <span style={{ color: 'var(--hud-text-dim)' }}>{p.api_keys.join(', ')}</span>
          </div>
        )}

        {p.has_alias && (
          <div className="grid grid-cols-[80px_1fr] gap-1">
            <span style={{ color: 'var(--hud-text-dim)' }}>{t('profiles.alias')}</span>
            <span>
              <span style={{ color: 'var(--hud-success)' }}>{p.name}</span>
              <span style={{ color: 'var(--hud-text-dim)' }}> ({t('profiles.onPath')})</span>
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ProfilesPanel() {
  const { t } = useTranslation()
  const { data, isLoading } = useApi<ProfilesResponse>('/profiles', 30000)

  if (isLoading && !data) {
    return <MuiPanel title={t('profiles.title')} className="col-span-full"><div className="glow text-sm animate-pulse">{t('profiles.loading')}</div></MuiPanel>
  }

  const profiles = data?.profiles || []

  return (
    <MuiPanel title={`${t('profiles.panelTitle')} — ${data?.total || 0} ${t('profiles.total')}, ${data?.active_count || 0} ${t('profiles.activeCount')}`} className="col-span-full">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {profiles.map(profile => (
          <ProfileCard key={profile.name} p={profile} />
        ))}
      </div>
    </MuiPanel>
  )
}
