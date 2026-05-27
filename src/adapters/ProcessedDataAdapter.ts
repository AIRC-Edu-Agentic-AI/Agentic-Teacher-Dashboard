import type { DataService } from '../ports/DataService'
import type { OuladIndex, ProcessedCourse, StudentProfile } from '../types/domain'

// In-memory cache so we only fetch each file once per session
const cache = new Map<string, ProcessedCourse>()
export class ProcessedDataAdapter implements DataService {
  async getIndex(): Promise<OuladIndex> {
    let ouladIndex: OuladIndex = { courses: [] }
    // 1. Try fetching static index
    try {
      const res = await fetch('/processed/index.json')
      if (res.ok) {
        ouladIndex = await res.json() as OuladIndex
      }
    } catch (e) {
      // Ignore static fetch failure
    }

    // 2. Fetch merged course list from Backend API
    try {
      const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api'
      const res = await fetch(`${API_BASE}/index`)
      if (res.ok) {
        const apiIndex = await res.json() as OuladIndex
        const existing = new Set(ouladIndex.courses.map((c) => `${c.module}_${c.presentation}`))
        for (const c of apiIndex.courses) {
          const key = `${c.module}_${c.presentation}`
          if (!existing.has(key)) {
            ouladIndex.courses.push(c)
            existing.add(key)
          }
        }
      }
    } catch (e) {
      console.warn('Backend API `/api/index` unreachable, using static index.', e)
    }

    return ouladIndex
  }

  async getCourse(module: string, presentation: string): Promise<ProcessedCourse> {
    const key = `${module}_${presentation}`
    if (cache.has(key)) return cache.get(key)!
    
    // 1. Try local processed static JSON
    try {
      const res = await fetch(`/processed/${key}.json`)
      if (res.ok) {
        const data = await res.json() as ProcessedCourse
        cache.set(key, data)
        return data
      }
    } catch (e) {
      // Fallback
    }

    // 2. Fallback to API call for custom classrooms
    const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api'
    const res = await fetch(`${API_BASE}/course/${module}/${presentation}`)
    if (!res.ok) throw new Error(`No course data found for ${module} ${presentation}`)
    const data = await res.json() as ProcessedCourse
    cache.set(key, data)
    return data
  }

  async getStudent(
    module: string,
    presentation: string,
    studentId: number
  ): Promise<StudentProfile | null> {
    const course = await this.getCourse(module, presentation)
    return course.students.find((s) => s.id_student === studentId) ?? null
  }
}
