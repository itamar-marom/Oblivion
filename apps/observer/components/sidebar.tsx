"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bot,
  FolderKanban,
  LayoutDashboard,
  Settings,
  Users,
} from "lucide-react";
import { observerApi } from "@/lib/api-client";
import { useAuth } from "@/contexts/auth-context";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Groups", href: "/groups", icon: Users },
  { name: "Projects", href: "/projects", icon: FolderKanban },
  { name: "Agents", href: "/agents", icon: Bot, showPendingBadge: true },
  { name: "Activity", href: "/activity", icon: Activity },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);

  // Fetch pending count on mount and periodically
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchPendingCount = async () => {
      try {
        const { count } = await observerApi.getPendingCount();
        setPendingCount(count);
      } catch {
        // Ignore errors silently
      }
    };

    fetchPendingCount();
    const interval = setInterval(fetchPendingCount, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [isAuthenticated]);

  return (
    <div className="flex h-full w-64 flex-col border-r border-zinc-800 bg-zinc-900">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-zinc-800 px-6">
        <img
          src="/oblivion-icon.jpeg"
          alt="Oblivion"
          width={32}
          height={32}
          className="rounded-lg flex-shrink-0"
        />
        <span className="text-lg font-semibold text-white">Observer</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:bg-zinc-800/50 hover:text-white"
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span className="flex-1">{item.name}</span>
              {item.showPendingBadge && pendingCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-yellow-500 px-1.5 text-xs font-semibold text-black">
                  {pendingCount > 99 ? "99+" : pendingCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Status Footer */}
      <div className="border-t border-zinc-800 p-4">
        <div className="flex items-center gap-2 text-sm">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          <span className="text-zinc-400">Nexus Connected</span>
        </div>
      </div>
    </div>
  );
}
