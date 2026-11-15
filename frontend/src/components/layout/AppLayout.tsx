"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);

  const isAuthRoute = pathname === "/login";

  useEffect(() => {
    if (isAuthRoute) {
      setAuthChecked(true);
      return;
    }

    const token = typeof window !== "undefined" ? localStorage.getItem("gtmflow_token") : null;
    if (!token) {
      router.replace("/login");
    } else {
      setAuthChecked(true);
    }
  }, [pathname, isAuthRoute, router]);

  if (isAuthRoute) {
    return <>{children}</>;
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center text-xs text-slate-500">
        Verifying workspace session...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Sidebar />
      <div className="pl-64 flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
