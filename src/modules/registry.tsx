import React from 'react'
import HomeIcon from '@mui/icons-material/HomeRounded'
import PersonIcon from '@mui/icons-material/PersonRounded'
import ClassIcon from '@mui/icons-material/ClassRounded'
import CalendarIcon from '@mui/icons-material/CalendarMonthRounded'

export interface ModuleConfig {
  id: string
  label: string
  path: string
  icon: React.ReactNode
}

export const moduleRegistry: ModuleConfig[] = [
  { id: 'home', label: 'Home', path: '/', icon: <HomeIcon fontSize="small" /> },
  { id: 'schedule', label: 'Weekly Schedule', path: '/schedule', icon: <CalendarIcon fontSize="small" /> },
  { id: 'students', label: 'Student Management', path: '/students', icon: <PersonIcon fontSize="small" /> },
  { id: 'class', label: 'Class', path: '/class', icon: <ClassIcon fontSize="small" /> },
]
