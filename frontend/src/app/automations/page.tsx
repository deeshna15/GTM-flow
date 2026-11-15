"use client";

import React, { useState, useEffect } from "react";
import {
  Zap,
  Play,
  Plus,
  Trash2,
  CheckCircle2,
  PauseCircle,
  Clock,
  Activity,
  X,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  automationsApi,
  AutomationRule,
  AutomationExecution,
} from "@/services/automations";
import { formatDate } from "@/lib/utils";
import { User } from "@/types";

export default function AutomationsPage() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [executions, setExecutions] = useState<AutomationExecution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [runningRuleId, setRunningRuleId] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Create Rule Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newTrigger, setNewTrigger] = useState("ON_SCORE_CALCULATED");
  const [minScore, setMinScore] = useState("80");
  const [unassignedOnly, setUnassignedOnly] = useState(true);
  const [selectedActions, setSelectedActions] = useState<string[]>(["AUTO_ASSIGN_REP", "CREATE_ALERT"]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [r, ex] = await Promise.all([
        automationsApi.listRules(),
        automationsApi.listExecutions(),
      ]);
      setRules(r);
      setExecutions(ex);
    } catch (err: any) {
      console.error("Failed to fetch automations:", err);
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

  const isAdmin = currentUser?.role === "ADMIN";

  const handleRunRule = async (ruleId: string) => {
    setRunningRuleId(ruleId);
    setBanner(null);
    try {
      const res = await automationsApi.runRule(ruleId);
      setBanner(res.message);
      await loadData();
    } catch (err: any) {
      setBanner(`Execution error: ${err.message}`);
    } finally {
      setRunningRuleId(null);
    }
  };

  const handleToggleRule = async (rule: AutomationRule) => {
    try {
      await automationsApi.toggleRule(rule.id, !rule.is_active);
      await loadData();
    } catch (err: any) {
      alert(`Failed to update rule: ${err.message}`);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm("Delete this automation rule?")) return;
    try {
      await automationsApi.deleteRule(ruleId);
      await loadData();
    } catch (err: any) {
      alert(`Failed to delete rule: ${err.message}`);
    }
  };

  const toggleActionChoice = (act: string) => {
    setSelectedActions((prev) =>
      prev.includes(act) ? prev.filter((a) => a !== act) : [...prev, act]
    );
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || selectedActions.length === 0) return;

    const conditions: Record<string, any> = {};
    if (minScore.trim() !== "") conditions.min_score = Number(minScore);
    if (unassignedOnly) conditions.unassigned_only = true;

    try {
      await automationsApi.createRule({
        name: newName.trim(),
        description: newDesc.trim() || undefined,
        trigger_type: newTrigger,
        conditions,
        actions: selectedActions,
        is_active: true,
      });
      setIsModalOpen(false);
      setNewName("");
      setNewDesc("");
      await loadData();
    } catch (err: any) {
      alert(`Failed to create rule: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Zap className="h-6 w-6 text-indigo-600" />
            GTM Automation Workflows
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure trigger-condition-action playbooks to score leads, assign reps, and generate priority alerts automatically.
          </p>
        </div>

        {isAdmin && (
          <Button
            size="sm"
            onClick={() => setIsModalOpen(true)}
            className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New Automation Rule
          </Button>
        )}
      </div>

      {banner && (
        <div className="p-3.5 rounded-lg bg-indigo-50 border border-indigo-200 text-xs font-medium text-indigo-900 flex items-center justify-between">
          <span>{banner}</span>
          <button onClick={() => setBanner(null)} className="text-indigo-600 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Rules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))
        ) : (
          rules.map((rule) => (
            <Card key={rule.id} className="border border-slate-200 bg-white flex flex-col justify-between">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Badge className="text-[10px] font-mono bg-indigo-50 text-indigo-700 border-indigo-100">
                      {rule.trigger_type}
                    </Badge>
                    <h3 className="text-sm font-bold text-slate-900 mt-2">{rule.name}</h3>
                  </div>
                  <Badge
                    className={`text-[10px] shrink-0 ${
                      rule.is_active
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-slate-100 text-slate-500 border-slate-200"
                    }`}
                  >
                    {rule.is_active ? "Active" : "Paused"}
                  </Badge>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed">
                  {rule.description || "Automated GTM workflow rule."}
                </p>

                <div className="pt-2 border-t border-slate-100 space-y-2 text-[11px]">
                  <div>
                    <span className="font-semibold text-slate-600">Conditions: </span>
                    <span className="font-mono text-slate-500">
                      {Object.keys(rule.conditions || {}).length > 0
                        ? JSON.stringify(rule.conditions)
                        : "All accounts"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {rule.actions.map((act, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px]"
                      >
                        {act}
                      </span>
                    ))}
                  </div>
                </div>
              </CardContent>

              <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                <Button
                  size="sm"
                  onClick={() => handleRunRule(rule.id)}
                  disabled={runningRuleId === rule.id}
                  className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white h-8"
                >
                  <Play className="h-3 w-3 mr-1" />
                  {runningRuleId === rule.id ? "Running..." : "Run Now"}
                </Button>

                {isAdmin && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleRule(rule)}
                      className="text-xs h-8 px-2.5"
                    >
                      {rule.is_active ? (
                        <>
                          <PauseCircle className="h-3.5 w-3.5 mr-1 text-amber-600" /> Pause
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-600" /> Enable
                        </>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteRule(rule.id)}
                      className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 h-8 px-2"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Execution History Log */}
      <Card className="border border-slate-200 bg-white overflow-hidden">
        <CardHeader className="p-5 border-b border-slate-100">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-indigo-600" />
            Recent Automation Execution Audit
          </CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[10px]">
              <tr>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Details / Actions Executed</th>
                <th className="px-4 py-3">Executed At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {executions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                    No automation executions recorded yet. Click &ldquo;Run Now&rdquo; on a rule above.
                  </td>
                </tr>
              ) : (
                executions.map((ex) => (
                  <tr key={ex.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <Badge
                        className={`text-[10px] ${
                          ex.status === "SUCCESS"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-rose-50 text-rose-700 border-rose-200"
                        }`}
                      >
                        {ex.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {ex.execution_details?.company_name || ex.entity_id}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-600">
                      {ex.error_message ||
                        ex.execution_details?.actions_executed?.join(", ") ||
                        JSON.stringify(ex.execution_details)}
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {formatDate(ex.executed_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Create Automation Workflow Rule</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRule} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Rule Name *</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Route High-Score DACH Leads"
                  className="w-full px-3 py-1.5 rounded-md border border-slate-300 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Optional description of workflow logic"
                  className="w-full px-3 py-1.5 rounded-md border border-slate-300 text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Trigger Event</label>
                  <select
                    value={newTrigger}
                    onChange={(e) => setNewTrigger(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-md border border-slate-300 text-slate-900"
                  >
                    <option value="ON_SCORE_CALCULATED">On Score Calculated</option>
                    <option value="ON_ENRICHMENT_COMPLETE">On Enrichment Complete</option>
                    <option value="ON_IMPORT_COMPLETE">On Import Complete</option>
                    <option value="SCHEDULED_DAILY">Scheduled Daily</option>
                    <option value="MANUAL">Manual Only</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Min Lead Score</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={minScore}
                    onChange={(e) => setMinScore(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-md border border-slate-300 text-slate-900"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={unassignedOnly}
                  onChange={(e) => setUnassignedOnly(e.target.checked)}
                  className="rounded text-indigo-600 h-4 w-4"
                />
                <span className="text-xs font-medium text-slate-700">Only match unassigned accounts</span>
              </label>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
                  Actions to Execute *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {["ENRICH_ACCOUNT", "SCORE_ACCOUNT", "AUTO_ASSIGN_REP", "CREATE_ALERT"].map((act) => (
                    <label
                      key={act}
                      className={`p-2 rounded border text-[11px] font-mono cursor-pointer flex items-center gap-2 ${
                        selectedActions.includes(act)
                          ? "border-indigo-500 bg-indigo-50 text-indigo-800"
                          : "border-slate-200 text-slate-600"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedActions.includes(act)}
                        onChange={() => toggleActionChoice(act)}
                        className="rounded text-indigo-600"
                      />
                      {act}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  Save Rule
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
