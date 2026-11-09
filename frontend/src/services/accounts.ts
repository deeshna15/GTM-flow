import apiClient from "./api";
import { Account, PriorityLevel, EnrichmentStatus } from "../types";

export interface AccountListParams {
  search?: string;
  country?: string;
  industry?: string;
  priority?: PriorityLevel;
  sort_by?: string;
  sort_order?: "asc" | "desc";
  page?: number;
  size?: number;
}

export interface AccountPaginationResponse {
  items: Account[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface CreateAccountPayload {
  company_name: string;
  domain?: string;
  website?: string;
  industry?: string;
  country?: string;
  employee_count?: number;
  description?: string;
  assigned_to?: string;
}

export interface UpdateAccountPayload {
  company_name?: string;
  domain?: string;
  website?: string;
  industry?: string;
  country?: string;
  employee_count?: number;
  description?: string;
  priority?: PriorityLevel;
  lead_score?: number;
  enrichment_status?: EnrichmentStatus;
  assigned_to?: string;
}

export interface AuditLogItem {
  id: string;
  user_id?: string;
  entity_type: string;
  entity_id: string;
  action: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  ip_address?: string;
  created_at: string;
}

export interface AuditLogPaginationResponse {
  items: AuditLogItem[];
  total: number;
  page: number;
  size: number;
}

export const accountsApi = {
  getAccounts: async (params?: AccountListParams): Promise<AccountPaginationResponse> => {
    const response = await apiClient.get<AccountPaginationResponse>("/accounts", { params });
    return response.data;
  },

  getAccountById: async (id: string): Promise<Account & { contacts: any[]; enrichment_records: any[]; lead_scores: any[] }> => {
    const response = await apiClient.get(`/accounts/${id}`);
    return response.data;
  },

  createAccount: async (payload: CreateAccountPayload): Promise<Account> => {
    const response = await apiClient.post<Account>("/accounts", payload);
    return response.data;
  },

  updateAccount: async (id: string, payload: UpdateAccountPayload): Promise<Account> => {
    const response = await apiClient.patch<Account>(`/accounts/${id}`, payload);
    return response.data;
  },

  deleteAccount: async (id: string): Promise<void> => {
    await apiClient.delete(`/accounts/${id}`);
  },

  getAccountActivity: async (id: string, page = 1, size = 20): Promise<AuditLogPaginationResponse> => {
    const response = await apiClient.get<AuditLogPaginationResponse>(`/accounts/${id}/activity`, {
      params: { page, size },
    });
    return response.data;
  },
};
