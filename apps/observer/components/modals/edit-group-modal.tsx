"use client";

import { useState, useEffect } from "react";
import {
  X,
  Users,
  Loader2,
  Archive,
  UserPlus,
  UserMinus,
  Bot,
  Crown,
  AlertTriangle,
} from "lucide-react";
import {
  groupsApi,
  observerApi,
  type Group,
  type UpdateGroupDto,
  type GroupMember,
  type ObserverAgent,
} from "@/lib/api-client";

interface EditGroupModalProps {
  isOpen: boolean;
  group: Group | null;
  onClose: () => void;
  onSuccess?: () => void;
}

type Tab = "details" | "members";

export function EditGroupModal({
  isOpen,
  group,
  onClose,
  onSuccess,
}: EditGroupModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>("details");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [availableAgents, setAvailableAgents] = useState<ObserverAgent[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);

  // Initialize form with group data
  useEffect(() => {
    if (isOpen && group) {
      setName(group.name);
      setDescription(group.description || "");
      setActiveTab("details");
      setError(null);
      setShowArchiveConfirm(false);
      loadMembers();
      loadAvailableAgents();
    }
  }, [isOpen, group]);

  const loadMembers = async () => {
    if (!group) return;
    setIsLoadingMembers(true);
    try {
      const data = await groupsApi.getMembers(group.id);
      setMembers(data);
    } catch (err) {
      console.error("Failed to load members:", err);
    } finally {
      setIsLoadingMembers(false);
    }
  };

  const loadAvailableAgents = async () => {
    try {
      const agents = await observerApi.getAgents();
      setAvailableAgents(agents);
    } catch (err) {
      console.error("Failed to load agents:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!group) return;
    setError(null);

    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setIsSubmitting(true);

    try {
      const dto: UpdateGroupDto = {
        name: name.trim(),
        description: description.trim() || null,
      };

      await groupsApi.update(group.id, dto);
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update group");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = async () => {
    if (!group) return;
    setIsSubmitting(true);
    setError(null);

    try {
      await groupsApi.archive(group.id);
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to archive group");
    } finally {
      setIsSubmitting(false);
      setShowArchiveConfirm(false);
    }
  };

  const handleAddMember = async (agentId: string) => {
    if (!group) return;
    setError(null);

    try {
      await groupsApi.addMember(group.id, { agentId, role: "member" });
      await loadMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add member");
    }
  };

  const handleRemoveMember = async (agentId: string) => {
    if (!group) return;
    setError(null);

    try {
      await groupsApi.removeMember(group.id, agentId);
      await loadMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove member");
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setName("");
      setDescription("");
      setMembers([]);
      setError(null);
      setShowArchiveConfirm(false);
      onClose();
    }
  };

  if (!isOpen || !group) return null;

  // Agents not already in the group
  const memberIds = new Set(members.map((m) => m.agent.id));
  const nonMembers = availableAgents.filter((a) => !memberIds.has(a.id));

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
              <Users className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Edit Group</h2>
              <p className="text-xs text-zinc-500">{group.slug}</p>
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

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-zinc-800">
          <button
            onClick={() => setActiveTab("details")}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === "details"
                ? "border-cyan-500 text-cyan-400"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Details
          </button>
          <button
            onClick={() => setActiveTab("members")}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === "members"
                ? "border-cyan-500 text-cyan-400"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Members ({members.length})
          </button>
        </div>

        {/* Details Tab */}
        {activeTab === "details" && (
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
                onChange={(e) => setName(e.target.value)}
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
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
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
                disabled={isSubmitting || !name.trim()}
                className="flex items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-cyan-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
        )}

        {/* Members Tab */}
        {activeTab === "members" && (
          <div className="space-y-4">
            {/* Current Members */}
            <div>
              <h3 className="text-sm font-medium text-zinc-300 mb-3">
                Current Members
              </h3>
              {isLoadingMembers ? (
                <div className="flex items-center justify-center py-8 text-zinc-500">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Loading members...
                </div>
              ) : members.length === 0 ? (
                <div className="text-center py-8 text-zinc-500 text-sm">
                  No members yet
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {members.map((member) => (
                    <div
                      key={member.agent.id}
                      className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-800/50 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-zinc-700 flex items-center justify-center">
                          <Bot className="h-4 w-4 text-zinc-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-white">
                              {member.agent.name}
                            </span>
                            {member.role === "lead" && (
                              <Crown className="h-3 w-3 text-amber-500" />
                            )}
                          </div>
                          <span className="text-xs text-zinc-500">
                            {member.role}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveMember(member.agent.id)}
                        className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-700 hover:text-red-400 transition-colors"
                      >
                        <UserMinus className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Members */}
            {nonMembers.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-zinc-300 mb-3">
                  Add Members
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {nonMembers.map((agent) => (
                    <div
                      key={agent.id}
                      className="flex items-center justify-between rounded-lg border border-zinc-800 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center">
                          <Bot className="h-4 w-4 text-zinc-500" />
                        </div>
                        <div>
                          <span className="text-sm font-medium text-zinc-300">
                            {agent.name}
                          </span>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                agent.isConnected
                                  ? "bg-green-500"
                                  : "bg-zinc-600"
                              }`}
                            />
                            <span className="text-xs text-zinc-500">
                              {agent.isConnected ? "Online" : "Offline"}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleAddMember(agent.id)}
                        className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-800 hover:text-cyan-400 transition-colors"
                      >
                        <UserPlus className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Archive Confirmation */}
        {showArchiveConfirm && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-zinc-900/95">
            <div className="text-center p-6">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20">
                <AlertTriangle className="h-6 w-6 text-red-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Archive Group?</h3>
              <p className="text-sm text-zinc-400 mb-6">
                This will archive "{group.name}" and all its projects.
                <br />
                Members will be removed from this group.
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
                      Archive Group
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
