import apiClient from "./api";
import { User, TokenResponse } from "../types";

export interface RegisterPayload {
  full_name: string;
  email: string;
  password: string;
  role?: "ADMIN" | "SALES";
}

export interface LoginPayload {
  email: string;
  password: string;
}

export const authApi = {
  register: async (payload: RegisterPayload): Promise<User> => {
    const response = await apiClient.post<User>("/auth/register", payload);
    return response.data;
  },

  login: async (payload: LoginPayload): Promise<TokenResponse> => {
    const response = await apiClient.post<TokenResponse>("/auth/login", payload);
    if (response.data.access_token && typeof window !== "undefined") {
      localStorage.setItem("gtmflow_token", response.data.access_token);
      localStorage.setItem("gtmflow_user", JSON.stringify(response.data.user));
    }
    return response.data;
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await apiClient.get<User>("/auth/me");
    return response.data;
  },

  logout: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("gtmflow_token");
      localStorage.removeItem("gtmflow_user");
    }
  },
};
