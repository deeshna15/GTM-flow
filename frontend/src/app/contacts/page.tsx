"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  Plus,
  Building2,
  Mail,
  ShieldCheck,
  UserCheck,
  Trash2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { contactsApi, ContactListParams } from "@/services/contacts";
import { accountsApi } from "@/services/accounts";
import { Contact, Account } from "@/types";

export default function ContactsPage() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("ALL");
  const [decisionMakerOnly, setDecisionMakerOnly] = useState<boolean>(false);

  // Add Contact Modal
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [newFirstName, setNewFirstName] = useState<string>("");
  const [newLastName, setNewLastName] = useState<string>("");
  const [newEmail, setNewEmail] = useState<string>("");
  const [newJobTitle, setNewJobTitle] = useState<string>("");
  const [newDepartment, setNewDepartment] = useState<string>("Security");
  const [newBuyingRole, setNewBuyingRole] = useState<string>("DECISION_MAKER");
  const [isDecisionMaker, setIsDecisionMaker] = useState<boolean>(true);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchContacts = async () => {
    setIsLoading(true);
    try {
      const params: ContactListParams = {
        page: currentPage,
        size: 15,
        search: searchTerm.trim() || undefined,
        is_decision_maker: decisionMakerOnly ? true : undefined,
        buying_role: selectedRole === "ALL" ? undefined : selectedRole,
      };
      const res = await contactsApi.getContacts(params);
      setContacts(res.items);
      setTotal(res.total);
      setTotalPages(res.pages);
    } catch (err: any) {
      console.error("Failed to load contacts:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAccountsForDropdown = async () => {
    try {
      const res = await accountsApi.getAccounts({ size: 100 });
      setAccounts(res.items);
      if (res.items.length > 0 && !selectedAccountId) {
        setSelectedAccountId(res.items[0].id);
      }
    } catch (err) {
      console.error("Failed to load accounts for dropdown:", err);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [currentPage, selectedRole, decisionMakerOnly]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchContacts();
  };

  const handleOpenCreateModal = () => {
    loadAccountsForDropdown();
    setIsCreateOpen(true);
  };

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFirstName.trim() || !newLastName.trim() || !selectedAccountId) {
      setFormError("First name, last name, and associated company are required.");
      return;
    }
    setFormError(null);
    setIsSubmitting(true);
    try {
      await contactsApi.createContact({
        account_id: selectedAccountId,
        first_name: newFirstName.trim(),
        last_name: newLastName.trim(),
        email: newEmail.trim() || undefined,
        job_title: newJobTitle.trim() || undefined,
        department: newDepartment.trim() || undefined,
        buying_role: newBuyingRole,
        is_decision_maker: isDecisionMaker,
      });
      setIsCreateOpen(false);
      setNewFirstName("");
      setNewLastName("");
      setNewEmail("");
      setNewJobTitle("");
      fetchContacts();
    } catch (err: any) {
      setFormError(err.message || "Failed to create contact.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteContact = async (id: string, name: string) => {
    if (!confirm(`Delete contact ${name}?`)) return;
    try {
      await contactsApi.deleteContact(id);
      fetchContacts();
    } catch (err: any) {
      alert(`Could not delete contact: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Buying Committee & Contacts</h1>
            <Badge variant="outline" className="text-xs">
              {total} Total Stakeholders
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Map decision makers, technical champions, and economic buyers across target accounts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={handleOpenCreateModal}
            className="text-xs bg-indigo-600 hover:bg-indigo-700 shadow-sm"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add Contact
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, title, email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </form>

        {/* Role Filters */}
        <div className="flex items-center gap-2">
          <select
            value={selectedRole}
            onChange={(e) => {
              setSelectedRole(e.target.value);
              setCurrentPage(1);
            }}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Buying Roles</option>
            <option value="DECISION_MAKER">Decision Makers</option>
            <option value="CHAMPION">Champions</option>
            <option value="INFLUENCER">Influencers</option>
            <option value="BUYER">Economic Buyers</option>
          </select>

          <label className="flex items-center gap-2 cursor-pointer bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700">
            <input
              type="checkbox"
              checked={decisionMakerOnly}
              onChange={(e) => {
                setDecisionMakerOnly(e.target.checked);
                setCurrentPage(1);
              }}
              className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
            />
            <span>Decision Makers Only</span>
          </label>
        </div>
      </div>

      {/* Contacts Table */}
      <Card className="overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">Contact Name</th>
                <th className="py-3.5 px-4">Company</th>
                <th className="py-3.5 px-4">Job Title & Dept</th>
                <th className="py-3.5 px-4">Buying Role</th>
                <th className="py-3.5 px-4">Decision Maker</th>
                <th className="py-3.5 px-4">Work Email</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="p-4"><Skeleton className="h-4 w-32" /></td>
                    <td className="p-4"><Skeleton className="h-4 w-28" /></td>
                    <td className="p-4"><Skeleton className="h-4 w-36" /></td>
                    <td className="p-4"><Skeleton className="h-4 w-20" /></td>
                    <td className="p-4"><Skeleton className="h-4 w-16" /></td>
                    <td className="p-4"><Skeleton className="h-4 w-32" /></td>
                    <td className="p-4 text-right"><Skeleton className="h-4 w-8 ml-auto" /></td>
                  </tr>
                ))
              ) : contacts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <Users className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                    <p className="font-semibold text-slate-700 text-sm">No contacts found</p>
                    <p className="text-xs text-slate-400 mt-1">Associate contacts with companies to build target buying committees.</p>
                  </td>
                </tr>
              ) : (
                contacts.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Name */}
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      {c.first_name} {c.last_name}
                    </td>

                    {/* Company */}
                    <td className="py-3.5 px-4">
                      {c.account ? (
                        <Link
                          href={`/accounts/${c.account.id}`}
                          className="font-medium text-indigo-600 hover:underline flex items-center gap-1"
                        >
                          <Building2 className="h-3 w-3 text-slate-400" />
                          <span>{c.account.company_name}</span>
                        </Link>
                      ) : (
                        <span className="text-slate-400 italic">No account</span>
                      )}
                    </td>

                    {/* Title & Dept */}
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-800">{c.job_title || "—"}</div>
                      <div className="text-[11px] text-slate-400">{c.department || "General"}</div>
                    </td>

                    {/* Buying Role */}
                    <td className="py-3.5 px-4">
                      {c.buying_role ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {c.buying_role}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    {/* Decision Maker Status */}
                    <td className="py-3.5 px-4">
                      {c.is_decision_maker ? (
                        <Badge variant="high" className="text-[10px]">
                          Decision Maker
                        </Badge>
                      ) : (
                        <span className="text-[11px] text-slate-400">Contributor</span>
                      )}
                    </td>

                    {/* Email */}
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600">
                      {c.email || <span className="text-slate-300 italic">No email</span>}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleDeleteContact(c.id, `${c.first_name} ${c.last_name}`)}
                        className="text-slate-400 hover:text-red-600 p-1 rounded transition-colors"
                        title="Delete Contact"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > 0 && (
          <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
            <div>
              Showing page <span className="font-semibold text-slate-900">{currentPage}</span> of{" "}
              <span className="font-semibold text-slate-900">{totalPages}</span> ({total} contacts)
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

      {/* Add Contact Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-sm">Add New Contact</h3>
              </div>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && (
              <div className="p-2.5 rounded-lg bg-red-50 text-red-700 border border-red-200 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateContact} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1 uppercase tracking-wider">
                  Associated Company *
                </label>
                <select
                  required
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-md border border-slate-300 text-slate-900 focus:outline-none focus:border-indigo-500"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.company_name} {acc.domain ? `(${acc.domain})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1 uppercase tracking-wider">
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-md border border-slate-300 text-slate-900 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1 uppercase tracking-wider">
                    Last Name *
                  </label>
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
                <label className="block text-[11px] font-semibold text-slate-700 mb-1 uppercase tracking-wider">
                  Work Email
                </label>
                <input
                  type="email"
                  placeholder="contact@company.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-md border border-slate-300 text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1 uppercase tracking-wider">
                  Job Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Chief Information Security Officer"
                  value={newJobTitle}
                  onChange={(e) => setNewJobTitle(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-md border border-slate-300 text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1 uppercase tracking-wider">
                    Buying Committee Role
                  </label>
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
                <Button type="button" variant="outline" size="sm" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" isLoading={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700">
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
