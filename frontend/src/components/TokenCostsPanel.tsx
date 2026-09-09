import React, { useState, useCallback, useMemo } from 'react'
import type { ReactNode } from 'react'
import { useApi } from '../hooks/useApi'
import MuiPanel from './MuiPanel'
import { formatTokens, formatMoney, formatNumber } from '../lib/utils'
import { useTranslation } from '../i18n'

// ── helpers ──────────────────────────────────────────────────

function StatCard({ value, label, badge }: { value: string | number; label: string; badge?: string }) {
  return (
    <div className="text-center p-2" style={{ background: 'var(--hud-bg-panel)' }}>
      <div className="stat-value text-[18px] flex items-center justify-center gap-1">
        {value}
        {badge && (
          <span
            className="uppercase font-bold"
            style={{
              fontSize: '12px',
              color: 'var(--hud-warning)',
              border: '1px solid var(--hud-warning)',
              borderRadius: '2px',
              padding: '0 3px',
              lineHeight: '1.2',
            }}
          >
            {badge}
          </span>
        )}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

function amount(value: number | null | undefined, currency?: string | null) {
  return formatMoney(value, currency || 'USD')
}

function balanceKind(bp: any): 'usage' | 'credits' | 'balance' | 'scraped' | 'none' {
  if (bp.usage_unit === 'output_tokens' && bp.usage_output_tokens_30d != null) return 'usage'
  if (bp.usage_unit === 'credits' || bp.api_currency === 'credits') return 'credits'
  if (bp.api_balance != null) return 'balance'
  if (bp.scraped_credits != null) return 'scraped'
  return 'none'
}

function scrapedLabel(bp: any) {
  if (bp.scraped_unit === 'currency') return amount(bp.scraped_credits, bp.scraped_currency)
  return `${bp.scraped_credits} ${bp.scraped_unit || 'cr'}`
}

function CreditBar({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0
  const tone = pct >= 90 ? 'var(--hud-warning)' : 'var(--hud-accent)'
  return (
    <div className="w-full h-1.5 mt-1" style={{ background: 'var(--hud-bg-hover)', borderRadius: 2 }}>
      <div style={{ width: `${pct}%`, height: '100%', background: tone, borderRadius: 2 }} />
    </div>
  )
}

function DeltaBadge({ value, pct }: { value: number; pct?: number | null }) {
  const color = value > 0 ? 'var(--hud-warning)' : value < 0 ? 'var(--hud-success)' : 'var(--hud-text-dim)'
  const sign = value > 0 ? '+' : ''
  return (
    <span style={{ color }}>
      {sign}{formatMoney(value)}{pct !== null && pct !== undefined ? ` (${sign}${pct.toFixed(1)}%)` : ''}
    </span>
  )
}

function DetailRow({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span style={{ color: 'var(--hud-text-dim)' }}>{label}</span>
      <span className="text-right" style={{ color: tone || 'inherit' }}>{value}</span>
    </div>
  )
}

function EstBadge() {
  return (
    <span
      className="uppercase font-bold"
      style={{
        fontSize: '12px',
        color: 'var(--hud-warning)',
        border: '1px solid var(--hud-warning)',
        borderRadius: '2px',
        padding: '0 3px',
        lineHeight: '1.2',
        marginLeft: '4px',
      }}
    >
      est
    </span>
  )
}

function ModelCard({ m }: { m: any }) {
  const { t } = useTranslation()
  const isFree = m.matched_pricing?.includes('local') || m.matched_pricing?.includes('free')
  const pricingColor = isFree ? 'var(--hud-success)' : 'var(--hud-accent)'

  return (
    <div className="p-3" style={{ background: 'var(--hud-bg-panel)', border: '1px solid var(--hud-border)' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-bold text-sm" style={{ color: 'var(--hud-primary)' }}>{m.model}</span>
        <span className="text-sm px-1.5 py-0.5" style={{ background: 'var(--hud-bg-hover)', color: pricingColor }}>
          {isFree ? t('tokenCosts.free') : formatMoney(m.billed_cost_usd ?? m.cost)}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-sm mb-2">
        <div><span style={{ color: 'var(--hud-primary)' }}>{m.session_count}</span> <span style={{ color: 'var(--hud-text-dim)' }}>{t('tokenCosts.sess')}</span></div>
        <div><span style={{ color: 'var(--hud-primary)' }}>{m.message_count.toLocaleString()}</span> <span style={{ color: 'var(--hud-text-dim)' }}>{t('tokenCosts.msgs')}</span></div>
        <div><span style={{ color: 'var(--hud-primary)' }}>{formatTokens(m.input_tokens + m.output_tokens)}</span> <span style={{ color: 'var(--hud-text-dim)' }}>{t('tokenCosts.tok')}</span></div>
      </div>
      <div className="text-sm space-y-0.5" style={{ color: 'var(--hud-text-dim)' }}>
        <DetailRow label={t('tokenCosts.input')} value={formatTokens(m.input_tokens)} />
        <DetailRow label={t('tokenCosts.output')} value={formatTokens(m.output_tokens)} />
        {m.cache_read_tokens > 0 && (
          <DetailRow label={t('tokenCosts.cacheRead')} value={formatTokens(m.cache_read_tokens)} />
        )}
        {m.cache_savings_usd > 0 && (
          <DetailRow label={t('tokenCosts.cacheSaved')} value={formatMoney(m.cache_savings_usd)} tone="var(--hud-success)" />
        )}
      </div>
      {!isFree && (
        <div className="mt-2 pt-2 text-sm space-y-0.5" style={{ borderTop: '1px solid var(--hud-border)' }}>
          <DetailRow label={t('tokenCosts.estimated')} value={formatMoney(m.estimated_cost_usd)} />
          <DetailRow label={t('tokenCosts.actual')} value={formatMoney(m.actual_cost_usd)} />
          <DetailRow label={t('tokenCosts.delta')} value={<DeltaBadge value={m.actual_delta_usd || 0} pct={m.actual_delta_pct} />} />
          <div className="font-bold">
            <DetailRow label={t('tokenCosts.billed')} value={formatMoney(m.billed_cost_usd)} tone="var(--hud-accent)" />
          </div>
        </div>
      )}
      {isFree && (
        <div className="mt-2 pt-2 text-sm" style={{ borderTop: '1px solid var(--hud-border)', color: 'var(--hud-success)' }}>
          {t('tokenCosts.localModel')}
        </div>
      )}
      <div className="text-sm mt-1" style={{ color: 'var(--hud-text-dim)' }}>
        {t('tokenCosts.pricing')}: {m.matched_pricing}
      </div>
    </div>
  )
}

// ── Trend chart (sparkline for day, bars for week/month) ─────

const RANGES = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'all', label: 'All' },
] as const

const GROUP_OPTS = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
] as const

function formatRangeLabel(range: any): string {
  if (!range) return ''
  // Sentinel values from API — "all" range has no meaningful date boundaries
  if (range.start === 'all' && range.end === 'now') return 'All time'
  if (range.start === 'all') return ''
  if (range.end === 'now') return ''
  // API returns ISO timestamps after tz fix (2026-07-01T19:39:28.780748+00:00)
  const fmt = (iso: string) => {
    if (!iso) return null
    const d = new Date(iso)
    return isNaN(d.getTime()) ? null : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  const s = fmt(range.start)
  const e = fmt(range.end)
  if (s && e) return `${s} — ${e}`
  if (s) return s
  return ''
}

function TrendChart({ values, groupBy, width = 720, height = 60 }: { values: number[]; groupBy: string; width?: number; height?: number }) {
  if (!values.length) return <div className="text-sm text-center py-4" style={{ color: 'var(--hud-text-dim)' }}>No trend data</div>

  const max = Math.max(...values, 0.001)
  const pad = 8

  if (groupBy === 'day') {
    // Line sparkline
    const points = values.map((v, i) => {
      const x = pad + (i / Math.max(values.length - 1, 1)) * (width - pad * 2)
      const y = height - pad - (v / max) * (height - pad * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')

    return (
      <svg width={width} height={height} style={{ display: 'block', width: '100%' }} viewBox={`0 0 ${width} ${height}`}>
        <polyline points={points} fill="none" stroke="var(--hud-primary)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
    )
  }

  // Bars for week/month
  const barW = Math.max(2, Math.floor((width - pad * 2) / values.length) - 2)
  const barGap = Math.max(1, Math.floor((width - pad * 2 - barW * values.length) / (values.length + 1)))
  return (
    <svg width={width} height={height} style={{ display: 'block', width: '100%' }} viewBox={`0 0 ${width} ${height}`}>
      {values.map((v, i) => {
        const barH = (v / max) * (height - pad * 2)
        const x = pad + barGap + i * (barW + barGap)
        const y = height - pad - barH
        return <rect key={i} x={x.toFixed(1)} y={y.toFixed(1)} width={barW} height={barH.toFixed(1)} fill="var(--hud-primary)" rx="1" />
      })}
    </svg>
  )
}

// ── main component ───────────────────────────────────────────

export default function TokenCostsPanel() {
  const { t } = useTranslation()
  const [range, setRange] = useState<string>('all')
  const [groupBy, setGroupBy] = useState<string>('day')
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null)
  const [showHidden, setShowHidden] = useState(false)

  const { data, isLoading, error } = useApi('/token-costs', 60000, { range, group_by: groupBy })
  const { data: billingData } = useApi('/billing', 60000)
  const [expandedIframe, setExpandedIframe] = useState<string | null>(null)

  const toggleIframe = useCallback((key: string) => {
    setExpandedIframe((prev) => (prev === key ? null : key))
  }, [])

  const toggleProvider = useCallback((key: string) => {
    setExpandedProvider((prev) => (prev === key ? null : key))
  }, [])

  // === HOOKS (must always run — never after a conditional return) ===

  const {
    range: rangeInfo,
    all_time: allTime,
    by_model: byModel = [],
    daily_trend: dailyTrend = [],
    top_sessions: topSessions = [],
    trend_summary: trendSummary = {},
    provider_breakdown: providerBreakdown = [],
  } = data || {}

  const costValues = useMemo(
    () => (dailyTrend || []).map((d: any) => d.billed_cost_usd ?? d.cost ?? 0),
    [dailyTrend]
  )

  // Compute cost breakdown across all models
  const { totalInputCost, totalOutputCost, totalCacheRCost, totalCacheWCost } = useMemo(() => {
    let inputCost = 0, outputCost = 0, cacheRCost = 0, cacheWCost = 0
    for (const m of byModel) {
      const p = data?.pricing_table?.[m.model] || data?.pricing_table?.[m.matched_pricing?.split(' ')[0]]
      if (p) {
        inputCost += (m.input_tokens / 1_000_000) * p.input
        outputCost += (m.output_tokens / 1_000_000) * p.output
        cacheRCost += (m.cache_read_tokens / 1_000_000) * p.cache_read
        cacheWCost += (m.cache_write_tokens / 1_000_000) * p.cache_write
      }
    }
    return { totalInputCost: inputCost, totalOutputCost: outputCost, totalCacheRCost: cacheRCost, totalCacheWCost: cacheWCost }
  }, [byModel, data])

  // Build provider_breakdown → by_model lookup
  const providerModels = useMemo(() => {
    const map: Record<string, any[]> = {}
    for (const pb of providerBreakdown || []) {
      const models = (pb.models || []) as string[]
      map[pb.provider] = byModel.filter((m: any) => models.includes(m.model))
    }
    return map
  }, [providerBreakdown, byModel])

  // Build estimate map for billing panel (from provider_breakdown)
  const providerEstFromBreakdown = useMemo(() => {
    const map: Record<string, any> = {}
    for (const pb of providerBreakdown || []) {
      map[pb.provider] = pb
    }
    return map
  }, [providerBreakdown])

  // Build HUD estimate map from byModel (for billing delta)
  const providerEstFromModels = useMemo(() => {
    const map: Record<string, number> = {}
    for (const m of byModel) {
      const model = (m.model || '').toLowerCase()
      let p = 'other'
      if (model.includes('deepseek')) p = 'deepseek'
      else if (model.includes('claude') || model.includes('anthropic')) p = 'anthropic'
      else if (model.includes('gpt') || model.includes('openai') || model.startsWith('o1') || model.startsWith('o3') || model.startsWith('o4')) p = 'openai'
      else if (model.includes('gemini')) p = 'gemini'
      else if (model.includes('grok') || model.includes('xai')) p = 'xai'
      else if (model.includes('mistral') || model.includes('devstral')) p = 'mistral'
      else if (model.includes('mimo')) p = 'xiaomi'
      else if (model.includes('minimax')) p = 'minimax'
      else if (model.includes('kimi')) p = 'kimi'
      else if (model.includes('glm') || model.includes('zai')) p = 'zai-glm'
      else if (model.includes('qwen')) p = 'other'
      else if (model.includes('llama')) p = 'other'
      map[p] = (map[p] || 0) + (m.billed_cost_usd ?? m.cost ?? 0)
    }
    return map
  }, [byModel])

  // Show estimate badge when actual_coverage_pct is low or absent
  const showEstBadge = !allTime?.actual_coverage_pct || allTime.actual_coverage_pct < 50
  const rangeLabel = formatRangeLabel(rangeInfo)

  // Empty range state
  const isEmpty = !allTime || (allTime.session_count === 0 && allTime.total_tokens === 0)

  // === RENDER GUARDS (after all hooks) ===

  // Loading state
  if (isLoading && !data) {
    return (
      <MuiPanel title={t('tokenCosts.title')} className="col-span-full">
        <div className="glow text-sm animate-pulse">{t('tokenCosts.loading')}</div>
      </MuiPanel>
    )
  }

  // Error state
  if (error && !data) {
    return (
      <MuiPanel title={t('tokenCosts.title')} className="col-span-full">
        <div className="text-sm text-center py-8" style={{ color: 'var(--hud-error)' }}>
          Failed to load cost data{(error as any)?.message ? `: ${(error as any).message}` : ''}
        </div>
      </MuiPanel>
    )
  }

  return (
    <>
      {/* ── Date Range Toolbar ── */}
      <MuiPanel title={t('tokenCosts.title')} className="col-span-full">
        <div className="space-y-3">
          {/* Range presets */}
          <div className="flex flex-wrap gap-1 items-center">
            {RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => setRange(r.value)}
                className="text-sm px-3 py-1"
                style={{
                  background: range === r.value ? 'var(--hud-primary)' : 'transparent',
                  color: range === r.value ? '#000' : 'var(--hud-text-dim)',
                  border: `1px solid ${range === r.value ? 'var(--hud-primary)' : 'var(--hud-border)'}`,
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontWeight: range === r.value ? 600 : 400,
                }}
              >
                {r.label}
              </button>
            ))}
            {rangeLabel && (
              <span className="text-sm ml-2" style={{ color: 'var(--hud-text-dim)' }}>
                {rangeLabel}
              </span>
            )}
          </div>

          {/* Group-by toggle */}
          <div className="flex items-center gap-2">
            <span className="text-sm" style={{ color: 'var(--hud-text-dim)' }}>Group by:</span>
            <div className="inline-flex" style={{ border: '1px solid var(--hud-border)', borderRadius: '3px', overflow: 'hidden' }}>
              {GROUP_OPTS.map((g) => (
                <button
                  key={g.value}
                  onClick={() => setGroupBy(g.value)}
                  className="text-sm px-3 py-1"
                  style={{
                    background: groupBy === g.value ? 'var(--hud-primary)' : 'transparent',
                    color: groupBy === g.value ? '#000' : 'var(--hud-text-dim)',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: groupBy === g.value ? 600 : 400,
                  }}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </MuiPanel>

      {/* ── Empty state ── */}
      {isEmpty && (
        <div className="col-span-full text-center py-12">
          <div className="text-sm" style={{ color: 'var(--hud-text-dim)' }}>
            No usage in this range
          </div>
        </div>
      )}

      {/* ── Summary stat cards ── */}
      {!isEmpty && allTime && (
        <MuiPanel
          title={`${t('tokenCosts.total')} — ${formatMoney(allTime.billed_cost_usd ?? allTime.estimated_cost_usd)}${showEstBadge ? ' (est)' : ''}`}
          className="col-span-full"
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <StatCard
              value={formatMoney(allTime.billed_cost_usd ?? allTime.estimated_cost_usd)}
              label={t('tokenCosts.billed')}
              badge={showEstBadge ? 'est' : undefined}
            />
            <StatCard value={formatNumber(allTime.session_count)} label={t('tokenCosts.sessions')} />
            <StatCard value={formatTokens(allTime.total_tokens)} label={t('tokenCosts.totalTokens')} />
            <StatCard
              value={formatMoney(allTime.cache_savings_usd)}
              label={t('tokenCosts.cacheSaved')}
            />
          </div>

          <div className="text-sm space-y-0.5 mt-2 pt-2" style={{ borderTop: '1px solid var(--hud-border)' }}>
            <DetailRow label={t('tokenCosts.estimated')} value={<>{formatMoney(allTime.estimated_cost_usd)}{showEstBadge && <EstBadge />}</>} />
            <DetailRow label={t('tokenCosts.actual')} value={`${formatMoney(allTime.actual_cost_usd)} · ${allTime.actual_coverage_pct || 0}%`} />
            <DetailRow label={t('tokenCosts.delta')} value={<DeltaBadge value={allTime.actual_delta_usd || 0} pct={allTime.actual_delta_pct} />} />
            <DetailRow label={t('tokenCosts.cacheSaved')} value={formatMoney(allTime.cache_savings_usd)} tone="var(--hud-success)" />
          </div>

          {/* Cost by type */}
          <div className="text-sm space-y-0.5 mt-2 pt-2" style={{ borderTop: '1px solid var(--hud-border)' }}>
            <DetailRow label={t('tokenCosts.inputCost')} value={formatMoney(totalInputCost)} tone="var(--hud-primary)" />
            <DetailRow label={t('tokenCosts.outputCost')} value={formatMoney(totalOutputCost)} tone="var(--hud-accent)" />
            <DetailRow label={t('tokenCosts.cacheRead')} value={formatMoney(totalCacheRCost)} tone="var(--hud-success)" />
            <DetailRow label={t('tokenCosts.cacheWrite')} value={formatMoney(totalCacheWCost)} tone="var(--hud-warning)" />
          </div>

          <div className="mt-3 text-[20px] font-bold text-center" style={{ color: 'var(--hud-accent)' }}>
            {formatMoney(allTime.billed_cost_usd ?? allTime.estimated_cost_usd)}
          </div>
          <div className="text-sm text-center" style={{ color: 'var(--hud-text-dim)' }}>
            {t('tokenCosts.billedAllTime')} ({byModel.length} {t('tokenCosts.models')})
          </div>
        </MuiPanel>
      )}

      {/* ── Trend chart ── */}
      {!isEmpty && dailyTrend.length > 0 && (
        <MuiPanel title={`${t('tokenCosts.trend')} — ${formatMoney(trendSummary.recent_7d_cost_usd)}`} className="col-span-full">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <StatCard value={formatMoney(trendSummary.recent_7d_cost_usd)} label={t('tokenCosts.last7Days')} />
            <StatCard value={formatMoney(trendSummary.previous_7d_cost_usd)} label={t('tokenCosts.prev7Days')} />
          </div>
          <div className="text-sm space-y-1 mb-3">
            <DetailRow label={t('tokenCosts.change')} value={<DeltaBadge value={trendSummary.delta_usd || 0} pct={trendSummary.delta_pct} />} />
          </div>

          {/* Trend SVG */}
          <div className="mb-2">
            <div className="text-sm uppercase tracking-wider mb-1" style={{ color: 'var(--hud-text-dim)' }}>
              Cost ({groupBy})
            </div>
            <TrendChart values={costValues} groupBy={groupBy} />
          </div>

          {/* x-axis labels */}
          <div className="flex justify-between text-xs" style={{ color: 'var(--hud-text-dim)' }}>
            <span>{dailyTrend[0]?.date}</span>
            <span>{dailyTrend[dailyTrend.length - 1]?.date}</span>
          </div>

          {/* Last N buckets detail */}
          <div className="text-sm grid grid-cols-5 gap-1 mt-2">
            {dailyTrend.slice(-10).map((d: any) => (
              <div key={d.date} className="text-center py-1" style={{ background: 'var(--hud-bg-panel)' }}>
                <div style={{ color: 'var(--hud-text-dim)' }}>{d.date.slice(5)}</div>
                <div style={{ color: 'var(--hud-accent)' }}>{formatMoney(d.billed_cost_usd ?? d.cost)}</div>
                <div style={{ fontSize: '12px' }}>{formatTokens(d.tokens)}</div>
              </div>
            ))}
          </div>
        </MuiPanel>
      )}

      {/* ── Provider breakdown ── */}
      {!isEmpty && providerBreakdown.length > 0 && (
        <MuiPanel title={`Providers — ${providerBreakdown.length}`} className="col-span-full">
          <div className="space-y-1">
            {providerBreakdown.map((pb: any) => {
              const isExpanded = expandedProvider === pb.provider
              const models = providerModels[pb.provider] || []

              return (
                <div key={pb.provider}>
                  {/* Summary row */}
                  <div
                    onClick={() => toggleProvider(pb.provider)}
                    className="flex items-center gap-3 p-2 text-sm cursor-pointer"
                    style={{
                      background: isExpanded ? 'var(--hud-bg-hover)' : 'transparent',
                      borderBottom: '1px solid var(--hud-border)',
                    }}
                  >
                    <span style={{
                      fontSize: '12px',
                      color: 'var(--hud-accent)',
                      display: 'inline-block',
                      width: '16px',
                      textAlign: 'center',
                    }}>
                      {isExpanded ? '▼' : '▶'}
                    </span>
                    <span className="font-bold flex-1" style={{ color: 'var(--hud-primary)' }}>
                      {pb.provider}
                    </span>
                    <span className="font-bold" style={{ color: 'var(--hud-accent)' }}>
                      {formatMoney(pb.total_cost)}
                    </span>
                    <span style={{ color: 'var(--hud-text-dim)' }}>
                      {pb.session_count} sess
                    </span>
                    <span style={{ color: 'var(--hud-text-dim)' }}>
                      {formatTokens(pb.total_tokens)} tok
                    </span>
                    <span style={{ color: 'var(--hud-text-dim)' }}>
                      {(pb.models || []).length} model{(pb.models || []).length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Expanded models */}
                  {isExpanded && models.length > 0 && (
                    <div className="p-2" style={{ background: 'var(--hud-bg-panel)', borderBottom: '1px solid var(--hud-border)' }}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {models.map((m: any) => (
                          <ModelCard key={m.model} m={m} />
                        ))}
                      </div>
                    </div>
                  )}
                  {isExpanded && models.length === 0 && (
                    <div className="p-3 text-sm" style={{ color: 'var(--hud-text-dim)', background: 'var(--hud-bg-panel)', borderBottom: '1px solid var(--hud-border)' }}>
                      No models found for this provider in the current range.
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </MuiPanel>
      )}

      {/* ── Real Billing ── */}
      {billingData && (
        <MuiPanel title="Real Billing vs Estimates" className="col-span-full">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ color: 'var(--hud-text-dim)' }}>
                <tr style={{ borderBottom: '1px solid var(--hud-border)' }}>
                  <th className="py-2 pr-3 font-normal text-left">Provider</th>
                  <th className="py-2 pr-3 font-normal text-right">Est (HUD)</th>
                  <th className="py-2 pr-3 font-normal text-right">Actual (Receipts)</th>
                  <th className="py-2 pr-3 font-normal text-right">Balance/API</th>
                  <th className="py-2 font-normal text-right">Δ</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const providers = billingData.providers || {}
                  const rows: any[] = []
                  for (const [key, bp] of Object.entries(providers) as any) {
                    const est = providerEstFromModels[key] || 0
                    const actual = bp.receipt_total_all_time || 0
                    const bal = bp.api_balance
                    const delta = actual - est
                    const iframeUrl = bp.iframe_url || null
                    const iframeBlocked = bp.iframe_blocked || false
                    const kind = balanceKind(bp)
                    const hasData = kind !== 'none'
                    const hasExpand = !!(iframeUrl || hasData)
                    const isHidden = bp.is_hidden === true
                    const hasEstimate = bp.has_estimate_data === true

                    if (isHidden) {
                      rows.push({
                        key, display: bp.display, est, actual, bal, delta,
                        currency: bp.api_currency, iframeUrl, iframeBlocked, kind, hasData, hasExpand,
                        usageTokens: bp.usage_output_tokens_30d,
                        usageByModel: bp.usage_by_model_30d,
                        remainingCredits: bp.remaining_credits,
                        planCredits: bp.plan_credits,
                        usedCredits: bp.used_credits,
                        billingPeriodEnd: bp.billing_period_end,
                        scrapedLabel: bp.scraped_credits != null ? scrapedLabel(bp) : null,
                        scrapedDate: bp.scraped_date,
                        scrapedUrl: bp.scraped_url,
                        isHidden: true,
                        hasEstimate,
                      })
                    } else if (est > 0 || actual > 0 || hasData || iframeUrl) {
                      rows.push({
                        key, display: bp.display, est, actual, bal, delta,
                        currency: bp.api_currency, iframeUrl, iframeBlocked, kind, hasData, hasExpand,
                        usageTokens: bp.usage_output_tokens_30d,
                        usageByModel: bp.usage_by_model_30d,
                        remainingCredits: bp.remaining_credits,
                        planCredits: bp.plan_credits,
                        usedCredits: bp.used_credits,
                        billingPeriodEnd: bp.billing_period_end,
                        scrapedLabel: bp.scraped_credits != null ? scrapedLabel(bp) : null,
                        scrapedDate: bp.scraped_date,
                        scrapedUrl: bp.scraped_url,
                        isHidden: false,
                        hasEstimate,
                      })
                    }
                  }
                  rows.sort((a, b) => (b.actual || b.est) - (a.actual || a.est))

                  const visibleRows = rows.filter((r) => !r.isHidden)
                  const hiddenRows = rows.filter((r) => r.isHidden)

                  const renderRow = (r: any) => {
                    const isExpanded = expandedIframe === r.key

                    return (
                      <React.Fragment key={r.key}>
                        <tr style={{ borderBottom: '1px solid var(--hud-border)' }}>
                          <td className="py-2 pr-3">
                            <span style={{ color: 'var(--hud-primary)', cursor: r.hasExpand ? 'pointer' : 'default' }}
                                  onClick={() => r.hasExpand && toggleIframe(r.key)}>
                              {r.hasExpand && <span className="mr-1" style={{ fontSize: '12px', color: 'var(--hud-accent)' }}>{isExpanded ? '▼' : '▶'}</span>}
                              {r.display || r.key}
                            </span>
                            {r.hasEstimate && <EstBadge />}
                            {r.iframeUrl && !isExpanded && (
                              <a href={r.iframeUrl} target="_blank" rel="noopener noreferrer"
                                 className="ml-1 opacity-30 hover:opacity-100"
                                 style={{ color: 'var(--hud-text-dim)', textDecoration: 'none', fontSize: '12px' }}>↗</a>
                            )}
                          </td>
                          <td className="py-2 pr-3 text-right">
                            {formatMoney(r.est)}
                            {r.hasEstimate && <EstBadge />}
                          </td>
                          <td className="py-2 pr-3 text-right" style={{ color: r.actual > 0 ? 'var(--hud-accent)' : 'var(--hud-text-dim)' }}>{r.actual > 0 ? formatMoney(r.actual) : '—'}</td>
                          <td className="py-2 pr-3 text-right" style={{ color: r.hasData ? 'var(--hud-success)' : 'var(--hud-text-dim)' }}>
                            {r.kind === 'usage'
                              ? <span>{formatTokens(r.usageTokens)} <span style={{ color: 'var(--hud-text-dim)', fontSize: '12px' }}>tok/30d</span></span>
                              : r.kind === 'credits'
                              ? <span>{r.remainingCredits}<span style={{ color: 'var(--hud-text-dim)' }}>/{r.planCredits}</span> <span style={{ color: 'var(--hud-text-dim)', fontSize: '12px' }}>cr</span></span>
                              : r.kind === 'balance'
                              ? amount(r.bal, r.currency)
                              : r.kind === 'scraped'
                              ? <span>{r.scrapedLabel} <span style={{ color: 'var(--hud-text-dim)', fontSize: '12px' }}>scraped</span></span>
                              : '—'}
                          </td>
                          <td className="py-2 text-right">{r.actual > 0 && r.est > 0 ? <DeltaBadge value={r.delta} /> : '—'}</td>
                        </tr>
                        {isExpanded && r.hasExpand && (
                          <tr key={`${r.key}-detail`}>
                            <td colSpan={5} className="p-3" style={{ background: 'var(--hud-bg-panel)', border: '1px solid var(--hud-border)' }}>
                              {/* Estimate data panel for OpenAI/Anthropic */}
                              {r.hasEstimate && (() => {
                                const estData = providerEstFromBreakdown[r.key]
                                return (
                                  <div className="text-sm space-y-1">
                                    <div className="flex justify-between">
                                      <span style={{ color: 'var(--hud-text-dim)' }}>Est. total cost (from token usage × rates)</span>
                                      <span className="font-bold" style={{ color: 'var(--hud-accent)' }}>
                                        {estData ? formatMoney(estData.total_cost) : formatMoney(r.est)}
                                      </span>
                                    </div>
                                    {estData && (
                                      <>
                                        <DetailRow label="Sessions" value={estData.session_count} />
                                        <DetailRow label="Tokens" value={formatTokens(estData.total_tokens)} />
                                        <DetailRow label="Models" value={(estData.models || []).join(', ')} />
                                      </>
                                    )}
                                    <div className="pt-1" style={{ color: 'var(--hud-text-dim)', fontSize: '12px' }}>
                                      Estimated from token usage × published rates — actual billing may differ
                                    </div>
                                    {r.iframeUrl && (
                                      <a href={r.iframeUrl} target="_blank" rel="noopener noreferrer"
                                         className="inline-block mt-1 px-3 py-1.5 text-sm font-bold"
                                         style={{ background: 'var(--hud-accent)', color: '#000', textDecoration: 'none', borderRadius: '3px' }}>
                                        Open {r.display} ↗
                                      </a>
                                    )}
                                  </div>
                                )
                              })()}
                              {!r.hasEstimate && r.kind === 'usage' && (
                                <div className="text-sm space-y-1">
                                  <div className="flex justify-between">
                                    <span style={{ color: 'var(--hud-text-dim)' }}>Output tokens (30d)</span>
                                    <span className="font-bold" style={{ color: 'var(--hud-accent)' }}>{(r.usageTokens || 0).toLocaleString()}</span>
                                  </div>
                                  {r.usageByModel && (
                                    <div className="mt-2 pt-2 space-y-0.5" style={{ borderTop: '1px solid var(--hud-border)' }}>
                                      <div className="uppercase tracking-wider mb-1" style={{ color: 'var(--hud-text-dim)', fontSize: '12px' }}>By model</div>
                                      {Object.entries(r.usageByModel).slice(0, 8).map(([model, tok]: any) => (
                                        <DetailRow key={model} label={model} value={<span style={{ color: 'var(--hud-primary)' }}>{formatTokens(tok)}</span>} />
                                      ))}
                                    </div>
                                  )}
                                  <div className="pt-1" style={{ color: 'var(--hud-text-dim)' }}>Usage-billed · pulled from Cloud Monitoring {r.iframeUrl && (<>· <a href={r.iframeUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--hud-accent)' }}>billing console ↗</a></>)}</div>
                                </div>
                              )}
                              {!r.hasEstimate && r.kind === 'credits' && (
                                <div className="text-sm space-y-1">
                                  <div className="flex justify-between">
                                    <span style={{ color: 'var(--hud-text-dim)' }}>Credits used</span>
                                    <span className="font-bold" style={{ color: 'var(--hud-accent)' }}>{r.usedCredits} / {r.planCredits}</span>
                                  </div>
                                  <CreditBar used={r.usedCredits || 0} total={r.planCredits || 0} />
                                  <div className="flex justify-between pt-1">
                                    <span style={{ color: 'var(--hud-text-dim)' }}>Remaining</span>
                                    <span style={{ color: 'var(--hud-success)' }}>{r.remainingCredits} credits</span>
                                  </div>
                                  {r.billingPeriodEnd && <DetailRow label="Period ends" value={r.billingPeriodEnd.slice(0, 10)} />}
                                  <div className="pt-1" style={{ color: 'var(--hud-text-dim)' }}>Pulled from {r.display} API {r.iframeUrl && (<>· <a href={r.iframeUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--hud-accent)' }}>open console ↗</a></>)}</div>
                                </div>
                              )}
                              {!r.hasEstimate && r.kind === 'balance' && (
                                <div className="text-sm space-y-1">
                                  <div className="flex justify-between">
                                    <span style={{ color: 'var(--hud-text-dim)' }}>API balance</span>
                                    <span className="font-bold" style={{ color: 'var(--hud-accent)' }}>{amount(r.bal, r.currency)}</span>
                                  </div>
                                  <div style={{ color: 'var(--hud-text-dim)' }}>Pulled from {r.display} API {r.iframeUrl && (<>· <a href={r.iframeUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--hud-accent)' }}>open console ↗</a></>)}</div>
                                </div>
                              )}
                              {!r.hasEstimate && r.kind === 'scraped' && (
                                <div className="text-sm space-y-1">
                                  <div className="flex justify-between">
                                    <span style={{ color: 'var(--hud-text-dim)' }}>Scraped from console</span>
                                    <span className="font-bold" style={{ color: 'var(--hud-accent)' }}>{r.scrapedLabel}</span>
                                  </div>
                                  {r.scrapedDate && <DetailRow label="Scraped at" value={r.scrapedDate.slice(0, 19).replace('T', ' ')} />}
                                  <div style={{ color: 'var(--hud-text-dim)' }}>Read from {r.display}'s web dashboard via Playwright {(r.scrapedUrl || r.iframeUrl) && (<>· <a href={r.scrapedUrl || r.iframeUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--hud-accent)' }}>open console ↗</a></>)}</div>
                                </div>
                              )}
                              {!r.hasEstimate && r.kind === 'none' && r.iframeUrl && !r.iframeBlocked && (
                                <iframe
                                  src={r.iframeUrl}
                                  style={{ width: '100%', height: '420px', border: 'none' }}
                                  title={`${r.display} console`}
                                />
                              )}
                              {!r.hasEstimate && r.kind === 'none' && r.iframeUrl && r.iframeBlocked && (
                                <div className="flex items-center justify-between gap-4">
                                  <div className="text-sm" style={{ color: 'var(--hud-text-dim)' }}>Google Sign-In blocks embedding — {r.display}'s console uses Google OAuth</div>
                                  <a href={r.iframeUrl} target="_blank" rel="noopener noreferrer"
                                     className="px-3 py-1.5 text-sm font-bold whitespace-nowrap"
                                     style={{ background: 'var(--hud-accent)', color: '#000', textDecoration: 'none', borderRadius: '3px' }}>
                                    Open {r.display} ↗
                                  </a>
                                </div>
                              )}
                              {!r.hasEstimate && r.kind === 'none' && !r.iframeUrl && (
                                <div className="text-sm" style={{ color: 'var(--hud-text-dim)' }}>No API or console URL for {r.display} yet</div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  }

                  return (
                    <>
                      {visibleRows.map(renderRow)}

                      {/* Hidden providers section */}
                      {hiddenRows.length > 0 && (
                        <React.Fragment key="hidden-section">
                          <tr style={{ borderBottom: '1px solid var(--hud-border)' }}>
                            <td colSpan={5} className="py-2">
                              <span
                                onClick={() => setShowHidden(!showHidden)}
                                className="text-sm cursor-pointer"
                                style={{ color: 'var(--hud-text-dim)' }}
                              >
                                {showHidden ? '▼' : '▶'} Other providers ({hiddenRows.length})
                              </span>
                            </td>
                          </tr>
                          {showHidden && hiddenRows.map((r) => (
                            <tr key={`hidden-${r.key}`} style={{ borderBottom: '1px solid var(--hud-border)' }}>
                              <td className="py-1 pr-3 pl-6" style={{ color: 'var(--hud-text-dim)' }}>{r.display || r.key}</td>
                              <td className="py-1 pr-3 text-right" style={{ color: 'var(--hud-text-dim)', fontSize: '12px' }}>no usage data</td>
                              <td colSpan={3}></td>
                            </tr>
                          ))}
                        </React.Fragment>
                      )}
                    </>
                  )
                })()}
              </tbody>
            </table>
          </div>
          {billingData.providers_with_data !== undefined && (
            <div className="mt-3 pt-2 text-sm space-y-1" style={{ borderTop: '1px solid var(--hud-border)', color: 'var(--hud-text-dim)' }}>
              <div>{billingData.providers_with_data}/{billingData.total_providers} providers with billing data ·
              Last scan: {billingData.updated_at?.slice(0, 19) || 'unknown'}</div>
              <div>▶ expand for details · balances/credits/usage pulled server-side · console-only providers link out</div>
            </div>
          )}
        </MuiPanel>
      )}

      {/* ── Top sessions ── */}
      {!isEmpty && topSessions.length > 0 && (
        <MuiPanel title={t('tokenCosts.topSessions')} className="col-span-full">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ color: 'var(--hud-text-dim)' }}>
                <tr className="text-left" style={{ borderBottom: '1px solid var(--hud-border)' }}>
                  <th className="py-2 pr-3 font-normal">{t('tokenCosts.session')}</th>
                  <th className="py-2 pr-3 font-normal">{t('tokenCosts.model')}</th>
                  <th className="py-2 pr-3 font-normal text-right">{t('tokenCosts.tokens')}</th>
                  <th className="py-2 pr-3 font-normal text-right">{t('tokenCosts.estimated')}</th>
                  <th className="py-2 pr-3 font-normal text-right">{t('tokenCosts.actual')}</th>
                  <th className="py-2 font-normal text-right">{t('tokenCosts.billed')}</th>
                </tr>
              </thead>
              <tbody>
                {topSessions.map((s: any) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--hud-border)' }}>
                    <td className="py-2 pr-3 max-w-[260px]">
                      <div className="truncate" style={{ color: 'var(--hud-primary)' }}>{s.title || s.id}</div>
                      <div style={{ color: 'var(--hud-text-dim)' }}>{s.date} · {s.source}</div>
                    </td>
                    <td className="py-2 pr-3">{s.model}</td>
                    <td className="py-2 pr-3 text-right">{formatTokens(s.total_tokens)}</td>
                    <td className="py-2 pr-3 text-right">{formatMoney(s.estimated_cost_usd)}</td>
                    <td className="py-2 pr-3 text-right">{s.actual_cost_usd > 0 ? formatMoney(s.actual_cost_usd) : '—'}</td>
                    <td className="py-2 text-right font-bold" style={{ color: 'var(--hud-accent)' }}>{formatMoney(s.billed_cost_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </MuiPanel>
      )}
    </>
  )
}
