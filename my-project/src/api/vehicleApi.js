import { apiRequest } from "./apiClient";
import { VEHICLE_STATUSES } from "../data/statuses";
import { normalizeVehicle, normalizeVehicles } from "./vehicleMapper";

const apiStatusByValue = {
  [VEHICLE_STATUSES.AVAILABLE]: 1,
  [VEHICLE_STATUSES.RESERVED]: 2,
  [VEHICLE_STATUSES.IN_USE]: 3,
  [VEHICLE_STATUSES.CHARGING]: 4,
  [VEHICLE_STATUSES.COMPLETED]: 5,
};

const validateVehiclePayload = (payload) => {
  if (!payload?.connectorType || !String(payload.connectorType).trim()) {
    throw new Error("Connector type is required.");
  }
};

export const vehicleApi = {
  getVehicles: async () => normalizeVehicles(await apiRequest("/api/vehicles")),
  getVehicle: async (id) => normalizeVehicle(await apiRequest(`/api/vehicles/${id}`)),
  createVehicle: async (payload) => {
    validateVehiclePayload(payload);
    return normalizeVehicle(await apiRequest("/api/vehicles", {
      method: "POST",
      body: JSON.stringify({ ...payload, connectorType: String(payload.connectorType).trim() }),
    }));
  },
  updateVehicle: async (id, payload) => {
    validateVehiclePayload(payload);
    return normalizeVehicle(await apiRequest(`/api/vehicles/${id}`, {
      method: "PUT",
      body: JSON.stringify({ ...payload, connectorType: String(payload.connectorType).trim() }),
    }));
  },
  updateVehicleStatus: async (id, status) =>
    normalizeVehicle(await apiRequest(`/api/vehicles/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: apiStatusByValue[status] || status }),
    })),
};
