import { useEffect } from 'react'
import { Box, Slider, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { tokens } from '../../theme'
import { container } from '../../di/container'
import { useContextStore } from '../stores/contextStore'

export function ContextBar() {
  const { selectedModule, selectedPresentation, currentWeek, setModule, setPresentation, setCurrentWeek, setNumWeeks } = useContextStore()

  const { data: index } = useQuery({
    queryKey: ['oulad-index'],
    queryFn: () => container.dataService.getIndex(),
    retry: false,
  })

  const { data: course } = useQuery({
    queryKey: ['course', selectedModule, selectedPresentation],
    queryFn: () => container.dataService.getCourse(selectedModule, selectedPresentation),
    enabled: !!selectedModule && !!selectedPresentation,
  })

  useEffect(() => {
    if (index && !selectedModule && index.courses.length > 0) {
      const first = index.courses[0]
      setModule(first.module)
      setPresentation(first.presentation)
      setNumWeeks(first.num_weeks)
    }
  }, [index, selectedModule, setModule, setPresentation, setNumWeeks])

  useEffect(() => {
    if (course) setNumWeeks(course.num_weeks)
  }, [course, setNumWeeks])

  const numWeeks = course?.num_weeks ?? 39

  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap',
      px: 3, py: 1, bgcolor: tokens.surface.paper, borderBottom: `1px solid ${tokens.border.default}`,
      minHeight: 52, flexShrink: 0,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 220, flex: 1, maxWidth: 360 }}>
        <Typography sx={{ fontSize: 11, color: tokens.text.secondary, fontFamily: tokens.font.mono, whiteSpace: 'nowrap' }}>
          Viewing week
        </Typography>
        <Slider
          min={1} max={numWeeks} value={currentWeek}
          onChange={(_, v) => setCurrentWeek(v as number)}
          size="small"
          sx={{ color: tokens.brand.primaryLight }}
        />
        <Typography sx={{ fontSize: 12, fontFamily: tokens.font.mono, color: tokens.text.primary, minWidth: 36 }}>
          {currentWeek}/{numWeeks}
        </Typography>
      </Box>
    </Box>
  )
}
