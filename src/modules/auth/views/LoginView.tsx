import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Card, CardContent, TextField, Button, Typography, Alert, CircularProgress } from '@mui/material'
import { useAuthStore } from '../../../shared/stores/authStore'

export function LoginView() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('http://localhost:8000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Login failed')
      login(data.token, data.user)
      navigate('/')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', bgcolor: '#F4F3F0' }}>
      <Card elevation={0} sx={{ width: 400, border: '1px solid #E5E3DC', borderRadius: 3 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography sx={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 13, color: '#1D9E75', mb: 0.5 }}>
            RTI / MTSS
          </Typography>
          <Typography sx={{ fontFamily: '"IBM Plex Sans", sans-serif', fontSize: 22, fontWeight: 600, color: '#0A1628', mb: 3 }}>
            Teacher Dashboard
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

          <TextField
            fullWidth label="Email" type="email" size="small"
            value={email} onChange={(e) => setEmail(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth label="Password" type="password" size="small"
            value={password} onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            sx={{ mb: 3 }}
          />

          <Button
            fullWidth variant="contained" onClick={handleLogin} disabled={loading}
            sx={{ bgcolor: '#0F6E56', '&:hover': { bgcolor: '#085041' }, py: 1.2 }}
          >
            {loading ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Sign in'}
          </Button>
        </CardContent>
      </Card>
    </Box>
  )
}