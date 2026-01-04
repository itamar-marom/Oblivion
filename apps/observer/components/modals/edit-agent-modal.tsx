"use client";

import { useState, useEffect } from "react";
import { X, Bot, Loader2, Plus, Trash2 } from "lucide-react";
import { observerApi, type UpdateAgentDto, type ObserverAgent } from "@/lib/api-client";

interface EditAgentModalProps {
  isOpen: boolean;
  agent: ObserverAgent | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function EditAgentModal({
  isOpen,
  agent,
  onClose,
  onSuccess,
}: EditAgentModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [slackUserId, setSlackUserId] = useState("");
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [newCapability, setNewCapability] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Populate form when agent changes
  useEffect(() => {
    if (agent) {
      setName(agent.name || "");
      setDescription(agent.description || "");
      setEmail(agent.email || "");
      setAvatarUrl(agent.avatarUrl || "");
      setSlackUserId(agent.slackUserId || "");
      setCapabilities(agent.capabilities || []);
    }
  }, [agent]);

  const handleAddCapability = () => {
    const cap = newCapability.trim().toLowerCase();
    if (cap && !capabilities.includes(cap)) {
      setCapabilities([...capabilities, cap]);
      setNewCapability("");
    }
  };

  const handleRemoveCapability = (cap: string) => {
    setCapabilities(capabilities.filter((c) => c !== cap));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddCapability();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!agent) return;

    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setIsSubmitting(true);

    try {
      const dto: UpdateAgentDto = {
        name: name.trim(),
        description: description.trim() || null,
        email: email.trim() || null,
        avatarUrl: avatarUrl.trim() || null,
        slackUserId: slackUserId.trim() || null,
        capabilities,
      };

      await observerApi.updateAgent(agent.id, dto);

      // Notify parent
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update agent");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setError(null);
      onClose();
    }
  };

  if (!isOpen || !agent) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/20">
              <Bot className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Edit Agent</h2>
              <p className="text-sm text-zinc-500">{agent.clientId}</p>
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
          {/* Name */}
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-zinc-300 mb-1.5"
            >
              Display Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Code Reviewer"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              disabled={isSubmitting}
            />
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
              placeholder="What does this agent do?"
              rows={2}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 resize-none"
              disabled={isSubmitting}
            />
          </div>

          {/* Email */}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-zinc-300 mb-1.5"
            >
              Email{" "}
              <span className="text-zinc-500 font-normal">(for Slack lookup)</span>
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="agent@company.com"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              disabled={isSubmitting}
            />
            <p className="mt-1 text-xs text-zinc-500">
              Used to auto-discover Slack user ID when agent joins a group.
            </p>
          </div>

          {/* Avatar URL */}
          <div>
            <label
              htmlFor="avatarUrl"
              className="block text-sm font-medium text-zinc-300 mb-1.5"
            >
              Avatar URL{" "}
              <span className="text-zinc-500 font-normal">(optional)</span>
            </label>
            <input
              id="avatarUrl"
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              disabled={isSubmitting}
            />
          </div>

          {/* Slack User ID */}
          <div>
            <label
              htmlFor="slackUserId"
              className="block text-sm font-medium text-zinc-300 mb-1.5"
            >
              Slack User ID{" "}
              <span className="text-zinc-500 font-normal">(optional)</span>
            </label>
            <input
              id="slackUserId"
              type="text"
              value={slackUserId}
              onChange={(e) => setSlackUserId(e.target.value)}
              placeholder="U01ABC123DE"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              disabled={isSubmitting}
            />
            <p className="mt-1 text-xs text-zinc-500">
              Will be auto-populated from email if not set.
            </p>
          </div>

          {/* Capabilities */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Capabilities
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newCapability}
                onChange={(e) => setNewCapability(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Add capability..."
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={handleAddCapability}
                disabled={isSubmitting || !newCapability.trim()}
                className="rounded-lg bg-zinc-700 px-3 py-2 text-sm hover:bg-zinc-600 transition-colors disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            {capabilities.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {capabilities.map((cap) => (
                  <span
                    key={cap}
                    className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300"
                  >
                    {cap}
                    <button
                      type="button"
                      onClick={() => handleRemoveCapability(cap)}
                      disabled={isSubmitting}
                      className="text-zinc-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
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
              disabled={isSubmitting || !name.trim()}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-cyan-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
      </div>
    </div>
  );
}
