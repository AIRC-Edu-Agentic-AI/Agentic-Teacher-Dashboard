export interface Classroom {
  _id?: string
  name: string
  module: string
  code_presentation: string
  description: string
  teacher_id: string
  student_ids: number[]
  status: 'active' | 'archived'
  created_at?: Date
  updated_at?: Date
  students?: any[]
}

export interface Assessment {
  _id?: string
  classroom_id: string
  name: string
  weight: number
  due_date: number | null
  assessment_type: string
}

export type CreateClassroomInput = Pick<Classroom, 'name' | 'module' | 'code_presentation' | 'description'> & {
  is_custom?: boolean
}

export type CreateAssessmentInput = Omit<Assessment, '_id' | 'classroom_id'>

export interface ClassroomService {
  getClassrooms(): Promise<Classroom[]>
  getClassroom(id: string): Promise<Classroom & { assessments: Assessment[] } | null>
  createClassroom(data: CreateClassroomInput): Promise<string>
  updateClassroom(id: string, data: Partial<Classroom>): Promise<void>
  deleteClassroom(id: string): Promise<void>
  importStudents(id: string, students: any[]): Promise<void>
  getAssessments(classroom_id: string): Promise<Assessment[]>
  createAssessment(classroom_id: string, data: CreateAssessmentInput): Promise<void>
}