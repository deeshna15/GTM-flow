"use client";

import React, { useEffect, useState } from "react";
import { Search, Bell, Sparkles, Server, CheckCircle2, AlertCircle } from "lucide-react";
import { healthApi } from "@/services/api";
import { SystemHealth } from "@/types";

export function Header() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [isLive, setIsLive] = useState<boolean | null>(null);

  useEffect(() => {
    let isMounted = true;
    const checkStatus = async () => {
      try {
        const res = await healthApi.getLiveness();
        if (isMounted) {
          setHealth(res);
          setIsLive(res.status === "online");
        }
      } catch {
        if (isMounted) {
          setIsLive(false);
        }
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <header className="h-16 border-b border-slate-200 bg-white/80 backdrop-blur-md px-8 flex items-center justify-between sticky top-0 z-20">
      {/* Search trigger */}
      <div className="flex items-center gap-4 w-96">
        <div className="relative w-full">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search accounts, domains, contacts... (Press ⌘K)"
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            readOnly
          />
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-3">
        {/* Backend Connectivity Status Badge */}
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full text-xs border border-slate-200 bg-slate-50">
          <Server className="h-3.5 w-3.5 text-slate-500" />
          <span className="text-slate-600 font-medium text-[11px]">Backend API</span>
          {isLive === null ? (
            <span className="h-2 w-2 rounded-full bg-slate-300 animate-pulse" />
          ) : isLive ? (
            <span className="flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Connected
            </span>
          ) : (
            <span className="flex items-center gap-1 text-red-600 font-semibold text-[11px]">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              Offline
            </span>
          )}
        </div>

        {/* AI Agent Status */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border border-indigo-100 bg-indigo-50/70 text-indigo-700">
          <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
          <span className="font-semibold text-[11px]">Claude 3.5 Ready</span>
        </div>

        {/* Notification Bell */}
        <button
          className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors relative"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          <span className="h-2 w-2 rounded-full bg-indigo-600 absolute top-1.5 right-1.5 ring-2 ring-white" />
        </button>
      </div>
    </header>
  );
}
