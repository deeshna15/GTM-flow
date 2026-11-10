"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Download,
  Clock,
  Layers,
  Database,
  ShieldCheck,
  FileText,
  AlertCircle,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  importsApi,
  ImportPreviewResponse,
  ImportJob,
} from "@/services/imports";
import { formatDate, formatNumber } from "@/lib/utils";

// Standard fields recognized by GTMFlow
const GTMFLOW_FIELDS = [
  { value: "company_name", label: "Company Name * (Required)", required: true },
  { value: "domain", label: "Domain (e.g. secfix.com)" },
  { value: "website", label: "Website URL" },
  { value: "industry", label: "Industry / Sector" },
  { value: "country", label: "Country / HQ Location" },
  { value: "employee_count", label: "Employee Count" },
  { value: "description", label: "Company Description" },
  { value: "ignore", label: "— Ignore this column —" },
];

export default function ImportsPage() {
  // Stepper state: 1: Upload, 2: Map & Preview, 3: Conflict Policy, 4: Progress, 5: Complete
  const [step, setStep] = useState<number>(1);

  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Preview & Mapping state
  const [previewData, setPreviewData] = useState<ImportPreviewResponse | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});

  // Policy state
  const [conflictPolicy, setConflictPolicy] = useState<"PRESERVE_EXISTING" | "OVERWRITE_EMPTY">("PRESERVE_EXISTING");
  const [isStartingImport, setIsStartingImport] = useState<boolean>(false);

  // Active Job state
  const [activeJob, setActiveJob] = useState<ImportJob | null>(null);
  const [isPolling, setIsPolling] = useState<boolean>(false);

  // History state
  const [pastJobs, setPastJobs] = useState<ImportJob[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(true);
  const [selectedHistoryJob, setSelectedHistoryJob] = useState<ImportJob | null>(null);

  // Load Past Jobs on Mount
  const fetchPastJobs = async () => {
    try {
      setIsLoadingHistory(true);
      const jobs = await importsApi.listImportJobs();
      setPastJobs(jobs);
    } catch (err: any) {
      console.error("Failed to load past import jobs:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchPastJobs();
  }, []);

  // Poll active job until done
  useEffect(() => {
    let timer: any = null;
    if (activeJob && (activeJob.status === "PENDING" || activeJob.status === "PROCESSING")) {
      setIsPolling(true);
      timer = setTimeout(async () => {
        try {
          const updated = await importsApi.getImportJob(activeJob.id);
          setActiveJob(updated);
          if (updated.status === "COMPLETED" || updated.status === "PARTIAL" || updated.status === "FAILED") {
            setIsPolling(false);
            setStep(5);
            fetchPastJobs();
          }
        } catch (err) {
          console.error("Error polling import job:", err);
        }
      }, 1500);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [activeJob]);

  // Handle File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      if (!f.name.endsWith(".csv") && !f.name.endsWith(".xlsx")) {
        setUploadError("Please select a valid .csv or .xlsx spreadsheet file.");
        return;
      }
      setSelectedFile(f);
      setUploadError(null);
    }
  };

  // Upload & Parse Preview
  const handleUploadAndAnalyze = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setUploadError(null);
    try {
      const preview = await importsApi.uploadFile(selectedFile);
      setPreviewData(preview);

      // Pre-fill mapping from suggested_mapping
      const initialMapping: Record<string, string> = {};
      preview.detected_columns.forEach((col) => {
        initialMapping[col] = preview.suggested_mapping[col] || "ignore";
      });
      setColumnMapping(initialMapping);
      setStep(2);
    } catch (err: any) {
      setUploadError(err.response?.data?.detail || err.message || "Failed to parse file preview.");
    } finally {
      setIsUploading(false);
    }
  };

  // Handle Mapping Change
  const handleMappingChange = (csvCol: string, gtmField: string) => {
    setColumnMapping((prev) => ({
      ...prev,
      [csvCol]: gtmField,
    }));
  };

  // Validate Mapping before Step 3
  const hasCompanyNameMapped = Object.values(columnMapping).includes("company_name");

  // Start Import Execution
  const handleStartImport = async () => {
    if (!previewData) return;
    setIsStartingImport(true);
    try {
      // Clean up mapping to only include non-ignored fields
      const cleanedMapping: Record<string, string> = {};
      Object.entries(columnMapping).forEach(([col, field]) => {
        if (field && field !== "ignore") {
          cleanedMapping[col] = field;
        }
      });

      const job = await importsApi.startImport({
        file_id: previewData.file_id,
        field_mapping: cleanedMapping,
        conflict_policy: conflictPolicy,
      });

      setActiveJob(job);
      setStep(4);
    } catch (err: any) {
      alert("Failed to start import: " + (err.response?.data?.detail || err.message));
    } finally {
      setIsStartingImport(false);
    }
  };

  // Reset Wizard
  const handleReset = () => {
    setStep(1);
    setSelectedFile(null);
    setPreviewData(null);
    setColumnMapping({});
    setActiveJob(null);
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Download Sample CSV
  const handleDownloadSample = () => {
    const csvContent =
      "company_name,website,industry,country,employee_count,description\n" +
      "Northstar Security,northstarsecurity.example,Cybersecurity,Germany,150,Security software provider\n" +
      "CloudBridge,cloudbridge.example,SaaS,France,300,Cloud infrastructure company\n" +
      "SecureStack,securestack.example,Software,Netherlands,85,Enterprise software company\n" +
      "DataOrbit,dataorbit.example,Technology,Germany,45,Data analytics provider\n" +
      "FinCore,fincore.example,Financial Services,France,220,Financial technology company\n" +
      "TechNova,technova.example,IT Services,India,500,IT services provider\n" +
      "CyberNest,cybernest.example,Cybersecurity,Austria,120,Security consulting company\n" +
      "Northstar Security,northstarsecurity.example,Cybersecurity,Germany,150,Duplicate test record\n";

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "gtmflow_sample_accounts.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Completed</Badge>;
      case "PARTIAL":
        return <Badge className="bg-amber-50 text-amber-700 border-amber-200">Partial Success</Badge>;
      case "PROCESSING":
        return <Badge className="bg-blue-50 text-blue-700 border-blue-200">Processing</Badge>;
      case "FAILED":
        return <Badge className="bg-rose-50 text-rose-700 border-rose-200">Failed</Badge>;
      default:
        return <Badge className="bg-slate-50 text-slate-700 border-slate-200">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <UploadCloud className="w-7 h-7 text-indigo-600" />
            CSV Data Ingestion & Deduplication
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Ingest company datasets with automated column detection, 3-tier deduplication, and source provenance.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadSample}
            className="flex items-center gap-1.5 text-xs text-slate-700 border-slate-300 hover:bg-slate-50"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Download Sample CSV
          </Button>
          {step > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="flex items-center gap-1.5 text-xs text-slate-600 border-slate-200"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Wizard
            </Button>
          )}
        </div>
      </div>

      {/* Interactive Ingestion Wizard Card */}
      <Card className="border border-slate-200 shadow-sm bg-white overflow-hidden">
        {/* Progress Stepper Bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { num: 1, title: "1. Upload File" },
              { num: 2, title: "2. Column Mapping" },
              { num: 3, title: "3. Conflict Policy" },
              { num: 4, title: "4. Processing" },
              { num: 5, title: "5. Completed" },
            ].map((s) => (
              <div
                key={s.num}
                className={`flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-md transition-colors ${
                  step === s.num
                    ? "bg-indigo-600 text-white shadow-sm"
                    : step > s.num
                    ? "bg-indigo-50 text-indigo-700 border border-indigo-100"
                    : "text-slate-400 bg-white border border-slate-200"
                }`}
              >
                {step > s.num ? (
                  <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                ) : (
                  <span
                    className={`w-4 h-4 flex items-center justify-center rounded-full text-[10px] ${
                      step === s.num ? "bg-white text-indigo-600 font-bold" : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {s.num}
                  </span>
                )}
                <span className="truncate">{s.title}</span>
              </div>
            ))}
          </div>
        </div>

        <CardContent className="p-6">
          {/* STEP 1: UPLOAD FILE */}
          {step === 1 && (
            <div className="max-w-2xl mx-auto py-6 space-y-6">
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                  selectedFile
                    ? "border-indigo-400 bg-indigo-50/40"
                    : "border-slate-300 hover:border-indigo-400 hover:bg-slate-50/60"
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".csv,.xlsx"
                  className="hidden"
                />
                <div className="w-14 h-14 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileSpreadsheet className="w-7 h-7" />
                </div>
                {selectedFile ? (
                  <div>
                    <p className="font-semibold text-slate-900 text-base">{selectedFile.name}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {(selectedFile.size / 1024).toFixed(1)} KB &bull; Click to change file
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-base font-semibold text-slate-800">
                      Click to choose CSV file or drag and drop
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Standard UTF-8 CSV or Excel file up to 25MB (max 10,000 rows per batch)
                    </p>
                  </div>
                )}
              </div>

              {uploadError && (
                <div className="flex items-center gap-2 p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              <div className="flex justify-between items-center pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadSample}
                  className="text-xs text-slate-600"
                >
                  <Download className="w-3.5 h-3.5 mr-1" />
                  Need sample data? Download template
                </Button>
                <Button
                  onClick={handleUploadAndAnalyze}
                  disabled={!selectedFile || isUploading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium flex items-center gap-2"
                >
                  {isUploading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Analyzing Schema...
                    </>
                  ) : (
                    <>
                      Upload & Preview <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: COLUMN MAPPING & PREVIEW */}
          {step === 2 && previewData && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Map Columns to GTMFlow Target Fields</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    We automatically mapped recognized columns. Please verify that <strong>Company Name</strong> is selected.
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
                  <span>File: <strong>{previewData.file_name}</strong></span>
                  <span>Detected Rows: <strong>{formatNumber(previewData.total_rows_detected)}</strong></span>
                  <span>Columns: <strong>{previewData.detected_columns.length}</strong></span>
                </div>
              </div>

              {!hasCompanyNameMapped && (
                <div className="flex items-center gap-2 p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>
                    <strong>Required:</strong> Please map at least one column to <strong>Company Name * (Required)</strong> to continue.
                  </span>
                </div>
              )}

              {/* Column Mapping Grid */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-100 px-4 py-2.5 text-xs font-semibold text-slate-700 uppercase tracking-wider grid grid-cols-12 gap-4">
                  <div className="col-span-5">CSV Column Header</div>
                  <div className="col-span-2 text-center">Direction</div>
                  <div className="col-span-5">GTMFlow Target Attribute</div>
                </div>
                <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                  {previewData.detected_columns.map((col) => {
                    const currentTarget = columnMapping[col] || "ignore";
                    const isRequired = currentTarget === "company_name";
                    return (
                      <div key={col} className="px-4 py-3 grid grid-cols-12 gap-4 items-center hover:bg-slate-50/70">
                        <div className="col-span-5 font-mono text-xs font-semibold text-slate-800 truncate">
                          {col}
                        </div>
                        <div className="col-span-2 flex justify-center">
                          <ArrowRight className="w-4 h-4 text-slate-400" />
                        </div>
                        <div className="col-span-5">
                          <select
                            value={currentTarget}
                            onChange={(e) => handleMappingChange(col, e.target.value)}
                            className={`w-full text-xs font-medium rounded-md px-3 py-1.5 border transition-all ${
                              isRequired
                                ? "border-indigo-500 bg-indigo-50 text-indigo-900 font-semibold"
                                : currentTarget !== "ignore"
                                ? "border-slate-300 text-slate-800"
                                : "border-slate-200 text-slate-400 bg-slate-50"
                            }`}
                          >
                            {GTMFLOW_FIELDS.map((f) => (
                              <option key={f.value} value={f.value}>
                                {f.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Data Preview Table */}
              <div>
                <h4 className="text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wider">
                  Raw File Preview (First {previewData.preview_rows.length} Rows)
                </h4>
                <div className="border border-slate-200 rounded-lg overflow-x-auto max-h-56">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200 sticky top-0">
                      <tr>
                        {previewData.detected_columns.map((c) => (
                          <th key={c} className="px-3 py-2 font-mono text-[11px] whitespace-nowrap">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {previewData.preview_rows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          {previewData.detected_columns.map((c) => (
                            <td key={c} className="px-3 py-1.5 text-slate-700 truncate max-w-xs text-[11px]">
                              {String(row[c] ?? "")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Navigation buttons */}
              <div className="flex justify-between items-center pt-4 border-t border-slate-200">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStep(1)}
                  className="text-xs text-slate-600"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to Upload
                </Button>
                <Button
                  disabled={!hasCompanyNameMapped}
                  onClick={() => setStep(3)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium flex items-center gap-2"
                >
                  Configure Conflict Policy <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: CONFLICT RESOLUTION POLICY */}
          {step === 3 && (
            <div className="max-w-2xl mx-auto py-4 space-y-6">
              <div className="text-center space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  Deduplication Hierarchy & Conflict Resolution
                </h3>
                <p className="text-xs text-slate-500">
                  Define how GTMFlow handles duplicate companies and existing record conflicts.
                </p>
              </div>

              {/* Deduplication explanation */}
              <div className="bg-indigo-50/60 border border-indigo-100 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2 text-indigo-900 font-semibold text-xs">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  3-Tier Deduplication Hierarchy (Automatic)
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px] text-slate-600 pt-1">
                  <div className="bg-white p-2.5 rounded border border-indigo-100">
                    <strong className="text-indigo-800">Tier 1: Canonical Domain</strong>
                    <p className="text-slate-500 mt-0.5">Exact normalized domain match (e.g. secfix.com)</p>
                  </div>
                  <div className="bg-white p-2.5 rounded border border-indigo-100">
                    <strong className="text-indigo-800">Tier 2: Name + Country</strong>
                    <p className="text-slate-500 mt-0.5">Normalized company name and identical country</p>
                  </div>
                  <div className="bg-white p-2.5 rounded border border-indigo-100">
                    <strong className="text-indigo-800">Tier 3: Exact Name</strong>
                    <p className="text-slate-500 mt-0.5">Case-insensitive exact company name matching</p>
                  </div>
                </div>
              </div>

              {/* Conflict Policy Options */}
              <div className="space-y-3">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
                  Select Merge Policy
                </label>

                {/* Option 1: PRESERVE_EXISTING */}
                <div
                  onClick={() => setConflictPolicy("PRESERVE_EXISTING")}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    conflictPolicy === "PRESERVE_EXISTING"
                      ? "border-indigo-600 bg-indigo-50/40"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 text-sm">
                          Safe GTM Standard (Preserve Existing Data)
                        </span>
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
                          Recommended
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Never overwrite verified CRM fields. If an account already exists, only fill empty/blank fields. Incoming records are preserved in <code>account_sources</code> for full audit provenance.
                      </p>
                    </div>
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center mt-1 ${
                        conflictPolicy === "PRESERVE_EXISTING"
                          ? "border-indigo-600 bg-indigo-600"
                          : "border-slate-300"
                      }`}
                    >
                      {conflictPolicy === "PRESERVE_EXISTING" && (
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Option 2: OVERWRITE_EMPTY */}
                <div
                  onClick={() => setConflictPolicy("OVERWRITE_EMPTY")}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    conflictPolicy === "OVERWRITE_EMPTY"
                      ? "border-indigo-600 bg-indigo-50/40"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-semibold text-slate-900 text-sm">
                        Enrich Empty Fields Only
                      </span>
                      <p className="text-xs text-slate-500 mt-1">
                        Strictly updates empty columns on existing accounts without modifying any populated values.
                      </p>
                    </div>
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center mt-1 ${
                        conflictPolicy === "OVERWRITE_EMPTY"
                          ? "border-indigo-600 bg-indigo-600"
                          : "border-slate-300"
                      }`}
                    >
                      {conflictPolicy === "OVERWRITE_EMPTY" && (
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Navigation buttons */}
              <div className="flex justify-between items-center pt-4 border-t border-slate-200">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStep(2)}
                  className="text-xs text-slate-600"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to Mapping
                </Button>
                <Button
                  onClick={handleStartImport}
                  disabled={isStartingImport}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium flex items-center gap-2"
                >
                  {isStartingImport ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Launching Pipeline...
                    </>
                  ) : (
                    <>
                      Start Ingestion Pipeline <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* STEP 4: LIVE PROCESSING PROGRESS */}
          {step === 4 && activeJob && (
            <div className="max-w-2xl mx-auto py-8 space-y-6 text-center">
              <div className="w-16 h-16 bg-indigo-50 border border-indigo-200 text-indigo-600 rounded-full flex items-center justify-center mx-auto animate-pulse">
                <Database className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900">
                  Processing CSV Ingestion Pipeline
                </h3>
                <p className="text-xs text-slate-500">
                  Running normalization, deduplication checks, and database transaction commits...
                </p>
              </div>

              {/* Progress bar */}
              <div className="space-y-2">
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200">
                  <div
                    className="bg-indigo-600 h-full transition-all duration-300 rounded-full"
                    style={{
                      width: `${
                        activeJob.total_records > 0
                          ? Math.min(
                              100,
                              Math.round(
                                ((activeJob.processed_records + activeJob.failed_records) /
                                  activeJob.total_records) *
                                  100
                              )
                            )
                          : 50
                      }%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs text-slate-500 font-mono">
                  <span>Processed: {activeJob.processed_records} / {activeJob.total_records}</span>
                  <span>
                    {activeJob.total_records > 0
                      ? Math.round(
                          ((activeJob.processed_records + activeJob.failed_records) /
                            activeJob.total_records) *
                            100
                        )
                      : 0}
                    %
                  </span>
                </div>
              </div>

              {/* Live Counters */}
              <div className="grid grid-cols-4 gap-3 pt-4">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <p className="text-[10px] uppercase font-bold text-slate-500">Total Rows</p>
                  <p className="text-xl font-bold text-slate-900 mt-1">{activeJob.total_records}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <p className="text-[10px] uppercase font-bold text-slate-500">Processed</p>
                  <p className="text-xl font-bold text-indigo-600 mt-1">{activeJob.processed_records}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <p className="text-[10px] uppercase font-bold text-slate-500">Duplicates</p>
                  <p className="text-xl font-bold text-amber-600 mt-1">{activeJob.duplicate_records}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <p className="text-[10px] uppercase font-bold text-slate-500">Errors</p>
                  <p className="text-xl font-bold text-rose-600 mt-1">{activeJob.failed_records}</p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: COMPLETED / SUMMARY */}
          {step === 5 && activeJob && (
            <div className="max-w-3xl mx-auto py-6 space-y-6">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">
                  Ingestion Pipeline Completed
                </h3>
                <p className="text-xs text-slate-500">
                  Finished processing <strong>{activeJob.file_name}</strong> in accordance with your deduplication settings.
                </p>
              </div>

              {/* Summary Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
                  <p className="text-xs text-slate-500 font-medium">Total Ingested</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{activeJob.total_records}</p>
                </div>
                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 text-center">
                  <p className="text-xs text-emerald-700 font-medium">Created / Merged</p>
                  <p className="text-2xl font-bold text-emerald-700 mt-1">{activeJob.processed_records}</p>
                </div>
                <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 text-center">
                  <p className="text-xs text-amber-700 font-medium">Duplicates Deduplicated</p>
                  <p className="text-2xl font-bold text-amber-700 mt-1">{activeJob.duplicate_records}</p>
                </div>
                <div className="bg-rose-50 p-4 rounded-xl border border-rose-100 text-center">
                  <p className="text-xs text-rose-700 font-medium">Failed Records</p>
                  <p className="text-2xl font-bold text-rose-700 mt-1">{activeJob.failed_records}</p>
                </div>
              </div>

              {/* Error Log Breakdown (if any) */}
              {activeJob.error_summary && activeJob.error_summary.length > 0 && (
                <div className="border border-rose-200 bg-rose-50/50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-rose-800 text-xs font-semibold">
                    <XCircle className="w-4 h-4 text-rose-600" />
                    Row Validation Failures ({activeJob.error_summary.length} rows skipped)
                  </div>
                  <div className="divide-y divide-rose-100 max-h-48 overflow-y-auto">
                    {activeJob.error_summary.map((err, i) => (
                      <div key={i} className="py-2 text-xs flex items-start justify-between gap-4">
                        <span className="font-mono text-rose-700 font-bold whitespace-nowrap">
                          Row #{err.row}:
                        </span>
                        <span className="text-slate-700 flex-1">{err.error}</span>
                        {err.raw_record && (
                          <span className="font-mono text-[11px] text-slate-400 truncate max-w-xs">
                            {JSON.stringify(err.raw_record)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4 border-t border-slate-200">
                <Link href="/accounts">
                  <Button className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium flex items-center gap-1.5">
                    View Accounts Directory <ChevronRight className="w-4 h-4" />
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  onClick={handleReset}
                  className="text-slate-700 border-slate-300"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1" />
                  Import Another File
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Historical Import Jobs Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-600" />
              Import History & Ingestion Audit
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Full record of previous batch uploads, conflict resolutions, and execution statuses.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchPastJobs}
            disabled={isLoadingHistory}
            className="text-xs text-slate-600 border-slate-200 hover:bg-slate-50"
          >
            <RotateCcw className={`w-3.5 h-3.5 mr-1 ${isLoadingHistory ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <Card className="border border-slate-200 shadow-sm bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-4 py-3">File Name</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Total Rows</th>
                  <th className="px-4 py-3 text-right">Processed</th>
                  <th className="px-4 py-3 text-right">Duplicates Merged</th>
                  <th className="px-4 py-3 text-right">Errors</th>
                  <th className="px-4 py-3">Ingested At</th>
                  <th className="px-4 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoadingHistory ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={8} className="px-4 py-3">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    </tr>
                  ))
                ) : pastJobs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                      No import jobs recorded yet. Upload a CSV file above to start ingesting leads.
                    </td>
                  </tr>
                ) : (
                  pastJobs.map((job) => (
                    <tr key={job.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900 flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <span className="truncate max-w-xs">{job.file_name}</span>
                      </td>
                      <td className="px-4 py-3">
                        {getStatusBadge(job.status)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-700">
                        {formatNumber(job.total_records)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-indigo-600">
                        {formatNumber(job.processed_records)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-amber-600 font-medium">
                        {formatNumber(job.duplicate_records)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-rose-600 font-medium">
                        {job.failed_records > 0 ? formatNumber(job.failed_records) : "0"}
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {formatDate(job.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedHistoryJob(job)}
                          className="text-xs text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2 py-1 h-7"
                        >
                          View Details
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* History Job Detail Modal / Dialog */}
      {selectedHistoryJob && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Import Job Details
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  ID: {selectedHistoryJob.id}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedHistoryJob(null)}
                className="text-slate-400 hover:text-slate-600 text-lg px-2 h-8"
              >
                &times;
              </Button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Status</span>
                  <div className="mt-1">{getStatusBadge(selectedHistoryJob.status)}</div>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Total Rows</span>
                  <p className="text-base font-bold text-slate-900 mt-1">
                    {formatNumber(selectedHistoryJob.total_records)}
                  </p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Processed</span>
                  <p className="text-base font-bold text-indigo-600 mt-1">
                    {formatNumber(selectedHistoryJob.processed_records)}
                  </p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Duplicates</span>
                  <p className="text-base font-bold text-amber-600 mt-1">
                    {formatNumber(selectedHistoryJob.duplicate_records)}
                  </p>
                </div>
              </div>

              {/* Mapping applied */}
              {selectedHistoryJob.field_mapping && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Field Mapping Applied
                  </h4>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 font-mono text-[11px] text-slate-700 max-h-36 overflow-y-auto">
                    {Object.entries(selectedHistoryJob.field_mapping).map(([k, v]) => (
                      <div key={k} className="flex justify-between py-0.5">
                        <span className="text-slate-500">{k}</span>
                        <span className="text-indigo-600 font-semibold">&rarr; {String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Error summary */}
              {selectedHistoryJob.error_summary && selectedHistoryJob.error_summary.length > 0 ? (
                <div>
                  <h4 className="text-xs font-semibold text-rose-700 uppercase tracking-wider mb-1.5">
                    Errors ({selectedHistoryJob.error_summary.length})
                  </h4>
                  <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 max-h-48 overflow-y-auto divide-y divide-rose-100 text-xs">
                    {selectedHistoryJob.error_summary.map((err, i) => (
                      <div key={i} className="py-1.5">
                        <span className="font-bold text-rose-800">Row {err.row}:</span>{" "}
                        <span className="text-slate-700">{err.error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  No execution errors recorded for this import.
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedHistoryJob(null)}
                className="text-xs text-slate-700"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
