import React, { useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { useApi } from '../hooks/useApi'
import Panel, { Sparkline } from './Panel'
import { formatTokens } from '../lib/utils'
import { useTranslation } from '../i18n'

function StatCard({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="text-center p-2" style={{ background: 'var(--hud-bg-panel)' }}>
      <div className="stat-value text-[18px]">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

function money(value: number | null | undefined) {
  return `$${(value || 0).toFixed(2)}`
}

// Currency-aware amount (handles USD, CNY, and non-monetary units).
function amount(value: number | null | undefined, currency?: string | null) {
  const v = value || 0
  if (currency === 'CNY') return `¥${v.toFixed(2)}`
  if (!currency || currency === 'USD') return `$${v.toFixed(2)}`
  return `${v.toFixed(2)} ${currency}`
}

// Classify what kind of "balance/usage" number a provider exposes.
function balanceKind(bp: any): 'usage' | 'credits' | 'balance' | 'scraped' | 'none' {
  if (bp.usage_unit === 'output_tokens' && bp.usage_output_tokens_30d != null) return 'usage'
  if (bp.usage_unit === 'credits' || bp.api_currency === 'credits') return 'credits'
  if (bp.api_balance != null) return 'balance'
  if (bp.scraped_credits != null) return 'scraped'
  return 'none'
}

// Render a scraped figure (currency or credits/tokens) as a short string.
function scrapedLabel(bp: any) {
  if (bp.scraped_unit === 'currency') return amount(bp.scraped_credits, bp.scraped_currency)
  return `${bp.scraped_credits} ${bp.scraped_unit || 'cr'}`
}

// A slim used/total bar for credit-based providers.
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
      {sign}{money(value)}{pct !== null && pct !== undefined ? ` (${sign}${pct.toFixed(1)}%)` : ''}
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

function ModelCard({ m }: { m: any }) {
  const { t } = useTranslation()
  const isFree = m.matched_pricing?.includes('local') || m.matched_pricing?.includes('free')
  const pricingColor = isFree ? 'var(--hud-success)' : 'var(--hud-accent)'

  return (
    <div className="p-3" style={{ background: 'var(--hud-bg-panel)', border: '1px solid var(--hud-border)' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-bold text-[13px]" style={{ color: 'var(--hud-primary)' }}>{m.model}</span>
        <span className="text-[13px] px-1.5 py-0.5" style={{ background: 'var(--hud-bg-hover)', color: pricingColor }}>
          {isFree ? t('tokenCosts.free') : money(m.billed_cost_usd ?? m.cost)}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-[13px] mb-2">
        <div><span style={{ color: 'var(--hud-primary)' }}>{m.session_count}</span> <span style={{ color: 'var(--hud-text-dim)' }}>{t('tokenCosts.sess')}</span></div>
        <div><span style={{ color: 'var(--hud-primary)' }}>{m.message_count.toLocaleString()}</span> <span style={{ color: 'var(--hud-text-dim)' }}>{t('tokenCosts.msgs')}</span></div>
        <div><span style={{ color: 'var(--hud-primary)' }}>{formatTokens(m.input_tokens + m.output_tokens)}</span> <span style={{ color: 'var(--hud-text-dim)' }}>{t('tokenCosts.tok')}</span></div>
      </div>
      <div className="text-[13px] space-y-0.5" style={{ color: 'var(--hud-text-dim)' }}>
        <DetailRow label={t('tokenCosts.input')} value={formatTokens(m.input_tokens)} />
        <DetailRow label={t('tokenCosts.output')} value={formatTokens(m.output_tokens)} />
        {m.cache_read_tokens > 0 && (
          <DetailRow label={t('tokenCosts.cacheRead')} value={formatTokens(m.cache_read_tokens)} />
        )}
        {m.cache_savings_usd > 0 && (
          <DetailRow label={t('tokenCosts.cacheSaved')} value={money(m.cache_savings_usd)} tone="var(--hud-success)" />
        )}
      </div>
      {!isFree && (
        <div className="mt-2 pt-2 text-[13px] space-y-0.5" style={{ borderTop: '1px solid var(--hud-border)' }}>
          <DetailRow label={t('tokenCosts.estimated')} value={money(m.estimated_cost_usd)} />
          <DetailRow label={t('tokenCosts.actual')} value={money(m.actual_cost_usd)} />
          <DetailRow label={t('tokenCosts.delta')} value={<DeltaBadge value={m.actual_delta_usd || 0} pct={m.actual_delta_pct} />} />
          <div className="font-bold">
            <DetailRow label={t('tokenCosts.billed')} value={money(m.billed_cost_usd)} tone="var(--hud-accent)" />
          </div>
        </div>
      )}
      {isFree && (
        <div className="mt-2 pt-2 text-[13px]" style={{ borderTop: '1px solid var(--hud-border)', color: 'var(--hud-success)' }}>
          {t('tokenCosts.localModel')}
        </div>
      )}
      <div className="text-[13px] mt-1" style={{ color: 'var(--hud-text-dim)' }}>
        {t('tokenCosts.pricing')}: {m.matched_pricing}
      </div>
    </div>
  )
}

export default function TokenCostsPanel() {
  const { t } = useTranslation()
  const { data, isLoading } = useApi('/token-costs', 60000)
  const { data: billingData } = useApi('/billing', 60000)
  const [expandedIframe, setExpandedIframe] = useState<string | null>(null)

  const toggleIframe = useCallback((key: string) => {
    setExpandedIframe((prev) => (prev === key ? null : key))
  }, [])

  // Only show loading on initial load
  if (isLoading && !data) {
    return <Panel title={t('tokenCosts.title')} className="col-span-full"><div className="glow text-[13px] animate-pulse">{t('tokenCosts.loading')}</div></Panel>
  }

  const {
    today,
    all_time: allTime,
    by_model: byModel,
    daily_trend: dailyTrend,
    top_sessions: topSessions = [],
    trend_summary: trendSummary = {},
  } = data
  const costValues = dailyTrend.map((d: any) => d.billed_cost_usd ?? d.cost)

  // Compute cost breakdown across all models
  let totalInputCost = 0, totalOutputCost = 0, totalCacheRCost = 0, totalCacheWCost = 0
  for (const m of byModel) {
    const p = data.pricing_table?.[m.model] || data.pricing_table?.[m.matched_pricing?.split(' ')[0]]
    if (p) {
      totalInputCost += (m.input_tokens / 1_000_000) * p.input
      totalOutputCost += (m.output_tokens / 1_000_000) * p.output
      totalCacheRCost += (m.cache_read_tokens / 1_000_000) * p.cache_read
      totalCacheWCost += (m.cache_write_tokens / 1_000_000) * p.cache_write
    }
  }

  return (
    <>
      {/* Real Billing — actual receipts + API balances vs estimates */}
      {billingData && (
        <Panel title="Real Billing vs Estimates" className="col-span-full">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
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
                  // Map HUD model estimates → billing providers
                  const providerEst: Record<string, number> = {}
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
                    providerEst[p] = (providerEst[p] || 0) + (m.billed_cost_usd ?? m.cost ?? 0)
                  }

                  const providers = billingData.providers || {}
                  const rows: any[] = []
                  for (const [key, bp] of Object.entries(providers) as any) {
                    const est = providerEst[key] || 0
                    const actual = bp.receipt_total_all_time || 0
                    const bal = bp.api_balance
                    const delta = actual - est
                    const iframeUrl = bp.iframe_url || null
                    const kind = balanceKind(bp)
                    const hasData = kind !== 'none'
                    const hasExpand = !!(iframeUrl || hasData)
                    if (est > 0 || actual > 0 || hasData || iframeUrl) {
                      rows.push({
                        key, display: bp.display, est, actual, bal, delta,
                        currency: bp.api_currency, iframeUrl, kind, hasData, hasExpand,
                        usageTokens: bp.usage_output_tokens_30d,
                        usageByModel: bp.usage_by_model_30d,
                        remainingCredits: bp.remaining_credits,
                        planCredits: bp.plan_credits,
                        usedCredits: bp.used_credits,
                        billingPeriodEnd: bp.billing_period_end,
                        scrapedLabel: bp.scraped_credits != null ? scrapedLabel(bp) : null,
                        scrapedDate: bp.scraped_date,
                        scrapedUrl: bp.scraped_url,
                      })
                    }
                  }
                  rows.sort((a, b) => (b.actual || b.est) - (a.actual || a.est))

                  return rows.map((r) => {
                    const isExpanded = expandedIframe === r.key

                  return (
                    <React.Fragment key={r.key}>
                      <tr style={{ borderBottom: '1px solid var(--hud-border)' }}>
                        <td className="py-2 pr-3">
                          <span style={{ color: 'var(--hud-primary)', cursor: r.hasExpand ? 'pointer' : 'default' }}
                                onClick={() => r.hasExpand && toggleIframe(r.key)}>
                            {r.hasExpand && <span className="mr-1" style={{ fontSize: '10px', color: 'var(--hud-accent)' }}>{isExpanded ? '▼' : '▶'}</span>}
                            {r.display || r.key}
                          </span>
                          {r.iframeUrl && !isExpanded && (
                            <a href={r.iframeUrl} target="_blank" rel="noopener noreferrer"
                               className="ml-1 opacity-30 hover:opacity-100"
                               style={{ color: 'var(--hud-text-dim)', textDecoration: 'none', fontSize: '9px' }}>↗</a>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-right">{money(r.est)}</td>
                        <td className="py-2 pr-3 text-right" style={{ color: r.actual > 0 ? 'var(--hud-accent)' : 'var(--hud-text-dim)' }}>{r.actual > 0 ? money(r.actual) : '—'}</td>
                        <td className="py-2 pr-3 text-right" style={{ color: r.hasData ? 'var(--hud-success)' : 'var(--hud-text-dim)' }}>
                          {r.kind === 'usage'
                            ? <span>{formatTokens(r.usageTokens)} <span style={{ color: 'var(--hud-text-dim)', fontSize: '11px' }}>tok/30d</span></span>
                            : r.kind === 'credits'
                            ? <span>{r.remainingCredits}<span style={{ color: 'var(--hud-text-dim)' }}>/{r.planCredits}</span> <span style={{ color: 'var(--hud-text-dim)', fontSize: '11px' }}>cr</span></span>
                            : r.kind === 'balance'
                            ? amount(r.bal, r.currency)
                            : r.kind === 'scraped'
                            ? <span>{r.scrapedLabel} <span style={{ color: 'var(--hud-text-dim)', fontSize: '11px' }}>scraped</span></span>
                            : '—'}
                        </td>
                        <td className="py-2 text-right">{r.actual > 0 && r.est > 0 ? <DeltaBadge value={r.delta} /> : '—'}</td>
                      </tr>
                      {isExpanded && r.hasExpand && (
                        <tr key={`${r.key}-detail`}>
                          <td colSpan={5} className="p-3" style={{ background: 'var(--hud-bg-panel)', border: '1px solid var(--hud-border)' }}>
                            {r.kind === 'usage' && (
                              <div className="text-[13px] space-y-1">
                                <div className="flex justify-between">
                                  <span style={{ color: 'var(--hud-text-dim)' }}>Output tokens (30d)</span>
                                  <span className="font-bold" style={{ color: 'var(--hud-accent)' }}>{(r.usageTokens || 0).toLocaleString()}</span>
                                </div>
                                {r.usageByModel && (
                                  <div className="mt-2 pt-2 space-y-0.5" style={{ borderTop: '1px solid var(--hud-border)' }}>
                                    <div className="uppercase tracking-wider mb-1" style={{ color: 'var(--hud-text-dim)', fontSize: '11px' }}>By model</div>
                                    {Object.entries(r.usageByModel).slice(0, 8).map(([model, tok]: any) => (
                                      <DetailRow key={model} label={model} value={<span style={{ color: 'var(--hud-primary)' }}>{formatTokens(tok)}</span>} />
                                    ))}
                                  </div>
                                )}
                                <div className="pt-1" style={{ color: 'var(--hud-text-dim)' }}>Usage-billed · pulled from Cloud Monitoring {r.iframeUrl && (<>· <a href={r.iframeUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--hud-accent)' }}>billing console ↗</a></>)}</div>
                              </div>
                            )}
                            {r.kind === 'credits' && (
                              <div className="text-[13px] space-y-1">
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
                            {r.kind === 'balance' && (
                              <div className="text-[13px] space-y-1">
                                <div className="flex justify-between">
                                  <span style={{ color: 'var(--hud-text-dim)' }}>API balance</span>
                                  <span className="font-bold" style={{ color: 'var(--hud-accent)' }}>{amount(r.bal, r.currency)}</span>
                                </div>
                                <div style={{ color: 'var(--hud-text-dim)' }}>Pulled from {r.display} API {r.iframeUrl && (<>· <a href={r.iframeUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--hud-accent)' }}>open console ↗</a></>)}</div>
                              </div>
                            )}
                            {r.kind === 'scraped' && (
                              <div className="text-[13px] space-y-1">
                                <div className="flex justify-between">
                                  <span style={{ color: 'var(--hud-text-dim)' }}>Scraped from console</span>
                                  <span className="font-bold" style={{ color: 'var(--hud-accent)' }}>{r.scrapedLabel}</span>
                                </div>
                                {r.scrapedDate && <DetailRow label="Scraped at" value={r.scrapedDate.slice(0, 19).replace('T', ' ')} />}
                                <div style={{ color: 'var(--hud-text-dim)' }}>Read from {r.display}'s web dashboard via Playwright {(r.scrapedUrl || r.iframeUrl) && (<>· <a href={r.scrapedUrl || r.iframeUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--hud-accent)' }}>open console ↗</a></>)}</div>
                              </div>
                            )}
                            {r.kind === 'none' && r.iframeUrl && (
                              <div className="flex items-center justify-between gap-4">
                                <div className="text-[13px]" style={{ color: 'var(--hud-text-dim)' }}>No API for {r.display} yet — usage lives in the web console (scraper pending).</div>
                                <a href={r.iframeUrl} target="_blank" rel="noopener noreferrer"
                                   className="px-3 py-1.5 text-[13px] font-bold whitespace-nowrap"
                                   style={{ background: 'var(--hud-accent)', color: '#000', textDecoration: 'none', borderRadius: '3px' }}>
                                  Open {r.display} ↗
                                </a>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )})
                })()}
              </tbody>
            </table>
          </div>
          {billingData.summary && (
            <div className="mt-3 pt-2 text-[13px] space-y-1" style={{ borderTop: '1px solid var(--hud-border)', color: 'var(--hud-text-dim)' }}>
              <div>{billingData.providers_with_data}/{billingData.total_providers} providers with billing data ·
              Last scan: {billingData.updated_at?.slice(0, 19) || 'unknown'}</div>
              <div>▶ expand for details · balances/credits/usage pulled server-side · console-only providers link out (scrapers pending)</div>
            </div>
          )}
        </Panel>
      )}

      {/* Today */}
      <Panel title={`${t('tokenCosts.today')} — ${money(today.billed_cost_usd ?? today.estimated_cost_usd)}`}>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <StatCard value={today.session_count} label={t('tokenCosts.sessions')} />
          <StatCard value={today.message_count} label={t('tokenCosts.messages')} />
        </div>
        <div className="text-[13px] space-y-1">
          <DetailRow label={t('tokenCosts.input')} value={formatTokens(today.input_tokens)} />
          <DetailRow label={t('tokenCosts.output')} value={formatTokens(today.output_tokens)} />
          <DetailRow label={t('tokenCosts.cacheRead')} value={formatTokens(today.cache_read_tokens)} />
          <div className="font-bold pt-1" style={{ borderTop: '1px solid var(--hud-border)' }}>
            <DetailRow label={t('tokenCosts.total')} value={formatTokens(today.total_tokens)} />
          </div>
        </div>
        <div className="mt-3 text-[20px] font-bold text-center" style={{ color: 'var(--hud-accent)' }}>
          {money(today.billed_cost_usd ?? today.estimated_cost_usd)}
        </div>
        <div className="text-[13px] text-center" style={{ color: 'var(--hud-text-dim)' }}>{t('tokenCosts.billedToday')}</div>
      </Panel>

      {/* All time */}
      <Panel title={`${t('tokenCosts.total')} — ${money(allTime.billed_cost_usd ?? allTime.estimated_cost_usd)}`}>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <StatCard value={allTime.session_count} label={t('tokenCosts.sessions')} />
          <StatCard value={(allTime.message_count || 0).toLocaleString()} label={t('tokenCosts.messages')} />
          <StatCard value={formatTokens(allTime.total_tokens)} label={t('tokenCosts.totalTokens')} />
          <StatCard value={(allTime.tool_call_count || 0).toLocaleString()} label={t('tokenCosts.toolCalls')} />
        </div>

        <div className="text-[13px] space-y-0.5 mt-2 pt-2" style={{ borderTop: '1px solid var(--hud-border)' }}>
          <DetailRow label={t('tokenCosts.estimated')} value={money(allTime.estimated_cost_usd)} />
          <DetailRow label={t('tokenCosts.actual')} value={`${money(allTime.actual_cost_usd)} · ${allTime.actual_coverage_pct || 0}%`} />
          <DetailRow label={t('tokenCosts.delta')} value={<DeltaBadge value={allTime.actual_delta_usd || 0} pct={allTime.actual_delta_pct} />} />
          <DetailRow label={t('tokenCosts.cacheSaved')} value={money(allTime.cache_savings_usd)} tone="var(--hud-success)" />
        </div>

        {/* Cost by type */}
        <div className="text-[13px] space-y-0.5 mt-2 pt-2" style={{ borderTop: '1px solid var(--hud-border)' }}>
          <DetailRow label={t('tokenCosts.inputCost')} value={money(totalInputCost)} tone="var(--hud-primary)" />
          <DetailRow label={t('tokenCosts.outputCost')} value={money(totalOutputCost)} tone="var(--hud-accent)" />
          <DetailRow label={t('tokenCosts.cacheRead')} value={money(totalCacheRCost)} tone="var(--hud-success)" />
          <DetailRow label={t('tokenCosts.cacheWrite')} value={money(totalCacheWCost)} tone="var(--hud-warning)" />
        </div>

        <div className="mt-3 text-[20px] font-bold text-center" style={{ color: 'var(--hud-accent)' }}>
          {money(allTime.billed_cost_usd ?? allTime.estimated_cost_usd)}
        </div>
        <div className="text-[13px] text-center" style={{ color: 'var(--hud-text-dim)' }}>
          {t('tokenCosts.billedAllTime')} ({byModel.length} {t('tokenCosts.models')})
        </div>
      </Panel>

      {/* Trend summary */}
      <Panel title={t('tokenCosts.trend')}>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <StatCard value={money(trendSummary.recent_7d_cost_usd)} label={t('tokenCosts.last7Days')} />
          <StatCard value={money(trendSummary.previous_7d_cost_usd)} label={t('tokenCosts.prev7Days')} />
        </div>
        <div className="text-[13px] space-y-1">
          <DetailRow label={t('tokenCosts.change')} value={<DeltaBadge value={trendSummary.delta_usd || 0} pct={trendSummary.delta_pct} />} />
          <DetailRow label={t('tokenCosts.cacheSaved')} value={money(allTime.cache_savings_usd)} tone="var(--hud-success)" />
          <DetailRow label={t('tokenCosts.actualCoverage')} value={`${allTime.actual_coverage_pct || 0}%`} />
        </div>
      </Panel>

      {/* Top sessions */}
      {topSessions.length > 0 && (
        <Panel title={t('tokenCosts.topSessions')} className="col-span-full">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
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
                    <td className="py-2 pr-3 text-right">{money(s.estimated_cost_usd)}</td>
                    <td className="py-2 pr-3 text-right">{s.actual_cost_usd > 0 ? money(s.actual_cost_usd) : '—'}</td>
                    <td className="py-2 text-right font-bold" style={{ color: 'var(--hud-accent)' }}>{money(s.billed_cost_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* Per-model breakdown */}
      {byModel.length > 0 && (
        <Panel title={`${t('tokenCosts.byModel')} — ${byModel.length} ${t('tokenCosts.models')}`} className="col-span-full">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {byModel.map((m: any) => (
              <ModelCard key={m.model} m={m} />
            ))}
          </div>
        </Panel>
      )}

      {/* Daily trend */}
      {dailyTrend.length > 0 && (
        <Panel title={t('tokenCosts.dailyTrend')} className="col-span-full">
          <div className="mb-3">
            <div className="text-[13px] uppercase tracking-wider mb-1" style={{ color: 'var(--hud-text-dim)' }}>
              {t('tokenCosts.costPerDay')}
            </div>
            <Sparkline values={costValues} width={800} height={50} />
          </div>
          <div className="text-[13px] grid grid-cols-5 gap-1">
            {dailyTrend.slice(-10).map((d: any) => (
              <div key={d.date} className="text-center py-1" style={{ background: 'var(--hud-bg-panel)' }}>
                <div style={{ color: 'var(--hud-text-dim)' }}>{d.date.slice(5)}</div>
                <div style={{ color: 'var(--hud-accent)' }}>{money(d.billed_cost_usd ?? d.cost)}</div>
                <div className="text-[13px]">{formatTokens(d.tokens)}</div>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </>
  )
}
