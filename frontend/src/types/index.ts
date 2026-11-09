export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface SystemHealth {
  status: "online" | "offline" | "degraded";
  service: string;
  environment: string;
  timestamp: string;
  version: string;
}

export interface DependencyHealth {
  status: "healthy" | "unhealthy";
  latency_ms?: number;
  error?: string;
}

export interface ReadinessResponse {
  ready: boolean;
  status: "ready" | "degraded";
  timestamp: string;
  dependencies: {
    database: DependencyHealth;
    redis: DependencyHealth;
  };
}

export type PriorityLevel = "HIGH" | "MEDIUM" | "LOW";
export type EnrichmentStatus = "PENDING" | "COMPLETED" | "FAILED";

export interface Account {
  id: string;
  company_name: string;
  domain: string | null;
  website: string | null;
  industry: string | null;
  country: string | null;
  employee_count: number | null;
  description: string | null;
  source: string;
  enrichment_status: EnrichmentStatus;
  lead_score: number | null;
  priority: PriorityLevel | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  account_id: string;
  first_name: string;
  last_name: string;
  email: string;
  job_title: string | null;
  department: string | null;
  seniority: string | null;
  linkedin_url: string | null;
  created_at: string;
}

export interface LeadScoreBreakdown {
  total_score: number;
  industry_score: number;
  geography_score: number;
  size_score: number;
  signal_score: number;
  data_completeness_score: number;
  priority: PriorityLevel;
  explanation: Record<string, any>;
  scoring_version: string;
  calculated_at: string;
}

export interface JobExecution {
  id: string;
  task_id: string;
  job_type: "IMPORT" | "ENRICH" | "SCORE" | "ASSIGN";
  status: "PENDING" | "RUNNING" | "SUCCESS" | "FAILED";
  retry_count: number;
  error_message?: string | null;
  started_at: string;
  completed_at?: string | null;
}
