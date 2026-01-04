"use client";

import { useState } from "react";
import { X, Users, Loader2 } from "lucide-react";
import { groupsApi, type CreateGroupDto } from "@/lib/api-client";

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
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

export function CreateGroupModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateGroupModalProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-generate slug from name
  const handleNameChange = (value: string) => {
    setName(value);
    // Only auto-generate if slug hasn't been manually edited
    if (slug === generateSlug(name)) {
      setSlug(generateSlug(value));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    if (!slug.trim()) {
      setError("Slug is required");
      return;
    }

    setIsSubmitting(true);

    try {
      const dto: CreateGroupDto = {
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || undefined,
      };

      await groupsApi.create(dto);

      // Reset form
      setName("");
      setSlug("");
      setDescription("");

      // Notify parent
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create group");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setName("");
      setSlug("");
      setDescription("");
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
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/20">
              <Users className="h-5 w-5 text-cyan-400" />
            </div>
            <h2 className="text-lg font-semibold">Create Group</h2>
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
              placeholder="e.g., Backend Team"
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
              placeholder="e.g., backend-team"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              disabled={isSubmitting}
            />
            <p className="mt-1 text-xs text-zinc-500">
              URL-safe identifier. Auto-generated from name.
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
              placeholder="What does this team do?"
              rows={3}
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
              disabled={isSubmitting || !name.trim() || !slug.trim()}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-cyan-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Group"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
