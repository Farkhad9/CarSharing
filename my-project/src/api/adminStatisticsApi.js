import { apiRequest } from "./apiClient";

export const adminStatisticsApi = {
  getLiveStatistics: () => apiRequest("/api/admin/statistics/live"),
  getStaffKpi: () => apiRequest("/api/admin/statistics/staff-kpi"),
};
