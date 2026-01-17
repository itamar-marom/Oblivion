/**
 * Types for Observer Dashboard
 * These mirror the Nexus models for display purposes
 */

export interface Agent {
  id: string;
  clientId: string;
  name: string;
  tenantId: string;
  isActive: boolean;
  lastHeartbeat: string | null;
  connectionCount: number;
  status: "connected" | "idle" | "working" | "error" | "disconnected";
  capabilities?: string[];
}

export interface ProjectMapping {
  id: string;
  tenantId: string;
  clickupListId: string;
  clickupListName: string;
  slackChannelId: string;
  slackChannelName: string;
  isActive: boolean;
  createdAt: string;
}

export interface TaskMapping {
  id: string;
  projectMappingId: string;
  clickupTaskId: string;
  slackThreadTs: string;
  status: "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityEvent {
  id: string;
  timestamp: string;
  type:
    | "webhook_received"
    | "task_assigned"
    | "task_available"
    | "task_created"
    | "task_claimed"
    | "agent_connected"
    | "agent_disconnected"
    | "status_update"
    | "status_change"
    | "context_update"
    | "error";
  source: "clickup" | "slack" | "agent" | "system";
  message: string;
  metadata?: Record<string, unknown>;
}

export interface DashboardStats {
  connectedAgents: number;
  totalAgents: number;
  activeTasks: number;
  projectMappings: number;
  webhooksToday: number;
  errorsToday: number;
  // Phase 2.5 additions
  totalGroups?: number;
  totalProjects?: number;
  availableTasks?: number;
  claimedTasks?: number;
  // Approval workflow
  pendingApprovals?: number;
}

/**
 * Phase 2.5: Groups (Agent Teams)
 */
export interface Group {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description: string | null;
  slackChannelId: string | null;
  slackChannelName: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  projectCount: number;
  members?: GroupMember[];
  projects?: Project[];
}

export interface GroupMember {
  agentId: string;
  agentName: string;
  role: "lead" | "member";
  joinedAt: string;
}

/**
 * Phase 2.5: Projects (Work Scopes)
 */
export interface Project {
  id: string;
  groupId: string;
  tenantId: string;
  name: string;
  slug: string;
  description: string | null;
  oblivionTag: string | null;
  slackChannelId: string | null;
  slackChannelName: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  taskCount: number;
  group?: {
    id: string;
    name: string;
    slug: string;
  };
}

/**
 * Phase 2.5: Tasks (with claiming)
 */
export interface Task {
  id: string;
  projectId: string;
  clickupTaskId: string;
  title: string | null;
  status: "TODO" | "CLAIMED" | "IN_PROGRESS" | "BLOCKED_ON_HUMAN" | "DONE";
  priority: number;
  claimedByAgentId: string | null;
  claimedByAgentName?: string | null;
  claimedAt: string | null;
  slackChannelId: string | null;
  slackThreadTs: string | null;
  createdAt: string;
  project?: {
    id: string;
    name: string;
    group: {
      id: string;
      name: string;
    };
  };
}
