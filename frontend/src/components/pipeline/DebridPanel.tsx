import {
  Box, Stack, Typography, Accordion, AccordionSummary, AccordionDetails,
  Chip, CircularProgress
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { usePipeline } from '../../hooks/usePipeline'
import { useTheme as useMuiTheme } from '@mui/material/styles'
import { AlertStrip, StatCard, ProgressRow, SectionHeader } from './shared'
import PipelineFlow from './PipelineFlow'

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

  return (
    <Stack spacing={1.5}>
      <AlertStrip alerts={alerts} />

      {/* Stat cards row */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        <StatCard
          label="Active Transfers"
          value={totalActive}
          color={totalActive > 0 ? muiTheme.palette.primary.main : undefined}
          sub={totalActive === 0 ? 'Idle' : undefined}
          xs={3}
        />
        <StatCard
          label="Mounts"
          value={`${mountsOk}/${mounts.length}`}
          color={mountsOk === mounts.length ? muiTheme.palette.success.main : muiTheme.palette.error.main}
          sub={mountsOk < mounts.length ? mounts.filter((m: any) => !m.ok).map((m: any) => m.path).join(', ') : 'All healthy'}
          xs={3}
        />
        <StatCard
          label="plex-debrid"
          value={
            <Chip
              label={data.plex_debrid || '?'}
              size="small"
              color={data.plex_debrid?.includes('running') ? 'success' : 'error'}
              sx={{ fontSize: '0.75rem' }}
            />
          }
          sub={data.last_cycle ? `Last cycle: ${data.last_cycle.slice(0, 60)}...` : undefined}
          xs={3}
        />
        <StatCard
          label="Updated"
          value={data.updated_at ? new Date(data.updated_at).toLocaleTimeString() : '—'}
          xs={3}
        />
      </Box>

      {/* d3 Flow */}
      <PipelineFlow services={services} transfers={transfers.length} />

      {/* Active transfers */}
      {transfers.length > 0 && (
        <>
          <SectionHeader title="Active Transfers" count={transfers.length} />
          {transfers.map((t: any, i: number) => (
            <ProgressRow
              key={i}
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
      {services.map((svc: any, i: number) => (
        <Accordion key={i} variant="outlined" disableGutters sx={{ '&:before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 40, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', justifyContent: 'space-between' }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{svc.name}</Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                {svc.premium_until && (
                  <Chip label={`Until ${svc.premium_until}`} size="small" variant="outlined" sx={{ fontSize: '0.65rem' }} />
                )}
                <Chip
                  label={`${svc.active || 0}/${svc.total || 0} active`}
                  size="small"
                  color={svc.active > 0 ? 'primary' : 'default'}
                  sx={{ fontSize: '0.65rem' }}
                />
              </Box>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            {svc.storage_pct != null && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Storage: {svc.storage_pct}% used
              </Typography>
            )}
            {svc.errors?.length > 0 && (
              <Box sx={{ mt: 0.5 }}>
                <Typography variant="caption" color="error">Recent errors:</Typography>
                {svc.errors.map((err: string, j: number) => (
                  <Typography key={j} variant="caption" color="text.secondary" sx={{ display: 'block', ml: 1 }}>
                    {err}
                  </Typography>
                ))}
              </Box>
            )}
            {!svc.storage_pct && !svc.errors?.length && (
              <Typography variant="caption" color="text.secondary">No issues reported</Typography>
            )}
          </AccordionDetails>
        </Accordion>
      ))}
    </Stack>
  )
}
