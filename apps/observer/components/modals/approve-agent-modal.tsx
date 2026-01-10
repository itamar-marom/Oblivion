"use client";

import { useState } from "react";
import { X, Bot, Loader2, Check, XCircle, Users } from "lucide-react";
import { observerApi, type PendingAgent } from "@/lib/api-client";

interface ApproveAgentModalProps {
  isOpen: boolean;
  agent: PendingAgent | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ApproveAgentModal({
  isOpen,
  agent,
  onClose,
  onSuccess,
}: ApproveAgentModalProps) {
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleApprove = async () => {
    if (!agent) return;

    setIsApproving(true);
    setError(null);

    try {
      await observerApi.approveAgent(agent.id);
      onSuccess?.();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve agent");
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!agent) return;

    setIsRejecting(true);
    setError(null);

    try {
      await observerApi.rejectAgent(agent.id, {
        reason: rejectReason.trim() || undefined,
      });
      onSuccess?.();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject agent");
      setIsRejecting(false);
    }
  };

  const handleClose = () => {
    if (!isApproving && !isRejecting) {
      setShowRejectForm(false);
      setRejectReason("");
      setError(null);
      onClose();
    }
  };

  if (!isOpen || !agent) return null;

  const isProcessing = isApproving || isRejecting;

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
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-500/20">
              <Bot className="h-5 w-5 text-yellow-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Review Registration</h2>
              <p className="text-sm text-zinc-400">Pending approval</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isProcessing}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Agent Details */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">
              Agent Name
            </label>
            <p className="text-white">{agent.name}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">
              Client ID
            </label>
            <code className="text-sm font-mono text-zinc-300 bg-zinc-800 px-2 py-1 rounded">
              {agent.clientId}
            </code>
          </div>

          {agent.description && (
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Description
              </label>
              <p className="text-zinc-300 text-sm">{agent.description}</p>
            </div>
          )}

          {agent.email && (
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Email
              </label>
              <p className="text-zinc-300 text-sm">{agent.email}</p>
            </div>
          )}

          {agent.capabilities.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Capabilities
              </label>
              <div className="flex flex-wrap gap-1">
                {agent.capabilities.map((cap) => (
                  <span
                    key={cap}
                    className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400"
                  >
                    {cap}
                  </span>
                ))}
              </div>
            </div>
          )}

          {agent.pendingGroup && (
            <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-cyan-400" />
                <span className="text-sm font-medium text-zinc-300">
                  Target Group
                </span>
              </div>
              <p className="text-white font-medium">{agent.pendingGroup.name}</p>
              <p className="text-xs text-zinc-400 mt-1">
                Agent will automatically join this group upon approval
              </p>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Reject Form */}
        {showRejectForm ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                Rejection Reason{" "}
                <span className="text-zinc-500 font-normal">(optional)</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain why this registration was rejected..."
                rows={3}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 resize-none"
                disabled={isRejecting}
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowRejectForm(false)}
                disabled={isRejecting}
                className="flex-1 rounded-lg border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors disabled:opacity-50"
              >
                Back
              </button>
              <button
                onClick={handleReject}
                disabled={isRejecting}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-500 transition-colors disabled:opacity-50"
              >
                {isRejecting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Rejecting...
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4" />
                    Confirm Reject
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Actions */
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setShowRejectForm(true)}
              disabled={isProcessing}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-red-500/50 px-4 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
            >
              <XCircle className="h-4 w-4" />
              Reject
            </button>
            <button
              onClick={handleApprove}
              disabled={isProcessing}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-500 transition-colors disabled:opacity-50"
            >
              {isApproving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Approving...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Approve
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
