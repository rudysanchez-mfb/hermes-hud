import {
  Box, Stack, Typography, Accordion, AccordionSummary, AccordionDetails,
  Chip, CircularProgress, LinearProgress
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { usePipeline } from '../../hooks/usePipeline'
import { useTheme as useMuiTheme } from '@mui/material/styles'
import { AlertStrip, StatCard, ProgressRow, SectionHeader } from './shared'
import PipelineFlow from './PipelineFlow'

// ── helpers ────────────────────────────────────────────────

function getTransferKey(t: any): string {
  return t.id || t.transfer_id || t.name || ''
}

function isFailedTransfer(t: any): boolean {
  const s = (t.status || '').toLowerCase()
  return s === 'error' || s === 'failed' || s === 'stalled' || s === 'cancelled'
}

// ── component ──────────────────────────────────────────────

export default function DebridPanel() {
  const { data, error } = usePipeline<any>('/pipeline/debrid')
  const muiTheme = useMuiTheme()

  if (error) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="error">Debrid pipeline unavailable: {error.message}</Typography>
      </Box>
    )
  }

  if (!data) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <CircularProgress size={24} />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Connecting to debrid services...</Typography>
      </Box>
    )
  }

  const services = data.services || []
  const transfers = data.transfers || []
  const mounts = data.mounts || []
  const alerts = data.alerts || []
  const mountsOk = mounts.filter((m: any) => m.ok).length
  const totalActive = services.reduce((sum: number, s: any) => sum + (s.active || 0), 0)

  // ── Compute nodeData for PipelineFlow hover popups ──────

  const nodeData: Record<string, { status: string; lines: string[] }> = {}

  // watchlist
  nodeData['watchlist'] = {
    status: 'ok',
    lines: [
      'Source: RSS / Watchlist',
      data.last_cycle ? `Last cycle: ${data.last_cycle.slice(0, 55)}` : 'No cycles recorded',
    ].filter(Boolean),
  }

  // plex-debrid
  const pdRunning = data.plex_debrid?.toLowerCase().includes('running')
  nodeData['plex-debrid'] = {
    status: pdRunning ? 'ok' : 'warning',
    lines: [
      `Status: ${data.plex_debrid || 'unknown'}`,
      data.last_cycle ? `Last: ${data.last_cycle.slice(0, 55)}` : '',
    ].filter(Boolean),
  }

  // Debrid services: premiumize, torbox, debridlink
  for (const svcId of ['premiumize', 'torbox', 'debridlink']) {
    const svc = services.find((s: any) => s.name?.toLowerCase() === svcId)
    const hasAlert = alerts.some((a: any) => a.label.toLowerCase().includes(svcId))
    nodeData[svcId] = {
      status: hasAlert ? 'error' : (svc?.active > 0 ? 'ok' : 'warning'),
      lines: [
        svc ? `Transfers: ${svc.active || 0} active / ${svc.total || 0} total` : 'No data',
        svc?.storage_pct != null ? `Storage: ${svc.storage_pct}% used` : '',
        svc?.premium_until ? `Premium until: ${svc.premium_until}` : 'Free tier',
      ].filter(Boolean),
    }
  }

  // mergerfs
  const failedMounts = mounts.filter((m: any) => !m.ok)
  nodeData['mergerfs'] = {
    status: mountsOk === mounts.length ? 'ok' : 'error',
    lines: [
      `Mounts: ${mountsOk}/${mounts.length} healthy`,
      ...failedMounts.slice(0, 2).map((m: any) => `⚠ ${m.path}`),
    ],
  }

  // plex
  nodeData['plex'] = {
    status: 'ok',
    lines: ['Media server', 'Streaming & library'],
  }

  // ── Render ───────────────────────────────────────────────

  return (
    <Stack spacing={1.5}>
      <AlertStrip alerts={alerts} />

      {/* Stat cards row */}
      <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' } }}>
        <StatCard
          label="Active Transfers"
          value={totalActive}
          color={totalActive > 0 ? muiTheme.palette.primary.main : undefined}
          sub={totalActive === 0 ? 'Idle' : undefined}
        />
        <StatCard
          label="Mounts"
          value={`${mountsOk}/${mounts.length}`}
          color={mountsOk === mounts.length ? muiTheme.palette.success.main : muiTheme.palette.error.main}
          sub={mountsOk < mounts.length ? failedMounts.map((m: any) => m.path).join(', ') : 'All healthy'}
        />
        <StatCard
          label="plex-debrid"
          value={
            <Chip
              label={data.plex_debrid || '?'}
              size="small"
              color={pdRunning ? 'success' as const : 'error' as const}
              sx={{ fontSize: '0.75rem' }}
            />
          }
          sub={data.last_cycle ? `Last cycle: ${data.last_cycle.slice(0, 60)}...` : undefined}
        />
        <StatCard
          label="Updated"
          value={data.updated_at ? new Date(data.updated_at).toLocaleTimeString() : '—'}
        />
      </Box>

      {/* d3 Flow with hover popups */}
      <PipelineFlow
        services={services}
        transfers={transfers.length}
        alerts={alerts}
        nodeData={nodeData}
      />

      {/* Active transfers */}
      {transfers.length > 0 && (
        <>
          <SectionHeader title="Active Transfers" count={transfers.length} />
          {transfers.map((t: any, i: number) => (
            <ProgressRow
              key={getTransferKey(t) || i}
              name={t.name || '?'}
              service={t.service}
              pct={t.progress || 0}
              speed={t.speed}
              size={t.size}
              status={t.status}
            />
          ))}
        </>
      )}

      {/* Per-service accordions */}
      <SectionHeader title="Services" count={services.length} />
      {services.map((svc: any, i: number) => {
        const recentTransfers: any[] = svc.recent_transfers || []
        const failedTransfers = recentTransfers.filter(isFailedTransfer)
        const recentOk = recentTransfers.filter((t: any) => !isFailedTransfer(t)).slice(0, 5)
        const mountInfo = mounts.find((m: any) =>
          (m.path || '').toLowerCase().includes((svc.name || '').toLowerCase())
        )

        return (
          <Accordion key={i} variant="outlined" disableGutters sx={{ '&:before': { display: 'none' } }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 40, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', justifyContent: 'space-between' }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{svc.name}</Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  {svc.premium_until && (
                    <Chip label={`Until ${svc.premium_until}`} size="small" variant="outlined" sx={{ fontSize: '0.75rem' }} />
                  )}
                  <Chip
                    label={`${svc.active || 0}/${svc.total || 0} active`}
                    size="small"
                    color={svc.active > 0 ? 'primary' : 'default'}
                    sx={{ fontSize: '0.75rem' }}
                  />
                </Box>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0 }}>
              {/* Storage bar */}
              {svc.storage_pct != null && (
                <Box sx={{ mb: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                    <Typography variant="caption" color="text.secondary">Storage</Typography>
                    <Typography variant="caption" color="text.secondary">{svc.storage_pct}%</Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(svc.storage_pct, 100)}
                    sx={{ height: 6, borderRadius: 3 }}
                    color={svc.storage_pct > 90 ? 'error' : svc.storage_pct > 70 ? 'warning' : 'primary'}
                  />
                </Box>
              )}

              {/* Premium status */}
              {svc.premium_until && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  Premium until: {svc.premium_until}
                </Typography>
              )}

              {/* Mount path */}
              {mountInfo && (
                <Typography variant="caption" color={mountInfo.ok ? 'text.secondary' : 'error'} sx={{ display: 'block', mb: 0.5 }}>
                  Mount: {mountInfo.path} {mountInfo.ok ? '✓' : '✗'}
                </Typography>
              )}

              {/* Failed/stuck transfers first */}
              {failedTransfers.length > 0 && (
                <Box sx={{ mb: 0.75 }}>
                  <Typography variant="caption" color="error" sx={{ fontWeight: 600, display: 'block', mb: 0.25 }}>
                    Failed / Stuck ({failedTransfers.length})
                  </Typography>
                  {failedTransfers.slice(0, 3).map((t: any, j: number) => (
                    <Box key={j} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, ml: 1, mb: 0.25 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.name || '?'}
                      </Typography>
                      <Chip
                        label={t.status || 'error'}
                        size="small"
                        color="error"
                        sx={{ fontSize: '0.65rem', height: 18 }}
                      />
                    </Box>
                  ))}
                </Box>
              )}

              {/* Recent transfers */}
              {recentOk.length > 0 && (
                <Box sx={{ mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 0.25 }}>
                    Recent ({recentOk.length})
                  </Typography>
                  {recentOk.map((t: any, j: number) => (
                    <Box key={j} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, ml: 1, mb: 0.25 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.name || '?'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t.progress != null ? `${t.progress}%` : t.status || ''}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}

              {/* Errors from API */}
              {svc.errors?.length > 0 && (
                <Box sx={{ mt: 0.5 }}>
                  <Typography variant="caption" color="error" sx={{ fontWeight: 600 }}>Recent errors:</Typography>
                  {svc.errors.map((err: string, j: number) => (
                    <Typography key={j} variant="caption" color="text.secondary" sx={{ display: 'block', ml: 1 }}>
                      {err}
                    </Typography>
                  ))}
                </Box>
              )}

              {/* Fallback: nothing to show */}
              {!svc.storage_pct && !svc.premium_until && !mountInfo && failedTransfers.length === 0 && recentOk.length === 0 && !svc.errors?.length && (
                <Typography variant="caption" color="text.secondary">No recent activity</Typography>
              )}
            </AccordionDetails>
          </Accordion>
        )
      })}

    </Stack>
  )
}
