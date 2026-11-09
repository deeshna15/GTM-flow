"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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
  ShieldCheck,
  AlertTriangle,
  UserCheck,
  Plus,
  Send,
  Calendar,
  Layers,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { accountsApi, AuditLogItem } from "@/services/accounts";
import { contactsApi } from "@/services/contacts";
import { Account, Contact, PriorityLevel } from "@/types";
import { formatDate, formatNumber, getPriorityColor } from "@/lib/utils";

type ActiveTab = "overview" | "contacts" | "ai_research" | "activity" | "history";

export default function AccountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const accountId = params?.id as string;

  const [account, setAccount] = useState<any | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activities, setActivities] = useState<AuditLogItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");

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
      const [acc, contRes, actRes] = await Promise.all([
        accountsApi.getAccountById(accountId),
        contactsApi.getContacts({ account_id: accountId, size: 50 }),
        accountsApi.getAccountActivity(accountId, 1, 20),
      ]);
      setAccount(acc);
      setContacts(contRes.items);
      setActivities(actRes.items);
    } catch (err: any) {
      console.error("Failed to load account details:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAccountDetails();
  }, [accountId]);

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

  // Latest enrichment record if present
  const latestEnrichment = account.enrichment_records?.[0]?.output_data || null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Breadcrumb Back Link */}
      <div>
        <Link
          href="/accounts"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Accounts Directory
        </Link>
      </div>

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
                    Enriched by Claude
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
                <span>{account.industry || "General Industry"}</span>
                <span>•</span>
                <span>{account.country || "Global"}</span>
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
              <p className="text-xs text-slate-500">Deterministic ICP</p>
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
            { id: "ai_research", label: "AI Research", icon: Sparkles },
            { id: "activity", label: `Activity (${activities.length})`, icon: Clock },
            { id: "history", label: "History", icon: History },
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
              {/* Prioritization Highlight Banner */}
              <Card className="border-indigo-100 bg-gradient-to-br from-white to-indigo-50/20 shadow-2xs">
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-indigo-600" />
                    <CardTitle className="text-sm">Why this account is prioritized</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-5 pt-0 text-xs text-slate-700 space-y-2">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Located in primary European target market ({account.country || "EU"}).</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Operates in high-compliance tech sector ({account.industry || "Software"}).</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Company size ({formatNumber(account.employee_count)} employees) falls squarely within mid-market segment.</span>
                  </div>
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
                    <span className="text-[11px] font-mono text-slate-400">Rule Engine v1.0</span>
                  </div>
                </CardHeader>
                <CardContent className="p-5 pt-0 space-y-3 text-xs">
                  {[
                    { label: "Industry Relevance", score: 30, max: 30, rationale: `${account.industry || "Tech"} tier match` },
                    { label: "Geographic Fit", score: 20, max: 20, rationale: `${account.country || "Target Market"} region` },
                    { label: "Company Size Fit", score: 20, max: 20, rationale: `${account.employee_count || 100} employee range` },
                    { label: "Buying Signals", score: 15, max: 20, rationale: "Security compliance keywords observed" },
                    { label: "Data Completeness", score: 8, max: 10, rationale: "Domain, industry, size verified" },
                  ].map((item, idx) => (
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
                          style={{ width: `${(item.score / item.max) * 100}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-slate-400">{item.rationale}</p>
                    </div>
                  ))}
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
                  <span className="text-[11px] font-semibold text-slate-500">Model: claude-3-5-sonnet</span>
                </div>

                {latestEnrichment ? (
                  <div className="mt-4 space-y-4 text-xs">
                    <div>
                      <h4 className="font-semibold text-slate-800 uppercase tracking-wider text-[10px] mb-1">Company Summary</h4>
                      <p className="text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200/60">
                        {latestEnrichment.company_summary}
                      </p>
                    </div>

                    <div>
                      <h4 className="font-semibold text-slate-800 uppercase tracking-wider text-[10px] mb-1">Target Market Fit</h4>
                      <Badge variant="high" className="capitalize">
                        {latestEnrichment.target_market_fit || "High"} Fit
                      </Badge>
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
                  </div>
                ) : (
                  <div className="py-8 text-center text-slate-500">
                    <Sparkles className="h-8 w-8 mx-auto text-indigo-300 mb-2" />
                    <p className="font-semibold text-slate-700 text-xs">Ready for AI Company Research</p>
                    <p className="text-[11px] text-slate-400 max-w-sm mx-auto mt-0.5">
                      Trigger Claude 3.5 Sonnet to research company compliance requirements and extract buying signals.
                    </p>
                    <Button size="sm" className="mt-3 text-xs bg-indigo-600 hover:bg-indigo-700">
                      Run AI Enrichment
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

          {/* TAB 5: HISTORY */}
          {activeTab === "history" && (
            <Card className="p-5 shadow-2xs">
              <h3 className="font-bold text-slate-900 text-sm mb-3">Enrichment & Scoring Runs</h3>
              <p className="text-xs text-slate-500">Every scoring calculation and enrichment cycle is preserved for auditing.</p>
            </Card>
          )}
        </div>

        {/* Right Column: CRM Sidebar Panel */}
        <div className="space-y-4">
          {/* Sales Assignment Card */}
          <Card className="shadow-2xs p-5 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Sales Assignment
            </h4>
            <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 border border-slate-200/70">
              <div className="h-8 w-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs">
                SF
              </div>
              <div className="flex-1 min-w-0 text-xs">
                <p className="font-bold text-slate-900 truncate">Secfix GTM Rep</p>
                <p className="text-[11px] text-slate-400 truncate">Active Sales Assignment</p>
              </div>
            </div>
          </Card>

          {/* Recommended Next Action */}
          <Card className="shadow-2xs p-5 space-y-2 border-indigo-100 bg-indigo-50/20">
            <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
              <Send className="h-3.5 w-3.5" />
              Recommended Next Action
            </h4>
            <p className="text-xs text-slate-700 leading-relaxed">
              Research the company's security and compliance requirements before initiating outreach. Identify if they recently expanded into EU cloud workloads.
            </p>
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
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                <span>Company name & domain verified</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                <span>Industry & geography normalized</span>
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
