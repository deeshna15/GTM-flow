import apiClient from "./api";

export interface ImportPreviewResponse {
  file_id: string;
  file_name: string;
  detected_columns: string[];
  preview_rows: Record<string, any>[];
  total_rows_detected: number;
  suggested_mapping: Record<string, string>;
}

export interface ImportExecutePayload {
  file_id: string;
  field_mapping: Record<string, string>;
  conflict_policy?: "PRESERVE_EXISTING" | "OVERWRITE_EMPTY";
}

export interface ImportJob {
  id: string;
  file_name: string;
  file_size_bytes: number;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "PARTIAL" | "FAILED";
  total_records: number;
  processed_records: number;
  duplicate_records: number;
  failed_records: number;
  field_mapping?: Record<string, any>;
  error_summary?: { row: number; error: string; raw_record?: any }[];
  created_at: string;
  completed_at?: string;
}

export const importsApi = {
  uploadFile: async (file: File): Promise<ImportPreviewResponse> => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await apiClient.post<ImportPreviewResponse>("/imports/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },

  startImport: async (payload: ImportExecutePayload): Promise<ImportJob> => {
    const response = await apiClient.post<ImportJob>("/imports/start", payload);
    return response.data;
  },

  getImportJob: async (id: string): Promise<ImportJob> => {
    const response = await apiClient.get<ImportJob>(`/imports/${id}`);
    return response.data;
  },

  listImportJobs: async (): Promise<ImportJob[]> => {
    const response = await apiClient.get<ImportJob[]>("/imports");
    return response.data;
  },
};
