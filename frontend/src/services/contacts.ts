import apiClient from "./api";
import { Contact } from "../types";

export interface ContactListParams {
  account_id?: string;
  search?: string;
  is_decision_maker?: boolean;
  buying_role?: string;
  page?: number;
  size?: number;
}

export interface ContactPaginationResponse {
  items: (Contact & { account?: { id: string; company_name: string; domain?: string } })[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface CreateContactPayload {
  account_id: string;
  first_name: string;
  last_name: string;
  email?: string;
  job_title?: string;
  department?: string;
  seniority?: string;
  linkedin_url?: string;
  is_decision_maker?: boolean;
  buying_role?: string;
}

export interface UpdateContactPayload {
  first_name?: string;
  last_name?: string;
  email?: string;
  job_title?: string;
  department?: string;
  seniority?: string;
  linkedin_url?: string;
  is_decision_maker?: boolean;
  buying_role?: string;
  verification_status?: string;
}

export const contactsApi = {
  getContacts: async (params?: ContactListParams): Promise<ContactPaginationResponse> => {
    const response = await apiClient.get<ContactPaginationResponse>("/contacts", { params });
    return response.data;
  },

  getContactById: async (id: string): Promise<Contact> => {
    const response = await apiClient.get<Contact>(`/contacts/${id}`);
    return response.data;
  },

  createContact: async (payload: CreateContactPayload): Promise<Contact> => {
    const response = await apiClient.post<Contact>("/contacts", payload);
    return response.data;
  },

  updateContact: async (id: string, payload: UpdateContactPayload): Promise<Contact> => {
    const response = await apiClient.patch<Contact>(`/contacts/${id}`, payload);
    return response.data;
  },

  deleteContact: async (id: string): Promise<void> => {
    await apiClient.delete(`/contacts/${id}`);
  },
};
