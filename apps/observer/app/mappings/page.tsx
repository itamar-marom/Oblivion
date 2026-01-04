"use client";

import Link from "next/link";
import { GitBranch, ArrowRight, Users, FolderKanban } from "lucide-react";

/**
 * Mappings page - Deprecated notice
 *
 * Project Mappings were replaced by Groups (Agent Teams) and Projects (Work Scopes)
 * in Phase 2.5. This page now redirects users to the new system.
 */
export default function MappingsPage() {
  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Project Mappings</h1>
        <p className="text-zinc-400">Legacy feature - replaced by Groups & Projects</p>
      </div>

      {/* Deprecation Notice */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-8 mb-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500/20">
            <GitBranch className="h-6 w-6 text-amber-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-amber-200 mb-2">
              Feature Replaced
            </h2>
            <p className="text-amber-200/80 mb-4">
              Project Mappings have been replaced by the new{" "}
              <strong>Groups</strong> and <strong>Projects</strong> system,
              which provides better organization, task routing via @tags, and
              agent team management.
            </p>
            <p className="text-sm text-amber-200/60">
              The new system routes tasks using @tags in ClickUp task
              descriptions, allowing flexible project-based task assignment to
              agent teams.
            </p>
          </div>
        </div>
      </div>

      {/* New System Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Groups Card */}
        <Link
          href="/groups"
          className="group rounded-xl border border-zinc-800 bg-zinc-900 p-6 hover:border-cyan-500/50 transition-colors"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-cyan-500/20">
              <Users className="h-6 w-6 text-cyan-400" />
            </div>
            <ArrowRight className="h-5 w-5 text-zinc-600 group-hover:text-cyan-400 transition-colors" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Groups (Agent Teams)</h3>
          <p className="text-sm text-zinc-400">
            Manage permanent teams of agents. Groups have dedicated Slack
            channels and can own multiple projects.
          </p>
        </Link>

        {/* Projects Card */}
        <Link
          href="/projects"
          className="group rounded-xl border border-zinc-800 bg-zinc-900 p-6 hover:border-purple-500/50 transition-colors"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-500/20">
              <FolderKanban className="h-6 w-6 text-purple-400" />
            </div>
            <ArrowRight className="h-5 w-5 text-zinc-600 group-hover:text-purple-400 transition-colors" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Projects (Work Scopes)</h3>
          <p className="text-sm text-zinc-400">
            Define work scopes with @tag routing. Tasks tagged with a project&apos;s
            @tag are automatically routed to the owning group&apos;s agents.
          </p>
        </Link>
      </div>

      {/* How it works */}
      <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <h3 className="text-lg font-semibold mb-4">How the New System Works</h3>
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-sm font-bold">
              1
            </div>
            <div>
              <p className="font-medium">Create a Group (Agent Team)</p>
              <p className="text-sm text-zinc-400">
                Groups are permanent teams like &quot;Backend Team&quot; or &quot;Frontend Team&quot;
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-sm font-bold">
              2
            </div>
            <div>
              <p className="font-medium">Add Agents to the Group</p>
              <p className="text-sm text-zinc-400">
                Assign agents to groups with roles (lead or member)
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-sm font-bold">
              3
            </div>
            <div>
              <p className="font-medium">Create Projects with @tags</p>
              <p className="text-sm text-zinc-400">
                Projects define work scopes (e.g., @auth-refactor, @api-v2)
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-sm font-bold">
              4
            </div>
            <div>
              <p className="font-medium">Tasks Route Automatically</p>
              <p className="text-sm text-zinc-400">
                When a ClickUp task contains @tag in its description, it routes
                to the project&apos;s group for agents to claim
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
