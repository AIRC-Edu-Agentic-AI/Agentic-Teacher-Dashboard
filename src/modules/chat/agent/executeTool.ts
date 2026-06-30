import type { AgentContext, StudentNotificationType, TaskSource } from '../../../types/domain'
import type { DataService } from '../../../ports/DataService'
import type { ScheduleService } from '../../../ports/ScheduleService'
import type { NotificationService } from '../../../ports/NotificationService'
import { weekToDate } from '../../../shared/scheduleAnchors'
import { listAtRiskStudents, getStudentDetail } from './readTools'

export interface AgentDeps {
  dataService: DataService
  scheduleService: ScheduleService
  notificationService: NotificationService
}

export interface ToolExecResult {
  ok: boolean
  content: string   // JSON string returned to the model as the tool_result
}

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  ctx: AgentContext,
  deps: AgentDeps,
): Promise<ToolExecResult> {
  try {
    if (name === 'list_at_risk_students') {
      const course = await deps.dataService.getCourse(ctx.module, ctx.presentation)
      const limit = typeof input.limit === 'number' ? input.limit : 10
      return { ok: true, content: JSON.stringify(listAtRiskStudents(course, ctx.currentWeek, limit)) }
    }

    if (name === 'get_student_detail') {
      const course = await deps.dataService.getCourse(ctx.module, ctx.presentation)
      const detail = getStudentDetail(course, Number(input.student_id), ctx.currentWeek)
      return detail
        ? { ok: true, content: JSON.stringify(detail) }
        : { ok: false, content: `No student #${input.student_id} in ${ctx.module} ${ctx.presentation}.` }
    }

    if (name === 'send_notification') {
      const saved = await deps.notificationService.send({
        student_id: Number(input.student_id),
        module: ctx.module,
        presentation: ctx.presentation,
        title: String(input.title),
        body: String(input.body),
        type: (input.type as StudentNotificationType) ?? 'general',
      })
      return { ok: true, content: `Notification sent (id ${saved._id ?? 'unknown'}).` }
    }

    if (name === 'create_task') {
      const dueWeek = typeof input.due_week === 'number' ? input.due_week : ctx.currentWeek
      const note = typeof input.note === 'string' ? input.note.trim() : ''
      const title = note ? `${String(input.title)} — ${note}` : String(input.title)
      const created = await deps.scheduleService.create({
        module: ctx.module,
        presentation: ctx.presentation,
        kind: 'task',
        title,
        date: weekToDate(ctx.presentation, dueWeek),
        week: dueWeek,
        source: 'intervention' as TaskSource,
        status: 'open',
        student_id: Number(input.student_id),
      })
      return { ok: true, content: `Task created (id ${created._id ?? 'unknown'}) for week ${dueWeek}.` }
    }

    return { ok: false, content: `Unknown tool: ${name}` }
  } catch (e) {
    return { ok: false, content: e instanceof Error ? e.message : 'Tool execution failed' }
  }
}
