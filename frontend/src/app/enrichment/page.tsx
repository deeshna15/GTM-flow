"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Sparkles,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  ExternalLink,
  AlertTriangle,
  RefreshCw,
  Cpu,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { enrichmentApi, EnrichmentRecord } from "@/services/enrichment";
import { formatDate } from "@/lib/utils";

export default function EnrichmentPage() {
  const [records, setRecords] = useState<EnrichmentRecord[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isBulkRunning, setIsBulkRunning] = useState<boolean>(false);
  const [reviewFilter, setReviewFilter] = useState<string>("ALL");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const loadFeed = async () => {
    setIsLoading(true);
    try {
      const res = await enrichmentApi.listFeed({
        review_status: reviewFilter === "ALL" ? undefined : reviewFilter,
        size: 30,
      });
      setRecords(res.items);
      setTotal(res.total);
    } catch (err: any) {
      console.error("Failed to fetch enrichment feed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFeed();
  }, [reviewFilter]);

  const handleBulkEnrich = async () => {
    setIsBulkRunning(true);
    setActionMessage(null);
    try {
      const res = await enrichmentApi.bulkEnrich(undefined, 20);
      setActionMessage(res.message);
      await loadFeed();
    } catch (err: any) {
      setActionMessage(`Bulk enrichment error: ${err.message}`);
    } finally {
      setIsBulkRunning(false);
    }
  };

  const handleReview = async (recordId: string, decision: "APPROVE" | "REJECT", applySummary: boolean = false) => {
    setReviewingId(recordId);
    try {
      await enrichmentApi.reviewRecord(recordId, {
        decision,
        apply_industry: decision === "APPROVE",
        apply_summary: applySummary,
      });
      await loadFeed();
    } catch (err: any) {
      alert(`Review failed: ${err.message}`);
    } finally {
      setReviewingId(null);
    }
  };

  const completedCount = records.filter((r) => r.status === "COMPLETED").length;
  const approvedCount = records.filter((r) => r.output_data?.review_status === "APPROVED").length;
  const totalTokens = records.reduce((acc, r) => acc + (r.tokens_used || 0), 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-indigo-600" />
            Claude AI Research & Enrichment Hub
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Structured company intelligence, compliance relevance detection, and human-in-the-loop review queue.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={loadFeed} disabled={isLoading} className="text-xs">
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={handleBulkEnrich}
            disabled={isBulkRunning}
            className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Play className="h-3.5 w-3.5 mr-1.5" />
            {isBulkRunning ? "Running AI Pipeline..." : "Enrich Pending Accounts"}
          </Button>
        </div>
      </div>

      {actionMessage && (
        <div className="p-3.5 rounded-lg bg-indigo-50 border border-indigo-200 text-xs font-medium text-indigo-900 flex items-center justify-between">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="text-indigo-600 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="p-4 border border-slate-200 bg-white">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Total Runs Logged
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{total}</p>
        </Card>
        <Card className="p-4 border border-slate-200 bg-white">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Successful Enrichments
          </p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{completedCount}</p>
        </Card>
        <Card className="p-4 border border-slate-200 bg-white">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Human Approved
          </p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">{approvedCount}</p>
        </Card>
        <Card className="p-4 border border-slate-200 bg-white">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Claude Tokens Tracked
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-1 font-mono">
            {totalTokens.toLocaleString()}
          </p>
        </Card>
      </div>

      {/* Review Filter Tabs */}
      <div className="flex items-center gap-2">
        {[
          { key: "ALL", label: "All Research Runs" },
          { key: "PENDING_REVIEW", label: "Awaiting Review" },
          { key: "APPROVED", label: "Approved" },
          { key: "REJECTED", label: "Rejected" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setReviewFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              reviewFilter === f.key
                ? "bg-slate-900 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Research Cards Feed */}
      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, idx) => (
            <Skeleton key={idx} className="h-44 w-full rounded-xl" />
          ))
        ) : records.length === 0 ? (
          <Card className="p-12 text-center border border-slate-200 bg-white">
            <Sparkles className="h-10 w-10 text-indigo-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-800">No Enrichment Records Found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Import or add accounts and click &ldquo;Enrich Pending Accounts&rdquo; to generate structured compliance research with Claude.
            </p>
          </Card>
        ) : (
          records.map((rec) => {
            const out = rec.output_data;
            const reviewStatus = out?.review_status || "PENDING_REVIEW";
            const isHeuristic = rec.provider === "HEURISTIC_FALLBACK" || out?.analysis_mode === "offline_heuristic";

            return (
              <Card key={rec.id} className="border border-slate-200 bg-white shadow-2xs overflow-hidden">
                <CardContent className="p-6 space-y-4">
                  {/* Top Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/accounts/${rec.account_id}`}
                          className="text-base font-bold text-slate-900 hover:text-indigo-600 flex items-center gap-1"
                        >
                          {rec.account?.company_name || "Account"}
                          <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                        </Link>
                        {out?.target_market_fit && (
                          <Badge
                            className={`text-[10px] uppercase ${
                              out.target_market_fit === "high"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : out.target_market_fit === "medium"
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-slate-100 text-slate-600 border-slate-200"
                            }`}
                          >
                            {out.target_market_fit} ICP Fit
                          </Badge>
                        )}
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-mono">
                          <Cpu className="h-3 w-3" />
                          {isHeuristic ? "Evidence Heuristic (No API Key)" : rec.model_name}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        {rec.account?.domain || "No domain"} &bull; {rec.account?.country || "Global"} &bull;{" "}
                        {formatDate(rec.created_at)}
                        {rec.latency_ms ? ` • ${Math.round(rec.latency_ms)} ms` : ""}
                        {rec.tokens_used ? ` • ${rec.tokens_used} tokens` : ""}
                      </p>
                    </div>

                    {/* Review Controls */}
                    <div className="flex items-center gap-2 shrink-0">
                      {reviewStatus === "APPROVED" ? (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Approved
                        </Badge>
                      ) : reviewStatus === "REJECTED" ? (
                        <Badge className="bg-rose-50 text-rose-700 border-rose-200 flex items-center gap-1">
                          <XCircle className="h-3.5 w-3.5" /> Rejected
                        </Badge>
                      ) : rec.status === "COMPLETED" ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={reviewingId === rec.id}
                            onClick={() => handleReview(rec.id, "REJECT")}
                            className="text-xs text-rose-600 border-rose-200 hover:bg-rose-50 h-8"
                          >
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            disabled={reviewingId === rec.id}
                            onClick={() => handleReview(rec.id, "APPROVE", true)}
                            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white h-8"
                          >
                            Approve & Apply
                          </Button>
                        </>
                      ) : (
                        <Badge className="bg-rose-50 text-rose-700 border-rose-200">
                          Failed
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Body */}
                  {rec.status === "FAILED" || !out ? (
                    <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>{rec.error_message || "AI enrichment run failed."}</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 text-xs">
                      <div className="lg:col-span-2 space-y-3">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Executive Summary
                          </span>
                          <p className="text-slate-700 mt-1 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                            {out.company_summary}
                          </p>
                        </div>

                        {out.buying_signals && out.buying_signals.length > 0 && (
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Evidence-Backed Buying Signals
                            </span>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1.5">
                              {out.buying_signals.map((sig, i) => (
                                <div key={i} className="p-2.5 rounded-lg border border-slate-200 bg-white">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-semibold text-slate-900">{sig.signal}</span>
                                    <span className="text-[10px] uppercase font-bold text-indigo-600">
                                      {sig.confidence}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 mt-1">{sig.evidence}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-3 bg-slate-50/70 p-4 rounded-xl border border-slate-200/70">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Compliance Frameworks
                          </span>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {out.compliance_relevance?.map((c, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 font-semibold text-[11px]"
                              >
                                {c}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Target Buyer Roles
                          </span>
                          <p className="text-slate-700 mt-1 font-medium">
                            {out.recommended_roles?.join(", ") || "CISO, Security Lead"}
                          </p>
                        </div>

                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                            Recommended Next Action
                          </span>
                          <p className="text-slate-700 mt-1 leading-relaxed">
                            {out.recommended_next_action}
                          </p>
                        </div>

                        {out.confidence_notes && (
                          <p className="text-[10px] text-slate-400 pt-2 border-t border-slate-200">
                            {out.confidence_notes}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
