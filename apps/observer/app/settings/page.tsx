"use client";

import { useState } from "react";
import { useNexus } from "@/hooks/use-nexus";
import {
  Settings,
  Server,
  Key,
  Bell,
  Shield,
  Webhook,
  Save,
  TestTube,
  CheckCircle,
  XCircle,
  ExternalLink,
} from "lucide-react";

interface SettingsSection {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
}

const sections: SettingsSection[] = [
  {
    id: "connection",
    title: "Nexus Connection",
    description: "Configure connection to the Nexus orchestration server",
    icon: Server,
  },
  {
    id: "integrations",
    title: "Integrations",
    description: "Manage ClickUp and Slack integration settings",
    icon: Webhook,
  },
  {
    id: "notifications",
    title: "Notifications",
    description: "Configure notification preferences",
    icon: Bell,
  },
  {
    id: "security",
    title: "Security",
    description: "API keys and authentication settings",
    icon: Shield,
  },
];

export default function SettingsPage() {
  const { connected } = useNexus();
  const [activeSection, setActiveSection] = useState("connection");
  const [nexusUrl, setNexusUrl] = useState("http://localhost:3000");
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "idle" | "success" | "error"
  >("idle");

  const testConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus("idle");

    // Simulate connection test
    await new Promise((resolve) => setTimeout(resolve, 1500));

    setConnectionStatus(connected ? "success" : "error");
    setTestingConnection(false);
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-zinc-400">Configure your Observer dashboard</p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-1">
          <nav className="space-y-1">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    activeSection === section.id
                      ? "bg-zinc-800 text-white"
                      : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {section.title}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            {/* Connection Settings */}
            {activeSection === "connection" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-1">
                    Nexus Connection
                  </h2>
                  <p className="text-sm text-zinc-400">
                    Configure the connection to your Nexus orchestration server
                  </p>
                </div>

                {/* Connection Status */}
                <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-800/50 p-4">
                  <div
                    className={`h-3 w-3 rounded-full ${
                      connected ? "bg-green-500" : "bg-red-500"
                    }`}
                  />
                  <div>
                    <p className="text-sm font-medium">
                      {connected ? "Connected" : "Disconnected"}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {connected
                        ? "Real-time updates active"
                        : "Attempting to connect..."}
                    </p>
                  </div>
                </div>

                {/* URL Input */}
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">
                    Nexus Server URL
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={nexusUrl}
                      onChange={(e) => setNexusUrl(e.target.value)}
                      className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                    <button
                      onClick={testConnection}
                      disabled={testingConnection}
                      className="flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-800 transition-colors disabled:opacity-50"
                    >
                      {testingConnection ? (
                        <>
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-200" />
                          Testing...
                        </>
                      ) : (
                        <>
                          <TestTube className="h-4 w-4" />
                          Test
                        </>
                      )}
                    </button>
                  </div>
                  {connectionStatus === "success" && (
                    <p className="mt-2 text-sm text-green-400 flex items-center gap-1">
                      <CheckCircle className="h-4 w-4" />
                      Connection successful
                    </p>
                  )}
                  {connectionStatus === "error" && (
                    <p className="mt-2 text-sm text-red-400 flex items-center gap-1">
                      <XCircle className="h-4 w-4" />
                      Connection failed - check URL and server status
                    </p>
                  )}
                </div>

                {/* Save Button */}
                <div className="pt-4 border-t border-zinc-800">
                  <button className="flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium hover:bg-cyan-700 transition-colors">
                    <Save className="h-4 w-4" />
                    Save Changes
                  </button>
                </div>
              </div>
            )}

            {/* Integrations Settings */}
            {activeSection === "integrations" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-1">Integrations</h2>
                  <p className="text-sm text-zinc-400">
                    Manage your connected services
                  </p>
                </div>

                {/* ClickUp Integration */}
                <div className="rounded-lg border border-zinc-800 p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/20">
                        <span className="text-lg">📋</span>
                      </div>
                      <div>
                        <h3 className="font-medium">ClickUp</h3>
                        <p className="text-xs text-zinc-500">
                          Task management integration
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-green-500/20 px-2.5 py-1 text-xs font-medium text-green-400">
                      Connected
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800 transition-colors">
                      Configure
                    </button>
                    <button className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800 transition-colors flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" />
                      ClickUp Dashboard
                    </button>
                  </div>
                </div>

                {/* Slack Integration */}
                <div className="rounded-lg border border-zinc-800 p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-pink-500/20">
                        <span className="text-lg">💬</span>
                      </div>
                      <div>
                        <h3 className="font-medium">Slack</h3>
                        <p className="text-xs text-zinc-500">
                          Team communication integration
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-green-500/20 px-2.5 py-1 text-xs font-medium text-green-400">
                      Connected
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800 transition-colors">
                      Configure
                    </button>
                    <button className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800 transition-colors flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" />
                      Slack Workspace
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Notifications Settings */}
            {activeSection === "notifications" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-1">Notifications</h2>
                  <p className="text-sm text-zinc-400">
                    Configure how you receive notifications
                  </p>
                </div>

                <div className="space-y-4">
                  {[
                    {
                      label: "Agent connection events",
                      description:
                        "Notify when agents connect or disconnect",
                      enabled: true,
                    },
                    {
                      label: "Task assignment events",
                      description: "Notify when tasks are assigned to agents",
                      enabled: true,
                    },
                    {
                      label: "Error alerts",
                      description: "Notify when errors occur in the system",
                      enabled: true,
                    },
                    {
                      label: "Webhook events",
                      description:
                        "Notify when webhooks are received from integrations",
                      enabled: false,
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between rounded-lg border border-zinc-800 p-4"
                    >
                      <div>
                        <p className="font-medium text-sm">{item.label}</p>
                        <p className="text-xs text-zinc-500">
                          {item.description}
                        </p>
                      </div>
                      <button
                        className={`relative h-6 w-11 rounded-full transition-colors ${
                          item.enabled ? "bg-cyan-600" : "bg-zinc-700"
                        }`}
                      >
                        <div
                          className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${
                            item.enabled ? "left-6" : "left-1"
                          }`}
                        />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Save Button */}
                <div className="pt-4 border-t border-zinc-800">
                  <button className="flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium hover:bg-cyan-700 transition-colors">
                    <Save className="h-4 w-4" />
                    Save Preferences
                  </button>
                </div>
              </div>
            )}

            {/* Security Settings */}
            {activeSection === "security" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-1">Security</h2>
                  <p className="text-sm text-zinc-400">
                    Manage API keys and authentication
                  </p>
                </div>

                {/* API Keys */}
                <div>
                  <h3 className="text-sm font-medium text-zinc-300 mb-3">
                    API Keys
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-lg border border-zinc-800 p-4">
                      <div className="flex items-center gap-3">
                        <Key className="h-4 w-4 text-zinc-500" />
                        <div>
                          <p className="text-sm font-medium">Observer API Key</p>
                          <p className="text-xs text-zinc-500">
                            obs_***************8f2a
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 transition-colors">
                          Reveal
                        </button>
                        <button className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 transition-colors">
                          Regenerate
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Webhook Secrets */}
                <div>
                  <h3 className="text-sm font-medium text-zinc-300 mb-3">
                    Webhook Verification
                  </h3>
                  <div className="rounded-lg border border-zinc-800 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Shield className="h-4 w-4 text-green-400" />
                      <span className="text-sm text-green-400">
                        HMAC signature verification enabled
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500">
                      All incoming webhooks are verified using HMAC-SHA256
                      signatures to ensure authenticity.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
