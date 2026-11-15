"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Building2,
  Users,
  Target,
  Sparkles,
  TrendingUp,
  CheckCircle2,
  XCircle,
  UploadCloud,
  RefreshCw,
  ArrowRight,
  ExternalLink,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { dashboardApi, DashboardOverview } from "@/services/dashboard";
import { formatDate, formatNumber, getPriorityColor } from "@/lib/utils";

const PIE_COLORS = ["#10b981", "#f59e0b", "#64748b", "#cbd5e1"];

export default function DashboardPage() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadOverview = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await dashboardApi.getOverview();
      setOverview(data);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load dashboard metrics.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            GTM Intelligence Command Center
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time pipeline telemetry, ICP scoring distributions, and background automation health.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={loadOverview} disabled={isLoading} className="text-xs">
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh Metrics
          </Button>
          <Link href="/imports">
            <Button size="sm" className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white">
              <UploadCloud className="mr-1.5 h-3.5 w-3.5" />
              Import Accounts CSV
            </Button>
          </Link>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
          {errorMsg}
        </div>
      )}

      {/* Primary KPI Grid */}
      {isLoading || !overview ? (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
          <Card className="p-4 border border-slate-200 bg-white">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Accounts</span>
              <Building2 className="h-4 w-4 text-indigo-600" />
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">{formatNumber(overview.total_accounts)}</p>
          </Card>

          <Card className="p-4 border border-slate-200 bg-white">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Contacts</span>
              <Users className="h-4 w-4 text-indigo-600" />
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">{formatNumber(overview.total_contacts)}</p>
          </Card>

          <Card className="p-4 border border-emerald-200 bg-emerald-50/40">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">High Priority</span>
              <Target className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold text-emerald-700 mt-2">{formatNumber(overview.high_priority_accounts)}</p>
          </Card>

          <Card className="p-4 border border-amber-200 bg-amber-50/40">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">Needs AI Enrich</span>
              <Sparkles className="h-4 w-4 text-amber-600" />
            </div>
            <p className="text-2xl font-bold text-amber-700 mt-2">{formatNumber(overview.accounts_awaiting_enrichment)}</p>
          </Card>

          <Card className="p-4 border border-slate-200 bg-white">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Avg Lead Score</span>
              <TrendingUp className="h-4 w-4 text-indigo-600" />
            </div>
            <p className="text-2xl font-bold text-indigo-600 mt-2">{overview.average_lead_score}</p>
          </Card>

          <Card className="p-4 border border-slate-200 bg-white">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Worker Jobs</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-xl font-bold text-emerald-700">{overview.successful_jobs}</span>
              <span className="text-xs text-slate-400">/</span>
              <span className="text-sm font-bold text-rose-600">{overview.failed_jobs} err</span>
            </div>
          </Card>
        </div>
      )}

      {/* Recharts Analytics Row */}
      {overview && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Industry Distribution */}
          <Card className="border border-slate-200 bg-white">
            <CardHeader className="p-5 pb-2">
              <CardTitle className="text-sm">Accounts by Industry</CardTitle>
              <CardDescription className="text-xs">Top operating sectors in CRM</CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-2 h-64">
              {overview.industry_distribution.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  No account industry data yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={overview.industry_distribution} layout="vertical" margin={{ left: 10, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10, fill: "#334155" }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#4f46e5" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Country Distribution */}
          <Card className="border border-slate-200 bg-white">
            <CardHeader className="p-5 pb-2">
              <CardTitle className="text-sm">Accounts by Country</CardTitle>
              <CardDescription className="text-xs">European & target market coverage</CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-2 h-64">
              {overview.country_distribution.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  No country data yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={overview.country_distribution} margin={{ left: -16, right: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#334155" }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Priority Breakdown */}
          <Card className="border border-slate-200 bg-white">
            <CardHeader className="p-5 pb-2">
              <CardTitle className="text-sm">Priority Tier Split</CardTitle>
              <CardDescription className="text-xs">Deterministic score classification</CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-2 h-64 flex flex-col justify-between">
              {overview.total_accounts === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  No priority data yet
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height="78%">
                    <PieChart>
                      <Pie
                        data={overview.priority_distribution}
                        dataKey="count"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={42}
                        outerRadius={68}
                        paddingAngle={3}
                      >
                        {overview.priority_distribution.map((_, idx) => (
                          <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap justify-center gap-3 text-[11px] text-slate-600">
                    {overview.priority_distribution.map((p, idx) => (
                      <div key={p.name} className="flex items-center gap-1.5">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                        />
                        <span>
                          {p.name}: <strong>{p.count}</strong>
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bottom Operational Feeds */}
      {overview && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top Priority Accounts */}
          <Card className="lg:col-span-2 border border-slate-200 bg-white overflow-hidden">
            <CardHeader className="p-5 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm">Highest Priority Target Accounts</CardTitle>
                <CardDescription className="text-xs">Ready for immediate sales outreach & compliance review</CardDescription>
              </div>
              <Link href="/accounts" className="text-xs font-semibold text-indigo-600 hover:underline flex items-center gap-1">
                View All <ArrowRight className="h-3 w-3" />
              </Link>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[10px] uppercase">
                  <tr>
                    <th className="px-4 py-2.5">Company</th>
                    <th className="px-4 py-2.5">Market</th>
                    <th className="px-4 py-2.5">Score</th>
                    <th className="px-4 py-2.5">Priority</th>
                    <th className="px-4 py-2.5">Owner</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {overview.top_priority_accounts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                        No accounts ingested yet. Import a CSV to populate your pipeline.
                      </td>
                    </tr>
                  ) : (
                    overview.top_priority_accounts.map((acc) => {
                      const pri = getPriorityColor(acc.priority);
                      return (
                        <tr key={acc.id} className="hover:bg-slate-50/70">
                          <td className="px-4 py-2.5">
                            <Link href={`/accounts/${acc.id}`} className="font-bold text-slate-900 hover:text-indigo-600 flex items-center gap-1">
                              {acc.company_name}
                              <ExternalLink className="h-3 w-3 text-slate-400" />
                            </Link>
                            <span className="text-[11px] font-mono text-slate-400">{acc.domain || "—"}</span>
                          </td>
                          <td className="px-4 py-2.5 text-slate-600">
                            {acc.country || "—"} &bull; {acc.industry || "—"}
                          </td>
                          <td className="px-4 py-2.5 font-mono font-bold text-slate-900">
                            {acc.lead_score ?? "—"}
                          </td>
                          <td className="px-4 py-2.5">
                            {acc.priority ? (
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${pri.badge}`}>
                                {acc.priority}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-slate-600">
                            {acc.assigned_user_name || <span className="text-amber-600">Unassigned</span>}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Recent Imports & Activities */}
          <div className="space-y-6">
            <Card className="border border-slate-200 bg-white">
              <CardHeader className="p-4 border-b border-slate-100 flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Recent CSV Imports</CardTitle>
                <Link href="/imports" className="text-[11px] font-semibold text-indigo-600 hover:underline">
                  Manage
                </Link>
              </CardHeader>
              <CardContent className="p-4 space-y-2.5 text-xs">
                {overview.recent_imports.length === 0 ? (
                  <p className="text-slate-400 text-center py-3">No CSV imports yet.</p>
                ) : (
                  overview.recent_imports.map((imp) => (
                    <div key={imp.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 truncate">{imp.file_name}</p>
                        <p className="text-[10px] text-slate-400">
                          {imp.processed_records} processed &bull; {imp.duplicate_records} deduped
                        </p>
                      </div>
                      <Badge className="text-[10px] shrink-0">{imp.status}</Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border border-slate-200 bg-white">
              <CardHeader className="p-4 border-b border-slate-100">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-indigo-600" />
                  Recent Pipeline Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-2.5 text-xs max-h-64 overflow-y-auto">
                {overview.recent_activities.length === 0 ? (
                  <p className="text-slate-400 text-center py-3">No activity recorded yet.</p>
                ) : (
                  overview.recent_activities.map((act) => (
                    <div key={act.id} className="pb-2 border-b border-slate-100 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[10px] text-indigo-700 uppercase tracking-wider">
                          {act.action}
                        </span>
                        <span className="text-[10px] text-slate-400">{formatDate(act.created_at)}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5 truncate">
                        {act.entity_type} {act.new_values ? `• ${JSON.stringify(act.new_values)}` : ""}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
