import { Typography, Paper } from '@mui/material'

export default function MusicPanel() {
  return (
    <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
      <Typography variant="h6" color="text.secondary">Music Pipeline</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        Lidarr, Transmission, Nicotine+, enricher — live view coming in Phase 5.
      </Typography>
    </Paper>
  )
}
