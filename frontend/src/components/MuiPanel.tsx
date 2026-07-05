import type { ReactNode } from 'react'
import { Box, Typography, Paper } from '@mui/material'

interface PanelProps {
  title: string
  children: ReactNode
  className?: string
  noPadding?: boolean
}

export default function MuiPanel({ title, children, noPadding = false }: PanelProps) {
  return (
    <Paper
      variant="outlined"
      sx={{
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        bgcolor: 'background.paper',
        ...(noPadding ? {} : {}),
      }}
    >
      <Typography
        variant="overline"
        sx={{
          px: 1.5, py: 0.75, letterSpacing: '0.1em', fontWeight: 600,
          borderBottom: 1, borderColor: 'divider',
          color: 'primary.main', textShadow: '0 0 8px var(--hud-primary-glow)',
        }}
      >
        {title}
      </Typography>
      <Box sx={noPadding ? { flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' } : { px: 1.5, py: 1 }}>
        {children}
      </Box>
    </Paper>
  )
}

// ── CapacityBar (kept compatible) ─────────────────────────

export function CapacityBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  const color = pct > 90 ? 'error.main' : pct > 70 ? 'warning.main' : 'success.main'

  return (
    <Box sx={{ mb: 1.5 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', mb: 0.5 }}>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
        <Typography variant="body2">
          <Box component="span" color="primary.main">{value.toLocaleString()}</Box>
          <Box component="span" color="text.secondary">/{max.toLocaleString()} ({pct.toFixed(0)}%)</Box>
        </Typography>
      </Box>
      <Box sx={{ height: 5, bgcolor: 'action.hover', borderRadius: 1, overflow: 'hidden' }}>
        <Box sx={{ height: '100%', width: `${Math.min(pct, 100)}%`, bgcolor: color, borderRadius: 1, transition: 'width 0.3s' }} />
      </Box>
    </Box>
  )
}

// ── Sparkline (kept compatible — pure SVG) ─────────────────

export function Sparkline({ values, width = 100, height = 20 }: { values: number[]; width?: number; height?: number }) {
  if (!values.length) return null
  const max = Math.max(...values, 1)
  const points = values.map((v, i) => {
    const x = (i / Math.max(values.length - 1, 1)) * width
    const y = height - (v / max) * height
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={width} height={height} style={{ display: 'inline-block' }}>
      <polyline
        points={points}
        fill="none"
        stroke="var(--hud-primary)"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
