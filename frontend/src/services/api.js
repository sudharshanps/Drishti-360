import axios from "axios";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 25000,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("drishti360_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message =
      error.response?.data?.detail || error.message || "Network or server error";
    return Promise.reject(new Error(message));
  }
);

export function resolveBackendAsset(path) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${API_BASE_URL}${path}`;
}

export const drishtiApi = {
  getHealth: () => apiClient.get("/api/health"),
  getDashboardStats: () => apiClient.get("/api/dashboard/stats"),

  register: (payload) => apiClient.post("/api/auth/register", payload),
  login: (payload) => apiClient.post("/api/auth/login", payload),
  demoLogin: (role = "farmer") => apiClient.post(`/api/auth/demo?role=${encodeURIComponent(role)}`),

  getCrops: () => apiClient.get("/api/crops"),
  createCropBatch: (payload) => apiClient.post("/api/crops", payload),

  getInspections: () => apiClient.get("/api/inspection"),
  analyzeInspection: (payload) => apiClient.post("/api/inspection/analyze", payload),
  analyzeInspectionUpload: (formData) =>
    apiClient.post("/api/inspection/analyze-upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  submitInspectorReview: (inspectionId, payload) =>
    apiClient.post(`/api/inspection/${encodeURIComponent(inspectionId)}/review`, payload),
  getCalibrationStats: () => apiClient.get("/api/inspection/calibration/stats"),

  getComplianceChecks: () => apiClient.get("/api/compliance"),
  analyzeCompliance: (payload) => apiClient.post("/api/compliance/analyze", payload),
  analyzeComplianceUpload: (formData) =>
    apiClient.post("/api/compliance/analyze-upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  getComplianceRules: () => apiClient.get("/api/compliance/rules"),
  updateComplianceRules: (payload) => apiClient.put("/api/compliance/rules", payload),

  getMandiBenchmarks: () => apiClient.get("/api/pricing/mandis"),
  getPriceTrend: (cropType, mandiLocation = "", grade = "A") =>
    apiClient.get(
      `/api/pricing/trend?crop_type=${encodeURIComponent(cropType)}&mandi_location=${encodeURIComponent(
        mandiLocation
      )}&grade=${encodeURIComponent(grade)}`
    ),
  getPricingEstimates: () => apiClient.get("/api/pricing"),
  estimatePrice: (payload) => apiClient.post("/api/pricing/estimate", payload),

  getPassports: () => apiClient.get("/api/passports"),
  generatePassport: (payload) => apiClient.post("/api/passports/generate", payload),
  getPassportById: (passportId) => apiClient.get(`/api/passports/${passportId}`),
  getPassportPdfUrl: (passportId) => `${API_BASE_URL}/api/passports/${encodeURIComponent(passportId)}/pdf`,
  verifyPassport: (passportId, recordScan = false) =>
    apiClient.get(`/api/passports/${encodeURIComponent(passportId)}/verify?record_scan=${recordScan}`),
  logPassportVerifyScan: (passportId, payload) =>
    apiClient.post(`/api/passports/${encodeURIComponent(passportId)}/verify-scan`, payload),

  getTraceability: (batchId) => apiClient.get(`/api/traceability/${batchId}`),
  addTraceabilityEvent: (batchId, payload) => apiClient.post(`/api/traceability/${batchId}/events`, payload),

  runMultimodalFusion: (formData) =>
    apiClient.post("/api/pipeline/fusion", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  syncOfflineBatch: (payload) => apiClient.post("/api/sync/batch", payload),

  getFpoOverview: () => apiClient.get("/api/fpo/overview"),
  fpoBulkCertify: (batchIds) => apiClient.post("/api/fpo/bulk-certify", { batch_ids: batchIds }),
  getBuyerCatalog: () => apiClient.get("/api/buyer/catalog"),
  recordBuyerPurchase: (payload) => apiClient.post("/api/buyer/purchase", payload),
};
