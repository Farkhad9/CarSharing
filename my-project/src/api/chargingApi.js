import { CHARGING_STATION_STATUSES } from "../data/statuses";
import { apiRequest } from "./apiClient";

const statusByValue = {
  1: CHARGING_STATION_STATUSES.ONLINE,
  2: CHARGING_STATION_STATUSES.BUSY,
  3: CHARGING_STATION_STATUSES.MAINTENANCE,
  4: CHARGING_STATION_STATUSES.OFFLINE,
  Online: CHARGING_STATION_STATUSES.ONLINE,
  Busy: CHARGING_STATION_STATUSES.BUSY,
  Maintenance: CHARGING_STATION_STATUSES.MAINTENANCE,
  Offline: CHARGING_STATION_STATUSES.OFFLINE,
};

const apiStatusByValue = {
  [CHARGING_STATION_STATUSES.ONLINE]: 1,
  [CHARGING_STATION_STATUSES.BUSY]: 2,
  [CHARGING_STATION_STATUSES.MAINTENANCE]: 3,
  [CHARGING_STATION_STATUSES.OFFLINE]: 4,
};

const sessionStatusByValue = {
  1: "active",
  2: "completed",
  Active: "active",
  Completed: "completed",
};

const BAKU_STATION_LOCATIONS = [
  { lat: 40.3777, lng: 49.8499 },
  { lat: 40.3926, lng: 49.8742 },
  { lat: 40.3612, lng: 49.8324 },
  { lat: 40.4078, lng: 49.8617 },
  { lat: 40.3719, lng: 49.9449 },
];

const isBakuCoordinate = (lat, lng) =>
  Number.isFinite(lat) && Number.isFinite(lng) && lat >= 40.2 && lat <= 40.6 && lng >= 49.55 && lng <= 50.25;

const hashKey = (value) =>
  String(value || "")
    .split("")
    .reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 0);

const resolveStationLocation = (station) => {
  const lat = Number(station.latitude ?? station.location?.lat);
  const lng = Number(station.longitude ?? station.location?.lng);

  if (isBakuCoordinate(lat, lng)) {
    return { lat, lng };
  }

  return BAKU_STATION_LOCATIONS[hashKey(station.id || station.name) % BAKU_STATION_LOCATIONS.length];
};

export const normalizeChargingSession = (session) => {
  if (!session) return null;

  return {
    ...session,
    id: session.id,
    vehicleId: session.vehicleId,
    chargingStationId: session.chargingStationId,
    assignedStaffId: session.assignedStaffId,
    staffTaskId: session.staffTaskId,
    status: sessionStatusByValue[session.status] || session.status || "active",
    startBatteryPercent: Number(session.startBatteryPercent ?? 0),
    targetBatteryPercent: Number(session.targetBatteryPercent ?? 100),
    currentBatteryPercent: Number(session.currentBatteryPercent ?? 0),
    currentRangeKm: Number(session.currentRangeKm ?? Number(session.currentBatteryPercent ?? 0) * 4),
    minutesRemaining: Number(session.minutesRemaining ?? 0),
  };
};

export const normalizeChargingSessionDetails = (details) => {
  if (!details) return null;

  return {
    ...details,
    session: normalizeChargingSession(details.session),
    station: normalizeChargingStation(details.station),
  };
};

export const normalizeChargingSessions = (sessions) =>
  Array.isArray(sessions) ? sessions.map(normalizeChargingSession).filter(Boolean) : [];

export const normalizeChargingStation = (station) => {
  if (!station) return null;
  const location = resolveStationLocation(station);

  return {
    ...station,
    id: station.id,
    status: statusByValue[station.status] || station.status || CHARGING_STATION_STATUSES.MAINTENANCE,
    location: {
      label: station.locationLabel || station.location?.label || "Baku",
      zone: station.zone || station.location?.zone || "City",
      lat: location.lat,
      lng: location.lng,
    },
    powerKw: Number(station.powerKw ?? 0),
    totalPorts: Number(station.totalPorts ?? 0),
    availablePorts: Number(station.availablePorts ?? 0),
    connectorTypes: Array.isArray(station.connectorTypes) ? station.connectorTypes : [],
  };
};

export const normalizeChargingStations = (stations) =>
  Array.isArray(stations) ? stations.map(normalizeChargingStation).filter(Boolean) : [];

export const toChargingStationStatusRequest = (status) => apiStatusByValue[status] || status;

export const chargingApi = {
  getStations: async () => normalizeChargingStations(await apiRequest("/api/charging/stations")),
  createStation: async (payload) =>
    normalizeChargingStation(await apiRequest("/api/charging/stations", {
      method: "POST",
      body: JSON.stringify({
        ...payload,
        status: toChargingStationStatusRequest(payload.status),
      }),
    })),
  updateStationStatus: async (id, status) =>
    normalizeChargingStation(await apiRequest(`/api/charging/stations/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: toChargingStationStatusRequest(status) }),
    })),
  deleteStation: (id) => apiRequest(`/api/charging/stations/${id}`, {
    method: "DELETE",
  }),
  getActiveSessions: async () => normalizeChargingSessions(await apiRequest("/api/charging/sessions/active")),
  startSession: async (payload) =>
    normalizeChargingSessionDetails(await apiRequest("/api/charging/sessions/start", {
      method: "POST",
      body: JSON.stringify({
        vehicleId: payload.vehicleId,
        chargingStationId: payload.chargingStationId,
        assignedStaffId: payload.assignedStaffId,
        targetBatteryPercent: 100,
      }),
    })),
  completeSession: async (id, payload = {}) =>
    normalizeChargingSessionDetails(await apiRequest(`/api/charging/sessions/${id}/complete`, {
      method: "POST",
      body: JSON.stringify({
        finalBatteryPercent: Number(payload.finalBatteryPercent ?? 100),
        notes: payload.notes || null,
      }),
    })),
  activateVehicle: (vehicleId) => apiRequest(`/api/charging/vehicles/${vehicleId}/activate`, {
    method: "POST",
  }),
};
