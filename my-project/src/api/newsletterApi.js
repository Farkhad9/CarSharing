import { apiRequest } from "./apiClient";

export const newsletterApi = {
  subscribe: (email) =>
    apiRequest("/api/newsletter/subscriptions", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
};
