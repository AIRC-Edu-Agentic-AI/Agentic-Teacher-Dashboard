import { Box, Card, Typography, Chip } from '@mui/material'
import type { StudentProfile, Tier } from '../../../types/domain'

interface Props {
  students: StudentProfile[]
  currentWeek: number
}

const TIER_CONFIG = {
  1: { label: 'Tier 1 — Low risk', color: '#1D9E75', bg: '#E1F5EE', description: 'Universal support' },
  2: { label: 'Tier 2 — Moderate', color: '#BA7517', bg: '#FAEEDA', description: 'Targeted intervention' },
  3: { label: 'Tier 3 — High risk', color: '#E24B4A', bg: '#FCEBEB', description: 'Intensive support' },
}

export function RiskTilesRow({ students, currentWeek }: Props) {
  const weekIdx = Math.max(0, currentWeek - 1)
  const counts = { 1: 0, 2: 0, 3: 0 }
  let totalRisk = 0

  for (const s of students) {
    const tier = (s.tier_by_week[weekIdx] ?? 1) as Tier
    counts[tier]++
    totalRisk += s.risk_by_week[weekIdx] ?? 0
  }

  const avgRisk = students.length > 0 ? totalRisk / students.length : 0

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, mb: 3 }}>
      {([1, 2, 3] as Tier[]).map((tier) => {
        const cfg = TIER_CONFIG[tier]
        const pct = students.length > 0 ? Math.round((counts[tier] / students.length) * 100) : 0
        return (
          <Card
            key={tier}
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: 2,
              border: `1px solid ${cfg.color}22`,
              bgcolor: cfg.bg,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Box sx={{ position: 'absolute', top: 0, left: 0, width: `${pct}%`, height: 3, bgcolor: cfg.color, borderRadius: '2px 0 0 0' }} />
            <Typography sx={{ fontSize: 11, color: cfg.color, fontFamily: '"IBM Plex Mono", monospace', fontWeight: 500, mb: 1 }}>
              {cfg.label}
            </Typography>
            <Typography sx={{ fontSize: 36, fontWeight: 600, color: '#0A1628', fontFamily: '"IBM Plex Mono", monospace', lineHeight: 1 }}>
              {counts[tier]}
            </Typography>
            <Typography sx={{ fontSize: 12, color: '#6B7280', mt: 0.5 }}>
              {pct}% of cohort
            </Typography>
            <Typography sx={{ fontSize: 11, color: cfg.color, mt: 1 }}>
              {cfg.description}
            </Typography>
          </Card>
        )
      })}

      {/* Average risk card */}
      <Card elevation={0} sx={{ p: 2.5, borderRadius: 2, border: '1px solid #E5E3DC', bgcolor: '#fff' }}>
        <Typography sx={{ fontSize: 11, color: '#6B7280', fontFamily: '"IBM Plex Mono", monospace', fontWeight: 500, mb: 1 }}>
          Cohort avg. risk
        </Typography>
        <Typography sx={{ fontSize: 36, fontWeight: 600, color: '#0A1628', fontFamily: '"IBM Plex Mono", monospace', lineHeight: 1 }}>
          {(avgRisk * 100).toFixed(0)}%
        </Typography>
        <Typography sx={{ fontSize: 12, color: '#6B7280', mt: 0.5 }}>
          {students.length} students total
        </Typography>
        <Chip
          label={avgRisk < 0.33 ? 'Low' : avgRisk < 0.66 ? 'Moderate' : 'High'}
          size="small"
          sx={{
            mt: 1,
            fontSize: 11,
            height: 20,
            bgcolor: avgRisk < 0.33 ? '#E1F5EE' : avgRisk < 0.66 ? '#FAEEDA' : '#FCEBEB',
            color: avgRisk < 0.33 ? '#0F6E56' : avgRisk < 0.66 ? '#854F0B' : '#A32D2D',
            fontFamily: '"IBM Plex Mono", monospace',
          }}
        />
      </Card>
    </Box>
  )
}
