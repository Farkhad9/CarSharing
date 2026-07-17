import { apiRequest } from "./apiClient";
import { normalizeVehicle, normalizeVehicles } from "./vehicleMapper";

export const vehicleApi = {
  getVehicles: async () => normalizeVehicles(await apiRequest("/api/vehicles")),
  getVehicle: async (id) => normalizeVehicle(await apiRequest(`/api/vehicles/${id}`)),
};
