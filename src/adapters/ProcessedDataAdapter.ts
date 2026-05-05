import type { DataService } from '../ports/DataService'
import type { OuladIndex, ProcessedCourse, StudentProfile } from '../types/domain'

// In-memory cache so we only fetch each file once per session
const cache = new Map<string, ProcessedCourse>()
let indexCache: OuladIndex | null = null

export class ProcessedDataAdapter implements DataService {
  async getIndex(): Promise<OuladIndex> {
    if (indexCache) return indexCache
    const res = await fetch('/processed/index.json')
    if (!res.ok) {
      throw new Error(
        'Preprocessed data not found. Run `npm run preprocess` first.'
      )
    }
    indexCache = await res.json() as OuladIndex
    return indexCache
  }

  async getCourse(module: string, presentation: string): Promise<ProcessedCourse> {
    const key = `${module}_${presentation}`
    if (cache.has(key)) return cache.get(key)!
    const res = await fetch(`/processed/${key}.json`)
    if (!res.ok) throw new Error(`No preprocessed data for ${module} ${presentation}`)
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
