import { formatDistanceToNow } from "date-fns";
import type { Agent } from "@/lib/types";

interface AgentStatusListProps {
  agents: Agent[];
}

const statusColors = {
  connected: "bg-blue-500",
  idle: "bg-green-500",
  working: "bg-yellow-500",
  error: "bg-red-500",
  disconnected: "bg-zinc-600",
};

const statusLabels = {
  connected: "Connected",
  idle: "Idle",
  working: "Working",
  error: "Error",
  disconnected: "Offline",
};

export function AgentStatusList({ agents }: AgentStatusListProps) {
  if (agents.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-zinc-500">
        No agents registered
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {agents.map((agent) => (
        <div
          key={agent.id}
          className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-800/50 p-3"
        >
          <div className="flex items-center gap-3">
            <div
              className={`h-2.5 w-2.5 rounded-full ${statusColors[agent.status]}`}
            />
            <div>
              <p className="font-medium text-sm">{agent.name}</p>
              <p className="text-xs text-zinc-500">{agent.clientId}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-zinc-400">{statusLabels[agent.status]}</p>
            {agent.lastHeartbeat && (
              <p className="text-xs text-zinc-600">
                {formatDistanceToNow(new Date(agent.lastHeartbeat), {
                  addSuffix: true,
                })}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
