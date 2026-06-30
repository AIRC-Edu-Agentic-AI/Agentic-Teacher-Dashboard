export interface ToolDefinition {
  name: string
  description: string
  input_schema: object
}

export const WRITE_TOOLS = new Set<string>(['send_notification', 'create_task'])

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'list_at_risk_students',
    description: 'List the most at-risk students (tier 2 or 3) for the current course and week, ranked by risk tier then risk score. Use this first when asked who needs attention.',
    input_schema: {
      type: 'object',
      properties: { limit: { type: 'number', description: 'Max students to return (default 10).' } },
    },
  },
  {
    name: 'get_student_detail',
    description: "Get one student's current risk tier, previous-week tier, engagement, cohort baseline, past-due unsubmitted assessments, and LSTM risk forecast. Use this to diagnose before proposing an intervention.",
    input_schema: {
      type: 'object',
      properties: { student_id: { type: 'number', description: 'The id_student to inspect.' } },
      required: ['student_id'],
    },
  },
  {
    name: 'send_notification',
    description: 'Send a notification to a student. Requires teacher approval before it is sent.',
    input_schema: {
      type: 'object',
      properties: {
        student_id: { type: 'number' },
        title: { type: 'string' },
        body: { type: 'string' },
        type: { type: 'string', enum: ['intervention', 'encouragement', 'reminder', 'general'] },
      },
      required: ['student_id', 'title', 'body', 'type'],
    },
  },
  {
    name: 'create_task',
    description: "Create a follow-up intervention task on the teacher's schedule for a student. Requires teacher approval before it is created.",
    input_schema: {
      type: 'object',
      properties: {
        student_id: { type: 'number' },
        title: { type: 'string' },
        due_week: { type: 'number', description: 'Course week the task is due (defaults to the current week).' },
        note: { type: 'string' },
      },
      required: ['student_id', 'title'],
    },
  },
]
