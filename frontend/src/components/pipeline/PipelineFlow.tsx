import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { Box, Typography, Paper } from '@mui/material'

interface PipelineFlowProps {
  services?: { name: string; active: number }[]
  transfers?: number
}

interface FlowNode {
  id: string
  label: string
  x: number
  y: number
}

interface FlowEdge {
  from: string
  to: string
  active: boolean
}

const NODES: FlowNode[] = [
  { id: 'watchlist',   label: 'Watchlist',     x: 30,  y: 28 },
  { id: 'plex-debrid', label: 'plex-debrid',   x: 155, y: 28 },
  { id: 'premiumize',  label: 'PM',            x: 290, y: 12 },
  { id: 'torbox',      label: 'TB',            x: 290, y: 28 },
  { id: 'debridlink',  label: 'DL',            x: 290, y: 44 },
  { id: 'mergerfs',    label: 'mergerfs',      x: 380, y: 28 },
  { id: 'plex',        label: 'Plex',          x: 485, y: 28 },
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

export default function PipelineFlow({ services, transfers }: PipelineFlowProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const activeNames = new Set((services || []).filter(s => s.active > 0).map(s => s.name.toLowerCase()))
    const hasActiveTransfers = (transfers || 0) > 0

    const edgeStates = EDGES.map(e => {
      let active = e.active
      if (e.to === 'premiumize' && activeNames.has('premiumize')) active = hasActiveTransfers
      if (e.to === 'torbox' && activeNames.has('torbox')) active = hasActiveTransfers
      if (e.to === 'debridlink' && activeNames.has('debridlink')) active = hasActiveTransfers
      return { ...e, active }
    })

    // Draw edges
    svg.selectAll<SVGLineElement, typeof edgeStates[number]>('line')
      .data(edgeStates)
      .enter()
      .append('line')
      .attr('x1', d => (NODES.find(n => n.id === d.from)?.x || 0) + 8)
      .attr('y1', d => NODES.find(n => n.id === d.from)?.y || 0)
      .attr('x2', d => (NODES.find(n => n.id === d.to)?.x || 0) - 8)
      .attr('y2', d => NODES.find(n => n.id === d.to)?.y || 0)
      .attr('stroke', d => d.active ? 'var(--hud-primary, #00d4ff)' : 'var(--hud-text-dim, #6a7490)')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '4 3')
      .attr('opacity', d => d.active ? 1 : 0.3)
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
            .attr('stroke-dashoffset', -14)
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
      .attr('markerWidth', 4)
      .attr('markerHeight', 4)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,0 L6,3 L0,6 Z')
      .attr('fill', 'var(--hud-primary, #00d4ff)')

    // Draw nodes
    svg.selectAll<SVGCircleElement, FlowNode>('circle')
      .data(NODES)
      .enter()
      .append('circle')
      .attr('cx', d => d.x)
      .attr('cy', d => d.y)
      .attr('r', 6)
      .attr('fill', 'var(--hud-bg-panel, #141830)')
      .attr('stroke', 'var(--hud-primary, #00d4ff)')
      .attr('stroke-width', 1.5)

    // Labels
    svg.selectAll<SVGTextElement, FlowNode>('text')
      .data(NODES)
      .enter()
      .append('text')
      .attr('x', d => d.x)
      .attr('y', d => d.y + 18)
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--hud-text-dim, #6a7490)')
      .attr('font-size', '9px')
      .attr('font-family', 'Funnel Sans, sans-serif')
      .text(d => d.label)

  }, [services, transfers])

  return (
    <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
      <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 0.5, letterSpacing: '0.1em' }}>
        Pipeline Flow
      </Typography>
      <Box sx={{ overflowX: 'auto' }}>
        <svg ref={svgRef} viewBox="0 0 560 60" style={{ width: '100%', maxWidth: 560, height: 'auto' }} />
      </Box>
    </Paper>
  )
}
