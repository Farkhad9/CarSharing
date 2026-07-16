import { apiRequest } from "./apiClient";

export const vehicleApi = {
  getVehicles: () => apiRequest("/api/vehicles"),
};
