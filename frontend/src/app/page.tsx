"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Shield,
  Server,
  Database,
  Cpu,
  Layers,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Building2,
  Users,
  Sparkles,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { healthApi } from "@/services/api";
import { SystemHealth, ReadinessResponse } from "@/types";

export default function DashboardPage() {
  const [healthData, setHealthData] = useState<SystemHealth | null>(null);
  const [readinessData, setReadinessData] = useState<ReadinessResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lastCheck, setLastCheck] = useState<string>("");

  const runHealthChecks = async () => {
    setIsLoading(true);
    try {
      const [health, ready] = await Promise.allSettled([
        healthApi.getLiveness(),
        healthApi.getReadiness(),
      ]);

      if (health.status === "fulfilled") {
        setHealthData(health.value);
      }
      if (ready.status === "fulfilled") {
        setReadinessData(ready.value);
      }
    } finally {
      setIsLoading(false);
      setLastCheck(new Date().toLocaleTimeString());
    }
  };

  useEffect(() => {
    runHealthChecks();
  }, []);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              GTM Lead Intelligence & Sales Automation
            </h1>
            <Badge variant="default" className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200">
              Phase 1: Foundation
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Enterprise architecture blueprint for Secfix GTM Engineering. Clean data ingestion, AI enrichment, and automated routing.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={runHealthChecks}
            isLoading={isLoading}
            className="text-xs"
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Check API Health
          </Button>

          <Link href="/imports">
            <Button size="sm" className="text-xs bg-indigo-600 hover:bg-indigo-700">
              Import Company CSV
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* System Status Alert */}
      <Alert variant={healthData ? "success" : "info"} title="System Operational Architecture">
        Backend FastAPI service is running with structured logging, CORS middleware, connection pooling, and versioned REST endpoints at <code className="font-mono bg-white/70 px-1.5 py-0.5 rounded text-xs text-indigo-800">/api/v1</code>.
        {lastCheck && <span className="ml-2 text-slate-500 font-normal">(Last checked: {lastCheck})</span>}
      </Alert>

      {/* Core Infrastructure Health Grid */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-600 mb-4 flex items-center gap-2">
          <Layers className="h-4 w-4 text-slate-500" />
          Infrastructure Stack & Connectivity Status
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: FastAPI REST Service */}
          <Card className="hover:border-slate-300 transition-all">
            <CardHeader className="p-5 pb-3">
              <div className="flex items-center justify-between">
                <div className="h-9 w-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Server className="h-5 w-5" />
                </div>
                {healthData ? (
                  <Badge variant="high">200 OK</Badge>
                ) : (
                  <Badge variant="outline">Connecting...</Badge>
                )}
              </div>
              <CardTitle className="text-base mt-3">FastAPI REST Core</CardTitle>
              <CardDescription className="text-xs">
                Python 3.13 + SQLAlchemy 2 + Pydantic v2
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-0 text-xs text-slate-600">
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <div className="flex justify-between">
                  <span className="text-slate-400">Environment:</span>
                  <span className="font-medium">{healthData?.environment || "development"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Version:</span>
                  <span className="font-medium">{healthData?.version || "1.0.0"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">OpenAPI Docs:</span>
                  <a
                    href="http://localhost:8000/docs"
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-indigo-600 hover:underline"
                  >
                    /docs
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: PostgreSQL Storage */}
          <Card className="hover:border-slate-300 transition-all">
            <CardHeader className="p-5 pb-3">
              <div className="flex items-center justify-between">
                <div className="h-9 w-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Database className="h-5 w-5" />
                </div>
                {readinessData?.dependencies?.database?.status === "healthy" ? (
                  <Badge variant="high">Connected</Badge>
                ) : (
                  <Badge variant="outline">Docker / Ready</Badge>
                )}
              </div>
              <CardTitle className="text-base mt-3">PostgreSQL 16</CardTitle>
              <CardDescription className="text-xs">
                Relational schema + JSONB + Alembic
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-0 text-xs text-slate-600">
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <div className="flex justify-between">
                  <span className="text-slate-400">Port:</span>
                  <span className="font-medium">5432</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Driver:</span>
                  <span className="font-medium">psycopg3</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Connection Pool:</span>
                  <span className="font-medium">Pre-ping enabled</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Redis Broker & Celery */}
          <Card className="hover:border-slate-300 transition-all">
            <CardHeader className="p-5 pb-3">
              <div className="flex items-center justify-between">
                <div className="h-9 w-9 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
                  <Cpu className="h-5 w-5" />
                </div>
                {readinessData?.dependencies?.redis?.status === "healthy" ? (
                  <Badge variant="high">Broker Active</Badge>
                ) : (
                  <Badge variant="outline">Port 6379</Badge>
                )}
              </div>
              <CardTitle className="text-base mt-3">Celery + Redis</CardTitle>
              <CardDescription className="text-xs">
                Asynchronous Task Queue & Scheduling
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-0 text-xs text-slate-600">
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <div className="flex justify-between">
                  <span className="text-slate-400">Broker:</span>
                  <span className="font-medium">Redis 7</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Prefetch:</span>
                  <span className="font-medium">1 (Fair Distribution)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Celery Beat:</span>
                  <span className="font-medium">Periodic Schedules</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 4: Claude AI Engine */}
          <Card className="hover:border-slate-300 transition-all">
            <CardHeader className="p-5 pb-3">
              <div className="flex items-center justify-between">
                <div className="h-9 w-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Sparkles className="h-5 w-5" />
                </div>
                <Badge variant="medium">Anthropic SDK</Badge>
              </div>
              <CardTitle className="text-base mt-3">Claude 3.5 Sonnet</CardTitle>
              <CardDescription className="text-xs">
                Deterministic Structured Enrichment
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-0 text-xs text-slate-600">
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <div className="flex justify-between">
                  <span className="text-slate-400">Schema:</span>
                  <span className="font-medium">Pydantic Validated</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Buying Signals:</span>
                  <span className="font-medium">Evidence-backed</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Retries:</span>
                  <span className="font-medium">Exponential Backoff</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Workflow Map & Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">GTM Platform Architecture & Roadmap</CardTitle>
            <CardDescription>
              Phase-by-phase implementation designed to match the Secfix GTM Engineer technical requirements.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              {
                phase: "Phase 1",
                title: "Foundation & Architecture",
                desc: "FastAPI REST API, SQLAlchemy 2, Alembic, Docker Compose, structured logging, Next.js frontend design system.",
                done: true,
              },
              {
                phase: "Phase 2",
                title: "Authentication & Relational Schemas",
                desc: "PostgreSQL models with UUIDs, unique domain constraints, JWT tokens, RBAC roles (ADMIN / SALES).",
                done: false,
              },
              {
                phase: "Phase 3",
                title: "Account & Contact Management",
                desc: "Account CRUD, contact relationships, buying committee, domain search, industry filtering, pagination.",
                done: false,
              },
              {
                phase: "Phase 4",
                title: "CSV Ingestion Engine & Deduplication",
                desc: "Dynamic column mapping, chunked parsing, URL normalization, domain matching, conflict resolution policy.",
                done: false,
              },
              {
                phase: "Phase 5",
                title: "Claude AI Enrichment & Research",
                desc: "Anthropic SDK client, structured Pydantic schemas, ISO/SOC 2 compliance relevance, buying signals.",
                done: false,
              },
              {
                phase: "Phase 6",
                title: "Lead Scoring & Sales Routing",
                desc: "Deterministic 100-pt scoring model, configurable weights, least-loaded representative assignment.",
                done: false,
              },
            ].map((p, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors"
              >
                <div className="mt-0.5">
                  {p.done ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <div className="h-5 w-5 rounded-full border-2 border-slate-300 text-[10px] font-bold text-slate-400 flex items-center justify-center">
                      {idx + 1}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800">{p.phase}:</span>
                    <span className="text-xs font-semibold text-slate-900">{p.title}</span>
                    {p.done && (
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded font-medium border border-emerald-200">
                        Completed
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{p.desc}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Live Diagnostics Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">System Diagnostics</CardTitle>
            <CardDescription>Live healthcheck payload from FastAPI</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 rounded-lg bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto space-y-1">
              <div className="text-slate-400">// GET /health</div>
              <div>{JSON.stringify(healthData || { status: "fetching..." }, null, 2)}</div>
            </div>

            <div className="p-3 rounded-lg bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto space-y-1">
              <div className="text-slate-400">// GET /ready</div>
              <div>
                {JSON.stringify(
                  readinessData || { status: "checking dependencies..." },
                  null,
                  2
                )}
              </div>
            </div>

            <div className="text-xs text-slate-500 space-y-1">
              <p>• Ready probe tests PostgreSQL connection latency.</p>
              <p>• Readiness reports 503 until docker compose services start.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
