import {
  Box, Paper, Typography, Stack, Alert, LinearProgress, Chip
} from '@mui/material'
import type { ReactNode } from 'react'

// ── Alert strip ───────────────────────────────────────────

export function AlertStrip({ alerts }: { alerts: { severity: string; label: string }[] }) {
  if (!alerts || alerts.length === 0) return null
  return (
    <Stack spacing={0.5} sx={{ mb: 1.5 }}>
      {alerts.map((a, i) => (
        <Alert
          key={i}
          severity={a.severity === 'critical' ? 'error' : a.severity === 'warning' ? 'warning' : 'info'}
          variant="outlined"
          sx={{ py: 0, fontSize: '0.85rem' }}
        >
          {a.label}
        </Alert>
      ))}
    </Stack>
  )
}

// ── Stat card ─────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: ReactNode
  sub?: ReactNode
  color?: string
  icon?: ReactNode
  xs?: number
}

export function StatCard({ label, value, sub, color, icon, xs }: StatCardProps) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5,
        flex: xs ? `0 0 ${(xs / 12) * 100}%` : 1, minWidth: 0,
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        {icon} {label}
      </Typography>
      <Typography variant="h6" sx={{ fontWeight: 700, color: color || 'text.primary', lineHeight: 1.2 }}>
        {value}
      </Typography>
      {sub && (
        <Typography variant="caption" color="text.secondary">
          {sub}
        </Typography>
      )}
    </Paper>
  )
}

// ── Progress row ──────────────────────────────────────────

interface ProgressRowProps {
  name: string
  service?: string
  pct: number
  speed?: string
  size?: string
  status?: string
}

export function ProgressRow({ name, service, pct, speed, size, status }: ProgressRowProps) {
  return (
    <Paper variant="outlined" sx={{ p: 1, mb: 0.5 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, mr: 1 }}>
          {name}
        </Typography>
        {service && <Chip label={service} size="small" sx={{ fontSize: '0.65rem', height: 20 }} />}
      </Box>
      <LinearProgress
        variant="determinate"
        value={Math.min(pct, 100)}
        sx={{ height: 4, borderRadius: 2, mb: 0.5 }}
      />
      <Box sx={{ display: 'flex', gap: 1.5 }}>
        <Typography variant="caption" color="text.secondary">{pct.toFixed(1)}%</Typography>
        {speed && <Typography variant="caption" color="text.secondary">{speed}</Typography>}
        {size && <Typography variant="caption" color="text.secondary">{size}</Typography>}
        {status && <Typography variant="caption" color="text.secondary">{status}</Typography>}
      </Box>
    </Paper>
  )
}

// ── Section header ────────────────────────────────────────

interface SectionHeaderProps {
  title: string
  count?: number
}

export function SectionHeader({ title, count }: SectionHeaderProps) {
  return (
    <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mt: 2, mb: 1, letterSpacing: '0.1em' }}>
      {title}{count !== undefined ? ` (${count})` : ''}
    </Typography>
  )
}
