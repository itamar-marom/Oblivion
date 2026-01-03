"use client";

import { useState } from "react";
import { useNexus } from "@/hooks/use-nexus";
import { formatDistanceToNow } from "date-fns";
import {
  GitBranch,
  Plus,
  ToggleLeft,
  ToggleRight,
  Trash2,
  ExternalLink,
  Hash,
  List,
} from "lucide-react";

export default function MappingsPage() {
  const { mappings } = useNexus();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const activeCount = mappings.filter((m) => m.isActive).length;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Project Mappings</h1>
          <p className="text-zinc-400">
            {activeCount} of {mappings.length} mappings active
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium hover:bg-cyan-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Create Mapping
        </button>
      </div>

      {/* Info Banner */}
      <div className="mb-6 rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
        <p className="text-sm text-blue-400">
          Project mappings link ClickUp lists to Slack channels. When a task is
          created in the ClickUp list, it will automatically create a thread in
          the mapped Slack channel for discussion and updates.
        </p>
      </div>

      {/* Mappings Table */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-800/50">
              <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                ClickUp List
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                <span className="sr-only">Arrow</span>
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                Slack Channel
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                Status
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                Created
              </th>
              <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-zinc-400">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {mappings.map((mapping) => (
              <tr
                key={mapping.id}
                className="hover:bg-zinc-800/30 transition-colors"
              >
                {/* ClickUp List */}
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/20">
                      <List className="h-4 w-4 text-purple-400" />
                    </div>
                    <div>
                      <p className="font-medium">{mapping.clickupListName}</p>
                      <p className="text-xs text-zinc-500">
                        {mapping.clickupListId}
                      </p>
                    </div>
                  </div>
                </td>

                {/* Arrow */}
                <td className="px-2 py-4">
                  <GitBranch className="h-4 w-4 text-zinc-600 rotate-90" />
                </td>

                {/* Slack Channel */}
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-pink-500/20">
                      <Hash className="h-4 w-4 text-pink-400" />
                    </div>
                    <div>
                      <p className="font-medium">{mapping.slackChannelName}</p>
                      <p className="text-xs text-zinc-500">
                        {mapping.slackChannelId}
                      </p>
                    </div>
                  </div>
                </td>

                {/* Status */}
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                      mapping.isActive
                        ? "bg-green-500/20 text-green-400 border border-green-500/30"
                        : "bg-zinc-500/20 text-zinc-400 border border-zinc-500/30"
                    }`}
                  >
                    {mapping.isActive ? "Active" : "Inactive"}
                  </span>
                </td>

                {/* Created */}
                <td className="px-6 py-4 text-sm text-zinc-400">
                  {formatDistanceToNow(new Date(mapping.createdAt), {
                    addSuffix: true,
                  })}
                </td>

                {/* Actions */}
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
                      title={mapping.isActive ? "Deactivate" : "Activate"}
                    >
                      {mapping.isActive ? (
                        <ToggleRight className="h-4 w-4 text-green-400" />
                      ) : (
                        <ToggleLeft className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Empty State */}
        {mappings.length === 0 && (
          <div className="flex flex-col items-center justify-center p-12">
            <GitBranch className="h-12 w-12 text-zinc-600 mb-4" />
            <h3 className="text-lg font-medium mb-2">No Mappings Configured</h3>
            <p className="text-zinc-500 text-center mb-4">
              Create a mapping to connect a ClickUp list with a Slack channel
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium hover:bg-cyan-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Create First Mapping
            </button>
          </div>
        )}
      </div>

      {/* Create Modal (placeholder) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="text-xl font-bold mb-4">Create New Mapping</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  ClickUp List ID
                </label>
                <input
                  type="text"
                  placeholder="Enter ClickUp list ID..."
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  ClickUp List Name
                </label>
                <input
                  type="text"
                  placeholder="Enter list name..."
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  Slack Channel ID
                </label>
                <input
                  type="text"
                  placeholder="Enter Slack channel ID..."
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  Slack Channel Name
                </label>
                <input
                  type="text"
                  placeholder="e.g., #backend-dev"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button className="flex-1 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium hover:bg-cyan-700 transition-colors">
                Create Mapping
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
