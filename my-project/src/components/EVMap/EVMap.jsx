import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { vehicles } from "../../data/vehicles";
import { VEHICLE_STATUSES } from "../../data/statuses";

const BAKU_CENTER = [40.3777, 49.892];

const STATUS_META = {
  [VEHICLE_STATUSES.AVAILABLE]: {
    label: "Available",
    color: "#22c55e",
  },
  [VEHICLE_STATUSES.RESERVED]: {
    label: "Reserved",
    color: "#3b82f6",
  },
  [VEHICLE_STATUSES.IN_USE]: {
    label: "In use",
    color: "#8b5cf6",
  },
  [VEHICLE_STATUSES.CHARGING]: {
    label: "Charging",
    color: "#f59e0b",
  },
  [VEHICLE_STATUSES.COMPLETED]: {
    label: "Completed",
    color: "#94a3b8",
  },
};

const nearestVehicle =
  vehicles.find((vehicle) => vehicle.status === VEHICLE_STATUSES.AVAILABLE) ||
  vehicles[0];

const createVehicleIcon = (vehicle, status) =>
  L.divIcon({
    className: "ev-map-marker",
    html: `
      <span class="ev-map-marker__pulse" style="--ev-status-color:${status.color};"></span>
      <span class="ev-map-marker__circle" style="border-color:${status.color};">
        <img alt="" src="${vehicle.image}" class="ev-map-marker__image" />
      </span>
    `,
    iconSize: [56, 56],
    iconAnchor: [28, 28],
    popupAnchor: [0, -30],
  });

const EVMap = () => {
  const nearestStatus =
    STATUS_META[nearestVehicle.status] ||
    STATUS_META[VEHICLE_STATUSES.COMPLETED];

  return (
    <div className="group relative h-[420px] w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-100 shadow-2xl shadow-gray-300/70 md:h-[500px]">
      <style>
        {`
          .ev-map-marker {
            align-items: center;
            display: flex;
            justify-content: center;
            position: relative;
          }

          .ev-map-marker__pulse {
            animation: ev-map-pulse 2.4s ease-out infinite;
            background: var(--ev-status-color);
            border-radius: 9999px;
            height: 58px;
            left: 50%;
            opacity: 0.28;
            position: absolute;
            top: 50%;
            width: 58px;
          }

          .ev-map-marker__circle {
            align-items: center;
            background: #ffffff;
            border: 3px solid;
            border-radius: 9999px;
            box-shadow: 0 12px 28px rgba(15, 23, 42, 0.24);
            display: flex;
            height: 50px;
            justify-content: center;
            overflow: hidden;
            position: relative;
            transition: transform 220ms ease, box-shadow 220ms ease;
            width: 50px;
            z-index: 1;
          }

          .ev-map-marker:hover .ev-map-marker__circle {
            box-shadow: 0 16px 34px rgba(15, 23, 42, 0.34);
            transform: translateY(-2px) scale(1.04);
          }

          .ev-map-marker__image {
            display: block;
            height: 36px;
            object-fit: contain;
            width: 42px;
          }

          .leaflet-container {
            transition: transform 700ms ease;
          }

          .group:hover .leaflet-container {
            transform: scale(1.015);
          }

          @keyframes ev-map-pulse {
            0% {
              opacity: 0.35;
              transform: translate(-50%, -50%) scale(0.78);
            }
            70% {
              opacity: 0;
              transform: translate(-50%, -50%) scale(1.5);
            }
            100% {
              opacity: 0;
              transform: translate(-50%, -50%) scale(1.5);
            }
          }
        `}
      </style>

      <MapContainer
        center={BAKU_CENTER}
        zoom={13}
        scrollWheelZoom={false}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />

        {vehicles.map((vehicle) => {
          const status =
            STATUS_META[vehicle.status] ||
            STATUS_META[VEHICLE_STATUSES.COMPLETED];

          return (
            <Marker
              key={vehicle.id}
              position={[vehicle.location.lat, vehicle.location.lng]}
              icon={createVehicleIcon(vehicle, status)}
            >
              <Popup>
                <div className="min-w-[190px]">
                  <p className="text-sm font-bold text-gray-950">
                    {vehicle.brand} {vehicle.model}
                  </p>
                  <p className="mt-1 text-xs font-medium text-gray-500">
                    {vehicle.location.label}
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span
                      className="rounded-full px-2.5 py-1 text-xs font-bold text-white"
                      style={{ backgroundColor: status.color }}
                    >
                      {status.label}
                    </span>
                    <span className="text-xs font-semibold text-gray-700">
                      {vehicle.batteryPercent}% battery
                    </span>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      <div className="pointer-events-none absolute bottom-5 left-5 z-[500] w-[min(280px,calc(100%-2.5rem))] rounded-lg border border-white/80 bg-white/95 p-4 shadow-2xl shadow-gray-900/15 backdrop-blur">
        <div className="flex items-center gap-3">
          <div
            className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full border-[3px] bg-white shadow-md"
            style={{ borderColor: nearestStatus.color }}
          >
            <img
              src={nearestVehicle.image}
              alt={`${nearestVehicle.brand} ${nearestVehicle.model}`}
              className="h-10 w-12 object-contain"
            />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#E53E3E]">
              Nearest EV
            </p>
            <p className="truncate text-sm font-extrabold text-gray-950">
              {nearestVehicle.brand} {nearestVehicle.model}
            </p>
            <p className="text-xs font-medium text-gray-500">
              {nearestVehicle.location.label} - 3 min walk
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EVMap;
