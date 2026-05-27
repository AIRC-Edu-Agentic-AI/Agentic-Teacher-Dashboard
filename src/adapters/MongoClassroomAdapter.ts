/// <reference types="vite/client" />
    import type {
      ClassroomService,
      Classroom,
      Assessment,
      CreateClassroomInput,
      CreateAssessmentInput,
    } from '../ports/ClassroomService'
    import { getAccessToken } from '../utils/auth'

    const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api'

    async function authHeaders(): Promise<Record<string, string>> {
      try {
        const token = await getAccessToken()
        return {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        }
      } catch {
        return { 'Content-Type': 'application/json' }
      }
    }

    export class MongoClassroomAdapter implements ClassroomService {
      async getClassrooms(): Promise<Classroom[]> {
        const res = await fetch(`${API_BASE}/classrooms`, { headers: await authHeaders() })
        if (!res.ok) throw new Error('Cannot fetch classrooms')
        return await res.json()
      }

      async getClassroom(id: string): Promise<Classroom & { assessments: Assessment[] } | null> {
        const res = await fetch(`${API_BASE}/classrooms/${id}`, { headers: await authHeaders() })
        if (!res.ok) return null
        return await res.json()
      }

      async createClassroom(data: CreateClassroomInput): Promise<string> {
        const res = await fetch(`${API_BASE}/classrooms`, {
          method: 'POST',
          headers: await authHeaders(),
          body: JSON.stringify(data),
        })
        if (!res.ok) throw new Error('Cannot create classroom')
        const result = await res.json()
        return result._id
      }

      async updateClassroom(id: string, data: Partial<Classroom>): Promise<void> {
        const res = await fetch(`${API_BASE}/classrooms/${id}`, {
          method: 'PUT',
          headers: await authHeaders(),
          body: JSON.stringify(data),
        })
        if (!res.ok) throw new Error('Cannot update classroom')
      }

      async deleteClassroom(id: string): Promise<void> {
        const res = await fetch(`${API_BASE}/classrooms/${id}`, {
          method: 'DELETE',
          headers: await authHeaders(),
        })
        if (!res.ok) throw new Error('Cannot delete classroom')
      }

      async importStudents(id: string, students: any[]): Promise<void> {
        const res = await fetch(`${API_BASE}/classrooms/${id}/students`, {
          method: 'POST',
          headers: await authHeaders(),
          body: JSON.stringify({ students }),
        })
        if (!res.ok) throw new Error('Cannot import students')
      }

      async getAssessments(classroom_id: string): Promise<Assessment[]> {
        const res = await fetch(`${API_BASE}/classrooms/${classroom_id}/assessments`, {
          headers: await authHeaders(),
        })
        if (!res.ok) throw new Error('Cannot fetch assessments')
        return await res.json()
      }

      async createAssessment(classroom_id: string, data: CreateAssessmentInput): Promise<void> {
        const res = await fetch(`${API_BASE}/classrooms/${classroom_id}/assessments`, {
          method: 'POST',
          headers: await authHeaders(),
          body: JSON.stringify(data),
        })
        if (!res.ok) throw new Error('Cannot create assessment')
      }
    }