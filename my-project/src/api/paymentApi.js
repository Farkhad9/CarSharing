import { apiRequest } from "./apiClient";

export const paymentApi = {
  getBalance: () => apiRequest("/api/payments/balance"),
  getTransactions: () => apiRequest("/api/payments/my"),
  createTopUp: (amount) => apiRequest("/api/payments/top-up", {
    method: "POST",
    body: JSON.stringify({ amount: Number(amount) }),
  }),
  payTrip: (tripId) => apiRequest(`/api/payments/trips/${tripId}/pay`, { method: "POST" }),
  createTripCheckout: (tripId) => apiRequest(`/api/payments/trips/${tripId}/checkout`, { method: "POST" }),
};
