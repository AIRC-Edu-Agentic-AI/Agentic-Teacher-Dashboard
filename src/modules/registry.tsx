import React from 'react'
import HomeIcon from '@mui/icons-material/HomeRounded'
import DashboardIcon from '@mui/icons-material/GridViewRounded'
import PersonIcon from '@mui/icons-material/PersonRounded'
import ClassIcon from '@mui/icons-material/ClassRounded';
import CalendarIcon from '@mui/icons-material/CalendarMonthRounded'

export interface ModuleConfig {
  id: string
  label: string
  path: string
  icon: React.ReactNode
}

export const moduleRegistry: ModuleConfig[] = [
  {
    id: 'home',
    label: 'Home',
    path: '/',
    icon: <HomeIcon fontSize="small" />,
  },
  {
    id: 'dashboard',
    label: 'Class overview',
    path: '/overview',
    icon: <DashboardIcon fontSize="small" />,
  },
  {
    id: 'student',
    label: 'Student detail',
    path: '/student',
    icon: <PersonIcon fontSize="small" />,
  },
  {
    id: 'class',
    label: 'Class Management',
    path: '/class',
    icon: <ClassIcon fontSize="small" />,
  },
  {
    id: 'schedule',
    label: 'Weekly Schedule',
    path: '/schedule',
    icon: <CalendarIcon fontSize="small" />,
  },
]