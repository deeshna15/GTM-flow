import apiClient from "./api";

export interface AutomationRule {
  id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  conditions: Record<string, any>;
  actions: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AutomationExecution {
  id: string;
  rule_id: string;
  entity_type: string;
  entity_id: string;
  status: string;
  execution_details: Record<string, any> | null;
  error_message: string | null;
  executed_at: string;
}

export interface JobExecutionRecord {
  id: string;
  task_id: string;
  job_type: string;
  status: "PENDING" | "RUNNING" | "SUCCESS" | "FAILED";
  retry_count: number;
  max_retries: number;
  payload: Record<string, any> | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface JobsSummary {
  total_jobs: number;
  success_jobs: number;
  failed_jobs: number;
  running_jobs: number;
  pending_jobs: number;
  items: JobExecutionRecord[];
}

export interface WorkerStatus {
  broker_status: string;
  broker_latency_ms?: number;
  scheduled_jobs: string[];
  execution_mode: string;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
}

export const automationsApi = {
  listRules: async (): Promise<AutomationRule[]> => {
    const res = await apiClient.get<AutomationRule[]>("/automations/rules");
    return res.data;
  },

  createRule: async (payload: {
    name: string;
    description?: string;
    trigger_type: string;
    conditions: Record<string, any>;
    actions: string[];
    is_active: boolean;
  }): Promise<AutomationRule> => {
    const res = await apiClient.post<AutomationRule>("/automations/rules", payload);
    return res.data;
  },

  toggleRule: async (ruleId: string, isActive: boolean): Promise<AutomationRule> => {
    const res = await apiClient.patch<AutomationRule>(`/automations/rules/${ruleId}`, {
      is_active: isActive,
    });
    return res.data;
  },

  deleteRule: async (ruleId: string): Promise<void> => {
    await apiClient.delete(`/automations/rules/${ruleId}`);
  },

  runRule: async (ruleId: string): Promise<{
    rule_id: string;
    rule_name: string;
    evaluated_accounts: number;
    succeeded: number;
    skipped: number;
    failed: number;
    message: string;
  }> => {
    const res = await apiClient.post(`/automations/rules/${ruleId}/run`, {});
    return res.data;
  },

  listExecutions: async (): Promise<AutomationExecution[]> => {
    const res = await apiClient.get<AutomationExecution[]>("/automations/executions");
    return res.data;
  },
};

export const jobsApi = {
  listJobs: async (params?: { status?: string; job_type?: string }): Promise<JobsSummary> => {
    const res = await apiClient.get<JobsSummary>("/jobs", { params });
    return res.data;
  },

  getWorkerStatus: async (): Promise<WorkerStatus> => {
    const res = await apiClient.get<WorkerStatus>("/jobs/worker-status");
    return res.data;
  },

  retryJob: async (jobId: string): Promise<JobExecutionRecord> => {
    const res = await apiClient.post<JobExecutionRecord>(`/jobs/${jobId}/retry`);
    return res.data;
  },
};

export const notificationsApi = {
  list: async (): Promise<{ unread_count: number; items: NotificationItem[] }> => {
    const res = await apiClient.get("/notifications");
    return res.data;
  },

  markRead: async (id: string): Promise<NotificationItem> => {
    const res = await apiClient.post<NotificationItem>(`/notifications/${id}/read`);
    return res.data;
  },

  markAllRead: async (): Promise<void> => {
    await apiClient.post("/notifications/read-all");
  },
};
