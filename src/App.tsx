import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material'
import { Shell } from './shared/components/Shell'
import { DashboardView } from './modules/dashboard/views/DashboardView'
import { StudentDetailView } from './modules/student/views/StudentDetailView'
import { ChatView } from './modules/chat/views/ChatView'
import { MasteryView } from './modules/mastery/views/MasteryView'
import { LoginView } from './modules/auth/views/LoginView'
import { useAuthStore } from './shared/stores/authStore'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000, retry: 1 },
  },
})

const theme = createTheme({
  palette: {
    primary: { main: '#0F6E56', dark: '#085041' },
    secondary: { main: '#BA7517' },
    background: { default: '#F4F3F0', paper: '#ffffff' },
  },
  typography: { fontFamily: '"IBM Plex Sans", sans-serif' },
  shape: { borderRadius: 8 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontFamily: '"IBM Plex Sans", sans-serif', fontWeight: 500 },
      },
    },
    MuiChip: { styleOverrides: { root: { fontFamily: '"IBM Plex Mono", monospace' } } },
    MuiTableCell: { styleOverrides: { root: { fontFamily: '"IBM Plex Sans", sans-serif' } } },
  },
})

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginView />} />
            <Route path="/" element={<PrivateRoute><Shell><DashboardView /></Shell></PrivateRoute>} />
            <Route path="/student/:id" element={<PrivateRoute><Shell><StudentDetailView /></Shell></PrivateRoute>} />
            <Route path="/student" element={<PrivateRoute><Shell><StudentDetailView /></Shell></PrivateRoute>} />
            <Route path="/mastery" element={<PrivateRoute><Shell><MasteryView /></Shell></PrivateRoute>} />
            <Route path="/chat" element={<PrivateRoute><Shell><ChatView /></Shell></PrivateRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  )
}