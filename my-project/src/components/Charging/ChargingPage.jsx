import { useCallback, useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { FiBatteryCharging, FiClock, FiMapPin, FiNavigation, FiRefreshCw, FiTool, FiZap } from "react-icons/fi";
import { FaPlug } from "react-icons/fa";
import { chargingApi } from "../../api/chargingApi";
import { CHARGING_STATION_STATUSES } from "../../data/statuses";

const BAKU_CENTER = [40.3777, 49.8499];

const statusMeta = {
  [CHARGING_STATION_STATUSES.ONLINE]: {
    label: "Online",
    color: "#16a34a",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
  },
  [CHARGING_STATION_STATUSES.BUSY]: {
    label: "Busy",
    color: "#f59e0b",
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
  },
  [CHARGING_STATION_STATUSES.MAINTENANCE]: {
    label: "Maintenance",
    color: "#64748b",
    bg: "bg-slate-100",
    text: "text-slate-700",
    border: "border-slate-200",
  },
  [CHARGING_STATION_STATUSES.OFFLINE]: {
    label: "Offline",
    color: "#71717a",
    bg: "bg-zinc-100",
    text: "text-zinc-700",
    border: "border-zinc-200",
  },
};

const filterOptions = [
  { id: "all", label: "All stations" },
  { id: CHARGING_STATION_STATUSES.ONLINE, label: "Available" },
  { id: CHARGING_STATION_STATUSES.BUSY, label: "Busy" },
  { id: CHARGING_STATION_STATUSES.MAINTENANCE, label: "Service" },
  { id: CHARGING_STATION_STATUSES.OFFLINE, label: "Offline" },
];

const createStationIcon = (station) => {
  const meta = statusMeta[station.status] || statusMeta[CHARGING_STATION_STATUSES.MAINTENANCE];

  return L.divIcon({
    className: "charging-map-marker",
    html: `
      <span class="charging-map-marker__pulse" style="--station-color:${meta.color};"></span>
      <span class="charging-map-marker__pin" style="--station-color:${meta.color};">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" fill="currentColor"></path>
        </svg>
      </span>
    `,
    iconSize: [54, 54],
    iconAnchor: [27, 27],
    popupAnchor: [0, -26],
  });
};

const getWaitTime = (station) => {
  if (
    station.status === CHARGING_STATION_STATUSES.MAINTENANCE ||
    station.status === CHARGING_STATION_STATUSES.OFFLINE
  ) return "Closed";
  if (station.availablePorts > 0) return "0 min";
  return "12 min";
};

const ChargingPage = () => {
  const [stations, setStations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [connectorFilter, setConnectorFilter] = useState("all");

  const loadStations = useCallback(async (options = {}) => {
    const silent = options.silent === true;
    if (!silent) setIsLoading(true);
    setError("");

    try {
      const nextStations = await chargingApi.getStations();
      setStations(nextStations);
    } catch (nextError) {
      setStations([]);
      setError(nextError.message || "Charging stations are unavailable. Please check the backend.");
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadStations, 0);
    return () => window.clearTimeout(timer);
  }, [loadStations]);

  useEffect(() => {
    const timer = window.setInterval(() => loadStations({ silent: true }), 10000);
    return () => window.clearInterval(timer);
  }, [loadStations]);

  const connectors = useMemo(
    () => ["all", ...new Set(stations.flatMap((station) => station.connectorTypes))],
    [stations]
  );

  const filteredStations = useMemo(() => {
    return stations.filter((station) => {
      const matchesStatus = activeFilter === "all" || station.status === activeFilter;
      const matchesConnector = connectorFilter === "all" || station.connectorTypes.includes(connectorFilter);
      return matchesStatus && matchesConnector;
    });
  }, [activeFilter, connectorFilter, stations]);

  const stats = useMemo(() => {
    const onlineStations = stations.filter((station) => station.status === CHARGING_STATION_STATUSES.ONLINE);
    const totalPorts = stations.reduce((sum, station) => sum + station.totalPorts, 0);
    const availablePorts = stations.reduce((sum, station) => sum + station.availablePorts, 0);
    const maxPower = stations.length ? Math.max(...stations.map((station) => station.powerKw)) : 0;

    return [
      { label: "Online hubs", value: onlineStations.length, icon: FiBatteryCharging },
      { label: "Free ports", value: `${availablePorts} / ${totalPorts}`, icon: FaPlug },
      { label: "Peak power", value: `${maxPower} kW`, icon: FiZap },
    ];
  }, [stations]);

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-zinc-950">
      <style>{`
        .charging-map-marker {
          align-items: center;
          display: flex;
          justify-content: center;
          position: relative;
        }

        .charging-map-marker__pulse {
          animation: charging-marker-pulse 2.4s ease-out infinite;
          background: var(--station-color);
          border-radius: 9999px;
          height: 54px;
          left: 50%;
          opacity: 0.22;
          position: absolute;
          top: 50%;
          width: 54px;
        }

        .charging-map-marker__pin {
          align-items: center;
          background: #ffffff;
          border: 3px solid var(--station-color);
          border-radius: 18px;
          box-shadow: 0 18px 32px rgba(15, 23, 42, 0.22);
          color: var(--station-color);
          display: flex;
          height: 46px;
          justify-content: center;
          position: relative;
          width: 46px;
          z-index: 1;
        }

        .charging-map-marker__pin svg {
          height: 24px;
          width: 24px;
        }

        @keyframes charging-marker-pulse {
          0% { opacity: 0.28; transform: translate(-50%, -50%) scale(0.78); }
          70% { opacity: 0; transform: translate(-50%, -50%) scale(1.55); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(1.55); }
        }
      `}</style>

      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto grid max-w-[1440px] gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:py-14">
          <div className="flex flex-col justify-center">
            <div className="flex w-fit items-center gap-2 rounded-full border border-red-100 bg-red-50 px-3 py-2 text-sm font-black text-red-600">
              <FiZap />
              Baku charging network
            </div>
            <h1 className="mt-5 max-w-2xl text-4xl font-black leading-tight text-zinc-950 sm:text-5xl">
              Charging stations for every ElectroStreet ride
            </h1>
            <p className="mt-5 max-w-xl text-base font-semibold leading-7 text-zinc-500">
              Check live station status, free ports, connector types, and fast-charge power before you pick a route.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {stats.map((stat) => {
                const Icon = stat.icon;

                return (
                  <div key={stat.label} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                    <Icon className="text-2xl text-red-500" />
                    <p className="mt-4 text-2xl font-black text-zinc-950">{stat.value}</p>
                    <p className="mt-1 text-sm font-bold text-zinc-500">{stat.label}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="min-h-[420px] overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 shadow-xl shadow-zinc-950/5 lg:min-h-[520px]">
            {isLoading || error ? (
              <div className="grid h-[420px] place-items-center p-6 text-center lg:h-[520px]">
                <div>
                  <p className="text-lg font-black text-zinc-950">
                    {isLoading ? "Loading charging stations..." : "Charging stations are unavailable"}
                  </p>
                  {error && <p className="mt-3 max-w-md text-sm font-bold leading-6 text-red-600">{error}</p>}
                  {error && (
                    <button
                      type="button"
                      onClick={loadStations}
                      className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-950 px-4 py-3 text-sm font-black text-white transition hover:bg-red-500"
                    >
                      <FiRefreshCw />
                      Retry
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <MapContainer center={BAKU_CENTER} zoom={13} scrollWheelZoom={false} className="h-[420px] w-full lg:h-[520px]">
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
                  url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                />

                {filteredStations.map((station) => {
                  const meta = statusMeta[station.status] || statusMeta[CHARGING_STATION_STATUSES.MAINTENANCE];

                  return (
                    <Marker
                      key={station.id}
                      position={[station.location.lat, station.location.lng]}
                      icon={createStationIcon(station)}
                    >
                      <Popup>
                        <div className="min-w-[210px]">
                          <p className="text-sm font-black text-zinc-950">{station.name}</p>
                          <p className="mt-1 text-xs font-semibold text-zinc-500">{station.location.label}</p>
                          <div className="mt-3 flex items-center justify-between gap-3">
                            <span className="rounded-full px-2.5 py-1 text-xs font-black text-white" style={{ backgroundColor: meta.color }}>
                              {meta.label}
                            </span>
                            <span className="text-xs font-bold text-zinc-700">{station.powerKw} kW</span>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 border-b border-zinc-200 pb-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {filterOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setActiveFilter(option.id)}
                className={`rounded-lg px-4 py-3 text-sm font-black transition ${
                  activeFilter === option.id ? "bg-zinc-950 text-white" : "border border-zinc-200 bg-white text-zinc-600 hover:border-red-200 hover:text-red-600"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {connectors.map((connector) => (
              <button
                key={connector}
                type="button"
                onClick={() => setConnectorFilter(connector)}
                className={`rounded-lg px-4 py-3 text-sm font-black transition ${
                  connectorFilter === connector ? "bg-red-500 text-white" : "border border-zinc-200 bg-white text-zinc-600 hover:border-red-200 hover:text-red-600"
                }`}
              >
                {connector === "all" ? "All plugs" : connector}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {!isLoading && !error && !filteredStations.length && (
            <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center xl:col-span-3">
              <p className="text-lg font-black text-zinc-950">No charging stations yet.</p>
              <p className="mt-2 text-sm font-semibold text-zinc-500">Stations created in admin will appear here.</p>
            </div>
          )}

          {filteredStations.map((station) => {
            const meta = statusMeta[station.status] || statusMeta[CHARGING_STATION_STATUSES.MAINTENANCE];

            return (
              <article key={station.id} className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-red-200 hover:shadow-lg">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="text-xl font-black text-zinc-950">{station.name}</h2>
                    <p className="mt-2 flex items-center gap-2 text-sm font-bold text-zinc-500">
                      <FiMapPin className="shrink-0 text-red-500" />
                      <span className="truncate">{station.location.label} · {station.location.zone}</span>
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-black ${meta.bg} ${meta.text} ${meta.border}`}>
                    {meta.label}
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-3">
                  <div className="rounded-lg bg-zinc-50 p-3">
                    <FaPlug className="text-lg text-zinc-400" />
                    <p className="mt-3 text-lg font-black">{station.availablePorts} / {station.totalPorts}</p>
                    <p className="text-xs font-bold text-zinc-500">Free ports</p>
                  </div>
                  <div className="rounded-lg bg-zinc-50 p-3">
                    <FiZap className="text-lg text-zinc-400" />
                    <p className="mt-3 text-lg font-black">{station.powerKw}</p>
                    <p className="text-xs font-bold text-zinc-500">kW</p>
                  </div>
                  <div className="rounded-lg bg-zinc-50 p-3">
                    {station.status === CHARGING_STATION_STATUSES.MAINTENANCE ? (
                      <FiTool className="text-lg text-zinc-400" />
                    ) : (
                      <FiClock className="text-lg text-zinc-400" />
                    )}
                    <p className="mt-3 text-lg font-black">{getWaitTime(station)}</p>
                    <p className="text-xs font-bold text-zinc-500">Wait</p>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {station.connectorTypes.map((connector) => (
                    <span key={connector} className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-black text-zinc-600">
                      {connector}
                    </span>
                  ))}
                </div>

                <div className="mt-5 flex gap-2">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${station.location.lat},${station.location.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-zinc-950 px-4 py-3 text-sm font-black text-white transition hover:bg-red-500"
                  >
                    <FiNavigation />
                    Route
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
};

export default ChargingPage;
