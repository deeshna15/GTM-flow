"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Users,
  UploadCloud,
  Sparkles,
  Target,
  Zap,
  Activity,
  Settings,
  ShieldCheck,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { authApi } from "@/services/auth";
import { User } from "@/types";

const navigationItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Accounts", href: "/accounts", icon: Building2 },
  { name: "Contacts", href: "/contacts", icon: Users },
  { name: "Data Import", href: "/imports", icon: UploadCloud },
  { name: "AI Enrichment", href: "/enrichment", icon: Sparkles, badge: "Claude" },
  { name: "Lead Scoring", href: "/scoring", icon: Target },
  { name: "Automation Center", href: "/automations", icon: Zap },
  { name: "Jobs & Monitoring", href: "/jobs", icon: Activity },
  { name: "Team & Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("gtmflow_user");
      if (cached) {
        try {
          setUser(JSON.parse(cached));
        } catch {
          // ignore
        }
      }
      authApi
        .getCurrentUser()
        .then((u) => {
          setUser(u);
          localStorage.setItem("gtmflow_user", JSON.stringify(u));
        })
        .catch(() => {
          // handled by interceptor
        });
    }
  }, []);

  const handleLogout = () => {
    authApi.logout();
    router.replace("/login");
  };

  const initials = user?.full_name
    ? user.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "SF";

  return (
    <aside className="w-64 border-r border-slate-200 bg-white flex flex-col h-screen fixed left-0 top-0 z-30 select-none">
      {/* Brand Header */}
      <div className="h-16 px-6 flex items-center justify-between border-b border-slate-100">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm shadow-indigo-200">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-900 text-base tracking-tight">GTMFlow</span>
              <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100">
                GTM
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">Secfix Lead Intelligence</p>
          </div>
        </Link>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Core Workflows
        </div>
        {navigationItems.map((item) => {
          const isActive =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "group flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-all duration-150",
                isActive
                  ? "bg-indigo-50/80 text-indigo-700 font-semibold"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={cn(
                    "h-4 w-4 transition-colors",
                    isActive ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"
                  )}
                />
                <span>{item.name}</span>
              </div>
              <div className="flex items-center gap-1">
                {item.badge && (
                  <span className="text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.2 rounded-full">
                    {item.badge}
                  </span>
                )}
                {isActive && <ChevronRight className="h-3.5 w-3.5 text-indigo-500" />}
              </div>
            </Link>
          );
        })}
      </div>

      {/* User Footer Profile */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/60">
        <div className="flex items-center gap-2.5 p-2 rounded-lg bg-white border border-slate-200/70 shadow-2xs">
          <div className="h-8 w-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-semibold text-slate-900 truncate">
                {user?.full_name || "GTM User"}
              </p>
              {user?.role && (
                <span className="text-[9px] font-bold uppercase px-1 py-0.2 rounded bg-indigo-50 text-indigo-700">
                  {user.role}
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-500 truncate">
              {user?.email || "Authenticated"}
            </p>
          </div>
          <button
            onClick={handleLogout}
            title="Sign Out"
            className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
