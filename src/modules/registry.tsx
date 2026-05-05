import React from 'react'
import DashboardIcon from '@mui/icons-material/GridViewRounded'
import PersonIcon from '@mui/icons-material/PersonRounded'
import ChatIcon from '@mui/icons-material/ChatBubbleOutlineRounded'
import HubIcon from '@mui/icons-material/HubRounded'

export interface ModuleConfig {
  id: string
  label: string
  path: string
  icon: React.ReactNode
}

export const moduleRegistry: ModuleConfig[] = [
  {
    id: 'dashboard',
    label: 'Class overview',
    path: '/',
    icon: <DashboardIcon fontSize="small" />,
  },
  {
    id: 'student',
    label: 'Student detail',
    path: '/student',
    icon: <PersonIcon fontSize="small" />,
  },
  {
    id: 'mastery',
    label: 'Concept mastery',
    path: '/mastery',
    icon: <HubIcon fontSize="small" />,
  },
  {
    id: 'chat',
    label: 'AI advisor',
    path: '/chat',
    icon: <ChatIcon fontSize="small" />,
  },
]
