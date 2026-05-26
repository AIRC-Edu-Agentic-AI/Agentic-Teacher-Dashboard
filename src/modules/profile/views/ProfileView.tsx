import { useEffect } from 'react'
import {
  Box, Typography, Avatar, Chip, Divider,
  Select, MenuItem, FormControl, InputLabel, CircularProgress, Card,
} from '@mui/material'
import { useAuth0 } from '@auth0/auth0-react'
import { tokens } from '../../../theme'
import { useAuthStore } from '../../../shared/stores/authStore'
import { usePreferencesStore } from '../../../shared/stores/preferencesStore'
import { useContextStore } from '../../../shared/stores/contextStore'

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  admin:              { bg: tokens.brand.dangerSubtle,   color: tokens.brand.dangerText },
  academic_advisor:   { bg: tokens.brand.secondarySubtle, color: tokens.brand.secondaryText },
  teacher:            { bg: tokens.brand.primarySubtle,  color: tokens.brand.primary },
  teacher_assistant:  { bg: tokens.surface.neutral,      color: tokens.text.secondary },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function ProfileView() {
  const { user: auth0User, getAccessTokenSilently } = useAuth0()
  const { user } = useAuthStore()
  const { preferences, loading, fetchPreferences, updatePreferences } = usePreferencesStore()

  const getToken = () => getAccessTokenSilently({
    authorizationParams: { audience: 'https://agentic-teacher-api' },
  })

  useEffect(() => {
    fetchPreferences(getToken)
  }, [])

  const roleStyle = ROLE_COLORS[user?.role ?? ''] ?? { bg: tokens.surface.neutral, color: tokens.text.secondary }
  const shortId = auth0User?.sub?.split('|')[1]?.slice(0, 8) ?? '—'

  return (
    <Box sx={{ p: 3, pb: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>

      {/* Header */}
      <Typography sx={{ fontFamily: tokens.font.sans, fontWeight: 600, fontSize: 15, color: tokens.text.primary, pb: 1, borderBottom: `1px solid ${tokens.border.default}` }}>
        My Profile
      </Typography>

      {/* Two column layout */}
      <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>

        {/* Left column */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0 }}>

          {/* Account info */}
          <Card sx={{ p: 3 }}>
            <Typography sx={{ fontSize: 11, fontFamily: tokens.font.mono, color: tokens.text.muted, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 2 }}>
              Account
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2.5 }}>
              <Avatar
                src={auth0User?.picture}
                alt={user?.name}
                sx={{ width: 56, height: 56, border: `2px solid ${tokens.border.default}` }}
              />
              <Box>
                <Typography sx={{ fontWeight: 600, fontSize: 15, color: tokens.text.primary, fontFamily: tokens.font.sans }}>
                  {user?.name}
                </Typography>
                <Typography sx={{ fontSize: 12, color: tokens.text.secondary, fontFamily: tokens.font.mono }}>
                  {user?.email}
                </Typography>
              </Box>
            </Box>
            <Chip
              label={user?.role?.replace('_', ' ') ?? 'unknown'}
              size="small"
              sx={{
                bgcolor: roleStyle.bg,
                color: roleStyle.color,
                fontFamily: tokens.font.mono,
                fontSize: 11,
                fontWeight: 600,
                height: 22,
                textTransform: 'capitalize',
              }}
            />
          </Card>

          {/* Assigned courses */}
          {(user?.modules?.length ?? 0) > 0 && (
            <Card sx={{ p: 3 }}>
              <Typography sx={{ fontSize: 11, fontFamily: tokens.font.mono, color: tokens.text.muted, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 2 }}>
                Assigned Courses
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
                {user?.modules?.map((m) => (
                  <Chip key={m} label={m} size="small"
                    sx={{ bgcolor: tokens.brand.primarySubtle, color: tokens.brand.primary, fontFamily: tokens.font.mono, fontSize: 11, height: 22 }}
                  />
                ))}
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {user?.presentations?.map((p) => (
                  <Chip key={p} label={p} size="small"
                    sx={{ bgcolor: tokens.surface.subtle, color: tokens.text.secondary, fontFamily: tokens.font.mono, fontSize: 11, height: 22 }}
                  />
                ))}
              </Box>
            </Card>
          )}

          {/* Preferences */}
          <Card sx={{ p: 3 }}>
            <Typography sx={{ fontSize: 11, fontFamily: tokens.font.mono, color: tokens.text.muted, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 2 }}>
              Preferences
            </Typography>

            {loading ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 2 }}>
                <CircularProgress size={16} sx={{ color: tokens.brand.primaryLight }} />
                <Typography sx={{ fontSize: 12, color: tokens.text.secondary }}>Loading preferences...</Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

                
                <Box>
                  <Typography sx={{ fontSize: 12, fontWeight: 500, color: tokens.text.primary, fontFamily: tokens.font.sans, mb: 0.5 }}>
                    Students per page
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: tokens.text.secondary, fontFamily: tokens.font.sans, mb: 1.5 }}>
                    Number of students shown in the risk table.
                  </Typography>
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel sx={{ fontSize: 12 }}>Rows</InputLabel>
                    <Select
                      value={preferences.students_per_page}
                      label="Rows"
                      onChange={(e) => updatePreferences({ students_per_page: Number(e.target.value) as 10 | 20 | 50 }, getToken)}
                      sx={{ fontSize: 12, fontFamily: tokens.font.mono }}
                    >
                      {[10, 20, 50].map((n) => (
                        <MenuItem key={n} value={n} sx={{ fontSize: 12, fontFamily: tokens.font.mono }}>{n} rows</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>

              </Box>
            )}
          </Card>

        </Box>

        {/* Right column */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, width: 280, flexShrink: 0 }}>

          {/* Account details */}
          <Card sx={{ p: 3 }}>
            <Typography sx={{ fontSize: 11, fontFamily: tokens.font.mono, color: tokens.text.muted, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 2 }}>
              Account Details
            </Typography>

            {[
              { label: 'Nickname', value: auth0User?.nickname ?? '—' },
              { label: 'Last seen', value: auth0User?.updated_at ? formatDate(auth0User.updated_at) : '—' },
              { label: 'Email verified', value: auth0User?.email_verified ? 'Yes' : 'No' },
              { label: 'Account ID', value: shortId },
            ].map(({ label, value }) => (
              <Box key={label} sx={{ mb: 2 }}>
                <Typography sx={{ fontSize: 10, fontFamily: tokens.font.mono, color: tokens.text.muted, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>
                  {label}
                </Typography>
                <Typography sx={{ fontSize: 12, fontFamily: tokens.font.mono, color: tokens.text.primary }}>
                  {value}
                </Typography>
              </Box>
            ))}
          </Card>

          

        </Box>
      </Box>
    </Box>
  )
}