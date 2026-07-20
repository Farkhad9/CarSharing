import { apiRequest } from "./apiClient";

const typeByApiValue = {
  1: "allowed",
  2: "allowed",
  3: "allowed",
  4: "restricted",
  Parking: "allowed",
  Charging: "allowed",
  Service: "allowed",
  Restricted: "restricted",
};

const apiTypeByValue = {
  allowed: 1,
  restricted: 4,
};

export const normalizeParkingZone = (zone) => {
  if (!zone) return null;

  const boundary = Array.isArray(zone.boundary) ? zone.boundary : [];
  const positions = boundary
    .map((point) => [Number(point.latitude ?? point.Latitude), Number(point.longitude ?? point.Longitude)])
    .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));

  if (positions.length < 3) return null;

  return {
    id: zone.id,
    name: zone.name || "Parking zone",
    type: typeByApiValue[zone.type] || "allowed",
    positions,
    allowsTripEnd: Boolean(zone.allowsTripEnd),
    isActive: zone.isActive !== false,
  };
};

export const normalizeParkingZones = (zones) =>
  Array.isArray(zones) ? zones.map(normalizeParkingZone).filter(Boolean) : [];

const toParkingZonePayload = (zone) => ({
  name: zone.name || (zone.type === "restricted" ? "No parking zone" : "Allowed parking zone"),
  type: apiTypeByValue[zone.type] || apiTypeByValue.allowed,
  allowsTripEnd: zone.type !== "restricted",
  isActive: zone.isActive !== false,
  boundary: (zone.positions || []).map(([lat, lng]) => ({
    latitude: Number(lat),
    longitude: Number(lng),
  })),
});

export const parkingZoneApi = {
  getZones: async () => normalizeParkingZones(await apiRequest("/api/parking-zones")),
  createZone: async (zone) =>
    normalizeParkingZone(await apiRequest("/api/parking-zones", {
      method: "POST",
      body: JSON.stringify(toParkingZonePayload(zone)),
    })),
  updateZone: async (id, zone) =>
    normalizeParkingZone(await apiRequest(`/api/parking-zones/${id}`, {
      method: "PUT",
      body: JSON.stringify(toParkingZonePayload(zone)),
    })),
  deactivateZone: (id) => apiRequest(`/api/parking-zones/${id}`, {
    method: "DELETE",
  }),
};
