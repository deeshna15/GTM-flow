"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, Bell, Sparkles, Server, Check } from "lucide-react";
import { healthApi } from "@/services/api";
import { notificationsApi, NotificationItem } from "@/services/automations";

export function Header() {
  const router = useRouter();
  const [isLive, setIsLive] = useState<boolean | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notifOpen, setNotifOpen] = useState<boolean>(false);

  const loadNotifications = async () => {
    try {
      const data = await notificationsApi.list();
      setNotifications(data.items);
      setUnreadCount(data.unread_count);
    } catch {
      // ignore if unauthenticated
    }
  };

  useEffect(() => {
    let isMounted = true;
    const checkStatus = async () => {
      try {
        const res = await healthApi.getLiveness();
        if (isMounted) {
          setIsLive(res.status === "online");
        }
      } catch {
        if (isMounted) {
          setIsLive(false);
        }
      }
    };

    checkStatus();
    loadNotifications();
    const interval = setInterval(() => {
      checkStatus();
      loadNotifications();
    }, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      router.push(`/accounts?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  return (
    <header className="h-16 border-b border-slate-200 bg-white/80 backdrop-blur-md px-8 flex items-center justify-between sticky top-0 z-20">
      {/* Search trigger */}
      <div className="flex items-center gap-4 w-96">
        <div className="relative w-full">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search accounts or domains and press Enter..."
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-3 relative">
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
        <Link
          href="/enrichment"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border border-indigo-100 bg-indigo-50/70 text-indigo-700 hover:bg-indigo-100/70 transition-colors"
        >
          <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
          <span className="font-semibold text-[11px]">Claude AI Hub</span>
        </Link>

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen((prev) => !prev)}
            className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors relative"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="h-2.5 w-2.5 rounded-full bg-indigo-600 absolute top-1 right-1 ring-2 ring-white" />
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <span className="text-xs font-bold text-slate-800">
                  Alerts & Routing ({unreadCount} unread)
                </span>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[11px] text-indigo-600 hover:underline flex items-center gap-1 font-medium"
                  >
                    <Check className="h-3 w-3" /> Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No notifications yet.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={async () => {
                        if (!n.is_read) {
                          await notificationsApi.markRead(n.id);
                          loadNotifications();
                        }
                        if (n.entity_type === "ACCOUNT" && n.entity_id) {
                          setNotifOpen(false);
                          router.push(`/accounts/${n.entity_id}`);
                        }
                      }}
                      className={`p-3 text-xs cursor-pointer hover:bg-slate-50 transition-colors ${
                        !n.is_read ? "bg-indigo-50/40" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-900">{n.title}</span>
                        {!n.is_read && <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 shrink-0" />}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
