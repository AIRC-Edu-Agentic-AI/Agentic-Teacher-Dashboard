import { Box, FormControl, InputLabel, Select, MenuItem } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { tokens } from '../../theme'
import { container } from '../../di/container'
import { useContextStore } from '../stores/contextStore'

export function CourseSelector() {
  const { selectedModule, selectedPresentation, setModule, setPresentation } = useContextStore()

  const { data: index } = useQuery({
    queryKey: ['oulad-index'],
    queryFn: () => container.dataService.getIndex(),
    retry: false,
  })

  const moduleOptions = [...new Set(index?.courses.map((c) => c.module) ?? [])]
  const presentationOptions = index?.courses
    .filter((c) => c.module === selectedModule)
    .map((c) => c.presentation) ?? []

  return (
    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
      <FormControl size="small" sx={{ minWidth: 110 }}>
        <InputLabel sx={{ fontSize: 12 }}>Module</InputLabel>
        <Select
          value={selectedModule}
          label="Module"
          onChange={(e) => {
            const mod = e.target.value
            const firstPres = index?.courses.find((c) => c.module === mod)?.presentation ?? ''
            setModule(mod)
            setPresentation(firstPres)
          }}
          sx={{ fontSize: 12, fontFamily: tokens.font.mono }}
        >
          {moduleOptions.map((m) => (
            <MenuItem key={m} value={m} sx={{ fontSize: 12, fontFamily: tokens.font.mono }}>{m}</MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl size="small" sx={{ minWidth: 110 }}>
        <InputLabel sx={{ fontSize: 12 }}>Presentation</InputLabel>
        <Select
          value={selectedPresentation}
          label="Presentation"
          onChange={(e) => setPresentation(e.target.value)}
          sx={{ fontSize: 12, fontFamily: tokens.font.mono }}
        >
          {presentationOptions.map((p) => (
            <MenuItem key={p} value={p} sx={{ fontSize: 12, fontFamily: tokens.font.mono }}>{p}</MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  )
}
