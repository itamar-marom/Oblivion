"use client";

import { useState } from "react";
import {
  Users,
  Plus,
  Search,
  FolderKanban,
  Hash,
  MoreVertical,
  UserPlus,
  Archive,
  Bot,
  Crown,
} from "lucide-react";
import { useNexus } from "@/hooks/use-nexus";
import { CreateGroupModal, EditGroupModal } from "@/components/modals";
import type { Group } from "@/lib/types";
import type { Group as ApiGroup } from "@/lib/api-client";

export default function GroupsPage() {
  const { groups, connected, refresh } = useNexus();
  const [searchQuery, setSearchQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Filter groups based on search and status
  const filteredGroups = groups.filter((group) => {
    const matchesSearch =
      group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      group.slug.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = showInactive || group.isActive;
    return matchesSearch && matchesStatus;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Groups</h1>
            <p className="mt-1 text-zinc-400">
              Manage Agent Teams and their members
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Group
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search groups..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2 pl-10 pr-4 text-sm text-white placeholder-zinc-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-zinc-400">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="rounded border-zinc-700 bg-zinc-800 text-cyan-600 focus:ring-cyan-500"
          />
          Show archived
        </label>
      </div>

      {/* Groups Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredGroups.map((group) => (
          <div
            key={group.id}
            className={`rounded-xl border ${
              group.isActive
                ? "border-zinc-800 bg-zinc-900"
                : "border-zinc-800/50 bg-zinc-900/50"
            } p-5 transition-colors hover:border-zinc-700`}
          >
            {/* Header */}
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                    group.isActive
                      ? "bg-cyan-500/10 text-cyan-500"
                      : "bg-zinc-800 text-zinc-500"
                  }`}
                >
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">{group.name}</h3>
                  <p className="text-xs text-zinc-500">{group.slug}</p>
                </div>
              </div>
              <button className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-800 hover:text-white">
                <MoreVertical className="h-4 w-4" />
              </button>
            </div>

            {/* Description */}
            {group.description && (
              <p className="mb-4 text-sm text-zinc-400 line-clamp-2">
                {group.description}
              </p>
            )}

            {/* Stats */}
            <div className="mb-4 grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <Bot className="h-4 w-4" />
                <span>{group.memberCount} agents</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <FolderKanban className="h-4 w-4" />
                <span>{group.projectCount} projects</span>
              </div>
            </div>

            {/* Slack Channel */}
            {group.slackChannelName && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-zinc-800/50 px-3 py-2 text-sm">
                <Hash className="h-4 w-4 text-zinc-500" />
                <span className="text-zinc-300">{group.slackChannelName.replace(/^#/, '')}</span>
              </div>
            )}

            {/* Members Preview */}
            {group.members && group.members.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Members
                </p>
                <div className="space-y-1">
                  {group.members.slice(0, 3).map((member) => (
                    <div
                      key={member.agentId}
                      className="flex items-center gap-2 text-sm"
                    >
                      <div className="h-6 w-6 rounded-full bg-zinc-800 flex items-center justify-center">
                        <Bot className="h-3 w-3 text-zinc-500" />
                      </div>
                      <span className="text-zinc-300">{member.agentName}</span>
                      {member.role === "lead" && (
                        <Crown className="h-3 w-3 text-amber-500" />
                      )}
                    </div>
                  ))}
                  {group.members.length > 3 && (
                    <p className="text-xs text-zinc-500 pl-8">
                      +{group.members.length - 3} more
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-zinc-800 pt-4">
              <span className="text-xs text-zinc-500">
                Created {formatDate(group.createdAt)}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedGroup(group)}
                  className="flex items-center gap-1 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 transition-colors"
                >
                  <UserPlus className="h-3 w-3" />
                  Manage
                </button>
              </div>
            </div>

            {/* Status Badge */}
            {!group.isActive && (
              <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
                <Archive className="h-3 w-3" />
                <span>Archived</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredGroups.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 py-16">
          <Users className="h-12 w-12 text-zinc-700" />
          <h3 className="mt-4 text-lg font-medium text-zinc-400">
            No groups found
          </h3>
          <p className="mt-1 text-sm text-zinc-500">
            {searchQuery
              ? "Try adjusting your search query"
              : "Create your first group to get started"}
          </p>
          {!searchQuery && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Create Group
            </button>
          )}
        </div>
      )}

      {/* Connection Status */}
      {!connected && (
        <div className="fixed bottom-4 right-4 flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-2 text-sm text-amber-500">
          <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          Connecting to Nexus...
        </div>
      )}

      {/* Create Group Modal */}
      <CreateGroupModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={refresh}
      />

      {/* Edit Group Modal */}
      <EditGroupModal
        isOpen={!!selectedGroup}
        group={selectedGroup as unknown as ApiGroup}
        onClose={() => setSelectedGroup(null)}
        onSuccess={refresh}
      />
    </div>
  );
}
