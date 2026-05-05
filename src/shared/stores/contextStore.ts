import { create } from 'zustand'
import type { StudentProfile } from '../../types/domain'

interface ContextState {
  selectedModule: string
  selectedPresentation: string
  currentWeek: number
  numWeeks: number
  activeStudent: StudentProfile | null

  setModule: (m: string) => void
  setPresentation: (p: string) => void
  setCurrentWeek: (w: number) => void
  setNumWeeks: (n: number) => void
  setActiveStudent: (s: StudentProfile | null) => void
}

export const useContextStore = create<ContextState>((set) => ({
  selectedModule: '',
  selectedPresentation: '',
  currentWeek: 15,
  numWeeks: 39,
  activeStudent: null,

  setModule: (selectedModule) => set({ selectedModule }),
  setPresentation: (selectedPresentation) => set({ selectedPresentation }),
  setCurrentWeek: (currentWeek) => set({ currentWeek }),
  setNumWeeks: (numWeeks) => set({ numWeeks }),
  setActiveStudent: (activeStudent) => set({ activeStudent }),
}))
