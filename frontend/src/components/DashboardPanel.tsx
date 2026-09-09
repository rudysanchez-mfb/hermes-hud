import {
  Box, Stack, Typography, Paper, Chip, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material'
import { StatCard } from './pipeline/shared'
import { useTheme as useMuiTheme } from '@mui/material/styles'
import { useApi } from '../hooks/useApi'
import { formatMoney } from '../lib/utils'

export default function DashboardPanel() {
  const { data, error } = useApi<any>('/dashboard', 30000)
  const { data: billing } = useApi<any>('/billing', 60000)
  const muiTheme = useMuiTheme()

  if (error) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="error">Dashboard unavailable</Typography>
      </Box>
    )
  }
  if (!data) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <CircularProgress size={32} />
      </Box>
    )
  }

  const exec = data.executive_summary || {}
  const spend = exec.spend || {}
  const health = exec.health || {}
  const docker = data.docker_services || {}
  const cronFails = data.cron_failures || []
  const debrid = data.pipeline_debrid || {}
  const music = data.pipeline_music || {}

  // Build unified Needs Attention feed
  const attention: { severity: string; label: string; link: string }[] = []

  // Health broken items
  if (health.broken > 0) {
    attention.push({ severity: 'critical', label: `${health.broken} health check${health.broken !== 1 ? 's' : ''} broken`, link: 'services' })
  }

  // Cron failures
  cronFails.slice(0, 5).forEach((j: any) => {
    attention.push({
      severity: 'error',
      label: `Cron "${j.name || j.id}": ${j.last_error || 'failed'}`,
      link: 'cron',
    })
  })

  // Docker degraded
  if (docker.degraded > 0) {
    const names = (docker.containers || [])
      .filter((c: any) => c.state !== 'running' || c.healthy === false)
      .slice(0, 3)
      .map((c: any) => c.name)
      .join(', ')
    attention.push({ severity: 'warning', label: `${docker.degraded} container${docker.degraded !== 1 ? 's' : ''} down: ${names}`, link: 'services' })
  }

  // Pipeline alerts
  (debrid.alerts || []).forEach((a: any) => {
    attention.push({ severity: a.severity, label: `[Debrid] ${a.label}`, link: 'debrid' })
  })
  ;(music.alerts || []).slice(0, 3).forEach((a: any) => {
    attention.push({ severity: a.severity, label: `[Music] ${a.label}`, link: 'music' })
  })

  // Provider warnings
  exec.actions?.forEach((a: any) => {
    attention.push({ severity: a.severity || 'warning', label: `[${a.source}] ${a.label}`, link: a.target || 'token-costs' })
  })

  const containersRunning = (docker.total || 0) - (docker.degraded || 0)

  return (
    <Stack spacing={1.5}>
      {/* ══ Spend pulse — always first ══ */}
      <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' } }}>
        <StatCard label="Spend Today" value={formatMoney(spend.today_usd)} color={muiTheme.palette.warning.main} />
        <StatCard label="7-Day Trend" value={spend.trend_delta_pct != null ? `${spend.trend_delta_pct > 0 ? '+' : ''}${spend.trend_delta_pct}%` : '—'} />
        <StatCard label="All-Time" value={formatMoney(billing?.providers ? Object.values(billing.providers).reduce((s: number, p: any) => s + (p.receipt_total_all_time || 0), 0) : null)} />
        <StatCard label="Provider Balances" value={formatMoney(billing?.providers?.deepseek?.api_balance)} sub="DeepSeek" />
      </Box>

      {/* ══ Needs Attention ══ */}
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1, letterSpacing: '0.1em' }}>
          Needs Attention
        </Typography>
        {attention.length === 0 ? (
          <Typography variant="body2" color="success.main">ALL SYSTEMS OPERATIONAL</Typography>
        ) : (
          <Stack spacing={0.5}>
            {attention.slice(0, 8).map((item, i) => (
              <Box
                key={i}
                component="a"
                href={`#/${item.link}`}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1, py: 0.25,
                  textDecoration: 'none', color: 'inherit',
                  '&:hover': { color: muiTheme.palette.primary.main },
                }}
              >
                <Chip
                  label={item.severity}
                  size="small"
                  color={item.severity === 'critical' ? 'error' : item.severity === 'warning' ? 'warning' : 'default'}
                  sx={{ fontSize: '0.75rem', height: 20, minWidth: 56 }}
                />
                <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                  {item.label.length > 100 ? item.label.slice(0, 97) + '...' : item.label}
                </Typography>
              </Box>
            ))}
          </Stack>
        )}
      </Paper>

      {/* ══ Services + Pipelines ══ */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
        {/* Docker services dot-grid */}
        <Paper variant="outlined" sx={{ p: 1.5, flex: 1, minWidth: 200 }}>
          <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1, letterSpacing: '0.1em' }}>
            Services ({containersRunning}/{docker.total})
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {(docker.containers || []).map((c: any) => {
              const ok = c.state === 'running' && c.healthy !== false
              return (
                <Chip
                  key={c.name}
                  label={c.name}
                  size="small"
                  sx={{
                    fontSize: '0.75rem', height: 26,
                    bgcolor: ok ? muiTheme.palette.primary.main : muiTheme.palette.error.main,
                    color: ok ? muiTheme.palette.primary.contrastText : '#fff',
                    fontWeight: 600,
                    opacity: ok ? 0.85 : 1,
                  }}
                />
              )
            })}
          </Box>
        </Paper>

        {/* Pipeline minis */}
        <Paper variant="outlined" sx={{ p: 1.5, flex: 1, minWidth: 200 }}>
          <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1, letterSpacing: '0.1em' }}>
            Pipelines
          </Typography>
          <Stack spacing={1}>
            <Box>
              <Typography variant="body2">
                <a href="#/debrid" style={{ color: muiTheme.palette.primary.main, textDecoration: 'none' }}>Debrid</a>
                {' '}
                {debrid.services?.length || 0} services · {debrid.transfers?.length || 0} active
                {debrid.alerts?.length > 0 && (
                  <Chip label={`${debrid.alerts.length} alerts`} size="small" color="warning" sx={{ ml: 1, fontSize: '0.75rem', height: 18 }} />
                )}
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2">
                <a href="#/music" style={{ color: muiTheme.palette.primary.main, textDecoration: 'none' }}>Music</a>
                {' '}
                Lidarr: {music.lidarr_queue?.active || 0} in queue · {music.lidarr_wanted || 0} wanted
                {music.alerts?.length > 0 && (
                  <Chip label={`${music.alerts.length} alerts`} size="small" color="warning" sx={{ ml: 1, fontSize: '0.75rem', height: 18 }} />
                )}
              </Typography>
            </Box>
          </Stack>
        </Paper>
      </Box>

      {/* ══ Cron next-runs ══ */}
      {(data.cron?.jobs?.length || 0) > 0 && (
        <Paper variant="outlined" sx={{ p: 1.5 }}>
          <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1, letterSpacing: '0.1em' }}>
            Cron ({data.cron.jobs.filter((j: any) => j.enabled).length || 0} active)
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontSize: '0.75rem' }}>Job</TableCell>
                  <TableCell sx={{ fontSize: '0.75rem' }}>Next Run</TableCell>
                  <TableCell sx={{ fontSize: '0.75rem' }}>Last</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(data.cron.jobs || []).filter((j: any) => j.enabled).slice(0, 8).map((j: any) => (
                  <TableRow key={j.id}>
                    <TableCell sx={{ fontSize: '0.75rem' }}>{j.name || j.id}</TableCell>
                    <TableCell sx={{ fontSize: '0.75rem' }}>{j.next_run_at ? new Date(j.next_run_at).toLocaleTimeString() : '—'}</TableCell>
                    <TableCell sx={{ fontSize: '0.75rem' }}>
                      <Chip
                        label={j.last_status || '—'}
                        size="small"
                        color={j.last_error ? 'error' : j.last_status === 'ok' ? 'success' : 'default'}
                        sx={{ fontSize: '0.75rem', height: 20 }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Stack>
  )
}
