import type { ScheduleEvent } from '../../types/domain'

export function eventBadge(e: ScheduleEvent): { emoji: string; label: string; color: string } {
  if (e.kind === 'class') return { emoji: '📅', label: e.class_type ?? 'Class', color: '#1976d2' }
  if (e.kind === 'lecture') return { emoji: '📖', label: 'Lecture', color: '#6a1b9a' }
  if (e.source === 'intervention') return { emoji: '🎯', label: 'Intervention', color: '#c62828' }
  if (e.source === 'suggestion') return { emoji: '💡', label: 'Suggestion', color: '#ef6c00' }
  return { emoji: '📝', label: 'Task', color: '#555555' }
}
