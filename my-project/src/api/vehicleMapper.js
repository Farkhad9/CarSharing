import { VEHICLE_STATUSES } from "../data/statuses";
import teslaModel3 from "../assets/img/fleet/Tesla Model3.png";
import hyundaiIoniq from "../assets/img/fleet/Hyundai.png";
import kiaEv6 from "../assets/img/fleet/Kia-Transparent.png";
import porscheTaycan from "../assets/img/fleet/Porsche-Taycan.png";
import cruze from "../assets/img/fleet/Cruze.png";
import rr from "../assets/img/fleet/RR.png";

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

const fallbackImages = [
  { match: ["tesla", "model 3"], image: teslaModel3 },
  { match: ["hyundai", "ioniq"], image: hyundaiIoniq },
  { match: ["kia", "ev6"], image: kiaEv6 },
  { match: ["porsche", "taycan"], image: porscheTaycan },
  { match: ["volkswagen", "id"], image: porscheTaycan },
  { match: ["chevrolet", "cruze"], image: cruze },
  { match: ["rr"], image: rr },
  { match: ["range"], image: rr },
];

const getVehicleImage = (vehicle) => {
  const text = `${vehicle?.brand || ""} ${vehicle?.model || ""}`.toLowerCase();
  return fallbackImages.find((item) => item.match.some((part) => text.includes(part)))?.image || teslaModel3;
};

export const normalizeVehicle = (vehicle) => {
  if (!vehicle) return null;

  const image = getVehicleImage(vehicle);
  return {
    ...vehicle,
    id: vehicle.id,
    status: statusByValue[vehicle.status] || vehicle.status || VEHICLE_STATUSES.AVAILABLE,
    pricePerMinute: Number(vehicle.pricePerMinute || 0),
    image,
    galleryImages: [image, image, image, image],
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
