import apiClient from "./api";

export interface BuyingSignal {
  signal: string;
  evidence: string;
  confidence: "high" | "medium" | "low";
}

export interface ClaudeEnrichmentOutput {
  company_summary: string;
  industry_classification: string;
  target_market_fit: "high" | "medium" | "low";
  compliance_relevance: string[];
  buying_signals: BuyingSignal[];
  recommended_roles: string[];
  recommended_next_action: string;
  confidence_notes?: string;
  analysis_mode?: string;
  review_status?: "PENDING_REVIEW" | "APPROVED" | "REJECTED";
}

export interface EnrichmentRecord {
  id: string;
  account_id: string;
  provider: string;
  input_snapshot: Record<string, any>;
  output_data: ClaudeEnrichmentOutput | null;
  status: string;
  model_name: string;
  tokens_used: number | null;
  latency_ms: number | null;
  error_message: string | null;
  created_at: string;
  account?: {
    id: string;
    company_name: string;
    domain: string | null;
    industry: string | null;
    country: string | null;
    employee_count: number | null;
    lead_score: number | null;
    priority: string | null;
  };
}

export interface EnrichmentFeedResponse {
  items: EnrichmentRecord[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface BulkEnrichResponse {
  job_id: string;
  queued_count: number;
  status: string;
  mode: string;
  message: string;
}

export const enrichmentApi = {
  enrichAccount: async (accountId: string): Promise<EnrichmentRecord> => {
    const res = await apiClient.post<EnrichmentRecord>(`/accounts/${accountId}/enrich`);
    return res.data;
  },

  getAccountEnrichments: async (accountId: string): Promise<EnrichmentRecord[]> => {
    const res = await apiClient.get<EnrichmentRecord[]>(`/accounts/${accountId}/enrichment`);
    return res.data;
  },

  bulkEnrich: async (accountIds?: string[], limit: number = 20): Promise<BulkEnrichResponse> => {
    const res = await apiClient.post<BulkEnrichResponse>("/accounts/bulk-enrich", {
      account_ids: accountIds,
      limit,
    });
    return res.data;
  },

  listFeed: async (params?: {
    status?: string;
    review_status?: string;
    page?: number;
    size?: number;
  }): Promise<EnrichmentFeedResponse> => {
    const res = await apiClient.get<EnrichmentFeedResponse>("/enrichment", { params });
    return res.data;
  },

  reviewRecord: async (
    recordId: string,
    payload: { decision: "APPROVE" | "REJECT"; apply_industry?: boolean; apply_summary?: boolean }
  ): Promise<EnrichmentRecord> => {
    const res = await apiClient.post<EnrichmentRecord>(`/enrichment/${recordId}/review`, payload);
    return res.data;
  },
};
