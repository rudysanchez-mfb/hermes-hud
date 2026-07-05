import {
  Box, Stack, Typography, Chip, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper
} from '@mui/material'
import { BarChart } from '@mui/x-charts/BarChart'
import { usePipeline } from '../../hooks/usePipeline'
import { useTheme as useMuiTheme } from '@mui/material/styles'
import { AlertStrip, StatCard, ProgressRow, SectionHeader } from './shared'

export default function MusicPanel() {
  const { data, error } = usePipeline<any>('/pipeline/music')
  const muiTheme = useMuiTheme()

  if (error) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="error">Music pipeline unavailable: {error.message}</Typography>
      </Box>
    )
  }

  if (!data) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <CircularProgress size={24} />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Loading music pipeline...</Typography>
      </Box>
    )
  }

  const queue = data.lidarr_queue || {}
  const imports = data.recent_imports || []
  const torrents = data.torrents || []
  const nicotine = data.nicotine || {}
  const enricher = data.enricher || {}
  const alerts = data.alerts || []
  const activeTorrents = torrents.filter((t: any) => t.status === 'downloading').length

  return (
    <Stack spacing={1.5}>
      <AlertStrip alerts={alerts} />

      {/* Stat cards */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        <StatCard label="Lidarr Queue" value={queue.active || 0} color={queue.active > 0 ? muiTheme.palette.warning.main : undefined} xs={3} />
        <StatCard label="Wanted Missing" value={data.lidarr_wanted || 0} sub="albums" xs={3} />
        <StatCard label="Active Torrents" value={activeTorrents} color={activeTorrents > 0 ? muiTheme.palette.primary.main : undefined} xs={3} />
        <StatCard
          label="Nicotine+"
          value={
            <Chip
              label={nicotine.running ? 'running' : 'stopped'}
              size="small"
              color={nicotine.running ? 'success' : 'error'}
              sx={{ fontSize: '0.7rem' }}
            />
          }
          sub={nicotine.running ? `${nicotine.recent_files || 0} files (30m)` : undefined}
          xs={3}
        />
      </Box>

      {/* Import history chart */}
      {imports.length > 0 && (
        <Paper variant="outlined" sx={{ p: 1.5 }}>
          <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1, letterSpacing: '0.1em' }}>
            Recent Imports
          </Typography>
          <Box sx={{ overflowX: 'auto' }}>
            <BarChart
              xAxis={[{
                scaleType: 'band',
                data: imports.map((imp: any) => imp.date || ''),
                tickLabelStyle: { fontSize: 10, fill: 'var(--hud-text-dim, #6a7490)' },
              }]}
              series={[{
                data: imports.map((_: any, i: number) => imports.length - i),
                color: muiTheme.palette.primary.main,
              }]}
              height={160}
              margin={{ top: 8, bottom: 30, left: 30, right: 8 }}
              slotProps={{}}
              sx={{ '& .MuiChartsAxis-tickLabel': { fill: 'var(--hud-text-dim, #6a7490) !important' } }}
            />
          </Box>
          {/* Import table */}
          <TableContainer sx={{ mt: 1 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontSize: '0.75rem' }}>Date</TableCell>
                  <TableCell sx={{ fontSize: '0.75rem' }}>Artist</TableCell>
                  <TableCell sx={{ fontSize: '0.75rem' }}>Title</TableCell>
                  <TableCell sx={{ fontSize: '0.75rem' }}>Quality</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {imports.slice(0, 8).map((imp: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell sx={{ fontSize: '0.75rem' }}>{imp.date}</TableCell>
                    <TableCell sx={{ fontSize: '0.75rem' }}>{imp.artist}</TableCell>
                    <TableCell sx={{ fontSize: '0.75rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{imp.title}</TableCell>
                    <TableCell sx={{ fontSize: '0.75rem' }}>{imp.quality}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Lidarr queue */}
      {queue.items?.length > 0 && (
        <>
          <SectionHeader title="Lidarr Downloads" count={queue.items.length} />
          {queue.items.slice(0, 10).map((item: any, i: number) => (
            <ProgressRow
              key={i}
              name={`${item.artist} — ${item.title}`}
              pct={item.status === 'completed' ? 100 : 50}
              size={item.size ? `${(item.size / 1e6).toFixed(0)}MB` : undefined}
              status={item.status}
            />
          ))}
        </>
      )}

      {/* Torrents */}
      {torrents.length > 0 && (
        <>
          <SectionHeader title="Transmission Torrents" count={torrents.length} />
          {torrents.slice(0, 10).map((t: any, i: number) => (
            <ProgressRow
              key={i}
              name={t.name}
              pct={t.progress || 0}
              status={t.status}
            />
          ))}
        </>
      )}

      {/* Enricher status */}
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 0.5, letterSpacing: '0.1em' }}>
          Enricher
        </Typography>
        <Typography variant="body2">
          {enricher.last_run
            ? `Last run: ${new Date(enricher.last_run).toLocaleString()} · ${enricher.enriched || 0} enriched / ${enricher.total_processed || 0} total`
            : 'No recent enricher data'}
        </Typography>
      </Paper>
    </Stack>
  )
}
