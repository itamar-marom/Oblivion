"use client";

import { useState, useEffect } from "react";
import {
  X,
  FolderKanban,
  Loader2,
  Archive,
  AlertTriangle,
  Tag,
} from "lucide-react";
import {
  projectsApi,
  type Project,
  type UpdateProjectDto,
} from "@/lib/api-client";

interface EditProjectModalProps {
  isOpen: boolean;
  project: Project | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function EditProjectModal({
  isOpen,
  project,
  onClose,
  onSuccess,
}: EditProjectModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [oblivionTag, setOblivionTag] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);

  // Initialize form with project data
  useEffect(() => {
    if (isOpen && project) {
      setName(project.name);
      setDescription(project.description || "");
      setOblivionTag(project.oblivionTag || "");
      setError(null);
      setShowArchiveConfirm(false);
    }
  }, [isOpen, project]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    setError(null);

    if (!name.trim()) {
      setError("Name is required");
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
      const dto: UpdateProjectDto = {
        name: name.trim(),
        description: description.trim() || null,
        oblivionTag: tagValue.replace(/^@/, ""), // API expects tag without @ prefix
      };

      await projectsApi.update(project.id, dto);
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update project");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = async () => {
    if (!project) return;
    setIsSubmitting(true);
    setError(null);

    try {
      await projectsApi.archive(project.id);
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to archive project");
    } finally {
      setIsSubmitting(false);
      setShowArchiveConfirm(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setName("");
      setDescription("");
      setOblivionTag("");
      setError(null);
      setShowArchiveConfirm(false);
      onClose();
    }
  };

  if (!isOpen || !project) return null;

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
            <div>
              <h2 className="text-lg font-semibold">Edit Project</h2>
              <p className="text-xs text-zinc-500">{project.slug}</p>
            </div>
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
          {/* Group (read-only) */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Group
            </label>
            <div className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-2.5 text-sm text-zinc-400">
              {project.group?.name || "Unknown Group"}
            </div>
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
              onChange={(e) => setName(e.target.value)}
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
            <div className="relative">
              <Tag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                id="tag"
                type="text"
                value={oblivionTag}
                onChange={(e) => setOblivionTag(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 pl-10 pr-4 py-2.5 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                disabled={isSubmitting}
              />
            </div>
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
              onClick={() => setShowArchiveConfirm(true)}
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-lg border border-red-500/30 px-4 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
            >
              <Archive className="h-4 w-4" />
              Archive
            </button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim() || !oblivionTag.trim()}
              className="flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </form>

        {/* Archive Confirmation */}
        {showArchiveConfirm && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-zinc-900/95">
            <div className="text-center p-6">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20">
                <AlertTriangle className="h-6 w-6 text-red-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Archive Project?</h3>
              <p className="text-sm text-zinc-400 mb-6">
                This will archive &quot;{project.name}&quot;.
                <br />
                Tasks will no longer route to this project.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setShowArchiveConfirm(false)}
                  disabled={isSubmitting}
                  className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleArchive}
                  disabled={isSubmitting}
                  className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-500 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Archiving...
                    </>
                  ) : (
                    <>
                      <Archive className="h-4 w-4" />
                      Archive Project
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
