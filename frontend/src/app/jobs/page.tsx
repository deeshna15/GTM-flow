"use client";

import React, { useState, useEffect } from "react";
import {
  Activity,
  RefreshCw,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  Server,
  AlertTriangle,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { jobsApi, JobsSummary, WorkerStatus } from "@/services/automations";
import { formatDate } from "@/lib/utils";

export default function JobsPage() {
  const [summary, setSummary] = useState<JobsSummary | null>(null);
  const [workerStatus, setWorkerStatus] = useState<WorkerStatus | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const loadJobs = async () => {
    setIsLoading(true);
    try {
      const [jobsRes, wsRes] = await Promise.all([
        jobsApi.listJobs({
          status: statusFilter === "ALL" ? undefined : statusFilter,
        }),
        jobsApi.getWorkerStatus(),
      ]);
      setSummary(jobsRes);
      setWorkerStatus(wsRes);
    } catch (err) {
      console.error("Failed to fetch job executions:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, [statusFilter]);

  const handleRetry = async (jobId: string) => {
    setRetryingId(jobId);
    try {
      await jobsApi.retryJob(jobId);
      await loadJobs();
    } catch (err: any) {
      alert(`Retry failed: ${err.message}`);
    } finally {
      setRetryingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SUCCESS":
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Success</Badge>;
      case "FAILED":
        return <Badge className="bg-rose-50 text-rose-700 border-rose-200">Failed</Badge>;
      case "RUNNING":
        return <Badge className="bg-blue-50 text-blue-700 border-blue-200">Running</Badge>;
      default:
        return <Badge className="bg-slate-100 text-slate-600 border-slate-200">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Activity className="h-6 w-6 text-indigo-600" />
            Background Jobs & Worker Monitoring
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Inspect Celery worker queues, Celery Beat schedules, job failures, and manual retry recovery.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={loadJobs} disabled={isLoading} className="text-xs">
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
          Refresh Status
        </Button>
      </div>

      {/* Broker & Beat Schedule Card */}
      {workerStatus && (
        <Card className="border border-slate-200 bg-white">
          <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                  workerStatus.broker_status === "healthy"
                    ? "bg-emerald-50 text-emerald-600"
                    : "bg-amber-50 text-amber-600"
                }`}
              >
                <Server className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900">Redis & Celery Broker</span>
                  <Badge
                    className={`text-[10px] ${
                      workerStatus.broker_status === "healthy"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-amber-50 text-amber-700 border-amber-200"
                    }`}
                  >
                    {workerStatus.broker_status === "healthy"
                      ? `Connected (${workerStatus.broker_latency_ms} ms)`
                      : "Offline (Sync Fallback Active)"}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Celery Beat schedules: {workerStatus.scheduled_jobs.join(", ") || "None"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Strip */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4 border border-slate-200 bg-white">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Jobs</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{summary.total_jobs}</p>
          </Card>
          <Card className="p-4 border border-emerald-200 bg-emerald-50/40">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">Succeeded</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{summary.success_jobs}</p>
          </Card>
          <Card className="p-4 border border-rose-200 bg-rose-50/40">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-700">Failed</p>
            <p className="text-2xl font-bold text-rose-700 mt-1">{summary.failed_jobs}</p>
          </Card>
          <Card className="p-4 border border-slate-200 bg-white">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Pending / Running
            </p>
            <p className="text-2xl font-bold text-indigo-600 mt-1">
              {summary.pending_jobs + summary.running_jobs}
            </p>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2">
        {["ALL", "SUCCESS", "FAILED", "RUNNING", "PENDING"].map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              statusFilter === st
                ? "bg-slate-900 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Job Table */}
      <Card className="border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[10px]">
              <tr>
                <th className="px-4 py-3">Task ID</th>
                <th className="px-4 py-3">Job Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Retries</th>
                <th className="px-4 py-3">Details / Error</th>
                <th className="px-4 py-3">Started</th>
                <th className="px-4 py-3 text-right">Recovery</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={7} className="px-4 py-3">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  </tr>
                ))
              ) : !summary || summary.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    No background job executions recorded yet.
                  </td>
                </tr>
              ) : (
                summary.items.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-700 truncate max-w-[180px]">
                      {job.task_id}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px] font-semibold">
                        {job.job_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(job.status)}</td>
                    <td className="px-4 py-3 font-mono text-slate-600">
                      {job.retry_count} / {job.max_retries}
                    </td>
                    <td className="px-4 py-3 max-w-xs truncate text-[11px]">
                      {job.error_message ? (
                        <span className="text-rose-600">{job.error_message}</span>
                      ) : (
                        <span className="text-slate-500 font-mono">
                          {job.payload ? JSON.stringify(job.payload) : "—"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {formatDate(job.started_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {job.status === "FAILED" && job.retry_count < job.max_retries ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={retryingId === job.id}
                          onClick={() => handleRetry(job.id)}
                          className="text-xs h-7 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Retry
                        </Button>
                      ) : (
                        <span className="text-slate-400 text-[11px]">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
