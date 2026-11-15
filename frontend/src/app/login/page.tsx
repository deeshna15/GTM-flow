"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Lock, Mail, User as UserIcon, ArrowRight, Sparkles, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { authApi } from "@/services/auth";
import { UserRole } from "@/types";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>("ADMIN");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const existingToken = localStorage.getItem("gtmflow_token");
      if (existingToken) {
        router.replace("/");
      }
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      if (mode === "register") {
        await authApi.register({
          full_name: fullName.trim(),
          email: email.trim(),
          password,
          role,
        });
      }
      await authApi.login({
        email: email.trim(),
        password,
      });
      router.replace("/");
    } catch (err: any) {
      setError(err.message || "Authentication failed. Check your credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  const fillDemoAdmin = () => {
    setMode("login");
    setEmail("admin@secfix-gtm.example");
    setPassword("AdminPass123!");
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="h-12 w-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center mx-auto shadow-md shadow-indigo-200">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">GTMFlow</h1>
          <p className="text-xs text-slate-500">
            AI-Powered Lead Intelligence, Account Scoring & Sales Automation
          </p>
        </div>

        {/* Auth Card */}
        <Card className="border border-slate-200 shadow-sm bg-white">
          <div className="grid grid-cols-2 border-b border-slate-100">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className={`py-3 text-xs font-semibold transition-colors ${
                mode === "login"
                  ? "text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setError(null);
              }}
              className={`py-3 text-xs font-semibold transition-colors ${
                mode === "register"
                  ? "text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Create Account
            </button>
          </div>

          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "register" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Full Name
                  </label>
                  <div className="relative">
                    <UserIcon className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      minLength={2}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Alex Weber"
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Work Email
                </label>
                <div className="relative">
                  <Mail className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              {mode === "register" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Workspace Role
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value="ADMIN">Admin (Full Scoring, Rules & Team Access)</option>
                    <option value="SALES">Sales Representative (Accounts, Leads & Enrichment)</option>
                  </select>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-2.5 flex items-center justify-center gap-2"
              >
                {isLoading
                  ? "Authenticating..."
                  : mode === "login"
                  ? "Sign In to GTMFlow"
                  : "Create Account & Sign In"}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </form>

            {/* Demo Seed Hint */}
            <div className="mt-5 pt-4 border-t border-slate-100">
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200/80 flex items-center justify-between gap-2">
                <div className="text-[11px] text-slate-600">
                  <div className="flex items-center gap-1 font-semibold text-slate-800">
                    <Sparkles className="h-3 w-3 text-indigo-600" />
                    Seeded Demo Workspace?
                  </div>
                  <p className="text-slate-500 mt-0.5 font-mono text-[10px]">
                    admin@secfix-gtm.example / AdminPass123!
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={fillDemoAdmin}
                  className="text-[11px] h-7 px-2.5 shrink-0"
                >
                  Fill Demo
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
