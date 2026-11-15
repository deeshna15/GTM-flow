"use client";

import React, { useState, useEffect } from "react";
import {
  Settings,
  Users,
  UserPlus,
  Shield,
  CheckCircle2,
  XCircle,
  ExternalLink,
  X,
  Database,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { usersApi, TeamMember } from "@/services/dashboard";
import { formatDate } from "@/lib/utils";
import { User, UserRole } from "@/types";

export default function SettingsPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  // Invite form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("SALES");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadMembers = async () => {
    setIsLoading(true);
    try {
      const data = await usersApi.listUsers();
      setMembers(data);
    } catch (err) {
      console.error("Failed to fetch team members:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("gtmflow_user");
      if (cached) {
        try {
          setCurrentUser(JSON.parse(cached));
        } catch {
          // ignore
        }
      }
    }
    loadMembers();
  }, []);

  const isAdmin = currentUser?.role === "ADMIN";
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
  const docsUrl = apiBase.replace("/api/v1", "/docs");

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);
    try {
      await usersApi.createUser({
        full_name: fullName.trim(),
        email: email.trim(),
        password,
        role,
      });
      setIsInviteOpen(false);
      setFullName("");
      setEmail("");
      setPassword("");
      await loadMembers();
    } catch (err: any) {
      setFormError(err.message || "Failed to add user.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (member: TeamMember) => {
    try {
      await usersApi.updateUser(member.id, { is_active: !member.is_active });
      await loadMembers();
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
    }
  };

  const handleRoleChange = async (member: TeamMember, newRole: UserRole) => {
    try {
      await usersApi.updateUser(member.id, { role: newRole });
      await loadMembers();
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Settings className="h-6 w-6 text-indigo-600" />
            Team & Workspace Settings
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage GTM team roles, least-loaded sales routing eligibility, and developer API documentation.
          </p>
        </div>

        {isAdmin && (
          <Button
            size="sm"
            onClick={() => setIsInviteOpen(true)}
            className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <UserPlus className="h-3.5 w-3.5 mr-1.5" />
            Add Team Member
          </Button>
        )}
      </div>

      {/* Team Directory */}
      <Card className="border border-slate-200 bg-white overflow-hidden">
        <CardHeader className="p-5 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-indigo-600" />
              Team Members & Routing Pool
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Active SALES users automatically participate in least-loaded lead routing.
            </p>
          </div>
          {!isAdmin && (
            <Badge className="text-[10px] bg-slate-100 text-slate-600 border-slate-200">
              Read-Only (Admin Required to Edit)
            </Badge>
          )}
        </CardHeader>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[10px]">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Assigned Accounts</th>
                <th className="px-4 py-3">Joined</th>
                {isAdmin && <th className="px-4 py-3 text-right">Manage</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={6} className="px-4 py-3">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  </tr>
                ))
              ) : (
                members.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-900">{m.full_name}</p>
                      <p className="text-[11px] text-slate-400 font-mono">{m.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      {isAdmin && m.id !== currentUser?.id ? (
                        <select
                          value={m.role}
                          onChange={(e) => handleRoleChange(m, e.target.value as UserRole)}
                          className="px-2 py-1 rounded border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
                        >
                          <option value="ADMIN">ADMIN</option>
                          <option value="SALES">SALES</option>
                        </select>
                      ) : (
                        <Badge
                          className={`text-[10px] ${
                            m.role === "ADMIN"
                              ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                              : "bg-slate-100 text-slate-700 border-slate-200"
                          }`}
                        >
                          {m.role}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {m.is_active ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-400 font-semibold">
                          <XCircle className="h-3.5 w-3.5" /> Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                      {m.assigned_accounts_count}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(m.created_at)}</td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
                        {m.id !== currentUser?.id ? (
                          <button
                            onClick={() => handleToggleActive(m)}
                            className="text-xs font-semibold text-indigo-600 hover:underline"
                          >
                            {m.is_active ? "Deactivate" : "Reactivate"}
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400">Current User</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Platform Resources */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5 border border-slate-200 bg-white space-y-2">
          <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
            <Database className="h-4 w-4 text-indigo-600" />
            Swagger / OpenAPI Documentation
          </div>
          <p className="text-xs text-slate-500">
            Explore full REST schemas, authentication Bearer flows, and endpoint specs served live by FastAPI.
          </p>
          <a
            href={docsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline pt-1"
          >
            Open Swagger UI ({docsUrl}) <ExternalLink className="h-3 w-3" />
          </a>
        </Card>

        <Card className="p-5 border border-slate-200 bg-white space-y-2">
          <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
            <Shield className="h-4 w-4 text-indigo-600" />
            Role-Based Access Control (RBAC)
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            <strong>ADMIN</strong> users manage scoring weights, automation rules, and team permissions.{" "}
            <strong>SALES</strong> users manage accounts, buying-committee contacts, imports, and AI research.
          </p>
        </Card>
      </div>

      {/* Invite Modal */}
      {isInviteOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Add Team Member</h3>
              <button onClick={() => setIsInviteOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleInvite} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  minLength={2}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Lena Weber"
                  className="w-full px-3 py-1.5 rounded-md border border-slate-300 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Work Email *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="lena@secfix-gtm.example"
                  className="w-full px-3 py-1.5 rounded-md border border-slate-300 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Initial Password *</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full px-3 py-1.5 rounded-md border border-slate-300 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full px-3 py-1.5 rounded-md border border-slate-300 text-slate-900"
                >
                  <option value="SALES">Sales Representative</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>

              {formError && (
                <p className="text-rose-600 text-xs bg-rose-50 p-2 rounded border border-rose-200">
                  {formError}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsInviteOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isSubmitting} className="bg-indigo-600 text-white">
                  {isSubmitting ? "Creating..." : "Create User"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
