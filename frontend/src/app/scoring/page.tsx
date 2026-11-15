"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Target,
  RefreshCw,
  UserCheck,
  Sliders,
  Award,
  ExternalLink,
  CheckCircle2,
  Zap,
  Save,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { scoringApi, ScoringOverview, ScoringConfig } from "@/services/scoring";
import { getPriorityColor, formatNumber } from "@/lib/utils";
import { User } from "@/types";

export default function ScoringPage() {
  const [overview, setOverview] = useState<ScoringOverview | null>(null);
  const [config, setConfig] = useState<ScoringConfig | null>(null);
  const [weightsDraft, setWeightsDraft] = useState<Record<string, number>>({});
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isScoringBatch, setIsScoringBatch] = useState(false);
  const [isRoutingBatch, setIsRoutingBatch] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [ov, cfg] = await Promise.all([
        scoringApi.getOverview(),
        scoringApi.getConfig(),
      ]);
      setOverview(ov);
      setConfig(cfg);
      setWeightsDraft({ ...cfg.weights });
    } catch (err: any) {
      console.error("Failed to load scoring data:", err);
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
    loadData();
  }, []);

  const handleBulkScore = async (rescoreAll: boolean) => {
    setIsScoringBatch(true);
    setBannerMessage(null);
    try {
      const res = await scoringApi.bulkScore(rescoreAll);
      setBannerMessage(res.message);
      await loadData();
    } catch (err: any) {
      setBannerMessage(`Scoring failed: ${err.message}`);
    } finally {
      setIsScoringBatch(false);
    }
  };

  const handleBulkAssign = async () => {
    setIsRoutingBatch(true);
    setBannerMessage(null);
    try {
      const res = await scoringApi.bulkAssignUnassigned(false);
      setBannerMessage(res.message);
      await loadData();
    } catch (err: any) {
      setBannerMessage(`Routing failed: ${err.message}`);
    } finally {
      setIsRoutingBatch(false);
    }
  };

  const handleSaveWeights = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    setBannerMessage(null);
    try {
      await scoringApi.updateConfig({ weights: weightsDraft });
      setBannerMessage("Scoring dimension weights updated. Recalculate scores to apply new rules.");
      await loadData();
    } catch (err: any) {
      setBannerMessage(`Config save failed: ${err.message}`);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const isAdmin = currentUser?.role === "ADMIN";
  const weightSum = Object.values(weightsDraft).reduce((a, b) => a + Number(b || 0), 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Target className="h-6 w-6 text-indigo-600" />
            Lead Scoring & Least-Loaded Sales Routing
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Deterministic 100-point ICP qualification leaderboard and automated sales representative load balancing.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleBulkScore(true)}
            disabled={isScoringBatch}
            className="text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isScoringBatch ? "animate-spin" : ""}`} />
            Recalculate All Scores
          </Button>
          <Button
            size="sm"
            onClick={handleBulkAssign}
            disabled={isRoutingBatch}
            className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <UserCheck className="h-3.5 w-3.5 mr-1.5" />
            {isRoutingBatch ? "Routing..." : "Auto-Route Unassigned Leads"}
          </Button>
        </div>
      </div>

      {bannerMessage && (
        <div className="p-3.5 rounded-lg bg-indigo-50 border border-indigo-200 text-xs font-medium text-indigo-900 flex items-center justify-between">
          <span>{bannerMessage}</span>
          <button onClick={() => setBannerMessage(null)} className="text-indigo-600 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Tier KPIs */}
      {isLoading || !overview ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="p-4 border border-slate-200 bg-white">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Average Lead Score
            </p>
            <p className="text-2xl font-bold text-indigo-600 mt-1">{overview.average_score} / 100</p>
          </Card>
          <Card className="p-4 border border-emerald-200 bg-emerald-50/40">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
              High Priority (&ge;80)
            </p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{overview.high_count}</p>
          </Card>
          <Card className="p-4 border border-amber-200 bg-amber-50/40">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">
              Medium Priority (50-79)
            </p>
            <p className="text-2xl font-bold text-amber-700 mt-1">{overview.medium_count}</p>
          </Card>
          <Card className="p-4 border border-slate-200 bg-white">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Low Priority (&lt;50)
            </p>
            <p className="text-2xl font-bold text-slate-700 mt-1">{overview.low_count}</p>
          </Card>
          <Card className="p-4 border border-slate-200 bg-white">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Unscored Queue
            </p>
            <p className="text-2xl font-bold text-slate-500 mt-1">{overview.unscored_count}</p>
          </Card>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Account Scoring Leaderboard */}
        <Card className="lg:col-span-2 border border-slate-200 bg-white overflow-hidden">
          <CardHeader className="p-5 border-b border-slate-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Award className="h-4 w-4 text-indigo-600" />
                Account Qualification Leaderboard
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Accounts ranked by deterministic ICP fit and assigned ownership.
              </p>
            </div>
          </CardHeader>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Segment</th>
                  <th className="px-4 py-3">Score</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Assigned Rep</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!overview || overview.top_accounts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      No accounts found. Import or create accounts first.
                    </td>
                  </tr>
                ) : (
                  overview.top_accounts.map((acc) => {
                    const pri = getPriorityColor(acc.priority);
                    return (
                      <tr key={acc.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3">
                          <Link
                            href={`/accounts/${acc.id}`}
                            className="font-bold text-slate-900 hover:text-indigo-600 flex items-center gap-1"
                          >
                            {acc.company_name}
                            <ExternalLink className="h-3 w-3 text-slate-400" />
                          </Link>
                          <p className="text-[11px] text-slate-400 font-mono">{acc.domain || "—"}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          <div>{acc.industry || "Unclassified"}</div>
                          <div className="text-[11px] text-slate-400">
                            {acc.country || "—"} &bull; {formatNumber(acc.employee_count)} emp
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold font-mono text-slate-900 w-8">
                              {acc.lead_score ?? "—"}
                            </span>
                            {acc.lead_score !== null && (
                              <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="bg-indigo-600 h-1.5 rounded-full"
                                  style={{ width: `${acc.lead_score}%` }}
                                />
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {acc.priority ? (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${pri.badge}`}>
                              {acc.priority}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">Unscored</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {acc.assigned_user_name ? (
                            <span className="font-medium text-slate-800">{acc.assigned_user_name}</span>
                          ) : (
                            <span className="text-amber-600 text-[11px] font-medium">Unassigned</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right space-x-1">
                          <button
                            onClick={async () => {
                              await scoringApi.scoreAccount(acc.id);
                              loadData();
                            }}
                            className="text-[11px] font-semibold text-indigo-600 hover:underline px-1.5 py-1"
                          >
                            Score
                          </button>
                          {!acc.assigned_to && (
                            <button
                              onClick={async () => {
                                await scoringApi.assignAccount(acc.id);
                                loadData();
                              }}
                              className="text-[11px] font-semibold text-emerald-600 hover:underline px-1.5 py-1"
                            >
                              Auto-Assign
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Right Col: Rep Load Balance & Weight Config */}
        <div className="space-y-6">
          {/* Rep Workload Card */}
          <Card className="border border-slate-200 bg-white">
            <CardHeader className="p-5 pb-3 border-b border-slate-100">
              <CardTitle className="text-sm flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-indigo-600" />
                Sales Rep Workload Balance
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-3 text-xs">
              {!overview || overview.rep_workloads.length === 0 ? (
                <p className="text-slate-400">No active reps found.</p>
              ) : (
                overview.rep_workloads.map((rep) => (
                  <div
                    key={rep.user_id}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200/70"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-900 truncate">{rep.full_name}</span>
                        <span className="text-[9px] uppercase font-bold px-1 py-0.2 rounded bg-slate-200 text-slate-700">
                          {rep.role}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate">{rep.email}</p>
                    </div>
                    <div className="text-right shrink-0 pl-2">
                      <p className="font-bold text-slate-900">{rep.total_assigned} accts</p>
                      <p className="text-[10px] text-emerald-700 font-medium">
                        {rep.high_priority_assigned} high
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* ICP Weight Configuration Card */}
          <Card className="border border-slate-200 bg-white">
            <CardHeader className="p-5 pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-indigo-600" />
                  Scoring Weights ({weightSum} pts)
                </CardTitle>
                {!isAdmin && (
                  <Badge className="text-[10px] bg-slate-100 text-slate-600 border-slate-200">
                    Admin Only
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-5">
              <form onSubmit={handleSaveWeights} className="space-y-3 text-xs">
                {[
                  { key: "industry", label: "Industry Relevance" },
                  { key: "geography", label: "Target Geography (EU)" },
                  { key: "size", label: "Employee Headcount Fit" },
                  { key: "signals", label: "Claude AI Buying Signals" },
                  { key: "completeness", label: "Data Completeness" },
                ].map((dim) => (
                  <div key={dim.key} className="flex items-center justify-between gap-3">
                    <label className="font-medium text-slate-700">{dim.label}</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      disabled={!isAdmin}
                      value={weightsDraft[dim.key] ?? 0}
                      onChange={(e) =>
                        setWeightsDraft((prev) => ({
                          ...prev,
                          [dim.key]: Number(e.target.value),
                        }))
                      }
                      className="w-20 px-2.5 py-1 text-right font-mono rounded border border-slate-300 text-slate-900 disabled:bg-slate-50"
                    />
                  </div>
                ))}

                {isAdmin && (
                  <Button
                    type="submit"
                    disabled={isSavingConfig}
                    className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {isSavingConfig ? "Saving Rules..." : "Save Scoring Weights"}
                  </Button>
                )}
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
