"use client";

import { useState } from "react";
import {
  FolderKanban,
  Plus,
  Search,
  Hash,
  MoreVertical,
  Archive,
  Users,
  Tag,
  ListTodo,
  ExternalLink,
  Filter,
} from "lucide-react";
import { useNexus } from "@/hooks/use-nexus";
import type { Project } from "@/lib/types";

export default function ProjectsPage() {
  const { projects, groups, connected } = useNexus();
  const [searchQuery, setSearchQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | "all">("all");

  // Filter projects
  const filteredProjects = projects.filter((project) => {
    const matchesSearch =
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (project.oblivionTag?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    const matchesStatus = showInactive || project.isActive;
    const matchesGroup =
      selectedGroupId === "all" || project.groupId === selectedGroupId;
    return matchesSearch && matchesStatus && matchesGroup;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive
      ? "bg-emerald-500/10 text-emerald-500"
      : "bg-zinc-500/10 text-zinc-500";
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Projects</h1>
            <p className="mt-1 text-zinc-400">
              Manage Work Scopes and @tag routing
            </p>
          </div>
          <button className="flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 transition-colors">
            <Plus className="h-4 w-4" />
            Create Project
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search projects or @tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2 pl-10 pr-4 text-sm text-white placeholder-zinc-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-zinc-500" />
          <select
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-800 py-2 pl-3 pr-8 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          >
            <option value="all">All Groups</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
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

      {/* Projects Table */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/50">
              <th className="px-6 py-4 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Project
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Group
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                @Tag
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Slack
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Tasks
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-4 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {filteredProjects.map((project) => (
              <tr
                key={project.id}
                className={`${
                  project.isActive ? "" : "opacity-60"
                } hover:bg-zinc-800/30 transition-colors`}
              >
                {/* Project Info */}
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                        project.isActive
                          ? "bg-purple-500/10 text-purple-500"
                          : "bg-zinc-800 text-zinc-500"
                      }`}
                    >
                      <FolderKanban className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium text-white">{project.name}</p>
                      <p className="text-xs text-zinc-500">{project.slug}</p>
                    </div>
                  </div>
                </td>

                {/* Group */}
                <td className="px-6 py-4">
                  {project.group && (
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-zinc-500" />
                      <span className="text-zinc-300">{project.group.name}</span>
                    </div>
                  )}
                </td>

                {/* @Tag */}
                <td className="px-6 py-4">
                  {project.oblivionTag ? (
                    <div className="inline-flex items-center gap-1 rounded-full bg-cyan-500/10 px-3 py-1 text-sm font-medium text-cyan-500">
                      <Tag className="h-3 w-3" />
                      @{project.oblivionTag}
                    </div>
                  ) : (
                    <span className="text-zinc-500 text-sm">No tag</span>
                  )}
                </td>

                {/* Slack Channel */}
                <td className="px-6 py-4">
                  {project.slackChannelName ? (
                    <div className="flex items-center gap-2 text-sm text-zinc-400">
                      <Hash className="h-4 w-4" />
                      <span>{project.slackChannelName}</span>
                    </div>
                  ) : (
                    <span className="text-zinc-500 text-sm">-</span>
                  )}
                </td>

                {/* Tasks */}
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 text-sm text-zinc-400">
                    <ListTodo className="h-4 w-4" />
                    <span>{project.taskCount}</span>
                  </div>
                </td>

                {/* Status */}
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(
                      project.isActive
                    )}`}
                  >
                    {project.isActive ? "Active" : "Archived"}
                  </span>
                </td>

                {/* Actions */}
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-800 hover:text-white transition-colors">
                      <ExternalLink className="h-4 w-4" />
                    </button>
                    <button className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-800 hover:text-white transition-colors">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Empty State */}
        {filteredProjects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <FolderKanban className="h-12 w-12 text-zinc-700" />
            <h3 className="mt-4 text-lg font-medium text-zinc-400">
              No projects found
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              {searchQuery
                ? "Try adjusting your search or filters"
                : "Create your first project to get started"}
            </p>
            {!searchQuery && (
              <button className="mt-4 flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 transition-colors">
                <Plus className="h-4 w-4" />
                Create Project
              </button>
            )}
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
              <FolderKanban className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {projects.filter((p) => p.isActive).length}
              </p>
              <p className="text-sm text-zinc-500">Active Projects</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10">
              <Tag className="h-5 w-5 text-cyan-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {projects.filter((p) => p.oblivionTag && p.isActive).length}
              </p>
              <p className="text-sm text-zinc-500">With @Tags</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
              <ListTodo className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {projects.reduce((acc, p) => acc + p.taskCount, 0)}
              </p>
              <p className="text-sm text-zinc-500">Total Tasks</p>
            </div>
          </div>
        </div>
      </div>

      {/* Connection Status */}
      {!connected && (
        <div className="fixed bottom-4 right-4 flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-2 text-sm text-amber-500">
          <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          Connecting to Nexus...
        </div>
      )}
    </div>
  );
}
