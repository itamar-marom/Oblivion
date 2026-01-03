"use client";

import { useNexus } from "@/hooks/use-nexus";
import { StatsCard } from "@/components/stats-card";
import { ActivityFeed } from "@/components/activity-feed";
import { AgentStatusList } from "@/components/agent-status-list";
import { Bot, GitBranch, Webhook, AlertTriangle, Activity, CheckCircle } from "lucide-react";

export default function Dashboard() {
  const { connected, agents, activity, stats } = useNexus();

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-zinc-400">Monitor your AI agent ecosystem</p>
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
          icon={Activity}
          color="blue"
        />
        <StatsCard
          title="Project Mappings"
          value={stats.projectMappings}
          subtitle="configured"
          icon={GitBranch}
          color="purple"
        />
        <StatsCard
          title="Webhooks Today"
          value={stats.webhooksToday}
          subtitle="received"
          icon={Webhook}
          color="green"
        />
        <StatsCard
          title="Errors Today"
          value={stats.errorsToday}
          subtitle="failures"
          icon={AlertTriangle}
          color={stats.errorsToday > 0 ? "red" : "green"}
        />
        <StatsCard
          title="System Status"
          value={connected ? "Online" : "Connecting..."}
          subtitle="Nexus connection"
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
