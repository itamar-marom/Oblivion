"use client";

import { useState, useEffect } from "react";
import { X, FolderKanban, Loader2 } from "lucide-react";
import {
  projectsApi,
  groupsApi,
  type CreateProjectDto,
  type Group,
} from "@/lib/api-client";

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  preselectedGroupId?: string;
}

/**
 * Generate a URL-safe slug from a name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function CreateProjectModal({
  isOpen,
  onClose,
  onSuccess,
  preselectedGroupId,
}: CreateProjectModalProps) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);

  const [groupId, setGroupId] = useState(preselectedGroupId || "");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [oblivionTag, setOblivionTag] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch groups on mount
  useEffect(() => {
    if (isOpen) {
      setLoadingGroups(true);
      groupsApi
        .list()
        .then((data) => {
          setGroups(data);
          if (preselectedGroupId) {
            setGroupId(preselectedGroupId);
          } else if (data.length > 0 && !groupId) {
            setGroupId(data[0].id);
          }
        })
        .catch((err) => {
          console.error("Failed to fetch groups:", err);
        })
        .finally(() => {
          setLoadingGroups(false);
        });
    }
  }, [isOpen, preselectedGroupId]);

  // Auto-generate slug and tag from name
  const handleNameChange = (value: string) => {
    setName(value);
    const newSlug = generateSlug(value);
    // Only auto-generate if not manually edited
    if (slug === generateSlug(name)) {
      setSlug(newSlug);
    }
    // Auto-generate @tag
    if (oblivionTag === `@${generateSlug(name)}` || !oblivionTag) {
      setOblivionTag(newSlug ? `@${newSlug}` : "");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!groupId) {
      setError("Please select a group");
      return;
    }

    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    if (!slug.trim()) {
      setError("Slug is required");
      return;
    }

    if (!oblivionTag.trim()) {
      setError("@tag is required for task routing");
      return;
    }

    // Validate tag format
    const tagValue = oblivionTag.startsWith("@")
      ? oblivionTag
      : `@${oblivionTag}`;
    if (!/^@[a-z0-9-]+$/.test(tagValue)) {
      setError("@tag must be lowercase letters, numbers, and hyphens only");
      return;
    }

    setIsSubmitting(true);

    try {
      const dto: CreateProjectDto = {
        groupId,
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || undefined,
        oblivionTag: tagValue.replace(/^@/, ""), // API expects tag without @ prefix
      };

      await projectsApi.create(dto);

      // Reset form
      setName("");
      setSlug("");
      setDescription("");
      setOblivionTag("");
      if (!preselectedGroupId) {
        setGroupId(groups[0]?.id || "");
      }

      // Notify parent
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setName("");
      setSlug("");
      setDescription("");
      setOblivionTag("");
      setError(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/20">
              <FolderKanban className="h-5 w-5 text-purple-400" />
            </div>
            <h2 className="text-lg font-semibold">Create Project</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Group Selection */}
          <div>
            <label
              htmlFor="group"
              className="block text-sm font-medium text-zinc-300 mb-1.5"
            >
              Group (Team)
            </label>
            {loadingGroups ? (
              <div className="flex items-center gap-2 text-sm text-zinc-500 py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading groups...
              </div>
            ) : groups.length === 0 ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
                No groups available. Create a group first.
              </div>
            ) : (
              <select
                id="group"
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                disabled={isSubmitting || !!preselectedGroupId}
              >
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Name */}
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-zinc-300 mb-1.5"
            >
              Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g., Auth Refactor"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              disabled={isSubmitting}
            />
          </div>

          {/* Slug */}
          <div>
            <label
              htmlFor="slug"
              className="block text-sm font-medium text-zinc-300 mb-1.5"
            >
              Slug
            </label>
            <input
              id="slug"
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="e.g., auth-refactor"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              disabled={isSubmitting}
            />
          </div>

          {/* Oblivion Tag */}
          <div>
            <label
              htmlFor="tag"
              className="block text-sm font-medium text-zinc-300 mb-1.5"
            >
              @Tag
            </label>
            <input
              id="tag"
              type="text"
              value={oblivionTag}
              onChange={(e) => setOblivionTag(e.target.value)}
              placeholder="e.g., @auth-refactor"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              disabled={isSubmitting}
            />
            <p className="mt-1 text-xs text-zinc-500">
              Tasks with this @tag in ClickUp will route to this project.
            </p>
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-zinc-300 mb-1.5"
            >
              Description{" "}
              <span className="text-zinc-500 font-normal">(optional)</span>
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this project about?"
              rows={2}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 resize-none"
              disabled={isSubmitting}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1 rounded-lg border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                isSubmitting ||
                !groupId ||
                !name.trim() ||
                !slug.trim() ||
                !oblivionTag.trim() ||
                groups.length === 0
              }
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Project"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
