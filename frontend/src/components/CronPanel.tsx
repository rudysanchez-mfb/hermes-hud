import { useApi } from '../hooks/useApi'
import MuiPanel from './MuiPanel'
import { timeAgo, truncate } from '../lib/utils'
import { useTranslation } from '../i18n'

interface CronJob {
  id: string
  name?: string
  prompt?: string
  schedule?: string
  schedule_display?: string
  enabled?: boolean
  state?: string
  next_run_at?: string | null
  last_run_at?: string | null
  last_status?: string | null
  deliver?: string
  repeat_total?: number | null
  repeat_completed?: number | null
  skills?: string[]
  paused_reason?: string | null
}

type CronResponse = { jobs?: CronJob[] } | CronJob[]

export default function CronPanel() {
  const { t } = useTranslation()
  const { data, isLoading } = useApi<CronResponse>('/cron', 30000)

  if (isLoading && !data) {
    return <MuiPanel title={t('cron.title')} className="col-span-full"><div className="glow text-sm animate-pulse">{t('cron.loading')}</div></MuiPanel>
  }

  const jobs = Array.isArray(data) ? data : data?.jobs || []
  const hasJobs = jobs.length > 0

  return (
    <MuiPanel title={t('cron.title')} className="col-span-full">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="text-xs" style={{ color: 'var(--hud-text-dim)' }}>
          {hasJobs ? `${jobs.length} ${jobs.length === 1 ? t('cron.job') : t('cron.jobs')}` : t('cron.noJobs')}
        </div>
      </div>

      {!hasJobs ? (
        <div className="text-sm" style={{ color: 'var(--hud-text-dim)' }}>{t('cron.noJobs')}</div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job: CronJob) => {
            const isPaused = job.state === 'paused'
            const isCompleted = job.state === 'completed'
            const isActive = job.enabled && !isPaused && !isCompleted

            return (
              <div key={job.id} className="p-3" style={{ background: 'var(--hud-bg-panel)', border: '1px solid var(--hud-border)' }}>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: isActive ? 'var(--hud-success)' : 'var(--hud-text-dim)' }} />
                  <span className="font-bold text-sm" style={{ color: 'var(--hud-primary)' }}>
                    {job.name || job.id}
                  </span>
                  <span className="text-sm px-1.5 py-0.5"
                    style={{
                      background: 'var(--hud-bg-hover)',
                      color: isActive ? 'var(--hud-success)' : 'var(--hud-text-dim)'
                    }}>
                    {job.state || 'unknown'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div>
                    <div className="uppercase tracking-wider" style={{ color: 'var(--hud-text-dim)', fontSize: '12px' }}>{t('cron.schedule')}</div>
                    <div style={{ color: 'var(--hud-primary)' }}>{job.schedule_display || job.schedule || '-'}</div>
                  </div>
                  <div>
                    <div className="uppercase tracking-wider" style={{ color: 'var(--hud-text-dim)', fontSize: '12px' }}>{t('cron.lastRun')}</div>
                    <div>
                      {timeAgo(job.last_run_at)}
                      {job.last_status && (
                        <span className="ml-1" style={{ color: job.last_status === 'ok' ? 'var(--hud-success)' : 'var(--hud-error)' }}>
                          {job.last_status === 'ok' ? '✔' : '✗'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="uppercase tracking-wider" style={{ color: 'var(--hud-text-dim)', fontSize: '12px' }}>{t('cron.nextRun')}</div>
                    <div>{job.next_run_at ? new Date(job.next_run_at).toLocaleString() : '-'}</div>
                  </div>
                  <div>
                    <div className="uppercase tracking-wider" style={{ color: 'var(--hud-text-dim)', fontSize: '12px' }}>{t('cron.deliver')}</div>
                    <div style={{ color: 'var(--hud-accent)' }}>{job.deliver || '-'}</div>
                  </div>
                </div>

                {job.repeat_completed != null && (
                  <div className="mt-2 text-sm" style={{ color: 'var(--hud-text-dim)' }}>
                    {t('cron.runsCompleted')}: {job.repeat_completed}{job.repeat_total ? ` / ${job.repeat_total}` : ''}
                    {!!job.skills?.length && <span className="ml-2">{t('cron.skills')}: {job.skills.join(', ')}</span>}
                  </div>
                )}

                {job.prompt && (
                  <div className="mt-2 text-sm" style={{ color: 'var(--hud-text-dim)' }}>
                    {truncate(job.prompt, 120)}
                  </div>
                )}

                {job.paused_reason && (
                  <div className="mt-1 text-xs" style={{ color: 'var(--hud-warning)' }}>
                    {t('cron.pausedReason')}: {job.paused_reason}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </MuiPanel>
  )
}
