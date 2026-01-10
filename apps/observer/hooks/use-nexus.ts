"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/auth-context";
import {
  observerApi,
  groupsApi,
  projectsApi,
  tasksApi,
  type ObserverStats,
  type ObserverAgent,
  type ObserverActivityEvent,
  type Group,
  type Project,
  type Task,
} from "@/lib/api-client";
import type { Agent, ActivityEvent, DashboardStats, Group as UIGroup, Project as UIProject, Task as UITask } from "@/lib/types";
import {
  useNexusSocket,
  type AgentConnectedPayload,
  type AgentDisconnectedPayload,
  type AgentStatusChangedPayload,
  type TaskAvailablePayload,
  type TaskClaimedPayload,
} from "./use-nexus-socket";

interface UseNexusReturn {
  connected: boolean;
  wsConnected: boolean;
  isLoading: boolean;
  agents: Agent[];
  activity: ActivityEvent[];
  stats: DashboardStats;
  groups: UIGroup[];
  projects: UIProject[];
  tasks: UITask[];
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Transform API agent to UI agent format
 */
function transformAgent(agent: ObserverAgent): Agent {
  return {
    id: agent.id,
    clientId: agent.clientId,
    name: agent.name,
    tenantId: "", // Not exposed by API
    isActive: agent.isActive,
    lastHeartbeat: agent.lastSeenAt,
    connectionCount: agent.isConnected ? 1 : 0,
    status: agent.connectionStatus === "offline" ? "disconnected" : agent.connectionStatus,
    capabilities: agent.capabilities,
  };
}

/**
 * Transform API activity to UI activity format
 */
function transformActivity(event: ObserverActivityEvent): ActivityEvent {
  let type: ActivityEvent["type"] = "task_available";
  let source: ActivityEvent["source"] = "system";

  switch (event.type) {
    case "task_created":
      type = "task_available";
      source = "system";
      break;
    case "task_claimed":
      type = "task_claimed";
      source = "agent";
      break;
    case "agent_connected":
      type = "agent_connected";
      source = "agent";
      break;
    case "agent_disconnected":
      type = "agent_disconnected";
      source = "agent";
      break;
    case "status_change":
      type = "status_update";
      source = "system";
      break;
  }

  return {
    id: event.id,
    timestamp: event.timestamp,
    type,
    source,
    message: event.details || `${event.agentName || "System"}: ${event.taskTitle || "Unknown"}`,
    metadata: {
      agentId: event.agentId,
      taskId: event.taskId,
      projectName: event.projectName,
    },
  };
}

/**
 * Transform API stats to UI stats format
 */
function transformStats(stats: ObserverStats): DashboardStats {
  return {
    connectedAgents: stats.connectedAgents,
    totalAgents: stats.totalAgents,
    activeTasks: stats.activeTasks,
    projectMappings: 0, // Deprecated
    webhooksToday: 0, // Would need separate tracking
    errorsToday: 0, // Would need separate tracking
    totalGroups: stats.totalGroups,
    totalProjects: stats.totalProjects,
    availableTasks: stats.pendingTasks,
    claimedTasks: stats.activeTasks,
    pendingApprovals: stats.pendingApprovals,
  };
}

/**
 * Transform API group to UI group format
 */
function transformGroup(group: Group): UIGroup {
  return {
    id: group.id,
    tenantId: "", // Not exposed
    name: group.name,
    slug: group.slug,
    description: group.description,
    slackChannelId: group.slackChannelId,
    slackChannelName: group.slackChannelName,
    isActive: group.isActive,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt || group.createdAt,
    memberCount: group.memberCount,
    projectCount: group.projectCount,
    members: group.members?.map((m) => ({
      agentId: m.agent.id,
      agentName: m.agent.name,
      role: m.role as "lead" | "member",
      joinedAt: m.joinedAt,
    })),
  };
}

/**
 * Transform API project to UI project format
 */
function transformProject(project: Project): UIProject {
  return {
    id: project.id,
    groupId: project.groupId,
    tenantId: "", // Not exposed
    name: project.name,
    slug: project.slug,
    description: project.description,
    oblivionTag: project.oblivionTag,
    slackChannelId: project.slackChannelId,
    slackChannelName: project.slackChannelName,
    isActive: project.isActive,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt || project.createdAt,
    taskCount: project.taskCount,
    group: project.group,
  };
}

/**
 * Transform API task to UI task format
 */
function transformTask(task: Task): UITask {
  return {
    id: task.id,
    projectId: task.projectId,
    clickupTaskId: task.clickupTaskId,
    title: task.title,
    status: task.status,
    priority: task.priority,
    claimedByAgentId: task.claimedByAgentId,
    claimedByAgentName: task.claimedByAgent?.name || null,
    claimedAt: task.claimedAt,
    slackChannelId: task.slackChannelId,
    slackThreadTs: task.slackThreadTs,
    createdAt: task.createdAt,
    project: task.project,
  };
}

/**
 * Hook for connecting to Nexus and receiving real-time updates.
 *
 * Features:
 * - Authenticates using JWT (via AuthProvider)
 * - Fetches data from REST API
 * - WebSocket for real-time updates
 * - Provides refresh callback for manual data updates
 */
export function useNexus(): UseNexusReturn {
  const { isAuthenticated, isLoading: authLoading, error: authError } = useAuth();

  const [connected, setConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [realtimeActivity, setRealtimeActivity] = useState<ActivityEvent[]>([]);
  const [groups, setGroups] = useState<UIGroup[]>([]);
  const [projects, setProjects] = useState<UIProject[]>([]);
  const [tasks, setTasks] = useState<UITask[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    connectedAgents: 0,
    totalAgents: 0,
    activeTasks: 0,
    projectMappings: 0,
    webhooksToday: 0,
    errorsToday: 0,
    totalGroups: 0,
    totalProjects: 0,
    availableTasks: 0,
    claimedTasks: 0,
    pendingApprovals: 0,
  });
  const [error, setError] = useState<string | null>(null);

  /**
   * WebSocket event handlers
   */
  const handleAgentConnected = useCallback((payload: AgentConnectedPayload) => {
    // Update agent status in state
    setAgents((prev) =>
      prev.map((agent) =>
        agent.id === payload.agentId
          ? { ...agent, status: "connected" as const, connectionCount: 1 }
          : agent
      )
    );
    // Update stats
    setStats((prev) => ({
      ...prev,
      connectedAgents: prev.connectedAgents + 1,
    }));
  }, []);

  const handleAgentDisconnected = useCallback((payload: AgentDisconnectedPayload) => {
    // Update agent status in state
    setAgents((prev) =>
      prev.map((agent) =>
        agent.id === payload.agentId
          ? { ...agent, status: "disconnected" as const, connectionCount: 0 }
          : agent
      )
    );
    // Update stats
    setStats((prev) => ({
      ...prev,
      connectedAgents: Math.max(0, prev.connectedAgents - 1),
    }));
  }, []);

  const handleAgentStatusChanged = useCallback((payload: AgentStatusChangedPayload) => {
    // Update agent status in state
    setAgents((prev) =>
      prev.map((agent) =>
        agent.id === payload.agentId
          ? { ...agent, status: payload.newStatus as Agent["status"] }
          : agent
      )
    );
  }, []);

  const handleTaskAvailable = useCallback((_payload: TaskAvailablePayload) => {
    // Update stats
    setStats((prev) => ({
      ...prev,
      availableTasks: (prev.availableTasks || 0) + 1,
    }));
  }, []);

  const handleTaskClaimed = useCallback((_payload: TaskClaimedPayload) => {
    // Update stats
    setStats((prev) => ({
      ...prev,
      availableTasks: Math.max(0, (prev.availableTasks || 0) - 1),
      claimedTasks: (prev.claimedTasks || 0) + 1,
    }));
  }, []);

  const handleActivity = useCallback((event: ActivityEvent) => {
    // Add to realtime activity (keep last 50)
    setRealtimeActivity((prev) => [event, ...prev].slice(0, 50));
  }, []);

  /**
   * Memoized WebSocket handlers
   */
  const wsHandlers = useMemo(
    () => ({
      onAgentConnected: handleAgentConnected,
      onAgentDisconnected: handleAgentDisconnected,
      onAgentStatusChanged: handleAgentStatusChanged,
      onTaskAvailable: handleTaskAvailable,
      onTaskClaimed: handleTaskClaimed,
      onActivity: handleActivity,
    }),
    [
      handleAgentConnected,
      handleAgentDisconnected,
      handleAgentStatusChanged,
      handleTaskAvailable,
      handleTaskClaimed,
      handleActivity,
    ]
  );

  /**
   * WebSocket connection
   */
  const { connected: wsConnected, error: wsError } = useNexusSocket(wsHandlers);

  /**
   * Merge API activity with realtime activity
   */
  const mergedActivity = useMemo(() => {
    // Dedupe by id and sort by timestamp (newest first)
    const all = [...realtimeActivity, ...activity];
    const seen = new Set<string>();
    return all
      .filter((e) => {
        if (seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 100);
  }, [realtimeActivity, activity]);

  /**
   * Fetch all data from API
   */
  const fetchData = useCallback(async () => {
    if (!isAuthenticated) return;

    setIsLoading(true);
    setError(null);

    try {
      // Fetch all data in parallel
      const [
        statsData,
        agentsData,
        activityData,
        groupsData,
        projectsData,
        tasksData,
      ] = await Promise.all([
        observerApi.getStats().catch(() => null),
        observerApi.getAgents().catch(() => []),
        observerApi.getActivity(50).catch(() => []),
        groupsApi.list().catch(() => []),
        projectsApi.list().catch(() => []),
        tasksApi.list().catch(() => []),
      ]);

      if (statsData) {
        setStats(transformStats(statsData));
      }

      setAgents(agentsData.map(transformAgent));
      setActivity(activityData.map(transformActivity));
      setGroups(groupsData.map(transformGroup));
      setProjects(projectsData.map(transformProject));
      setTasks(tasksData.map(transformTask));
      setConnected(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch data";
      setError(message);
      setConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  /**
   * Manual refresh callback
   */
  const refresh = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  /**
   * Fetch data when authenticated
   */
  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated, fetchData]);

  /**
   * Propagate auth errors
   */
  useEffect(() => {
    if (authError) {
      setError(authError);
      setConnected(false);
    }
  }, [authError]);

  /**
   * Auto-refresh data every 30 seconds
   */
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(() => {
      fetchData();
    }, 30000);

    return () => clearInterval(interval);
  }, [isAuthenticated, fetchData]);

  /**
   * Combine WebSocket errors with other errors
   */
  useEffect(() => {
    if (wsError && !error) {
      console.warn("[WebSocket] Error:", wsError);
      // Don't set error - WebSocket is optional, REST API is primary
    }
  }, [wsError, error]);

  return {
    connected,
    wsConnected,
    isLoading: authLoading || isLoading,
    agents,
    activity: mergedActivity,
    stats,
    groups,
    projects,
    tasks,
    error,
    refresh,
  };
}

/**
 * Hook for fetching data from Nexus API (legacy - use useNexus instead)
 */
export function useNexusApi() {
  const fetchAgents = useCallback(async (): Promise<Agent[]> => {
    const agents = await observerApi.getAgents();
    return agents.map(transformAgent);
  }, []);

  const fetchMappings = useCallback(async () => {
    // Mappings are deprecated
    return [];
  }, []);

  return { fetchAgents, fetchMappings };
}
