import { apiRequest } from "./apiClient";

export const TRIP_COMPLETION_STATUSES = {
  PendingReview: 1,
  Approved: 2,
  Rejected: 3,
};

export const tripCompletionRequestsApi = {
  getPending: () => apiRequest("/api/trip-completion-requests/pending"),
  getById: (id) => apiRequest(`/api/trip-completion-requests/${id}`),
  approve: (id) => apiRequest(`/api/trip-completion-requests/${id}/approve`, { method: "POST" }),
  reject: (id, reason) => apiRequest(`/api/trip-completion-requests/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  }),
};
