"use client";

import { useState, useEffect } from "react";
import { X, Key, Loader2, Copy, Check, AlertTriangle } from "lucide-react";
import {
  observerApi,
  groupsApi,
  type CreateRegistrationTokenDto,
  type RegistrationToken,
  type Group,
} from "@/lib/api-client";

interface CreateRegistrationTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateRegistrationTokenModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateRegistrationTokenModalProps) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState("");
  const [name, setName] = useState("");
  const [expiresInHours, setExpiresInHours] = useState<string>("");
  const [maxUses, setMaxUses] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdToken, setCreatedToken] = useState<RegistrationToken | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);

  // Fetch groups when modal opens
  useEffect(() => {
    if (isOpen) {
      let cancelled = false;

      const fetchGroups = async () => {
        setIsLoadingGroups(true);
        try {
          const data = await groupsApi.list();
          if (!cancelled) setGroups(data);
        } catch {
          if (!cancelled) setError("Failed to load groups");
        } finally {
          if (!cancelled) setIsLoadingGroups(false);
        }
      };

      void fetchGroups();

      return () => {
        cancelled = true;
      };
    }
  }, [isOpen]);

  const handleCopyToken = async () => {
    if (createdToken) {
      await navigator.clipboard.writeText(createdToken.token);
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 2000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!groupId) {
      setError("Please select a group");
      return;
    }

    setIsSubmitting(true);

    try {
      const dto: CreateRegistrationTokenDto = {
        groupId,
        name: name.trim() || undefined,
        expiresInHours: expiresInHours ? parseInt(expiresInHours, 10) : undefined,
        maxUses: maxUses ? parseInt(maxUses, 10) : undefined,
      };

      const token = await observerApi.createRegistrationToken(dto);
      setCreatedToken(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create token");
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setGroupId("");
      setName("");
      setExpiresInHours("");
      setMaxUses("");
      setError(null);
      setCreatedToken(null);
      setTokenCopied(false);
      onClose();
    }
  };

  const handleDone = () => {
    onSuccess?.();
    handleClose();
  };

  if (!isOpen) return null;

  // Show token after successful creation
  if (createdToken) {
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
              <h2 className="text-lg font-semibold">Token Created</h2>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-400 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>Save this token now. It will only be shown once.</span>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                Registration Token
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm font-mono break-all">
                  {createdToken.token}
                </code>
                <button
                  onClick={handleCopyToken}
                  className="rounded-lg border border-zinc-700 p-2.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
                >
                  {tokenCopied ? (
                    <Check className="h-4 w-4 text-green-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-zinc-400">Group:</span>
                <p className="text-white">{createdToken.groupName}</p>
              </div>
              {createdToken.expiresAt && (
                <div>
                  <span className="text-zinc-400">Expires:</span>
                  <p className="text-white">
                    {new Date(createdToken.expiresAt).toLocaleDateString()}
                  </p>
                </div>
              )}
              {createdToken.maxUses && (
                <div>
                  <span className="text-zinc-400">Max Uses:</span>
                  <p className="text-white">{createdToken.maxUses}</p>
                </div>
              )}
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
      <div className="relative z-10 w-full max-w-lg rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/20">
              <Key className="h-5 w-5 text-cyan-400" />
            </div>
            <h2 className="text-lg font-semibold">Generate Registration Token</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-zinc-400 mb-6">
          Create a token that agents can use to self-register. They will need
          approval before they can authenticate.
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Group Selection */}
          <div>
            <label
              htmlFor="group"
              className="block text-sm font-medium text-zinc-300 mb-1.5"
            >
              Target Group <span className="text-red-400">*</span>
            </label>
            {isLoadingGroups ? (
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading groups...
              </div>
            ) : (
              <select
                id="group"
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                disabled={isSubmitting}
              >
                <option value="">Select a group...</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            )}
            <p className="mt-1 text-xs text-zinc-500">
              Agents using this token will join this group on approval
            </p>
          </div>

          {/* Token Name */}
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-zinc-300 mb-1.5"
            >
              Token Name{" "}
              <span className="text-zinc-500 font-normal">(optional)</span>
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Q1 2026 Onboarding"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              disabled={isSubmitting}
            />
          </div>

          {/* Expiration & Max Uses */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="expires"
                className="block text-sm font-medium text-zinc-300 mb-1.5"
              >
                Expires In (hours)
              </label>
              <input
                id="expires"
                type="number"
                min="1"
                value={expiresInHours}
                onChange={(e) => setExpiresInHours(e.target.value)}
                placeholder="Never"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label
                htmlFor="maxUses"
                className="block text-sm font-medium text-zinc-300 mb-1.5"
              >
                Max Uses
              </label>
              <input
                id="maxUses"
                type="number"
                min="1"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                placeholder="Unlimited"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                disabled={isSubmitting}
              />
            </div>
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
              disabled={isSubmitting || !groupId}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-cyan-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Generate Token"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
