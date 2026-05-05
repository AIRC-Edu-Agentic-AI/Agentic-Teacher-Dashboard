import type { ConceptGraph } from '../types/domain'

export interface MasteryService {
  /**
   * Returns the concept mastery graph for a student.
   * In pilot: returns mock data seeded by studentId.
   * In deployment: queries Neo4j G_course.
   */
  getConceptGraph(studentId: number, module: string): Promise<ConceptGraph>
}
