import { Typography, Paper } from '@mui/material'

export default function DebridPanel() {
  return (
    <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
      <Typography variant="h6" color="text.secondary">Debrid Pipeline</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        Real-time monitoring coming in Phase 5 — Premiumize, TorBox, DebridLink, plex-debrid.
      </Typography>
    </Paper>
  )
}
