"use client";

import { useEffect, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import type { Agent, ActivityEvent, DashboardStats, ProjectMapping, Group, Project, Task } from "@/lib/types";

const NEXUS_URL = process.env.NEXT_PUBLIC_NEXUS_URL || "http://localhost:3000";

interface UseNexusReturn {
  connected: boolean;
  agents: Agent[];
  activity: ActivityEvent[];
  stats: DashboardStats;
  mappings: ProjectMapping[];
  groups: Group[];
  projects: Project[];
  tasks: Task[];
  error: string | null;
}

/**
 * Hook for connecting to Nexus and receiving real-time updates.
 *
 * Note: This is a simplified implementation. In production, you would:
 * 1. Add authentication (JWT token)
 * 2. Connect to a dedicated observer namespace
 * 3. Handle reconnection more robustly
 */
export function useNexus(): UseNexusReturn {
  const [connected, setConnected] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [mappings, setMappings] = useState<ProjectMapping[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
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
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // For now, use mock data since we don't have an observer namespace yet
    // In production, this would connect to Nexus WebSocket

    // Simulate connection
    const timer = setTimeout(() => {
      setConnected(true);

      // Mock initial data
      setAgents([
        {
          id: "agent-1",
          clientId: "backend-agent",
          name: "Backend Agent",
          tenantId: "tenant-1",
          isActive: true,
          lastHeartbeat: new Date().toISOString(),
          connectionCount: 1,
          status: "idle",
          capabilities: ["code-review", "documentation"],
        },
        {
          id: "agent-2",
          clientId: "frontend-agent",
          name: "Frontend Agent",
          tenantId: "tenant-1",
          isActive: true,
          lastHeartbeat: new Date().toISOString(),
          connectionCount: 1,
          status: "working",
          capabilities: ["ui-design", "testing"],
        },
        {
          id: "agent-3",
          clientId: "devops-agent",
          name: "DevOps Agent",
          tenantId: "tenant-1",
          isActive: false,
          lastHeartbeat: null,
          connectionCount: 0,
          status: "disconnected",
          capabilities: ["deployment", "monitoring"],
        },
      ]);

      setStats({
        connectedAgents: 2,
        totalAgents: 3,
        activeTasks: 5,
        projectMappings: 3,
        webhooksToday: 47,
        errorsToday: 2,
        totalGroups: 2,
        totalProjects: 4,
        availableTasks: 3,
        claimedTasks: 2,
      });

      // Mock groups
      setGroups([
        {
          id: "group-1",
          tenantId: "tenant-1",
          name: "Backend Team",
          slug: "backend-team",
          description: "Handles all backend services and APIs",
          slackChannelId: "C123456",
          slackChannelName: "#oblivion-backend-team",
          isActive: true,
          createdAt: new Date(Date.now() - 86400000 * 14).toISOString(),
          updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
          memberCount: 2,
          projectCount: 2,
          members: [
            { agentId: "agent-1", agentName: "Backend Agent", role: "lead", joinedAt: new Date(Date.now() - 86400000 * 14).toISOString() },
            { agentId: "agent-3", agentName: "DevOps Agent", role: "member", joinedAt: new Date(Date.now() - 86400000 * 10).toISOString() },
          ],
        },
        {
          id: "group-2",
          tenantId: "tenant-1",
          name: "Frontend Team",
          slug: "frontend-team",
          description: "Handles all UI/UX and frontend applications",
          slackChannelId: "C789012",
          slackChannelName: "#oblivion-frontend-team",
          isActive: true,
          createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
          updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
          memberCount: 1,
          projectCount: 2,
          members: [
            { agentId: "agent-2", agentName: "Frontend Agent", role: "lead", joinedAt: new Date(Date.now() - 86400000 * 10).toISOString() },
          ],
        },
      ]);

      // Mock projects
      setProjects([
        {
          id: "project-1",
          groupId: "group-1",
          tenantId: "tenant-1",
          name: "Auth Refactor",
          slug: "auth-refactor",
          description: "Refactoring the authentication system to use JWT",
          oblivionTag: "auth-refactor",
          slackChannelId: "C111111",
          slackChannelName: "#oblivion-auth-refactor",
          isActive: true,
          createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
          updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
          taskCount: 3,
          group: { id: "group-1", name: "Backend Team", slug: "backend-team" },
        },
        {
          id: "project-2",
          groupId: "group-1",
          tenantId: "tenant-1",
          name: "API v2",
          slug: "api-v2",
          description: "Building the next version of the public API",
          oblivionTag: "api-v2",
          slackChannelId: "C222222",
          slackChannelName: "#oblivion-api-v2",
          isActive: true,
          createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
          updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
          taskCount: 2,
          group: { id: "group-1", name: "Backend Team", slug: "backend-team" },
        },
        {
          id: "project-3",
          groupId: "group-2",
          tenantId: "tenant-1",
          name: "Dashboard Redesign",
          slug: "dashboard-redesign",
          description: "Modernizing the user dashboard UI",
          oblivionTag: "dashboard",
          slackChannelId: "C333333",
          slackChannelName: "#oblivion-dashboard-redesign",
          isActive: true,
          createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
          updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
          taskCount: 4,
          group: { id: "group-2", name: "Frontend Team", slug: "frontend-team" },
        },
        {
          id: "project-4",
          groupId: "group-2",
          tenantId: "tenant-1",
          name: "Mobile App",
          slug: "mobile-app",
          description: "React Native mobile application",
          oblivionTag: "mobile",
          slackChannelId: "C444444",
          slackChannelName: "#oblivion-mobile-app",
          isActive: false,
          createdAt: new Date(Date.now() - 86400000 * 20).toISOString(),
          updatedAt: new Date(Date.now() - 86400000 * 10).toISOString(),
          taskCount: 0,
          group: { id: "group-2", name: "Frontend Team", slug: "frontend-team" },
        },
      ]);

      // Mock tasks
      setTasks([
        {
          id: "task-1",
          projectId: "project-1",
          clickupTaskId: "abc123",
          title: "Implement JWT token refresh",
          status: "TODO",
          priority: 1,
          claimedByAgentId: null,
          claimedAt: null,
          slackChannelId: "C111111",
          slackThreadTs: null,
          createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
          project: { id: "project-1", name: "Auth Refactor", group: { id: "group-1", name: "Backend Team" } },
        },
        {
          id: "task-2",
          projectId: "project-1",
          clickupTaskId: "def456",
          title: "Add OAuth2 support",
          status: "CLAIMED",
          priority: 2,
          claimedByAgentId: "agent-1",
          claimedByAgentName: "Backend Agent",
          claimedAt: new Date(Date.now() - 3600000).toISOString(),
          slackChannelId: "C111111",
          slackThreadTs: "1234567890.123456",
          createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
          project: { id: "project-1", name: "Auth Refactor", group: { id: "group-1", name: "Backend Team" } },
        },
        {
          id: "task-3",
          projectId: "project-3",
          clickupTaskId: "ghi789",
          title: "Design new navigation component",
          status: "IN_PROGRESS",
          priority: 1,
          claimedByAgentId: "agent-2",
          claimedByAgentName: "Frontend Agent",
          claimedAt: new Date(Date.now() - 7200000).toISOString(),
          slackChannelId: "C333333",
          slackThreadTs: "1234567890.654321",
          createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
          project: { id: "project-3", name: "Dashboard Redesign", group: { id: "group-2", name: "Frontend Team" } },
        },
      ]);

      // Mock mappings
      setMappings([
        {
          id: "map-1",
          tenantId: "tenant-1",
          clickupListId: "list-123",
          clickupListName: "Backend Tasks",
          slackChannelId: "C123456",
          slackChannelName: "#backend-dev",
          isActive: true,
          createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
        },
        {
          id: "map-2",
          tenantId: "tenant-1",
          clickupListId: "list-456",
          clickupListName: "Frontend Tasks",
          slackChannelId: "C789012",
          slackChannelName: "#frontend-dev",
          isActive: true,
          createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
        },
        {
          id: "map-3",
          tenantId: "tenant-1",
          clickupListId: "list-789",
          clickupListName: "DevOps Tasks",
          slackChannelId: "C345678",
          slackChannelName: "#devops",
          isActive: false,
          createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
        },
      ]);

      // Mock activity feed
      const mockActivity: ActivityEvent[] = [
        {
          id: "evt-1",
          timestamp: new Date().toISOString(),
          type: "webhook_received",
          source: "clickup",
          message: "Task created: Implement user authentication",
        },
        {
          id: "evt-2",
          timestamp: new Date(Date.now() - 30000).toISOString(),
          type: "task_available",
          source: "system",
          message: "Task \"Implement JWT token refresh\" available to Backend Team (2 agents)",
        },
        {
          id: "evt-3",
          timestamp: new Date(Date.now() - 60000).toISOString(),
          type: "task_claimed",
          source: "agent",
          message: "Backend Agent claimed task \"Add OAuth2 support\" in Auth Refactor",
        },
        {
          id: "evt-4",
          timestamp: new Date(Date.now() - 90000).toISOString(),
          type: "task_assigned",
          source: "system",
          message: "Task assigned to backend-agent (legacy routing)",
        },
        {
          id: "evt-5",
          timestamp: new Date(Date.now() - 120000).toISOString(),
          type: "status_update",
          source: "agent",
          message: "Frontend Agent: IN_PROGRESS → Design new navigation component",
        },
        {
          id: "evt-6",
          timestamp: new Date(Date.now() - 180000).toISOString(),
          type: "context_update",
          source: "slack",
          message: "New message in thread: Can you add tests?",
        },
        {
          id: "evt-7",
          timestamp: new Date(Date.now() - 240000).toISOString(),
          type: "agent_connected",
          source: "agent",
          message: "Backend Agent connected from 192.168.1.100",
        },
        {
          id: "evt-8",
          timestamp: new Date(Date.now() - 300000).toISOString(),
          type: "task_claimed",
          source: "agent",
          message: "Frontend Agent claimed task \"Design new navigation component\" in Dashboard Redesign",
        },
      ];
      setActivity(mockActivity);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  return { connected, agents, activity, stats, mappings, groups, projects, tasks, error };
}

/**
 * Hook for fetching data from Nexus API
 */
export function useNexusApi() {
  const fetchAgents = useCallback(async (): Promise<Agent[]> => {
    // In production, fetch from Nexus API
    // const response = await fetch(`${NEXUS_URL}/api/agents`);
    // return response.json();
    return [];
  }, []);

  const fetchMappings = useCallback(async () => {
    // In production, fetch from Nexus API
    return [];
  }, []);

  return { fetchAgents, fetchMappings };
}
