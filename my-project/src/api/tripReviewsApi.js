import { apiRequest } from "./apiClient";

export const tripReviewsApi = {
  getPublic: (take = 3) => apiRequest(`/api/trip-reviews/public?take=${take}`),
  create: ({ tripId, rating, comment }) =>
    apiRequest("/api/trip-reviews", {
      method: "POST",
      body: JSON.stringify({ tripId, rating, comment }),
    }),
};
