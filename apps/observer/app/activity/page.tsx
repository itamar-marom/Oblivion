"use client";

import { useState } from "react";
import { useNexus } from "@/hooks/use-nexus";
import { formatDistanceToNow, format } from "date-fns";
import {
  Webhook,
  Bot,
  MessageSquare,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  Filter,
  Search,
  RefreshCw,
  ListTodo,
  Hand,
} from "lucide-react";
import type { ActivityEvent } from "@/lib/types";

const eventIcons: Record<string, typeof Webhook> = {
  webhook_received: Webhook,
  task_assigned: ArrowRight,
  task_available: ListTodo,
  task_created: ListTodo,
  task_claimed: Hand,
  agent_connected: Bot,
  agent_disconnected: Bot,
  status_update: CheckCircle,
  status_change: CheckCircle,
  context_update: MessageSquare,
  error: AlertCircle,
};

const eventColors: Record<string, string> = {
  webhook_received: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  task_assigned: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  task_available: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  task_created: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  task_claimed: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  agent_connected: "bg-green-500/20 text-green-400 border-green-500/30",
  agent_disconnected: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  status_update: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  status_change: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  context_update: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  error: "bg-red-500/20 text-red-400 border-red-500/30",
};

const eventLabels: Record<string, string> = {
  webhook_received: "Webhook",
  task_assigned: "Task Assigned",
  task_available: "Task Available",
  task_created: "Task Created",
  task_claimed: "Task Claimed",
  agent_connected: "Agent Connected",
  agent_disconnected: "Agent Disconnected",
  status_update: "Status Update",
  status_change: "Status Change",
  context_update: "Context Update",
  error: "Error",
};

const sourceColors = {
  clickup: "bg-purple-500/20 text-purple-400",
  slack: "bg-pink-500/20 text-pink-400",
  agent: "bg-cyan-500/20 text-cyan-400",
  system: "bg-zinc-500/20 text-zinc-400",
};

type EventType = ActivityEvent["type"];
type SourceType = ActivityEvent["source"];

export default function ActivityPage() {
  const { activity } = useNexus();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<EventType[]>([]);
  const [selectedSources, setSelectedSources] = useState<SourceType[]>([]);

  // Filter events
  const filteredEvents = activity.filter((event) => {
    // Search filter
    if (
      searchQuery &&
      !event.message.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    // Type filter
    if (selectedTypes.length > 0 && !selectedTypes.includes(event.type)) {
      return false;
    }
    // Source filter
    if (selectedSources.length > 0 && !selectedSources.includes(event.source)) {
      return false;
    }
    return true;
  });

  const toggleType = (type: EventType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const toggleSource = (source: SourceType) => {
    setSelectedSources((prev) =>
      prev.includes(source)
        ? prev.filter((s) => s !== source)
        : [...prev, source]
    );
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Activity Log</h1>
          <p className="text-zinc-400">
            {filteredEvents.length} events
            {(selectedTypes.length > 0 || selectedSources.length > 0) &&
              ` (filtered from ${activity.length})`}
          </p>
        </div>
        <button className="flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-800 transition-colors">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search activity..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 pl-10 pr-4 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>

        {/* Filter Chips */}
        <div className="flex flex-wrap gap-4">
          {/* Type Filters */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-zinc-500" />
            <span className="text-xs text-zinc-500 uppercase tracking-wider">
              Type:
            </span>
            <div className="flex flex-wrap gap-1">
              {(Object.keys(eventLabels) as EventType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => toggleType(type)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    selectedTypes.includes(type)
                      ? eventColors[type]
                      : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"
                  }`}
                >
                  {eventLabels[type]}
                </button>
              ))}
            </div>
          </div>

          {/* Source Filters */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 uppercase tracking-wider">
              Source:
            </span>
            <div className="flex gap-1">
              {(["clickup", "slack", "agent", "system"] as SourceType[]).map(
                (source) => (
                  <button
                    key={source}
                    onClick={() => toggleSource(source)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                      selectedSources.includes(source)
                        ? sourceColors[source]
                        : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"
                    }`}
                  >
                    {source}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Clear Filters */}
          {(selectedTypes.length > 0 || selectedSources.length > 0) && (
            <button
              onClick={() => {
                setSelectedTypes([]);
                setSelectedSources([]);
              }}
              className="text-xs text-cyan-400 hover:text-cyan-300"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Activity List */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900">
        {filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12">
            <MessageSquare className="h-12 w-12 text-zinc-600 mb-4" />
            <h3 className="text-lg font-medium mb-2">No Activity Found</h3>
            <p className="text-zinc-500 text-center">
              {activity.length === 0
                ? "Activity will appear here as events occur"
                : "Try adjusting your filters"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {filteredEvents.map((event) => {
              const Icon = eventIcons[event.type];
              return (
                <div
                  key={event.id}
                  className="flex items-start gap-4 p-4 hover:bg-zinc-800/30 transition-colors"
                >
                  {/* Icon */}
                  <div
                    className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg border ${eventColors[event.type]}`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">{event.message}</p>
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          <span
                            className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${eventColors[event.type]}`}
                          >
                            {eventLabels[event.type]}
                          </span>
                          <span
                            className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${sourceColors[event.source]}`}
                          >
                            {event.source}
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-zinc-500">
                          {formatDistanceToNow(new Date(event.timestamp), {
                            addSuffix: true,
                          })}
                        </p>
                        <p className="text-xs text-zinc-600 mt-1">
                          {format(new Date(event.timestamp), "HH:mm:ss")}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
