import { apiRequest } from "./apiClient";

const buildQuery = (filters = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, value);
    }
  });
  const query = params.toString();
  return query ? `?${query}` : "";
};

export const adminStatisticsApi = {
  getLiveStatistics: () => apiRequest("/api/admin/statistics/live"),
  getFinanceStatistics: (filters) => apiRequest(`/api/admin/statistics/finance${buildQuery(filters)}`),
  getStaffKpi: () => apiRequest("/api/admin/statistics/staff-kpi"),
};
