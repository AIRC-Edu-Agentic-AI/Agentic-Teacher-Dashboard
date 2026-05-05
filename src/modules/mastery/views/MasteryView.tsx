import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import {
  Box, Typography, FormControl, InputLabel, Select, MenuItem,
  Card, CardContent, Chip, CircularProgress, Alert, Toolbar,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { container } from '../../../di/container'
import { useContextStore } from '../../../shared/stores/contextStore'
import type { ConceptNode, ConceptEdge } from '../../../types/domain'

type D3Node = ConceptNode & d3.SimulationNodeDatum & { topic_group: number }
type D3Link = Omit<ConceptEdge, 'source' | 'target'> & d3.SimulationLinkDatum<D3Node>

function nodeColor(mastery: number, dark = false) {
  if (mastery >= 0.90) return dark ? { f: '#085041', s: '#5DCAA5', t: '#9FE1CB' } : { f: '#5DCAA5', s: '#0F6E56', t: '#085041' }
  if (mastery >= 0.75) return dark ? { f: '#04342C', s: '#1D9E75', t: '#9FE1CB' } : { f: '#E1F5EE', s: '#1D9E75', t: '#085041' }
  if (mastery >= 0.60) return dark ? { f: '#633806', s: '#EF9F27', t: '#FAC775' } : { f: '#FAEEDA', s: '#BA7517', t: '#633806' }
  return dark ? { f: '#791F1F', s: '#F09595', t: '#F7C1C1' } : { f: '#FCEBEB', s: '#E24B4A', t: '#791F1F' }
}

function masteryLabel(m: number) {
  if (m >= 0.90) return 'Mastered'
  if (m >= 0.75) return 'Proficient'
  if (m >= 0.60) return 'Developing'
  return 'Needs support'
}

const R = 24

export function MasteryView() {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const simRef = useRef<d3.Simulation<D3Node, D3Link> | null>(null)

  const { selectedModule, selectedPresentation, activeStudent, setActiveStudent } = useContextStore()
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(activeStudent?.id_student ?? null)
  const [selectedNode, setSelectedNode] = useState<ConceptNode | null>(null)

  const { data: course } = useQuery({
    queryKey: ['course', selectedModule, selectedPresentation],
    queryFn: () => container.dataService.getCourse(selectedModule, selectedPresentation),
    enabled: !!selectedModule && !!selectedPresentation,
  })

  const { data: graph, isLoading } = useQuery({
    queryKey: ['mastery', selectedStudentId, selectedModule],
    queryFn: () => container.masteryService.getConceptGraph(selectedStudentId!, selectedModule),
    enabled: !!selectedStudentId && !!selectedModule,
  })

  // Sync activeStudent to local selector
  useEffect(() => {
    if (activeStudent) setSelectedStudentId(activeStudent.id_student)
  }, [activeStudent])

  // D3 force graph
  useEffect(() => {
    if (!graph || !svgRef.current || !containerRef.current) return

    const W = containerRef.current.clientWidth || 640
    const H = 380
    const groupX: Record<number, number> = { 1: W * 0.18, 2: W * 0.5, 3: W * 0.82 }

    const nodes: D3Node[] = graph.nodes.map((n) => ({
      ...n,
      x: groupX[n.topic_group] + (Math.random() - 0.5) * 50,
      y: H / 2 + (Math.random() - 0.5) * 80,
    }))

    const edges: D3Link[] = graph.edges.map((e) => ({ ...e }))

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    svg.attr('viewBox', `0 0 ${W} ${H}`).attr('width', '100%').attr('height', H)

    svg.append('defs').append('marker')
      .attr('id', 'marr').attr('viewBox', '0 0 10 10').attr('refX', 8).attr('refY', 5)
      .attr('markerWidth', 5).attr('markerHeight', 5).attr('orient', 'auto-start-reverse')
      .append('path').attr('d', 'M2 1L8 5L2 9').attr('fill', 'none').attr('stroke', '#B4B2A9')
      .attr('stroke-width', 1.5).attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round')

    const linkSel = svg.append('g').selectAll('line').data(edges).join('line')
      .attr('stroke', '#D3D1C7').attr('stroke-width', 1).attr('marker-end', 'url(#marr)')

    const nodeSel = svg.append('g').selectAll<SVGGElement, D3Node>('g').data(nodes).join('g')
      .attr('cursor', 'pointer')
      .on('click', (_, d) => setSelectedNode((prev) => prev?.id === d.id ? null : d))
      .call(
        d3.drag<SVGGElement, D3Node>()
          .on('start', (e, d) => { if (!e.active) simRef.current?.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y })
          .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y })
          .on('end', (e, d) => { if (!e.active) simRef.current?.alphaTarget(0); d.fx = null; d.fy = null })
      )

    nodeSel.append('circle').attr('r', R)
      .attr('fill', (d) => nodeColor(d.mastery).f)
      .attr('stroke', (d) => nodeColor(d.mastery).s)
      .attr('stroke-width', 2)

    nodeSel.append('text')
      .text((d) => `${Math.round(d.mastery * 100)}%`)
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'central').attr('y', 0.5)
      .attr('font-size', 11).attr('font-weight', 500)
      .attr('fill', (d) => nodeColor(d.mastery).t).attr('pointer-events', 'none')

    nodeSel.append('text')
      .text((d) => d.label)
      .attr('text-anchor', 'middle').attr('y', R + 13).attr('font-size', 11)
      .attr('fill', '#888780').attr('pointer-events', 'none')

    const sim = d3.forceSimulation<D3Node>(nodes)
      .force('link', d3.forceLink<D3Node, D3Link>(edges).id((d) => d.id).distance(95).strength(0.55))
      .force('charge', d3.forceManyBody().strength(-270))
      .force('center', d3.forceCenter(W / 2, H / 2 - 10))
      .force('collide', d3.forceCollide(R + 22))
      .force('x', d3.forceX((d: D3Node) => groupX[d.topic_group]).strength(0.32))

    simRef.current = sim

    sim.on('tick', () => {
      linkSel
        .attr('x1', (d) => (d.source as D3Node).x!)
        .attr('y1', (d) => (d.source as D3Node).y!)
        .attr('x2', (d) => {
          const dx = (d.target as D3Node).x! - (d.source as D3Node).x!
          const dy = (d.target as D3Node).y! - (d.source as D3Node).y!
          const l = Math.sqrt(dx * dx + dy * dy) || 1
          return (d.target as D3Node).x! - (dx / l) * (R + 9)
        })
        .attr('y2', (d) => {
          const dx = (d.target as D3Node).x! - (d.source as D3Node).x!
          const dy = (d.target as D3Node).y! - (d.source as D3Node).y!
          const l = Math.sqrt(dx * dx + dy * dy) || 1
          return (d.target as D3Node).y! - (dy / l) * (R + 9)
        })

      nodeSel.attr('transform', (d) =>
        `translate(${Math.max(R + 4, Math.min(W - R - 4, d.x!))},${Math.max(R + 28, Math.min(H - R - 20, d.y!))})`)
    })

    return () => { sim.stop() }
  }, [graph])

  const topStudentsByRisk = course?.students
    .slice()
    .sort((a, b) => {
      const wi = Math.max(0, (useContextStore.getState().currentWeek) - 1)
      return (b.risk_by_week[wi] ?? 0) - (a.risk_by_week[wi] ?? 0)
    })
    .slice(0, 20) ?? []

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Toolbar sx={{ bgcolor: '#fff', borderBottom: '1px solid #E5E3DC', gap: 2, minHeight: '60px !important', px: 3 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 500, color: '#0A1628', fontFamily: '"IBM Plex Sans", sans-serif', flex: 1 }}>
          Concept Mastery Graph
        </Typography>

        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel sx={{ fontSize: 12 }}>Student</InputLabel>
          <Select
            value={selectedStudentId ?? ''}
            label="Student"
            onChange={(e) => {
              const id = Number(e.target.value)
              setSelectedStudentId(id)
              const s = course?.students.find((s) => s.id_student === id)
              if (s) setActiveStudent(s)
            }}
            sx={{ fontSize: 12, fontFamily: '"IBM Plex Mono", monospace' }}
          >
            {topStudentsByRisk.map((s) => (
              <MenuItem key={s.id_student} value={s.id_student} sx={{ fontSize: 12, fontFamily: '"IBM Plex Mono", monospace' }}>
                #{s.id_student}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Toolbar>

      <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
        {!selectedModule && (
          <Alert severity="info" sx={{ borderRadius: 2, mb: 2 }}>Select a module/presentation in Class Overview first.</Alert>
        )}

        <Alert severity="info" icon={false} sx={{ borderRadius: 2, mb: 2, fontSize: 12, fontFamily: '"IBM Plex Mono", monospace', py: 0.5 }}>
          Mock data — concept nodes will be sourced from G_course (Neo4j) in deployment
        </Alert>

        {/* Legend */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          {[
            { label: 'Mastered ≥90%', bg: '#5DCAA5', color: '#085041' },
            { label: 'Proficient ≥75%', bg: '#E1F5EE', color: '#085041' },
            { label: 'Developing ≥60%', bg: '#FAEEDA', color: '#633806' },
            { label: 'Needs support', bg: '#FCEBEB', color: '#791F1F' },
          ].map((l) => (
            <Chip key={l.label} label={l.label} size="small"
              sx={{ bgcolor: l.bg, color: l.color, fontSize: 11, fontFamily: '"IBM Plex Mono", monospace', height: 22 }}
            />
          ))}
        </Box>

        {/* Graph */}
        <Card elevation={0} sx={{ borderRadius: 2, border: '1px solid #E5E3DC', bgcolor: '#fff', mb: 2 }}>
          <CardContent sx={{ p: '16px !important' }}>
            {isLoading && (
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', py: 4, justifyContent: 'center' }}>
                <CircularProgress size={18} sx={{ color: '#1D9E75' }} />
                <Typography sx={{ fontSize: 13, color: '#6B7280', fontFamily: '"IBM Plex Mono", monospace' }}>
                  Building concept graph…
                </Typography>
              </Box>
            )}
            {!isLoading && !selectedStudentId && (
              <Typography sx={{ textAlign: 'center', py: 6, fontSize: 13, color: '#9CA3AF' }}>
                Select a student to view their mastery graph
              </Typography>
            )}
            <div ref={containerRef}>
              <svg ref={svgRef} style={{ display: graph ? 'block' : 'none' }} />
            </div>
          </CardContent>
        </Card>

        {/* Selected node detail */}
        {selectedNode && (
          <Card elevation={0} sx={{ borderRadius: 2, border: '1px solid #E5E3DC', bgcolor: '#fff' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
                    <Typography sx={{ fontSize: 15, fontWeight: 500, color: '#0A1628' }}>{selectedNode.label}</Typography>
                    <Chip
                      label={masteryLabel(selectedNode.mastery)}
                      size="small"
                      sx={{ bgcolor: nodeColor(selectedNode.mastery).f, color: nodeColor(selectedNode.mastery).t, fontFamily: '"IBM Plex Mono", monospace', fontSize: 11, height: 20 }}
                    />
                  </Box>
                  <Typography sx={{ fontSize: 22, fontWeight: 600, fontFamily: '"IBM Plex Mono", monospace', color: nodeColor(selectedNode.mastery).s }}>
                    {Math.round(selectedNode.mastery * 100)}%
                  </Typography>
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                  <Box>
                    <Typography sx={{ fontSize: 11, color: '#9CA3AF', fontFamily: '"IBM Plex Mono", monospace', mb: 0.5 }}>Evidence points</Typography>
                    <Typography sx={{ fontSize: 13, fontWeight: 500, fontFamily: '"IBM Plex Mono", monospace', color: '#0A1628' }}>{selectedNode.evidence_count}</Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: 11, color: '#9CA3AF', fontFamily: '"IBM Plex Mono", monospace', mb: 0.5 }}>Confidence</Typography>
                    <Typography sx={{ fontSize: 13, fontWeight: 500, fontFamily: '"IBM Plex Mono", monospace', color: '#0A1628' }}>{Math.round(selectedNode.confidence * 100)}%</Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: 11, color: '#9CA3AF', fontFamily: '"IBM Plex Mono", monospace', mb: 0.5 }}>Prerequisites</Typography>
                    <Typography sx={{ fontSize: 12, color: '#6B7280' }}>
                      {graph?.edges.filter((e) => e.target === selectedNode.id).map((e) => graph.nodes.find((n) => n.id === e.source)?.label).join(', ') || 'None'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: 11, color: '#9CA3AF', fontFamily: '"IBM Plex Mono", monospace', mb: 0.5 }}>Unlocks</Typography>
                    <Typography sx={{ fontSize: 12, color: '#6B7280' }}>
                      {graph?.edges.filter((e) => e.source === selectedNode.id).map((e) => graph.nodes.find((n) => n.id === e.target)?.label).join(', ') || 'None'}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </CardContent>
          </Card>
        )}
      </Box>
    </Box>
  )
}
