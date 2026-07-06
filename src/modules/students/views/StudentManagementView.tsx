import { useMemo, useState } from 'react'
import {
  Box, Typography, FormControl, InputLabel, Select, MenuItem, TextField,
  Table, TableHead, TableRow, TableCell, TableBody, TableSortLabel, Chip, Alert, CircularProgress,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { container } from '../../../di/container'
import { useContextStore } from '../../../shared/stores/contextStore'
import { buildRoster, filterAndSortRoster, type RosterRow, type RosterFilters, type RosterSort } from '../roster'
import type { StudentProfile } from '../../../types/domain'

const TIER_COLORS: Record<number, string> = { 1: '#1D9E75', 2: '#ef6c00', 3: '#c62828' }

export function StudentManagementView() {
  const { currentWeek, openStudentDetail } = useContextStore()
  const { data: courses, isLoading, error } = useQuery({
    queryKey: ['all-courses'],
    queryFn: () => container.dataService.getAllCourses(),
  })

  const [filters, setFilters] = useState<RosterFilters>({})
  const [sort, setSort] = useState<RosterSort>({ key: 'tier', dir: 'desc' })

  const rows = useMemo(() => (courses ? buildRoster(courses, currentWeek) : []), [courses, currentWeek])
  const visible = useMemo(() => filterAndSortRoster(rows, filters, sort), [rows, filters, sort])

  const studentIndex = useMemo(() => {
    const m = new Map<string, { student: StudentProfile; module: string; presentation: string }>()
    for (const c of courses ?? []) {
      for (const s of c.students) m.set(`${c.module}/${c.presentation}/${s.id_student}`, { student: s, module: c.module, presentation: c.presentation })
    }
    return m
  }, [courses])

  const moduleOptions = useMemo(() => [...new Set(rows.map((r) => r.module))].sort(), [rows])
  const resultOptions = useMemo(() => [...new Set(rows.map((r) => r.final_result))].sort(), [rows])

  function openRow(r: RosterRow) {
    const t = studentIndex.get(`${r.module}/${r.presentation}/${r.id_student}`)
    if (t) openStudentDetail(t)
  }

  function toggleSort(key: RosterSort['key']) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }))
  }

  function header(key: RosterSort['key'], label: string) {
    return (
      <TableSortLabel active={sort.key === key} direction={sort.key === key ? sort.dir : 'desc'} onClick={() => toggleSort(key)}>
        {label}
      </TableSortLabel>
    )
  }

  if (error) return <Box sx={{ p: 3 }}><Alert severity="error">Failed to load students.</Alert></Box>

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Student Management · Week {currentWeek}</Typography>

      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Course</InputLabel>
          <Select label="Course" value={filters.module ?? ''} onChange={(e) => setFilters((f) => ({ ...f, module: e.target.value || undefined }))}>
            <MenuItem value="">All</MenuItem>
            {moduleOptions.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 100 }}>
          <InputLabel>Tier</InputLabel>
          <Select label="Tier" value={filters.tier ?? ''} onChange={(e) => setFilters((f) => ({ ...f, tier: e.target.value === '' ? undefined : Number(e.target.value) }))}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value={1}>1</MenuItem>
            <MenuItem value={2}>2</MenuItem>
            <MenuItem value={3}>3</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Final result</InputLabel>
          <Select label="Final result" value={filters.final_result ?? ''} onChange={(e) => setFilters((f) => ({ ...f, final_result: e.target.value || undefined }))}>
            <MenuItem value="">All</MenuItem>
            {resultOptions.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
          </Select>
        </FormControl>
        <TextField size="small" label="Search id" value={filters.search ?? ''} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value || undefined }))} />
      </Box>

      {isLoading && <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', p: 2 }}><CircularProgress size={18} /><Typography sx={{ fontSize: 13 }}>Loading students…</Typography></Box>}

      {!isLoading && (
        <>
          <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1 }}>{visible.length} students</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{header('id_student', 'Student')}</TableCell>
                <TableCell>Course</TableCell>
                <TableCell>{header('tier', 'Tier')}</TableCell>
                <TableCell>{header('risk', 'Risk')}</TableCell>
                <TableCell>{header('decayed_engagement', 'Engagement')}</TableCell>
                <TableCell>Final result</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visible.map((r) => (
                <TableRow key={`${r.module}/${r.presentation}/${r.id_student}`} hover sx={{ cursor: 'pointer' }} onClick={() => openRow(r)}>
                  <TableCell>#{r.id_student}</TableCell>
                  <TableCell>{r.module} {r.presentation}</TableCell>
                  <TableCell><Chip label={r.tier} size="small" sx={{ bgcolor: `${TIER_COLORS[r.tier] ?? '#999'}22`, color: TIER_COLORS[r.tier] ?? '#999', height: 20, fontSize: 11 }} /></TableCell>
                  <TableCell>{(r.risk * 100).toFixed(0)}%</TableCell>
                  <TableCell>{r.decayed_engagement.toFixed(0)}</TableCell>
                  <TableCell>{r.final_result}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </Box>
  )
}
