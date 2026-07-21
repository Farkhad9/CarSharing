import { VEHICLE_STATUSES } from "../data/statuses";
import { API_URL } from "./apiClient";
import vehicleComingSoon from "../assets/img/vehicle-coming-soon.png";

const BAKU_LOCATIONS = [
  { lat: 40.3777, lng: 49.8499 },
  { lat: 40.3953, lng: 49.8822 },
  { lat: 40.3697, lng: 49.8354 },
  { lat: 40.3504, lng: 49.8296 },
  { lat: 40.4093, lng: 49.8671 },
  { lat: 40.3657, lng: 49.9576 },
  { lat: 40.3838, lng: 49.8046 },
  { lat: 40.4261, lng: 49.9861 },
];

const statusByValue = {
  1: VEHICLE_STATUSES.AVAILABLE,
  2: VEHICLE_STATUSES.RESERVED,
  3: VEHICLE_STATUSES.IN_USE,
  4: VEHICLE_STATUSES.CHARGING,
  5: VEHICLE_STATUSES.COMPLETED,
  Available: VEHICLE_STATUSES.AVAILABLE,
  Reserved: VEHICLE_STATUSES.RESERVED,
  InUse: VEHICLE_STATUSES.IN_USE,
  Charging: VEHICLE_STATUSES.CHARGING,
  Maintenance: VEHICLE_STATUSES.COMPLETED,
};

const resolveVehicleImageUrl = (imageUrl) => {
  if (!imageUrl || typeof imageUrl !== "string") return "";
  const trimmedUrl = imageUrl.trim();
  if (!trimmedUrl) return "";
  if (/^https?:\/\//i.test(trimmedUrl) || trimmedUrl.startsWith("data:")) return trimmedUrl;
  return `${API_URL}${trimmedUrl.startsWith("/") ? "" : "/"}${trimmedUrl}`;
};

const isBakuCoordinate = (lat, lng) =>
  Number.isFinite(lat) && Number.isFinite(lng) && lat >= 40.2 && lat <= 40.6 && lng >= 49.55 && lng <= 50.25;

const hashKey = (value) =>
  String(value || "")
    .split("")
    .reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 0);

const resolveVehicleLocation = (vehicle) => {
  const lat = Number(vehicle.latitude);
  const lng = Number(vehicle.longitude);

  if (isBakuCoordinate(lat, lng)) {
    return { lat, lng };
  }

  const key = vehicle.id || vehicle.plateNumber || `${vehicle.brand}-${vehicle.model}`;
  return BAKU_LOCATIONS[hashKey(key) % BAKU_LOCATIONS.length];
};

export const normalizeVehicle = (vehicle) => {
  if (!vehicle) return null;

  const fallbackImage = vehicleComingSoon;
  const image = resolveVehicleImageUrl(vehicle.mainImageUrl) || fallbackImage;
  const galleryImages = [
    image,
    resolveVehicleImageUrl(vehicle.galleryImageUrl1),
    resolveVehicleImageUrl(vehicle.galleryImageUrl2),
    resolveVehicleImageUrl(vehicle.galleryImageUrl3),
  ].map((item) => item || fallbackImage);
  const location = resolveVehicleLocation(vehicle);

  return {
    ...vehicle,
    id: vehicle.id,
    status: statusByValue[vehicle.status] || vehicle.status || VEHICLE_STATUSES.AVAILABLE,
    basePricePerMinute: Number(vehicle.pricePerMinute || 0),
    pricePerMinute: Number(vehicle.activePricePerMinute ?? vehicle.pricePerMinute ?? 0),
    activePricePerMinute: Number(vehicle.activePricePerMinute ?? vehicle.pricePerMinute ?? 0),
    pricingMode: vehicle.pricingMode || "Standard",
    pricingAdjustmentAmount: Number(vehicle.pricingAdjustmentAmount || 0),
    demandMultiplier: Number(vehicle.demandMultiplier || 1),
    zoneMultiplier: Number(vehicle.zoneMultiplier || 1),
    batteryMultiplier: Number(vehicle.batteryMultiplier || 1),
    image,
    galleryImages,
    location: {
      label: vehicle.locationLabel || "Baku",
      zone: vehicle.zone || "City",
      lat: location.lat,
      lng: location.lng,
    },
    specs: {
      interior: `${vehicle.color || "Premium"} cabin`,
      tires: "All-season EV tires",
      power: "Electric drivetrain",
      acceleration: "EV launch",
      engine: "Electric motor",
      driveType: "EV",
    },
  };
};

export const normalizeVehicles = (vehicles) =>
  Array.isArray(vehicles) ? vehicles.map(normalizeVehicle).filter(Boolean) : [];
