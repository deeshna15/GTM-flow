import apiClient from "./api";
import { LeadScoreBreakdown, PriorityLevel } from "@/types";

export interface LeadScoreRecord {
  id: string;
  account_id: string;
  total_score: number;
  industry_score: number;
  geography_score: number;
  size_score: number;
  signal_score: number;
  data_completeness_score: number;
  priority: PriorityLevel;
  explanation: {
    breakdown?: Record<string, { score: number; max: number; reason: string }>;
    reasons?: string[];
    recommended_next_action?: string;
    config_name?: string;
  };
  scoring_version: string;
  created_at: string;
}

export interface ScoringConfig {
  id: string;
  name: string;
  weights: Record<string, number>;
  target_industries: Record<string, number>;
  target_geographies: Record<string, number>;
  target_employee_ranges: Record<string, number>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RepWorkload {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
  total_assigned: number;
  high_priority_assigned: number;
}

export interface ScoringOverview {
  total_accounts: number;
  scored_accounts: number;
  average_score: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  unscored_count: number;
  top_accounts: Array<{
    id: string;
    company_name: string;
    domain: string | null;
    industry: string | null;
    country: string | null;
    employee_count: number | null;
    lead_score: number | null;
    priority: PriorityLevel | null;
    enrichment_status: string;
    assigned_to: string | null;
    assigned_user_name: string | null;
  }>;
  rep_workloads: RepWorkload[];
}

export interface AssignAccountResult {
  account_id: string;
  company_name: string;
  assigned_to: string;
  assigned_user_name: string;
  assigned_user_email: string;
  strategy: "MANUAL" | "LEAST_LOADED_AUTO";
  active_account_load: number;
}

export const scoringApi = {
  scoreAccount: async (accountId: string): Promise<LeadScoreRecord> => {
    const res = await apiClient.post<LeadScoreRecord>(`/accounts/${accountId}/score`);
    return res.data;
  },

  bulkScore: async (rescoreAll: boolean = false): Promise<{
    scored_count: number;
    high_priority_count: number;
    medium_priority_count: number;
    low_priority_count: number;
    message: string;
  }> => {
    const res = await apiClient.post("/accounts/bulk-score", { rescore_all: rescoreAll });
    return res.data;
  },

  assignAccount: async (accountId: string, userId?: string): Promise<AssignAccountResult> => {
    const res = await apiClient.post<AssignAccountResult>(`/accounts/${accountId}/assign`, {
      user_id: userId || null,
    });
    return res.data;
  },

  bulkAssignUnassigned: async (onlyHighPriority: boolean = false): Promise<{
    assigned_count: number;
    assignments: AssignAccountResult[];
    message: string;
  }> => {
    const res = await apiClient.post("/accounts/bulk-assign", {
      only_high_priority: onlyHighPriority,
    });
    return res.data;
  },

  getConfig: async (): Promise<ScoringConfig> => {
    const res = await apiClient.get<ScoringConfig>("/scoring/config");
    return res.data;
  },

  updateConfig: async (payload: Partial<ScoringConfig>): Promise<ScoringConfig> => {
    const res = await apiClient.patch<ScoringConfig>("/scoring/config", payload);
    return res.data;
  },

  getOverview: async (): Promise<ScoringOverview> => {
    const res = await apiClient.get<ScoringOverview>("/scoring/overview");
    return res.data;
  },
};
