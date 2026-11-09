"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Building2,
  Search,
  Filter,
  Plus,
  ArrowUpDown,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Sparkles,
  ShieldAlert,
  X,
  UserCheck,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { accountsApi, AccountListParams } from "@/services/accounts";
import { Account, PriorityLevel } from "@/types";
import { formatNumber, getPriorityColor } from "@/lib/utils";

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters & Sorting
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedPriority, setSelectedPriority] = useState<PriorityLevel | "ALL">("ALL");
  const [sortBy, setSortBy] = useState<string>("lead_score");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Create Modal
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [newCompanyName, setNewCompanyName] = useState<string>("");
  const [newWebsite, setNewWebsite] = useState<string>("");
  const [newIndustry, setNewIndustry] = useState<string>("Cybersecurity");
  const [newCountry, setNewCountry] = useState<string>("Germany");
  const [newEmployees, setNewEmployees] = useState<string>("100");
  const [newDescription, setNewDescription] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);

  const fetchAccounts = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const params: AccountListParams = {
        page: currentPage,
        size: 15,
        search: searchTerm.trim() || undefined,
        priority: selectedPriority === "ALL" ? undefined : selectedPriority,
        sort_by: sortBy,
        sort_order: sortOrder,
      };
      const res = await accountsApi.getAccounts(params);
      setAccounts(res.items);
      setTotal(res.total);
      setTotalPages(res.pages);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to load accounts from database.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, [currentPage, selectedPriority, sortBy, sortOrder]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchAccounts();
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) {
      setFormError("Company name is required.");
      return;
    }
    setFormError(null);
    setIsSubmitting(true);
    try {
      await accountsApi.createAccount({
        company_name: newCompanyName.trim(),
        website: newWebsite.trim() || undefined,
        industry: newIndustry.trim() || undefined,
        country: newCountry.trim() || undefined,
        employee_count: newEmployees ? parseInt(newEmployees, 10) : undefined,
        description: newDescription.trim() || undefined,
      });
      setIsCreateOpen(false);
      setNewCompanyName("");
      setNewWebsite("");
      setNewDescription("");
      fetchAccounts();
    } catch (err: any) {
      setFormError(err.message || "Failed to create account.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAccount = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}? All associated contacts and research will be permanently removed.`)) {
      return;
    }
    try {
      await accountsApi.deleteAccount(id);
      fetchAccounts();
    } catch (err: any) {
      alert(`Could not delete account: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Account Intelligence</h1>
            <Badge variant="outline" className="text-xs">
              {total} Total Companies
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Target company accounts enriched with compliance signals, ICP qualification, and deterministic lead scoring.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="text-xs bg-indigo-600 hover:bg-indigo-700 shadow-sm"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add Account
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by company or domain..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </form>

        {/* Priority Filter Pills */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1">
            Priority:
          </span>
          {(["ALL", "HIGH", "MEDIUM", "LOW"] as const).map((pri) => (
            <button
              key={pri}
              onClick={() => {
                setSelectedPriority(pri);
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                selectedPriority === pri
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {pri}
            </button>
          ))}
        </div>

        {/* Sorting Dropdown */}
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [sb, so] = e.target.value.split("-") as [string, "asc" | "desc"];
              setSortBy(sb);
              setSortOrder(so);
              setCurrentPage(1);
            }}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:border-indigo-500"
          >
            <option value="lead_score-desc">Highest Lead Score</option>
            <option value="lead_score-asc">Lowest Lead Score</option>
            <option value="employee_count-desc">Largest Size (Employees)</option>
            <option value="company_name-asc">Company Name (A-Z)</option>
            <option value="created_at-desc">Recently Added</option>
          </select>
        </div>
      </div>

      {/* Accounts Table */}
      <Card className="overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">Company Name</th>
                <th className="py-3.5 px-4">Industry / Market</th>
                <th className="py-3.5 px-4">Employees</th>
                <th className="py-3.5 px-4">Lead Score</th>
                <th className="py-3.5 px-4">Priority</th>
                <th className="py-3.5 px-4">Enrichment</th>
                <th className="py-3.5 px-4">Assigned Rep</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="p-4"><Skeleton className="h-4 w-36" /></td>
                    <td className="p-4"><Skeleton className="h-4 w-28" /></td>
                    <td className="p-4"><Skeleton className="h-4 w-12" /></td>
                    <td className="p-4"><Skeleton className="h-4 w-16" /></td>
                    <td className="p-4"><Skeleton className="h-4 w-16" /></td>
                    <td className="p-4"><Skeleton className="h-4 w-20" /></td>
                    <td className="p-4"><Skeleton className="h-4 w-24" /></td>
                    <td className="p-4 text-right"><Skeleton className="h-4 w-12 ml-auto" /></td>
                  </tr>
                ))
              ) : accounts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <Building2 className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                    <p className="font-semibold text-slate-700 text-sm">No company accounts found</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                      No accounts matched your filters. Import a CSV file or add a new account manually to start lead qualification.
                    </p>
                  </td>
                </tr>
              ) : (
                accounts.map((acc) => {
                  const priColor = getPriorityColor(acc.priority);

                  return (
                    <tr
                      key={acc.id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* Company Name & Domain */}
                      <td className="py-3.5 px-4">
                        <Link
                          href={`/accounts/${acc.id}`}
                          className="font-semibold text-slate-900 hover:text-indigo-600 transition-colors"
                        >
                          {acc.company_name}
                        </Link>
                        {acc.domain && (
                          <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                            <span>{acc.domain}</span>
                            {acc.website && (
                              <a
                                href={acc.website}
                                target="_blank"
                                rel="noreferrer"
                                className="hover:text-slate-600"
                              >
                                <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Industry & Country */}
                      <td className="py-3.5 px-4 text-slate-600">
                        <div className="font-medium text-slate-800">{acc.industry || "—"}</div>
                        <div className="text-[11px] text-slate-400">{acc.country || "Global"}</div>
                      </td>

                      {/* Employees */}
                      <td className="py-3.5 px-4 text-slate-700 font-medium">
                        {formatNumber(acc.employee_count)}
                      </td>

                      {/* Lead Score */}
                      <td className="py-3.5 px-4">
                        {acc.lead_score !== null ? (
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">
                              {acc.lead_score}
                            </span>
                            <span className="text-[10px] text-slate-400">/ 100</span>
                          </div>
                        ) : (
                          <span className="text-slate-300 text-xs italic">Unscored</span>
                        )}
                      </td>

                      {/* Priority */}
                      <td className="py-3.5 px-4">
                        {acc.priority ? (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${priColor.badge}`}
                          >
                            {acc.priority}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>

                      {/* Enrichment Status */}
                      <td className="py-3.5 px-4">
                        {acc.enrichment_status === "COMPLETED" ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-medium text-[11px]">
                            <Sparkles className="h-3 w-3 text-emerald-600" />
                            Enriched
                          </span>
                        ) : acc.enrichment_status === "FAILED" ? (
                          <span className="inline-flex items-center gap-1 text-red-600 font-medium text-[11px]">
                            <ShieldAlert className="h-3 w-3 text-red-500" />
                            Failed
                          </span>
                        ) : (
                          <span className="text-slate-400 font-medium text-[11px]">
                            Pending
                          </span>
                        )}
                      </td>

                      {/* Assigned Sales Rep */}
                      <td className="py-3.5 px-4 text-slate-600">
                        {acc.assigned_to ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-700 font-medium">
                            <UserCheck className="h-3 w-3 text-indigo-500" />
                            Assigned
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-300">Unassigned</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/accounts/${acc.id}`}>
                            <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]">
                              View
                            </Button>
                          </Link>
                          <button
                            onClick={() => handleDeleteAccount(acc.id, acc.company_name)}
                            className="text-slate-400 hover:text-red-600 p-1 rounded transition-colors"
                            title="Delete Account"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {total > 0 && (
          <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
            <div>
              Showing page <span className="font-semibold text-slate-900">{currentPage}</span> of{" "}
              <span className="font-semibold text-slate-900">{totalPages}</span> ({total} accounts)
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="h-7 text-xs"
              >
                <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="h-7 text-xs"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Create Account Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm">Add Company Account</h3>
                  <p className="text-xs text-slate-400">Manual entry with automated domain normalization</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && (
              <div className="p-2.5 rounded-lg bg-red-50 text-red-700 border border-red-200 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateAccount} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1 uppercase tracking-wider">
                  Company Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Northstar Security GmbH"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-md border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1 uppercase tracking-wider">
                  Website or Domain
                </label>
                <input
                  type="text"
                  placeholder="e.g., https://northstarsecurity.example"
                  value={newWebsite}
                  onChange={(e) => setNewWebsite(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-md border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1 uppercase tracking-wider">
                    Industry
                  </label>
                  <select
                    value={newIndustry}
                    onChange={(e) => setNewIndustry(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-md border border-slate-300 text-slate-900 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Cybersecurity">Cybersecurity</option>
                    <option value="SaaS">SaaS</option>
                    <option value="Technology">Technology</option>
                    <option value="Financial Services">Financial Services</option>
                    <option value="Healthcare">Healthcare</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1 uppercase tracking-wider">
                    Country
                  </label>
                  <input
                    type="text"
                    value={newCountry}
                    onChange={(e) => setNewCountry(e.target.value)}
                    placeholder="Germany"
                    className="w-full px-3 py-1.5 rounded-md border border-slate-300 text-slate-900 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1 uppercase tracking-wider">
                  Employee Count
                </label>
                <input
                  type="number"
                  min="1"
                  value={newEmployees}
                  onChange={(e) => setNewEmployees(e.target.value)}
                  placeholder="150"
                  className="w-full px-3 py-1.5 rounded-md border border-slate-300 text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1 uppercase tracking-wider">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Company summary, compliance context..."
                  className="w-full px-3 py-1.5 rounded-md border border-slate-300 text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  isLoading={isSubmitting}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  Create Account
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
