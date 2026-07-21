import { apiRequest } from "./apiClient";

export const tripReviewsApi = {
  getPublic: (take = 3) => apiRequest(`/api/trip-reviews/public?take=${take}`),
  getAdmin: () => apiRequest("/api/admin/trip-reviews"),
  updateAdmin: (id, payload) => apiRequest(`/api/admin/trip-reviews/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }),
  updatePublication: (id, isPublished) => apiRequest(`/api/admin/trip-reviews/${id}/publication`, {
    method: "PATCH",
    body: JSON.stringify({ isPublished }),
  }),
  deleteAdmin: (id) => apiRequest(`/api/admin/trip-reviews/${id}`, {
    method: "DELETE",
  }),
  create: ({ tripId, rating, comment }) =>
    apiRequest("/api/trip-reviews", {
      method: "POST",
      body: JSON.stringify({ tripId, rating, comment }),
    }),
};
