import {
  Box, Stack, Typography, Chip, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Collapse, IconButton
} from '@mui/material'
import { BarChart } from '@mui/x-charts/BarChart'
import { usePipeline } from '../../hooks/usePipeline'
import { useState } from 'react'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
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
      <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' } }}>
        <StatCard label="Lidarr Queue" value={queue.active || 0} color={queue.active > 0 ? muiTheme.palette.warning.main : undefined} />
        <StatCard label="Wanted Missing" value={data.lidarr_wanted || 0} sub="albums" />
        <StatCard label="Active Torrents" value={activeTorrents} color={activeTorrents > 0 ? muiTheme.palette.primary.main : undefined} />
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
      {enricher.artists?.length > 0 && (
        <Paper variant="outlined" sx={{ p: 1.5 }}>
          <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1, letterSpacing: '0.1em' }}>
            Artist Enricher — {enricher.enriched || 0} enriched, {enricher.with_artwork || 0} w/ artwork, {enricher.no_bio || 0} no bio
            {enricher.last_run && (
              <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                (last: {new Date(enricher.last_run).toLocaleDateString()})
              </Typography>
            )}
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontSize: '0.75rem', width: 32 }} />
                  <TableCell sx={{ fontSize: '0.75rem' }}>Artist</TableCell>
                  <TableCell sx={{ fontSize: '0.75rem' }}>Status</TableCell>
                  <TableCell sx={{ fontSize: '0.75rem' }}>Bio</TableCell>
                  <TableCell sx={{ fontSize: '0.75rem' }}>Artwork</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {enricher.artists.map((a: any, i: number) => (
                  <EnricherRow key={i} artist={a} />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Stack>
  )
}

// ── Collapsible enricher row ──

function EnricherRow({ artist: a }: { artist: any }) {
  const [open, setOpen] = useState(false)
  const isEnriched = a.status === 'enriched'

  return (
    <>
      <TableRow
        onClick={() => setOpen(!open)}
        sx={{
          cursor: 'pointer',
          '&:hover': { bgcolor: 'action.hover' },
          bgcolor: open ? 'action.selected' : undefined,
        }}
      >
        <TableCell sx={{ p: 0.5 }}>
          <IconButton size="small" sx={{ p: 0 }}>
            {open ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
          </IconButton>
        </TableCell>
        <TableCell sx={{ fontSize: '0.8rem', fontWeight: isEnriched ? 500 : 400 }}>
          {a.name}
        </TableCell>
        <TableCell>
          <Chip
            label={isEnriched ? '✓ enriched' : '✗ no bio'}
            size="small"
            color={isEnriched ? 'success' : 'default'}
            sx={{ fontSize: '0.65rem', height: 20 }}
          />
        </TableCell>
        <TableCell sx={{ fontSize: '0.75rem' }}>
          {a.chars ? `${a.chars}c` : '—'}
        </TableCell>
        <TableCell>
          {isEnriched ? (
            a.artwork
              ? <Chip label="✓" size="small" color="primary" sx={{ fontSize: '0.65rem', height: 20, minWidth: 32 }} />
              : <Chip label="—" size="small" variant="outlined" sx={{ fontSize: '0.65rem', height: 20, minWidth: 32 }} />
          ) : '—'}
        </TableCell>
      </TableRow>
      <TableRow sx={{ '& td': { borderBottom: open ? undefined : 'none' } }}>
        <TableCell colSpan={5} sx={{ py: 0, px: 0 }}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ py: 1.5, px: 3, bgcolor: 'action.hover' }}>
              {isEnriched ? (
                <Stack spacing={0.5}>
                  <Typography variant="caption" color="text.secondary">
                    Wikipedia page:{' '}
                    <Typography component="span" variant="caption" sx={{ fontWeight: 500 }}>
                      {a.source || '?'}
                    </Typography>
                  </Typography>
                  {a.description && (
                    <Typography variant="caption" color="text.secondary">
                      Description:{' '}
                      <Typography component="span" variant="caption" sx={{ fontStyle: 'italic' }}>
                        {a.description}
                      </Typography>
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary">
                    Bio length: {a.chars} characters
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Artwork pushed: {a.artwork ? (
                      <Chip label="Yes" size="small" color="success" sx={{ fontSize: '0.6rem', height: 18 }} />
                    ) : (
                      <Chip label="No" size="small" variant="outlined" sx={{ fontSize: '0.6rem', height: 18 }} />
                    )}
                    {!a.artwork && a.reason && (
                      <Typography component="span" variant="caption" sx={{ ml: 1, fontStyle: 'italic' }}>
                        {a.reason}
                      </Typography>
                    )}
                  </Typography>
                </Stack>
              ) : (
                <Typography variant="caption" color="text.secondary">
                  No matching Wikipedia article found for "{a.name}".
                </Typography>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  )
}
