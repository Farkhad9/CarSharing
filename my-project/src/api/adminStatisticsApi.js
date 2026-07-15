import { apiRequest } from "./apiClient";

export const adminStatisticsApi = {
  getLiveStatistics: () => apiRequest("/api/admin/statistics/live"),
};
