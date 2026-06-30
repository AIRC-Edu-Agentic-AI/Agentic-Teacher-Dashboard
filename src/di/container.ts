/**
 * Dependency Injection Container
 *
 * This is the ONLY file that changes when switching between phases:
 *   Pilot   → ProcessedDataAdapter + ClaudeAgentAdapter  ← current
 *   Deploy  → MongoDataAdapter + ClaudeAgentAdapter
 */

import { ProcessedDataAdapter } from '../adapters/ProcessedDataAdapter'
import { MockMasteryAdapter } from '../adapters/MockMasteryAdapter'
import { ClaudeAgentAdapter } from '../adapters/ClaudeAgentAdapter'
import { ApiScheduleAdapter } from '../adapters/ApiScheduleAdapter'
import { ApiNotificationAdapter } from '../adapters/ApiNotificationAdapter'

import type { DataService } from '../ports/DataService'
import type { AgentService } from '../ports/AgentService'
import type { MasteryService } from '../ports/MasteryService'
import type { ScheduleService } from '../ports/ScheduleService'
import type { NotificationService } from '../ports/NotificationService'

export const container: {
  dataService: DataService
  agentService: AgentService
  masteryService: MasteryService
  scheduleService: ScheduleService
  notificationService: NotificationService
} = {
  dataService: new ProcessedDataAdapter(),
  agentService: new ClaudeAgentAdapter(),
  masteryService: new MockMasteryAdapter(),
  scheduleService: new ApiScheduleAdapter(),
  notificationService: new ApiNotificationAdapter(),
}
