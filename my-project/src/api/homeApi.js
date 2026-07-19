import { apiRequest } from "./apiClient";

export const homeApi = {
  getSummary: () => apiRequest("/api/home/summary"),
};
