import { apiRequest } from "./apiClient";

export const reservationApi = {
  create: ({ vehicleId, passengerCount = 1 }) => apiRequest("/api/reservations", {
    method: "POST",
    body: JSON.stringify({ vehicleId, passengerCount }),
  }),
  getMyActive: () => apiRequest("/api/reservations/my"),
  getById: (id) => apiRequest(`/api/reservations/${id}`),
  cancel: (id, reason = "Cancelled by customer") => apiRequest(`/api/reservations/${id}/cancel`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  }),
};
