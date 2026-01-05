"use client";

import { useState } from "react";
import { X, Bot, Loader2, Plus, Trash2, Eye, EyeOff, Copy, Check } from "lucide-react";
import { observerApi, type CreateAgentDto } from "@/lib/api-client";

interface CreateAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * Generate a URL-safe client ID from a name
 */
function generateClientId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Generate a random client secret
 */
function generateSecret(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function CreateAgentModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateAgentModalProps) {
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [description, setDescription] = useState("");
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [newCapability, setNewCapability] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [secretCopied, setSecretCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdAgent, setCreatedAgent] = useState<{ clientId: string; clientSecret: string } | null>(null);

  // Auto-generate client ID from name
  const handleNameChange = (value: string) => {
    setName(value);
    // Only auto-generate if clientId hasn't been manually edited
    if (clientId === generateClientId(name)) {
      setClientId(generateClientId(value));
    }
  };

  const handleGenerateSecret = () => {
    setClientSecret(generateSecret());
    setShowSecret(true);
  };

  const handleCopySecret = async () => {
    await navigator.clipboard.writeText(clientSecret);
    setSecretCopied(true);
    setTimeout(() => setSecretCopied(false), 2000);
  };

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

    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    if (!clientId.trim()) {
      setError("Client ID is required");
      return;
    }

    if (!clientSecret.trim()) {
      setError("Client secret is required");
      return;
    }

    if (clientSecret.length < 8) {
      setError("Client secret must be at least 8 characters");
      return;
    }

    setIsSubmitting(true);

    try {
      const dto: CreateAgentDto = {
        name: name.trim(),
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim(),
        description: description.trim() || undefined,
        capabilities: capabilities.length > 0 ? capabilities : undefined,
      };

      await observerApi.createAgent(dto);

      // Show credentials before closing
      setCreatedAgent({
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim(),
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create agent");
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setName("");
      setClientId("");
      setClientSecret("");
      setDescription("");
      setCapabilities([]);
      setNewCapability("");
      setShowSecret(false);
      setError(null);
      setCreatedAgent(null);
      onClose();
    }
  };

  const handleDone = () => {
    onSuccess?.();
    handleClose();
  };

  if (!isOpen) return null;

  // Show credentials after successful creation
  if (createdAgent) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={handleDone}
        />
        <div className="relative z-10 w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-xl">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/20">
                <Check className="h-5 w-5 text-green-400" />
              </div>
              <h2 className="text-lg font-semibold">Agent Created</h2>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-400">
              Save these credentials now. The client secret cannot be retrieved later.
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                Client ID
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm font-mono">
                  {createdAgent.clientId}
                </code>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                Client Secret
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm font-mono break-all">
                  {createdAgent.clientSecret}
                </code>
              </div>
            </div>

            <button
              onClick={handleDone}
              className="w-full rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-cyan-500 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

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
            <h2 className="text-lg font-semibold">Register Agent</h2>
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
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g., Code Reviewer"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              disabled={isSubmitting}
            />
          </div>

          {/* Client ID */}
          <div>
            <label
              htmlFor="clientId"
              className="block text-sm font-medium text-zinc-300 mb-1.5"
            >
              Client ID
            </label>
            <input
              id="clientId"
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="e.g., code-reviewer"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
              disabled={isSubmitting}
            />
            <p className="mt-1 text-xs text-zinc-500">
              Lowercase alphanumeric with hyphens only. Used for authentication.
            </p>
          </div>

          {/* Client Secret */}
          <div>
            <label
              htmlFor="clientSecret"
              className="block text-sm font-medium text-zinc-300 mb-1.5"
            >
              Client Secret
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  id="clientSecret"
                  type={showSecret ? "text" : "password"}
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder="Enter or generate a secret"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 pr-20 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
                  disabled={isSubmitting}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="rounded p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
                    disabled={isSubmitting}
                  >
                    {showSecret ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                  {clientSecret && (
                    <button
                      type="button"
                      onClick={handleCopySecret}
                      className="rounded p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
                      disabled={isSubmitting}
                    >
                      {secretCopied ? (
                        <Check className="h-4 w-4 text-green-400" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={handleGenerateSecret}
                disabled={isSubmitting}
                className="rounded-lg bg-zinc-700 px-3 py-2 text-sm hover:bg-zinc-600 transition-colors whitespace-nowrap"
              >
                Generate
              </button>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              Minimum 8 characters. Save this securely - it cannot be retrieved later.
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
              placeholder="What does this agent do?"
              rows={2}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 resize-none"
              disabled={isSubmitting}
            />
          </div>

          {/* Capabilities */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Capabilities{" "}
              <span className="text-zinc-500 font-normal">(optional)</span>
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
              disabled={isSubmitting || !name.trim() || !clientId.trim() || !clientSecret.trim()}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-cyan-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Agent"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
