"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Building2,
  ExternalLink,
  Users,
  Sparkles,
  Target,
  Clock,
  History,
  ArrowLeft,
  CheckCircle2,
  UserCheck,
  Plus,
  Send,
  TrendingUp,
  RefreshCw,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { accountsApi, AuditLogItem } from "@/services/accounts";
import { contactsApi } from "@/services/contacts";
import { enrichmentApi } from "@/services/enrichment";
import { scoringApi } from "@/services/scoring";
import { usersApi, TeamMember } from "@/services/dashboard";
import { Contact } from "@/types";
import { formatDate, formatNumber, getPriorityColor } from "@/lib/utils";

type ActiveTab = "overview" | "contacts" | "ai_research" | "activity" | "history";

export default function AccountDetailPage() {
  const params = useParams();
  const accountId = params?.id as string;

  const [account, setAccount] = useState<any | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activities, setActivities] = useState<AuditLogItem[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");

  // Pipeline Action States
  const [isEnriching, setIsEnriching] = useState(false);
  const [isScoring, setIsScoring] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Add Contact Modal State
  const [isAddContactOpen, setIsAddContactOpen] = useState<boolean>(false);
  const [newFirstName, setNewFirstName] = useState<string>("");
  const [newLastName, setNewLastName] = useState<string>("");
  const [newEmail, setNewEmail] = useState<string>("");
  const [newTitle, setNewTitle] = useState<string>("");
  const [newDepartment, setNewDepartment] = useState<string>("Security");
  const [newBuyingRole, setNewBuyingRole] = useState<string>("DECISION_MAKER");
  const [isDecisionMaker, setIsDecisionMaker] = useState<boolean>(true);

  const fetchAccountDetails = async () => {
    if (!accountId) return;
    setIsLoading(true);
    try {
      const [acc, contRes, actRes, usersRes] = await Promise.all([
        accountsApi.getAccountById(accountId),
        contactsApi.getContacts({ account_id: accountId, size: 50 }),
        accountsApi.getAccountActivity(accountId, 1, 20),
        usersApi.listUsers().catch(() => []),
      ]);
      setAccount(acc);
      setContacts(contRes.items);
      setActivities(actRes.items);
      setTeamMembers(usersRes);
    } catch (err: any) {
      console.error("Failed to load account details:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAccountDetails();
  }, [accountId]);

  const handleRunEnrichment = async () => {
    setIsEnriching(true);
    setActionNotice(null);
    try {
      const rec = await enrichmentApi.enrichAccount(accountId);
      setActionNotice(
        `AI enrichment ${rec.status.toLowerCase()} using ${
          rec.provider === "HEURISTIC_FALLBACK" ? "Evidence Heuristic" : rec.model_name
        }.`
      );
      await fetchAccountDetails();
      setActiveTab("ai_research");
    } catch (err: any) {
      setActionNotice(`Enrichment failed: ${err.message}`);
    } finally {
      setIsEnriching(false);
    }
  };

  const handleRecalculateScore = async () => {
    setIsScoring(true);
    setActionNotice(null);
    try {
      const score = await scoringApi.scoreAccount(accountId);
      setActionNotice(`Score recalculated: ${score.total_score}/100 (${score.priority} priority).`);
      await fetchAccountDetails();
    } catch (err: any) {
      setActionNotice(`Scoring failed: ${err.message}`);
    } finally {
      setIsScoring(false);
    }
  };

  const handleAssignRep = async (userId?: string) => {
    setIsAssigning(true);
    setActionNotice(null);
    try {
      const res = await scoringApi.assignAccount(accountId, userId);
      setActionNotice(
        `Assigned to ${res.assigned_user_name} (${res.strategy === "LEAST_LOADED_AUTO" ? "Least-Loaded Auto" : "Manual"}).`
      );
      await fetchAccountDetails();
    } catch (err: any) {
      setActionNotice(`Assignment failed: ${err.message}`);
    } finally {
      setIsAssigning(false);
    }
  };

  const handleReviewEnrichment = async (recordId: string, decision: "APPROVE" | "REJECT") => {
    try {
      await enrichmentApi.reviewRecord(recordId, {
        decision,
        apply_industry: decision === "APPROVE",
        apply_summary: false,
      });
      await fetchAccountDetails();
    } catch (err: any) {
      alert(`Review failed: ${err.message}`);
    }
  };

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFirstName.trim() || !newLastName.trim()) return;

    try {
      await contactsApi.createContact({
        account_id: accountId,
        first_name: newFirstName.trim(),
        last_name: newLastName.trim(),
        email: newEmail.trim() || undefined,
        job_title: newTitle.trim() || undefined,
        department: newDepartment.trim() || undefined,
        buying_role: newBuyingRole,
        is_decision_maker: isDecisionMaker,
      });

      setIsAddContactOpen(false);
      setNewFirstName("");
      setNewLastName("");
      setNewEmail("");
      setNewTitle("");
      fetchAccountDetails();
    } catch (err: any) {
      alert(`Failed to add contact: ${err.message}`);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <div className="grid grid-cols-3 gap-6">
          <Skeleton className="h-96 col-span-2 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="max-w-7xl mx-auto py-16 text-center">
        <h2 className="text-lg font-bold text-slate-800">Account Not Found</h2>
        <p className="text-sm text-slate-500 mt-1">The requested company account could not be found.</p>
        <Link href="/accounts" className="mt-4 inline-block text-xs text-indigo-600 hover:underline">
          &larr; Back to Accounts
        </Link>
      </div>
    );
  }

  const priColor = getPriorityColor(account.priority);
  const completenessScore =
    (account.company_name ? 20 : 0) +
    (account.domain ? 20 : 0) +
    (account.industry ? 15 : 0) +
    (account.country ? 15 : 0) +
    (account.employee_count ? 15 : 0) +
    (contacts.length > 0 ? 15 : 0);

  const enrichmentRecords = account.enrichment_records || [];
  const latestEnrichmentRecord = enrichmentRecords[0] || null;
  const latestEnrichment = latestEnrichmentRecord?.output_data || null;

  const leadScores = account.lead_scores || [];
  const latestScore = leadScores[0] || null;
  const breakdownObj = latestScore?.explanation?.breakdown || null;
  const reasonsList: string[] = latestScore?.explanation?.reasons || [];
  const nextActionText: string =
    latestEnrichment?.recommended_next_action ||
    latestScore?.explanation?.recommended_next_action ||
    "Run AI Enrichment and Deterministic Scoring to generate evidence-based next actions.";

  const scoreRows = breakdownObj
    ? [
        { label: "Industry Relevance", ...(breakdownObj.industry || { score: latestScore.industry_score, max: 30, reason: "" }) },
        { label: "Geographic Fit", ...(breakdownObj.geography || { score: latestScore.geography_score, max: 20, reason: "" }) },
        { label: "Company Size Fit", ...(breakdownObj.size || { score: latestScore.size_score, max: 20, reason: "" }) },
        { label: "Buying Signals", ...(breakdownObj.signals || { score: latestScore.signal_score, max: 20, reason: "" }) },
        { label: "Data Completeness", ...(breakdownObj.completeness || { score: latestScore.data_completeness_score, max: 10, reason: "" }) },
      ]
    : null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Breadcrumb Back Link */}
      <div className="flex items-center justify-between">
        <Link
          href="/accounts"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Accounts Directory
        </Link>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleRunEnrichment}
            disabled={isEnriching}
            className="text-xs"
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5 text-indigo-600" />
            {isEnriching ? "Enriching..." : "Run AI Enrichment"}
          </Button>
          <Button
            size="sm"
            onClick={handleRecalculateScore}
            disabled={isScoring}
            className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isScoring ? "animate-spin" : ""}`} />
            {isScoring ? "Scoring..." : "Calculate Lead Score"}
          </Button>
        </div>
      </div>

      {actionNotice && (
        <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-200 text-xs font-medium text-indigo-900 flex items-center justify-between">
          <span>{actionNotice}</span>
          <button onClick={() => setActionNotice(null)} className="text-indigo-600 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Account Hero Header */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xl shadow-sm shadow-indigo-100 shrink-0">
              {account.company_name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  {account.company_name}
                </h1>
                {account.priority && (
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${priColor.badge}`}>
                    {account.priority} Priority
                  </span>
                )}
                {account.enrichment_status === "COMPLETED" && (
                  <Badge variant="high" className="flex items-center gap-1 text-[11px]">
                    <Sparkles className="h-3 w-3" />
                    Enriched
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-2 font-medium">
                {account.domain && (
                  <a
                    href={account.website || `https://${account.domain}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-indigo-600 hover:underline"
                  >
                    <span>{account.domain}</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                <span>•</span>
                <span>{account.industry || "Unclassified Industry"}</span>
                <span>•</span>
                <span>{account.country || "Region Unspecified"}</span>
                <span>•</span>
                <span>{formatNumber(account.employee_count)} Employees</span>
                <span>•</span>
                <span>Source: {account.source}</span>
              </div>
            </div>
          </div>

          {/* Lead Score Widget */}
          <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Lead Score
              </p>
              <p className="text-xs text-slate-500">
                {latestScore ? `Rule Engine v${latestScore.scoring_version}` : "Not yet scored"}
              </p>
            </div>
            <div className="h-12 w-12 rounded-lg bg-indigo-600 text-white flex flex-col items-center justify-center font-bold shadow-sm shadow-indigo-200">
              <span className="text-lg leading-tight">{account.lead_score ?? "—"}</span>
              <span className="text-[9px] text-indigo-200 uppercase font-medium">/ 100</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 border-t border-slate-100 mt-6 pt-4 overflow-x-auto">
          {[
            { id: "overview", label: "Overview", icon: Building2 },
            { id: "contacts", label: `Contacts (${contacts.length})`, icon: Users },
            { id: "ai_research", label: `AI Research (${enrichmentRecords.length})`, icon: Sparkles },
            { id: "activity", label: `Activity (${activities.length})`, icon: Clock },
            { id: "history", label: `Scoring & Runs (${leadScores.length})`, icon: History },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as ActiveTab)}
                className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  isActive
                    ? "bg-slate-900 text-white shadow-2xs"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isActive ? "text-white" : "text-slate-400"}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Active Tab Content (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Prioritization Rationale Banner */}
              <Card className="border-indigo-100 bg-gradient-to-br from-white to-indigo-50/20 shadow-2xs">
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-indigo-600" />
                    <CardTitle className="text-sm">Why this account is scored & prioritized</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-5 pt-0 text-xs text-slate-700 space-y-2">
                  {reasonsList.length > 0 ? (
                    reasonsList.map((reason, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{reason}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-500 flex items-center justify-between">
                      <span>Click &ldquo;Calculate Lead Score&rdquo; above to generate deterministic ICP prioritization rationale.</span>
                      <Button size="sm" variant="outline" onClick={handleRecalculateScore} className="text-xs h-7">
                        Score Now
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Lead Score Breakdown Card */}
              <Card className="shadow-2xs">
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-indigo-600" />
                      <CardTitle className="text-sm">Deterministic Qualification Breakdown</CardTitle>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">
                      {latestScore ? `Total: ${latestScore.total_score}/100` : "Unscored"}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="p-5 pt-0 space-y-3 text-xs">
                  {scoreRows ? (
                    scoreRows.map((item, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-slate-800">{item.label}</span>
                          <span className="font-bold text-slate-900 font-mono">
                            {item.score} / {item.max} pts
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-indigo-600 h-1.5 rounded-full"
                            style={{ width: `${item.max > 0 ? Math.min(100, (item.score / item.max) * 100) : 0}%` }}
                          />
                        </div>
                        {item.reason && <p className="text-[11px] text-slate-400">{item.reason}</p>}
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-500 py-4 text-center">
                      No deterministic score breakdown persisted yet.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Profile Details */}
              <Card className="shadow-2xs">
                <CardHeader className="p-5 pb-3">
                  <CardTitle className="text-sm">Company Profile Metadata</CardTitle>
                </CardHeader>
                <CardContent className="p-5 pt-0 text-xs">
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <div>
                      <dt className="text-slate-400 font-medium">Description</dt>
                      <dd className="text-slate-800 mt-0.5">{account.description || "No description provided."}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400 font-medium">Normalized Domain</dt>
                      <dd className="font-mono text-slate-800 mt-0.5">{account.domain || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400 font-medium">Created Timestamp</dt>
                      <dd className="text-slate-800 mt-0.5">{formatDate(account.created_at)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400 font-medium">Last Modified</dt>
                      <dd className="text-slate-800 mt-0.5">{formatDate(account.updated_at)}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB 2: CONTACTS & BUYING COMMITTEE */}
          {activeTab === "contacts" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Buying Committee & Contacts</h3>
                  <p className="text-xs text-slate-500">Key stakeholders and decision makers for Secfix outreach</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => setIsAddContactOpen(true)}
                  className="text-xs bg-indigo-600 hover:bg-indigo-700"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Contact
                </Button>
              </div>

              {contacts.length === 0 ? (
                <Card className="p-8 text-center text-slate-500">
                  <Users className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                  <p className="font-semibold text-slate-700 text-xs">No contacts recorded yet</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Add contacts to map the internal buying committee.</p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {contacts.map((contact) => (
                    <Card key={contact.id} className="p-4 shadow-2xs hover:border-slate-300 transition-colors">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900 text-xs">
                              {contact.first_name} {contact.last_name}
                            </span>
                            {contact.is_decision_maker && (
                              <span className="px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-semibold">
                                Decision Maker
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 font-medium mt-0.5">{contact.job_title || "Role not specified"}</p>
                          <p className="text-[11px] text-slate-400">{contact.department || "General"} Department</p>
                        </div>
                        {contact.buying_role && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            {contact.buying_role}
                          </span>
                        )}
                      </div>

                      {contact.email && (
                        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                          <span className="text-slate-600 font-mono">{contact.email}</span>
                          <span className="text-[10px] text-slate-400 capitalize">{contact.verification_status.toLowerCase()}</span>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: AI RESEARCH (CLAUDE 3.5) */}
          {activeTab === "ai_research" && (
            <div className="space-y-4">
              <Card className="p-5 shadow-2xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-indigo-600" />
                    <h3 className="font-bold text-slate-900 text-sm">Claude AI Structured Intelligence</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {latestEnrichmentRecord && (
                      <span className="text-[11px] font-mono text-slate-500">
                        {latestEnrichmentRecord.model_name}
                      </span>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleRunEnrichment}
                      disabled={isEnriching}
                      className="text-xs h-7"
                    >
                      {isEnriching ? "Running..." : "Re-Run Enrichment"}
                    </Button>
                  </div>
                </div>

                {latestEnrichment ? (
                  <div className="mt-4 space-y-4 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="high" className="capitalize">
                          {latestEnrichment.target_market_fit || "High"} Fit
                        </Badge>
                        {latestEnrichment.industry_classification && (
                          <span className="text-slate-600 font-medium">
                            Classified Sector: <strong>{latestEnrichment.industry_classification}</strong>
                          </span>
                        )}
                      </div>

                      {latestEnrichment.review_status === "APPROVED" ? (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Approved</Badge>
                      ) : latestEnrichment.review_status === "REJECTED" ? (
                        <Badge className="bg-rose-50 text-rose-700 border-rose-200">Rejected</Badge>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReviewEnrichment(latestEnrichmentRecord.id, "REJECT")}
                            className="text-xs h-7 text-rose-600 border-rose-200"
                          >
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleReviewEnrichment(latestEnrichmentRecord.id, "APPROVE")}
                            className="text-xs h-7 bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            Approve & Apply Industry
                          </Button>
                        </div>
                      )}
                    </div>

                    <div>
                      <h4 className="font-semibold text-slate-800 uppercase tracking-wider text-[10px] mb-1">Company Summary</h4>
                      <p className="text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200/60">
                        {latestEnrichment.company_summary}
                      </p>
                    </div>

                    {latestEnrichment.compliance_relevance && (
                      <div>
                        <h4 className="font-semibold text-slate-800 uppercase tracking-wider text-[10px] mb-1.5">Compliance Categories</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {latestEnrichment.compliance_relevance.map((comp: string, i: number) => (
                            <span key={i} className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-xs font-semibold border border-indigo-100">
                              {comp}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {latestEnrichment.buying_signals && (
                      <div>
                        <h4 className="font-semibold text-slate-800 uppercase tracking-wider text-[10px] mb-1.5">Observed Buying Signals</h4>
                        <div className="space-y-2">
                          {latestEnrichment.buying_signals.map((sig: any, i: number) => (
                            <div key={i} className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-slate-900">{sig.signal}</span>
                                <span className="text-[10px] font-bold text-emerald-700 uppercase">{sig.confidence} Confidence</span>
                              </div>
                              <p className="text-[11px] text-slate-500">{sig.evidence}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {latestEnrichment.recommended_roles && (
                      <div>
                        <h4 className="font-semibold text-slate-800 uppercase tracking-wider text-[10px] mb-1">Recommended Decision Makers</h4>
                        <p className="text-slate-700">{latestEnrichment.recommended_roles.join(", ")}</p>
                      </div>
                    )}

                    {latestEnrichment.confidence_notes && (
                      <p className="text-[11px] text-slate-400 pt-2 border-t border-slate-100">
                        {latestEnrichment.confidence_notes}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="py-8 text-center text-slate-500">
                    <Sparkles className="h-8 w-8 mx-auto text-indigo-300 mb-2" />
                    <p className="font-semibold text-slate-700 text-xs">Ready for AI Company Research</p>
                    <p className="text-[11px] text-slate-400 max-w-sm mx-auto mt-0.5">
                      Trigger structured company research to detect compliance frameworks and buying signals.
                    </p>
                    <Button
                      size="sm"
                      onClick={handleRunEnrichment}
                      disabled={isEnriching}
                      className="mt-3 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                      {isEnriching ? "Enriching..." : "Run AI Enrichment"}
                    </Button>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* TAB 4: ACTIVITY (AUDIT LOGS) */}
          {activeTab === "activity" && (
            <Card className="p-5 shadow-2xs">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <Clock className="h-4 w-4 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-sm">Account Audit History</h3>
              </div>
              <div className="mt-4 space-y-3">
                {activities.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">No audit trail entries recorded yet.</p>
                ) : (
                  activities.map((act) => (
                    <div key={act.id} className="p-3 rounded-lg border border-slate-100 bg-slate-50/50 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 uppercase text-[10px] tracking-wider">
                          {act.action}
                        </span>
                        <span className="text-[10px] text-slate-400">{formatDate(act.created_at)}</span>
                      </div>
                      {act.new_values && (
                        <div className="font-mono text-[11px] text-slate-600 bg-white p-2 rounded border border-slate-200/60 overflow-x-auto">
                          {JSON.stringify(act.new_values)}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </Card>
          )}

          {/* TAB 5: SCORING & ENRICHMENT RUN HISTORY */}
          {activeTab === "history" && (
            <Card className="p-5 shadow-2xs space-y-4">
              <h3 className="font-bold text-slate-900 text-sm">Historical Scoring & Enrichment Runs</h3>
              {leadScores.length === 0 && enrichmentRecords.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">No scoring or enrichment cycles recorded yet.</p>
              ) : (
                <div className="space-y-2.5 text-xs">
                  {leadScores.map((ls: any) => (
                    <div key={ls.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-800">Lead Score v{ls.scoring_version}</span>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Ind: {ls.industry_score} &bull; Geo: {ls.geography_score} &bull; Size: {ls.size_score} &bull; Sig: {ls.signal_score} &bull; Comp: {ls.data_completeness_score}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-indigo-700 font-mono">{ls.total_score}/100 ({ls.priority})</span>
                        <p className="text-[10px] text-slate-400">{formatDate(ls.created_at)}</p>
                      </div>
                    </div>
                  ))}
                  {enrichmentRecords.map((er: any) => (
                    <div key={er.id} className="p-3 rounded-lg border border-slate-200 bg-white flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-800">AI Enrichment ({er.model_name})</span>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Provider: {er.provider} {er.tokens_used ? `• ${er.tokens_used} tokens` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge className="text-[10px]">{er.status}</Badge>
                        <p className="text-[10px] text-slate-400 mt-0.5">{formatDate(er.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Right Column: CRM Sidebar Panel */}
        <div className="space-y-4">
          {/* Sales Assignment Card */}
          <Card className="shadow-2xs p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Sales Assignment
              </h4>
              <button
                onClick={() => handleAssignRep()}
                disabled={isAssigning}
                className="text-[11px] font-semibold text-indigo-600 hover:underline"
              >
                {isAssigning ? "Routing..." : "Auto-Route"}
              </button>
            </div>

            {account.assigned_user ? (
              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 border border-slate-200/70">
                <div className="h-8 w-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs">
                  {account.assigned_user.full_name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0 text-xs">
                  <p className="font-bold text-slate-900 truncate">{account.assigned_user.full_name}</p>
                  <p className="text-[11px] text-slate-400 truncate">{account.assigned_user.email}</p>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-amber-50/60 border border-amber-200 text-xs text-amber-800 flex items-center justify-between">
                <span>Unassigned Account</span>
                <Button size="sm" variant="outline" onClick={() => handleAssignRep()} className="h-7 text-[11px]">
                  <UserCheck className="h-3 w-3 mr-1" /> Auto-Assign
                </Button>
              </div>
            )}

            {teamMembers.length > 0 && (
              <select
                value={account.assigned_to || ""}
                onChange={(e) => {
                  if (e.target.value) handleAssignRep(e.target.value);
                }}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-700 bg-white"
              >
                <option value="">Reassign manually...</option>
                {teamMembers
                  .filter((u) => u.is_active)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.role} - {u.assigned_accounts_count} accts)
                    </option>
                  ))}
              </select>
            )}
          </Card>

          {/* Recommended Next Action */}
          <Card className="shadow-2xs p-5 space-y-2 border-indigo-100 bg-indigo-50/20">
            <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
              <Send className="h-3.5 w-3.5" />
              Recommended Next Action
            </h4>
            <p className="text-xs text-slate-700 leading-relaxed">{nextActionText}</p>
          </Card>

          {/* Data Completeness Meter */}
          <Card className="shadow-2xs p-5 space-y-2.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-slate-800">Data Completeness</span>
              <span className="font-bold text-indigo-600">{completenessScore}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${completenessScore}%` }}
              />
            </div>
            <div className="text-[11px] text-slate-400 space-y-1 pt-1">
              <div className="flex items-center gap-1.5">
                {account.domain ? (
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                ) : (
                  <span className="h-3 w-3 rounded-full border border-slate-300" />
                )}
                <span>Company name & domain</span>
              </div>
              <div className="flex items-center gap-1.5">
                {account.industry && account.country ? (
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                ) : (
                  <span className="h-3 w-3 rounded-full border border-slate-300" />
                )}
                <span>Industry & geography</span>
              </div>
              <div className="flex items-center gap-1.5">
                {contacts.length > 0 ? (
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                ) : (
                  <span className="h-3 w-3 rounded-full border border-slate-300" />
                )}
                <span>Buying committee mapped</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Add Contact Modal */}
      {isAddContactOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Add Contact to Buying Committee</h3>
              <button onClick={() => setIsAddContactOpen(false)} className="text-slate-400 hover:text-slate-700">
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateContact} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-md border border-slate-300 text-slate-900 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-md border border-slate-300 text-slate-900 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Work Email</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full px-3 py-1.5 rounded-md border border-slate-300 text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Job Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Chief Information Security Officer"
                  className="w-full px-3 py-1.5 rounded-md border border-slate-300 text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Buying Role</label>
                  <select
                    value={newBuyingRole}
                    onChange={(e) => setNewBuyingRole(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-md border border-slate-300 text-slate-900 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="DECISION_MAKER">Decision Maker</option>
                    <option value="CHAMPION">Champion</option>
                    <option value="INFLUENCER">Influencer</option>
                    <option value="BUYER">Economic Buyer</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isDecisionMaker}
                      onChange={(e) => setIsDecisionMaker(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    <span className="text-xs font-semibold text-slate-700">Key Decision Maker</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsAddContactOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-indigo-600 hover:bg-indigo-700">
                  Save Contact
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
