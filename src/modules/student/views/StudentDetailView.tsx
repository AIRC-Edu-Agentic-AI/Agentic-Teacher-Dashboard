import { useParams, useNavigate } from 'react-router-dom'
import {
  Box, Typography, Card, CardContent, Chip, Button, Grid,
  Table, TableBody, TableCell, TableHead, TableRow, Toolbar, CircularProgress,
} from '@mui/material'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts'
import { useQuery } from '@tanstack/react-query'
import ChatIcon from '@mui/icons-material/ChatBubbleOutlineRounded'
import HubIcon from '@mui/icons-material/HubRounded'
import ArrowBackIcon from '@mui/icons-material/ArrowBackRounded'
import { container } from '../../../di/container'
import { useContextStore } from '../../../shared/stores/contextStore'
import type { Tier } from '../../../types/domain'

const TIER_COLORS: Record<Tier, { bg: string; text: string }> = {
  1: { bg: '#E1F5EE', text: '#0F6E56' },
  2: { bg: '#FAEEDA', text: '#854F0B' },
  3: { bg: '#FCEBEB', text: '#A32D2D' },
}

export function StudentDetailView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { selectedModule, selectedPresentation, currentWeek, setActiveStudent } = useContextStore()

  const { data: student, isLoading } = useQuery({
    queryKey: ['student', selectedModule, selectedPresentation, id],
    queryFn: () => container.dataService.getStudent(selectedModule, selectedPresentation, Number(id)),
    enabled: !!selectedModule && !!selectedPresentation && !!id,
  })

  if (isLoading) return (
    <Box sx={{ display: 'flex', p: 4, gap: 1.5, alignItems: 'center' }}>
      <CircularProgress size={18} sx={{ color: '#1D9E75' }} />
      <Typography sx={{ fontSize: 13, color: '#6B7280', fontFamily: '"IBM Plex Mono", monospace' }}>Loading student data…</Typography>
    </Box>
  )

  if (!student) return (
    <Box sx={{ p: 4 }}>
      <Typography sx={{ color: '#E24B4A' }}>Student not found. Select a module/presentation first.</Typography>
    </Box>
  )

  const weekIdx = Math.max(0, currentWeek - 1)
  const risk = student.risk_by_week[weekIdx] ?? 0
  const tier = (student.tier_by_week[weekIdx] ?? 1) as Tier
  const tc = TIER_COLORS[tier]

  // Cumulative weighted score per week:
  //   CWS(w) = Σ(score × weight for on-time submissions due by w) / Σ(weight for all due by w) × 100
  const cwsByWeek = student.risk_by_week.map((_, i) => {
    const currentDay = (i + 1) * 7
    const due = (student.assessments ?? []).filter(
      (a) => a.date_due != null && a.date_due <= currentDay,
    )
    if (due.length === 0) return null
    const totalWeight = due.reduce((s, a) => s + (a.weight ?? 0), 0)
    if (totalWeight === 0) return null
    const weightedScore = due
      .filter((a) => a.date_submitted != null && a.date_submitted <= currentDay)
      .reduce((s, a) => s + (a.score ?? 0) * (a.weight ?? 0), 0)
    return Math.round((weightedScore / totalWeight) * 10) / 10
  })

  // Risk timeline data
  const riskData = student.risk_by_week.map((r, i) => ({
    week: i + 1,
    risk: r,
    cws: cwsByWeek[i],
  }))

  // Weekly VLE bar data (sample every 2 weeks for readability)
  const vleData = student.weekly_clicks.map((c, i) => ({ week: i + 1, clicks: c }))

  // Assessment table
  const assessments = [...(student.assessments ?? [])].sort((a, b) => (a.date_due ?? 0) - (b.date_due ?? 0))

  const handleOpenChat = () => {
    setActiveStudent(student)
    navigate('/chat')
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <Toolbar sx={{ bgcolor: '#fff', borderBottom: '1px solid #E5E3DC', gap: 2, minHeight: '60px !important', px: 3 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/')} size="small" sx={{ color: '#6B7280', fontSize: 12 }}>
          Overview
        </Button>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 500, color: '#0A1628', fontFamily: '"IBM Plex Sans", sans-serif' }}>
            Student #{student.id_student} — {selectedModule} {selectedPresentation}
          </Typography>
          {student.final_result === 'Withdrawn' && (
            <Chip
              label="Withdrawn"
              size="small"
              sx={{ bgcolor: '#F3F4F6', color: '#6B7280', fontFamily: '"IBM Plex Mono", monospace', fontWeight: 500, fontSize: 12 }}
            />
          )}
        </Box>
        <Button variant="outlined" size="small" startIcon={<HubIcon />} onClick={() => navigate('/mastery')} sx={{ fontSize: 12, borderColor: '#E5E3DC', color: '#6B7280' }}>
          Mastery graph
        </Button>
        <Button variant="contained" size="small" startIcon={<ChatIcon />} onClick={handleOpenChat}
          sx={{ fontSize: 12, bgcolor: '#0F6E56', '&:hover': { bgcolor: '#085041' } }}>
          Discuss with AI
        </Button>
      </Toolbar>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
        <Grid container spacing={2}>
          {/* Demographics */}
          <Grid item xs={12} md={4}>
            <Card elevation={0} sx={{ borderRadius: 2, border: '1px solid #E5E3DC', height: '100%' }}>
              <CardContent>
                <Typography sx={{ fontSize: 11, color: '#6B7280', fontFamily: '"IBM Plex Mono", monospace', mb: 1.5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Demographics
                </Typography>
                {[
                  ['Student ID', `#${student.id_student}`],
                  ['Gender', student.gender],
                  ['Age band', student.age_band],
                  ['IMD band', student.imd_band],
                  ['Education', student.highest_education],
                  ['Region', student.region],
                  ['Prior attempts', String(student.num_of_prev_attempts)],
                  ['Credits', String(student.studied_credits)],
                  ['Disability', student.disability ? 'Yes' : 'No'],
                  ['Final result', student.final_result],
                ].map(([k, v]) => (
                  <Box key={k} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, borderBottom: '1px solid #F0EFE9' }}>
                    <Typography sx={{ fontSize: 12, color: '#6B7280' }}>{k}</Typography>
                    <Typography sx={{ fontSize: 12, fontWeight: 500, color: '#0A1628', fontFamily: '"IBM Plex Mono", monospace' }}>{v}</Typography>
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>

          {/* Risk summary + timeline */}
          <Grid item xs={12} md={8}>
            <Card elevation={0} sx={{ borderRadius: 2, border: '1px solid #E5E3DC', mb: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <Box>
                    <Typography sx={{ fontSize: 11, color: '#6B7280', fontFamily: '"IBM Plex Mono", monospace' }}>Risk score — Week {currentWeek}</Typography>
                    <Typography sx={{ fontSize: 32, fontWeight: 600, fontFamily: '"IBM Plex Mono", monospace', color: '#0A1628', lineHeight: 1.2 }}>
                      {(risk * 100).toFixed(0)}%
                    </Typography>
                  </Box>
                  <Chip label={`Tier ${tier}`} sx={{ bgcolor: tc.bg, color: tc.text, fontFamily: '"IBM Plex Mono", monospace', fontWeight: 500, fontSize: 13 }} />
                  {student.final_result === 'Withdrawn' && (
                    <Chip label="Withdrawn" sx={{ bgcolor: '#F3F4F6', color: '#6B7280', fontFamily: '"IBM Plex Mono", monospace', fontWeight: 500, fontSize: 13 }} />
                  )}
                </Box>
                <Typography sx={{ fontSize: 12, fontWeight: 500, color: '#0A1628', mb: 1 }}>Risk trajectory &amp; weighted score</Typography>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={riskData} margin={{ top: 4, right: 36, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0EFE9" />
                    <XAxis dataKey="week" tick={{ fontSize: 10, fontFamily: '"IBM Plex Mono"' }} />
                    <YAxis yAxisId="left" domain={[0, 1]} tick={{ fontSize: 10, fontFamily: '"IBM Plex Mono"' }} />
                    <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 10, fontFamily: '"IBM Plex Mono"' }} tickFormatter={(v) => `${v}%`} />
                    <Tooltip
                      formatter={(value: number, name: string) =>
                        name === 'risk'
                          ? [`${(value * 100).toFixed(0)}%`, 'Risk']
                          : [`${value.toFixed(1)}%`, 'Weighted score']
                      }
                      labelFormatter={(v) => `Week ${v}`}
                      contentStyle={{ fontSize: 12, fontFamily: '"IBM Plex Mono"', borderRadius: 8 }}
                    />
                    <Legend
                      iconType="plainline"
                      formatter={(v) => v === 'risk' ? 'Risk' : 'Weighted score'}
                      wrapperStyle={{ fontSize: 11, fontFamily: '"IBM Plex Mono", monospace' }}
                    />
                    <ReferenceLine yAxisId="left" y={0.33} stroke="#1D9E75" strokeDasharray="3 3" />
                    <ReferenceLine yAxisId="left" y={0.66} stroke="#EF9F27" strokeDasharray="3 3" />
                    <ReferenceLine yAxisId="left" x={currentWeek} stroke="#0A1628" strokeDasharray="4 3" strokeWidth={1.5} />
                    <Line yAxisId="left" type="monotone" dataKey="risk" stroke="#0A1628" strokeWidth={2} dot={false} />
                    <Line yAxisId="right" type="stepAfter" dataKey="cws" stroke="#6366F1" strokeWidth={2} dot={false} connectNulls={false} strokeDasharray="5 3" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* VLE activity */}
            <Card elevation={0} sx={{ borderRadius: 2, border: '1px solid #E5E3DC' }}>
              <CardContent>
                <Typography sx={{ fontSize: 12, fontWeight: 500, color: '#0A1628', mb: 1 }}>Weekly VLE activity (clicks)</Typography>
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={vleData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0EFE9" />
                    <XAxis dataKey="week" tick={{ fontSize: 10, fontFamily: '"IBM Plex Mono"' }} />
                    <YAxis tick={{ fontSize: 10, fontFamily: '"IBM Plex Mono"' }} />
                    <Tooltip contentStyle={{ fontSize: 12, fontFamily: '"IBM Plex Mono"', borderRadius: 8 }} labelFormatter={(v) => `Week ${v}`} />
                    <ReferenceLine x={currentWeek} stroke="#0A1628" strokeDasharray="4 3" />
                    <Bar dataKey="clicks" fill="#5DCAA5" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Assessments */}
          <Grid item xs={12}>
            <Card elevation={0} sx={{ borderRadius: 2, border: '1px solid #E5E3DC' }}>
              <CardContent>
                <Typography sx={{ fontSize: 12, fontWeight: 500, color: '#0A1628', mb: 1.5 }}>Assessments</Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {['ID', 'Type', 'Due (day)', 'Weight', 'Score', 'Submitted'].map((h) => (
                        <TableCell key={h} sx={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 11, color: '#6B7280', bgcolor: '#F8F7F4' }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {assessments.map((a) => (
                      <TableRow key={a.id_assessment}>
                        <TableCell sx={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 11 }}>{a.id_assessment}</TableCell>
                        <TableCell sx={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 11 }}>{a.assessment_type}</TableCell>
                        <TableCell sx={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 11 }}>{a.date_due}</TableCell>
                        <TableCell sx={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 11 }}>{a.weight}%</TableCell>
                        <TableCell sx={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 11 }}>
                          {a.score !== null ? (
                            <Chip label={`${a.score}%`} size="small" sx={{ fontSize: 11, height: 20, bgcolor: a.score >= 50 ? '#E1F5EE' : '#FCEBEB', color: a.score >= 50 ? '#0F6E56' : '#A32D2D' }} />
                          ) : <Typography sx={{ fontSize: 11, color: '#9CA3AF' }}>—</Typography>}
                        </TableCell>
                        <TableCell sx={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 11, color: a.date_submitted ? '#0F6E56' : '#9CA3AF' }}>
                          {a.date_submitted !== null ? `Day ${a.date_submitted}` : 'Not submitted'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Box>
  )
}
