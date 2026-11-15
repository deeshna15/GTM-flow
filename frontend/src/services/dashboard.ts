import apiClient from "./api";
import { User, UserRole } from "@/types";

export interface DashboardOverview {
  total_accounts: number;
  total_contacts: number;
  high_priority_accounts: number;
  medium_priority_accounts: number;
  low_priority_accounts: number;
  accounts_awaiting_enrichment: number;
  enriched_accounts: number;
  average_lead_score: number;
  successful_jobs: number;
  failed_jobs: number;
  pending_jobs: number;
  industry_distribution: Array<{ name: string; count: number }>;
  country_distribution: Array<{ name: string; count: number }>;
  priority_distribution: Array<{ name: string; count: number }>;
  recent_imports: Array<{
    id: string;
    file_name: string;
    status: string;
    total_records: number;
    processed_records: number;
    duplicate_records: number;
    failed_records: number;
    created_at: string;
  }>;
  recent_activities: Array<{
    id: string;
    action: string;
    entity_type: string;
    entity_id: string;
    new_values: Record<string, any> | null;
    created_at: string;
  }>;
  top_priority_accounts: Array<{
    id: string;
    company_name: string;
    domain: string | null;
    industry: string | null;
    country: string | null;
    employee_count: number | null;
    lead_score: number | null;
    priority: string | null;
    enrichment_status: string;
    assigned_user_name: string | null;
  }>;
}

export interface TeamMember extends User {
  assigned_accounts_count: number;
}

export const dashboardApi = {
  getOverview: async (): Promise<DashboardOverview> => {
    const res = await apiClient.get<DashboardOverview>("/dashboard/overview");
    return res.data;
  },
};

export const usersApi = {
  listUsers: async (): Promise<TeamMember[]> => {
    const res = await apiClient.get<TeamMember[]>("/users");
    return res.data;
  },

  createUser: async (payload: {
    full_name: string;
    email: string;
    password: string;
    role: UserRole;
  }): Promise<User> => {
    const res = await apiClient.post<User>("/users", payload);
    return res.data;
  },

  updateUser: async (
    userId: string,
    payload: { full_name?: string; role?: UserRole; is_active?: boolean }
  ): Promise<User> => {
    const res = await apiClient.patch<User>(`/users/${userId}`, payload);
    return res.data;
  },
};
