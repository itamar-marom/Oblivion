import { formatDistanceToNow } from "date-fns";
import {
  Webhook,
  Bot,
  MessageSquare,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  ListTodo,
  Hand,
} from "lucide-react";
import type { ActivityEvent } from "@/lib/types";

interface ActivityFeedProps {
  events: ActivityEvent[];
}

const eventIcons = {
  webhook_received: Webhook,
  task_assigned: ArrowRight,
  task_available: ListTodo,
  task_claimed: Hand,
  agent_connected: Bot,
  agent_disconnected: Bot,
  status_update: CheckCircle,
  context_update: MessageSquare,
  error: AlertCircle,
};

const eventColors = {
  webhook_received: "text-blue-400",
  task_assigned: "text-cyan-400",
  task_available: "text-emerald-400",
  task_claimed: "text-amber-400",
  agent_connected: "text-green-400",
  agent_disconnected: "text-zinc-500",
  status_update: "text-purple-400",
  context_update: "text-yellow-400",
  error: "text-red-400",
};

const sourceColors = {
  clickup: "bg-purple-500/20 text-purple-400",
  slack: "bg-pink-500/20 text-pink-400",
  agent: "bg-cyan-500/20 text-cyan-400",
  system: "bg-zinc-500/20 text-zinc-400",
};

export function ActivityFeed({ events }: ActivityFeedProps) {
  if (events.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-zinc-500">
        No activity yet
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((event) => {
        const Icon = eventIcons[event.type];
        return (
          <div
            key={event.id}
            className="flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-800/50 p-3"
          >
            <div className={`mt-0.5 ${eventColors[event.type]}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-zinc-200 truncate">{event.message}</p>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${sourceColors[event.source]}`}
                >
                  {event.source}
                </span>
                <span className="text-xs text-zinc-500">
                  {formatDistanceToNow(new Date(event.timestamp), {
                    addSuffix: true,
                  })}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
