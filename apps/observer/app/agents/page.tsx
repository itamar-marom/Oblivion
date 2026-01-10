"use client";

import { useState, useEffect, useCallback } from "react";
import { useNexus } from "@/hooks/use-nexus";
import { formatDistanceToNow, format } from "date-fns";
import {
  Bot,
  Wifi,
  WifiOff,
  Zap,
  Clock,
  Settings,
  Key,
  UserPlus,
  Users,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  CreateAgentModal,
  EditAgentModal,
  ApproveAgentModal,
  CreateRegistrationTokenModal,
} from "@/components/modals";
import {
  observerApi,
  type ObserverAgent,
  type PendingAgent,
  type RegistrationToken,
} from "@/lib/api-client";

const statusColors = {
  connected: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  idle: "bg-green-500/20 text-green-400 border-green-500/30",
  working: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  error: "bg-red-500/20 text-red-400 border-red-500/30",
  disconnected: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
};

const statusDots = {
  connected: "bg-blue-500",
  idle: "bg-green-500",
  working: "bg-yellow-500",
  error: "bg-red-500",
  disconnected: "bg-zinc-600",
};

export default function AgentsPage() {
  const { agents, refresh } = useNexus();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [tokenModalOpen, setTokenModalOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<ObserverAgent | null>(null);
  const [selectedPendingAgent, setSelectedPendingAgent] = useState<PendingAgent | null>(null);

  // Pending agents state
  const [pendingAgents, setPendingAgents] = useState<PendingAgent[]>([]);
  const [isLoadingPending, setIsLoadingPending] = useState(true);

  // Registration tokens state
  const [tokens, setTokens] = useState<RegistrationToken[]>([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState(true);
  const [showTokens, setShowTokens] = useState(false);

  const connectedCount = agents.filter((a) => a.status !== "disconnected").length;

  // Fetch pending agents
  const fetchPendingAgents = useCallback(async () => {
    try {
      const data = await observerApi.getPendingAgents();
      setPendingAgents(data);
    } catch {
      // Ignore errors
    } finally {
      setIsLoadingPending(false);
    }
  }, []);

  // Fetch registration tokens
  const fetchTokens = useCallback(async () => {
    try {
      const data = await observerApi.listRegistrationTokens();
      setTokens(data);
    } catch {
      // Ignore errors
    } finally {
      setIsLoadingTokens(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingAgents();
    fetchTokens();
  }, [fetchPendingAgents, fetchTokens]);

  const handleReviewPendingAgent = (agent: PendingAgent) => {
    setSelectedPendingAgent(agent);
    setApproveModalOpen(true);
  };

  const handleApprovalSuccess = () => {
    fetchPendingAgents();
    refresh();
  };

  const handleRevokeToken = async (tokenId: string) => {
    if (!confirm("Are you sure you want to revoke this token?")) return;
    try {
      await observerApi.revokeRegistrationToken(tokenId);
      fetchTokens();
    } catch (err) {
      console.error("Failed to revoke token:", err);
    }
  };

  const handleEditAgent = async (agent: typeof agents[0]) => {
    try {
      // Fetch full agent details from API
      const fullAgent = await observerApi.getAgent(agent.id);
      setSelectedAgent(fullAgent);
      setEditModalOpen(true);
    } catch (err) {
      console.error("Failed to fetch agent details:", err);
      // Fallback to basic info from list
      const observerAgent: ObserverAgent = {
        id: agent.id,
        name: agent.name,
        description: null,
        clientId: agent.clientId,
        capabilities: agent.capabilities || [],
        isActive: agent.isActive,
        lastSeenAt: agent.lastHeartbeat,
        createdAt: "",
        isConnected: agent.status !== "disconnected",
        connectionStatus: agent.status === "disconnected" ? "offline" : agent.status,
      };
      setSelectedAgent(observerAgent);
      setEditModalOpen(true);
    }
  };

  const handleEditSuccess = () => {
    refresh();
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agents</h1>
          <p className="text-zinc-400">
            {connectedCount} of {agents.length} agents connected
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setTokenModalOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            <Key className="h-4 w-4" />
            Generate Token
          </button>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium hover:bg-cyan-700 transition-colors"
          >
            Register New Agent
          </button>
        </div>
      </div>

      {/* Pending Approvals Section */}
      {pendingAgents.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus className="h-5 w-5 text-yellow-500" />
            <h2 className="text-lg font-semibold">Pending Approvals</h2>
            <span className="rounded-full bg-yellow-500 px-2 py-0.5 text-xs font-semibold text-black">
              {pendingAgents.length}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pendingAgents.map((agent) => (
              <div
                key={agent.id}
                className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-500/20">
                      <Bot className="h-5 w-5 text-yellow-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{agent.name}</h3>
                      <p className="text-sm text-zinc-500">{agent.clientId}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-yellow-500/20 border border-yellow-500/30 px-2.5 py-1 text-xs font-medium text-yellow-400">
                    Pending
                  </span>
                </div>

                {agent.pendingGroup && (
                  <div className="flex items-center gap-2 text-sm mb-3">
                    <Users className="h-4 w-4 text-zinc-500" />
                    <span className="text-zinc-400">
                      Joining: <span className="text-white">{agent.pendingGroup.name}</span>
                    </span>
                  </div>
                )}

                {agent.capabilities.length > 0 && (
                  <div className="flex items-start gap-2 text-sm mb-4">
                    <Zap className="h-4 w-4 text-zinc-500 mt-0.5" />
                    <div className="flex flex-wrap gap-1">
                      {agent.capabilities.slice(0, 3).map((cap) => (
                        <span
                          key={cap}
                          className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400"
                        >
                          {cap}
                        </span>
                      ))}
                      {agent.capabilities.length > 3 && (
                        <span className="text-xs text-zinc-500">
                          +{agent.capabilities.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => handleReviewPendingAgent(agent)}
                  className="w-full rounded-lg bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-500 transition-colors"
                >
                  Review Request
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Registration Tokens Section */}
      <div className="mb-8">
        <button
          onClick={() => setShowTokens(!showTokens)}
          className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-4"
        >
          <Key className="h-5 w-5" />
          <span className="font-medium">Registration Tokens</span>
          <span className="text-zinc-500">({tokens.filter(t => t.isActive).length} active)</span>
          {showTokens ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>

        {showTokens && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
            {tokens.length === 0 ? (
              <div className="p-6 text-center text-zinc-500">
                No registration tokens yet.{" "}
                <button
                  onClick={() => setTokenModalOpen(true)}
                  className="text-cyan-400 hover:underline"
                >
                  Generate one
                </button>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-zinc-800 bg-zinc-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-zinc-400">Name</th>
                    <th className="px-4 py-3 text-left font-medium text-zinc-400">Group</th>
                    <th className="px-4 py-3 text-left font-medium text-zinc-400">Uses</th>
                    <th className="px-4 py-3 text-left font-medium text-zinc-400">Expires</th>
                    <th className="px-4 py-3 text-left font-medium text-zinc-400">Status</th>
                    <th className="px-4 py-3 text-right font-medium text-zinc-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {tokens.map((token) => (
                    <tr key={token.id} className={!token.isActive ? "opacity-50" : ""}>
                      <td className="px-4 py-3">
                        {token.name || <span className="text-zinc-500">Unnamed</span>}
                      </td>
                      <td className="px-4 py-3 text-zinc-300">{token.groupName}</td>
                      <td className="px-4 py-3 text-zinc-300">
                        {token.usedCount}
                        {token.maxUses && ` / ${token.maxUses}`}
                      </td>
                      <td className="px-4 py-3 text-zinc-300">
                        {token.expiresAt
                          ? format(new Date(token.expiresAt), "MMM d, yyyy")
                          : "Never"}
                      </td>
                      <td className="px-4 py-3">
                        {token.isActive ? (
                          <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-400">
                            Active
                          </span>
                        ) : (
                          <span className="rounded-full bg-zinc-500/20 px-2 py-0.5 text-xs text-zinc-400">
                            Revoked
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {token.isActive && (
                          <button
                            onClick={() => handleRevokeToken(token.id)}
                            className="rounded p-1.5 text-zinc-500 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                            title="Revoke token"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Agent Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-6"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800">
                  <Bot className="h-5 w-5 text-zinc-400" />
                </div>
                <div>
                  <h3 className="font-semibold">{agent.name}</h3>
                  <p className="text-sm text-zinc-500">{agent.clientId}</p>
                </div>
              </div>
              <div
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${statusColors[agent.status]}`}
              >
                <div className={`h-1.5 w-1.5 rounded-full ${statusDots[agent.status]}`} />
                {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
              </div>
            </div>

            {/* Details */}
            <div className="space-y-3">
              {/* Connection Status */}
              <div className="flex items-center gap-2 text-sm">
                {agent.status !== "disconnected" ? (
                  <Wifi className="h-4 w-4 text-green-500" />
                ) : (
                  <WifiOff className="h-4 w-4 text-zinc-500" />
                )}
                <span className="text-zinc-400">
                  {agent.connectionCount} active connection
                  {agent.connectionCount !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Last Heartbeat */}
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-zinc-500" />
                <span className="text-zinc-400">
                  {agent.lastHeartbeat
                    ? `Last seen ${formatDistanceToNow(new Date(agent.lastHeartbeat), { addSuffix: true })}`
                    : "Never connected"}
                </span>
              </div>

              {/* Capabilities */}
              {agent.capabilities && agent.capabilities.length > 0 && (
                <div className="flex items-start gap-2 text-sm">
                  <Zap className="h-4 w-4 text-zinc-500 mt-0.5" />
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
            </div>

            {/* Actions */}
            <div className="mt-4 flex gap-2 border-t border-zinc-800 pt-4">
              <button className="flex-1 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800 transition-colors">
                View Logs
              </button>
              <button
                onClick={() => handleEditAgent(agent)}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800 transition-colors"
              >
                <Settings className="h-3.5 w-3.5" />
                Configure
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {agents.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 p-12">
          <Bot className="h-12 w-12 text-zinc-600 mb-4" />
          <h3 className="text-lg font-medium mb-2">No Agents Registered</h3>
          <p className="text-zinc-500 text-center mb-4">
            Register your first AI agent to start automating tasks
          </p>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium hover:bg-cyan-700 transition-colors"
          >
            Register Agent
          </button>
        </div>
      )}

      {/* Create Agent Modal */}
      <CreateAgentModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={refresh}
      />

      {/* Edit Agent Modal */}
      <EditAgentModal
        isOpen={editModalOpen}
        agent={selectedAgent}
        onClose={() => setEditModalOpen(false)}
        onSuccess={handleEditSuccess}
      />

      {/* Approve Agent Modal */}
      <ApproveAgentModal
        isOpen={approveModalOpen}
        agent={selectedPendingAgent}
        onClose={() => setApproveModalOpen(false)}
        onSuccess={handleApprovalSuccess}
      />

      {/* Create Registration Token Modal */}
      <CreateRegistrationTokenModal
        isOpen={tokenModalOpen}
        onClose={() => setTokenModalOpen(false)}
        onSuccess={fetchTokens}
      />
    </div>
  );
}
