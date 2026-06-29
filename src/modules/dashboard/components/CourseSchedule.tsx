import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, Paper, List, ListItem, Link, Chip, Divider, TextField, IconButton, Checkbox, Button } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
// Adjust the import path based on your folder structure
import { useContextStore } from '../../../shared/stores/contextStore';
import { container } from '../../../di/container';
import type { ScheduleItem } from '../../../types/domain';

// Local interface for Schedule UI, ensuring no modifications to the domain layer
interface ScheduleItemUI extends ScheduleItem {}

export function CourseSchedule() {
  const { selectedModule, selectedPresentation, currentWeek, numWeeks } = useContextStore();

  const [scheduleItems, setScheduleItems] = useState<ScheduleItemUI[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!selectedModule || !selectedPresentation) {
      setScheduleItems([])
      return
    }

    let mounted = true
    setLoading(true)
    container.dataService.getSchedules(selectedModule, selectedPresentation)
      .then((s) => {
        if (!mounted) return
        // ensure every item has an id
        const normalized = s.map((it) => ({ ...it, id: it.id || `${selectedModule}_${selectedPresentation}_${it.week}_${Math.random().toString(36).slice(2,8)}` }))
        setScheduleItems(normalized)
      })
      .catch((e) => {
        console.warn('Failed to load schedules', e)
        setScheduleItems([])
      })
      .finally(() => setLoading(false))

    return () => { mounted = false }
  }, [selectedModule, selectedPresentation])

  const saveAll = async () => {
    if (!selectedModule || !selectedPresentation) return
    setLoading(true)
    try {
      await container.dataService.saveSchedules(selectedModule, selectedPresentation, scheduleItems)
    } finally {
      setLoading(false)
    }
  }

  // If no module is selected, we can hide the schedule or show a placeholder
  if (!selectedModule) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center', bgcolor: '#fcfcfc', border: '1px solid #E5E3DC', borderRadius: 2 }}>
        <Typography color="text.secondary">Please select a module to view the schedule.</Typography>
      </Paper>
    );
  }

  return (
    <Box sx={{ mt: 2 }}>
      <Paper sx={{ p: 2, border: '1px solid #E5E3DC', borderRadius: 2, bgcolor: '#fcfcfc', maxHeight: 500, overflowY: 'auto' }}>
        <Typography sx={{ fontWeight: 700, fontSize: 12, color: '#1D9E75', mb: 2, textTransform: 'uppercase', position: 'sticky', top: 0, bgcolor: '#fcfcfc', zIndex: 1, pb: 1 }}>
          Course Schedule & Lectures
        </Typography>
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography sx={{ fontWeight: 700 }}>Course Schedule & Lectures</Typography>
          <Box>
            <Button startIcon={<AddIcon />} size="small" onClick={() => {
              const id = `${selectedModule}_${selectedPresentation}_${Date.now()}`
              setScheduleItems((s) => [...s, { id, week: currentWeek, activity: 'New session', time: 'TBD', is_makeup: false }])
            }}>Add</Button>
            <Button startIcon={<SaveIcon />} size="small" onClick={saveAll} disabled={loading} sx={{ ml: 1 }}>Save</Button>
          </Box>
        </Box>

        <List disablePadding>
          {scheduleItems.map((item, index) => {
            const isPast = item.week < currentWeek
            return (
              <Box key={item.id}>
                <ListItem sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', p: 2, borderRadius: 2, mb: 1 }}>
                  <Box sx={{ width: '100%', display: 'flex', gap: 2 }}>
                    <TextField label="Week" type="number" size="small" value={item.week} onChange={(e) => setScheduleItems((prev) => prev.map((it) => it.id === item.id ? { ...it, week: Number(e.target.value) } : it))} sx={{ width: 96 }} />
                    <TextField label="Activity" size="small" value={item.activity} onChange={(e) => setScheduleItems((prev) => prev.map((it) => it.id === item.id ? { ...it, activity: e.target.value } : it))} sx={{ flex: 1 }} />
                    <TextField label="Time" size="small" value={item.time} onChange={(e) => setScheduleItems((prev) => prev.map((it) => it.id === item.id ? { ...it, time: e.target.value } : it))} sx={{ width: 160 }} />
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Checkbox checked={!!item.is_makeup} onChange={(e) => setScheduleItems((prev) => prev.map((it) => it.id === item.id ? { ...it, is_makeup: e.target.checked } : it))} />
                      <Typography variant="caption">Make-up</Typography>
                    </Box>
                    <IconButton onClick={() => setScheduleItems((prev) => prev.filter((it) => it.id !== item.id))}><DeleteIcon /></IconButton>
                  </Box>

                  <Box sx={{ width: '100%', mt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography sx={{ fontSize: 13, color: isPast ? 'text.secondary' : 'text.primary' }}>{item.note ?? ''}</Typography>
                    <Button size="small" onClick={async () => {
                      // save single item
                      await container.dataService.saveSchedules(selectedModule, selectedPresentation, scheduleItems)
                    }}>Save Item</Button>
                  </Box>
                </ListItem>
                {index < scheduleItems.length - 1 && <Divider sx={{ my: 0.5, borderStyle: 'dashed' }} />}
              </Box>
            )
          })}
        </List>
      </Paper>
    </Box>
  );
}