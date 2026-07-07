import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { Box, Typography, Paper } from '@mui/material'

interface PipelineFlowProps {
  services?: { name: string; active: number }[]
  transfers?: number
  alerts?: { severity: string; label: string }[]
}

interface FlowNode {
  id: string
  label: string
  x: number
  y: number
  labelPlacement?: 'above' | 'below'
}

interface FlowEdge {
  from: string
  to: string
  active: boolean
}

const NODES: FlowNode[] = [
  { id: 'watchlist',   label: 'Watchlist',     x: 65,  y: 52 },
  { id: 'plex-debrid', label: 'plex-debrid',   x: 235, y: 52 },
  { id: 'premiumize',  label: 'Premiumize',    x: 415, y: -10, labelPlacement: 'above' },
  { id: 'torbox',      label: 'TorBox',        x: 415, y: 52 },
  { id: 'debridlink',  label: 'DebridLink',    x: 415, y: 115, labelPlacement: 'below' },
  { id: 'mergerfs',    label: 'mergerfs',      x: 595, y: 52 },
  { id: 'plex',        label: 'Plex',          x: 755, y: 52 },
]

const EDGES: FlowEdge[] = [
  { from: 'watchlist', to: 'plex-debrid', active: true },
  { from: 'plex-debrid', to: 'premiumize', active: false },
  { from: 'plex-debrid', to: 'torbox', active: false },
  { from: 'plex-debrid', to: 'debridlink', active: false },
  { from: 'premiumize', to: 'mergerfs', active: false },
  { from: 'torbox', to: 'mergerfs', active: false },
  { from: 'debridlink', to: 'mergerfs', active: false },
  { from: 'mergerfs', to: 'plex', active: true },
]

const VIEWBOX = { width: 820, height: 210 }
const LABEL_GAP = 10
const LABEL_HEIGHT = 11
const MAX_NODE_RADIUS = 7

function nodeVerticalBounds(node: FlowNode): { min: number; max: number } {
  const placement = node.labelPlacement ?? 'below'
  const nodeMin = node.y - MAX_NODE_RADIUS
  const nodeMax = node.y + MAX_NODE_RADIUS
  if (placement === 'above') {
    return { min: nodeMin - LABEL_GAP - LABEL_HEIGHT, max: nodeMax }
  }
  return { min: nodeMin, max: nodeMax + LABEL_GAP + LABEL_HEIGHT }
}

function verticalCenterOffset(): number {
  const minY = Math.min(...NODES.map(n => nodeVerticalBounds(n).min))
  const maxY = Math.max(...NODES.map(n => nodeVerticalBounds(n).max))
  const contentHeight = maxY - minY
  return (VIEWBOX.height - contentHeight) / 2 - minY
}

export default function PipelineFlow({ services, transfers, alerts }: PipelineFlowProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const activeNames = new Set((services || []).filter(s => s.active > 0).map(s => s.name.toLowerCase()))
    const hasActiveTransfers = (transfers || 0) > 0

    // Find services mentioned in error alerts
    const errorServices = new Set<string>()
    ;(alerts || []).forEach(a => {
      const label = a.label.toLowerCase()
      if (label.includes('torbox')) errorServices.add('torbox')
      if (label.includes('premiumize')) errorServices.add('premiumize')
      if (label.includes('debridlink')) errorServices.add('debridlink')
    })

    const edgeStates = EDGES.map(e => {
      let active = e.active
      if (e.to === 'premiumize' && activeNames.has('premiumize')) active = hasActiveTransfers
      if (e.to === 'torbox' && activeNames.has('torbox')) active = hasActiveTransfers
      if (e.to === 'debridlink' && activeNames.has('debridlink')) active = hasActiveTransfers
      return { ...e, active }
    })

    const chart = svg.append('g').attr('transform', `translate(0, ${verticalCenterOffset()})`)

    // Draw edges — brighter for both active and inactive
    chart.selectAll<SVGLineElement, typeof edgeStates[number]>('line')
      .data(edgeStates)
      .enter()
      .append('line')
      .attr('x1', d => (NODES.find(n => n.id === d.from)?.x || 0) + 7)
      .attr('y1', d => NODES.find(n => n.id === d.from)?.y || 0)
      .attr('x2', d => (NODES.find(n => n.id === d.to)?.x || 0) - 7)
      .attr('y2', d => NODES.find(n => n.id === d.to)?.y || 0)
      .attr('stroke', d => d.active ? 'var(--hud-primary, #00d4ff)' : 'var(--hud-text, #d0d8e8)')
      .attr('stroke-width', d => d.active ? 2 : 1)
      .attr('stroke-dasharray', d => d.active ? '5 3' : '3 4')
      .attr('opacity', d => d.active ? 1 : 0.5)
      .attr('marker-end', d => d.active ? 'url(#arrow)' : '')
      .each(function () {
        const line = d3.select(this)
        const isActive = line.attr('marker-end') === 'url(#arrow)'
        if (!isActive) return
        const animate = (sel: d3.Selection<SVGLineElement, unknown, null, unknown>) => {
          sel.attr('stroke-dashoffset', 0)
            .transition()
            .duration(800)
            .ease(d3.easeLinear)
            .attr('stroke-dashoffset', -16)
            .on('end', () => animate(sel))
        }
        animate(line)
      })

    // Arrow marker
    svg.append('defs')
      .append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 0 6 6')
      .attr('refX', 5)
      .attr('refY', 3)
      .attr('markerWidth', 5)
      .attr('markerHeight', 5)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,0 L6,3 L0,6 Z')
      .attr('fill', 'var(--hud-primary, #00d4ff)')

    // Draw nodes — red for errored services
    chart.selectAll<SVGCircleElement, FlowNode>('circle')
      .data(NODES)
      .enter()
      .append('circle')
      .attr('cx', d => d.x)
      .attr('cy', d => d.y)
      .attr('r', d => errorServices.has(d.id) ? 7 : 5)
      .attr('fill', d => errorServices.has(d.id) ? 'var(--hud-error, #ff5252)' : 'var(--hud-bg-panel, #141830)')
      .attr('stroke', d => errorServices.has(d.id) ? 'var(--hud-error, #ff5252)' : 'var(--hud-primary, #00d4ff)')
      .attr('stroke-width', d => errorServices.has(d.id) ? 2.5 : 1.5)

    // Labels — brighter, bolder
    chart.selectAll<SVGTextElement, FlowNode>('text')
      .data(NODES)
      .enter()
      .append('text')
      .attr('x', d => d.x)
      .attr('y', d => {
        const placement = d.labelPlacement ?? 'below'
        return placement === 'above'
          ? d.y - MAX_NODE_RADIUS - LABEL_GAP
          : d.y + MAX_NODE_RADIUS + LABEL_GAP
      })
      .attr('dominant-baseline', d => (d.labelPlacement ?? 'below') === 'above' ? 'auto' : 'hanging')
      .attr('text-anchor', 'middle')
      .attr('fill', d => errorServices.has(d.id) ? 'var(--hud-error, #ff5252)' : 'var(--hud-text, #d0d8e8)')
      .attr('font-size', '11px')
      .attr('font-weight', d => errorServices.has(d.id) ? '700' : '400')
      .attr('font-family', 'Funnel Sans, sans-serif')
      .text(d => d.label)

  }, [services, transfers, alerts])

  return (
    <Paper variant="outlined" sx={{ p: 1.5, mb: 2, borderColor: 'var(--hud-border-subtle)' }}>
      <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 0.5, letterSpacing: '0.1em' }}>
        Pipeline Flow
      </Typography>
      <Box>
        <svg ref={svgRef} viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`} style={{ width: '100%', height: 'auto', display: 'block' }} />
      </Box>
    </Paper>
  )
}
