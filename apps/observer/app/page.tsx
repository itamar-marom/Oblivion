"use client";

import { useNexus } from "@/hooks/use-nexus";
import { StatsCard } from "@/components/stats-card";
import { ActivityFeed } from "@/components/activity-feed";
import { AgentStatusList } from "@/components/agent-status-list";
import { Bot, FolderKanban, ListTodo, ClipboardList, Users, CheckCircle } from "lucide-react";

export default function Dashboard() {
  const { connected, wsConnected, agents, activity, stats, isLoading, error } = useNexus();

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-4">
          <p className="text-zinc-400">Monitor your AI agent ecosystem</p>
          {isLoading && <span className="text-xs text-yellow-400">Loading...</span>}
          {error && <span className="text-xs text-red-400">{error}</span>}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatsCard
          title="Connected Agents"
          value={stats.connectedAgents}
          subtitle={`of ${stats.totalAgents} total`}
          icon={Bot}
          color="cyan"
        />
        <StatsCard
          title="Active Tasks"
          value={stats.activeTasks}
          subtitle="in progress"
          icon={ClipboardList}
          color="blue"
        />
        <StatsCard
          title="Available Tasks"
          value={stats.availableTasks || 0}
          subtitle="pending claim"
          icon={ListTodo}
          color="yellow"
        />
        <StatsCard
          title="Groups"
          value={stats.totalGroups || 0}
          subtitle="agent teams"
          icon={Users}
          color="purple"
        />
        <StatsCard
          title="Projects"
          value={stats.totalProjects || 0}
          subtitle="active"
          icon={FolderKanban}
          color="green"
        />
        <StatsCard
          title="System Status"
          value={connected ? "Online" : "Connecting..."}
          subtitle={wsConnected ? "Real-time" : "Polling"}
          icon={CheckCircle}
          color={connected ? "green" : "yellow"}
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Activity Feed */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="mb-4 text-lg font-semibold">Live Activity</h2>
            <ActivityFeed events={activity} />
          </div>
        </div>

        {/* Agent Status */}
        <div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="mb-4 text-lg font-semibold">Agent Status</h2>
            <AgentStatusList agents={agents} />
          </div>
        </div>
      </div>
    </div>
  );
}
