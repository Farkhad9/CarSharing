import { VEHICLE_STATUSES } from "../data/statuses";
import { API_URL } from "./apiClient";
import vehicleComingSoon from "../assets/img/vehicle-coming-soon.png";

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

  return {
    ...vehicle,
    id: vehicle.id,
    status: statusByValue[vehicle.status] || vehicle.status || VEHICLE_STATUSES.AVAILABLE,
    pricePerMinute: Number(vehicle.pricePerMinute || 0),
    image,
    galleryImages,
    location: {
      label: vehicle.locationLabel || "Baku",
      zone: vehicle.zone || "City",
      lat: Number(vehicle.latitude || 40.3772),
      lng: Number(vehicle.longitude || 49.8475),
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
