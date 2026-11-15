import axios, { AxiosInstance, AxiosResponse } from "axios";
import { SystemHealth, ReadinessResponse } from "../types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Interceptor for attaching auth token from localStorage if present
apiClient.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("gtmflow_token");
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Interceptor for unified error handling and 401 expiry redirect
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error) => {
    if (
      typeof window !== "undefined" &&
      error.response?.status === 401 &&
      !window.location.pathname.startsWith("/login")
    ) {
      localStorage.removeItem("gtmflow_token");
      localStorage.removeItem("gtmflow_user");
      window.location.href = "/login";
    }

    const message =
      error.response?.data?.detail ||
      error.response?.data?.message ||
      error.message ||
      "An unexpected error occurred";
    return Promise.reject(new Error(typeof message === "string" ? message : JSON.stringify(message)));
  }
);

export const healthApi = {
  getLiveness: async (): Promise<SystemHealth> => {
    const response = await axios.get<SystemHealth>(
      API_BASE_URL.replace("/api/v1", "/health")
    );
    return response.data;
  },

  getReadiness: async (): Promise<ReadinessResponse> => {
    const response = await axios.get<ReadinessResponse>(
      API_BASE_URL.replace("/api/v1", "/ready")
    );
    return response.data;
  },
};

export default apiClient;
