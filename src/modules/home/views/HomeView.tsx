import { useState } from 'react'
import { Box, Grid } from '@mui/material'
import { SuggestionsPanel } from '../components/SuggestionsPanel'
import { TodoList } from '../components/TodoList'

export function HomeView() {
  const [reloadKey, setReloadKey] = useState(0)
  return (
    <Box sx={{ p: 3 }}>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <SuggestionsPanel onTaskCreated={() => setReloadKey((k) => k + 1)} />
        </Grid>
        <Grid item xs={12} md={6}>
          <TodoList reloadKey={reloadKey} />
        </Grid>
      </Grid>
    </Box>
  )
}
