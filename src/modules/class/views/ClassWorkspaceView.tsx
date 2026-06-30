import { useState } from 'react'
import { Box, Tabs, Tab } from '@mui/material'
import { tokens } from '../../../theme'
import { CourseSelector } from '../../../shared/components/CourseSelector'
import { DashboardView } from '../../dashboard/views/DashboardView'
import { ClassView } from './ClassView'

export function ClassWorkspaceView() {
  const [tab, setTab] = useState(0)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap',
        px: 3, py: 1.5, bgcolor: tokens.surface.paper,
        borderBottom: `1px solid ${tokens.border.default}`, flexShrink: 0,
      }}>
        <CourseSelector />
        <Tabs value={tab} onChange={(_, v) => setTab(v as number)} sx={{ ml: 1, minHeight: 36 }}>
          <Tab label="Overview" sx={{ fontSize: 13, textTransform: 'none', minHeight: 36 }} />
          <Tab label="Management" sx={{ fontSize: 13, textTransform: 'none', minHeight: 36 }} />
        </Tabs>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {tab === 0 ? <DashboardView /> : <ClassView />}
      </Box>
    </Box>
  )
}
