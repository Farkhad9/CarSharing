import { useEffect, useMemo, useState } from "react";
// ИСПРАВЛЕНО: Импортируем иконку батареи из правильного пакета /bs
import { BsBatteryCharging } from "react-icons/bs"; 
import { FiNavigation, FiSliders } from "react-icons/fi";
import { VEHICLE_STATUSES } from "../../data/statuses";
import AuthModal from "../AuthModal/AuthModal";
import { RESERVATIONS_UPDATED_EVENT } from "../../utils/reservations";
import { DEFAULT_PICKUP_USER_LOCATION, getDistanceMeters, getWalkMinutes } from "../../utils/pickupMetrics";
import { refreshVehicles, useVehicles } from "../../hooks/useVehicles";

const LOW_CHARGE_RESERVATION_LIMIT = 30;

const FILTERS = [
  { label: "All", value: "all" },
  { label: "Available", value: VEHICLE_STATUSES.AVAILABLE },
  { label: "Charging", value: VEHICLE_STATUSES.CHARGING },
  { label: "Reserved", value: VEHICLE_STATUSES.RESERVED },
];

const PRICE_FILTERS = [
  { label: "All prices", value: "all", matches: () => true },
  { label: "Under 0.50", value: "under_050", matches: (price) => price < 0.5 },
  { label: "0.50 - 0.80", value: "050_080", matches: (price) => price >= 0.5 && price <= 0.8 },
  { label: "0.80+", value: "over_080", matches: (price) => price > 0.8 },
];

const STATUS_STYLES = {
  [VEHICLE_STATUSES.AVAILABLE]: {
    label: "Available",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    bar: "bg-emerald-500",
    button: "bg-[#E53E3E] text-white hover:bg-red-600 hover:-translate-y-0.5 shadow-md shadow-red-500/10",
    buttonText: "Reserve Car",
    disabled: false,
  },
  [VEHICLE_STATUSES.RESERVED]: {
    label: "Reserved",
    badge: "bg-blue-50 text-blue-700 border-blue-200",
    bar: "bg-blue-500",
    button: "bg-gray-200 text-gray-400 cursor-not-allowed",
    buttonText: "Reserved",
    disabled: true,
  },
  [VEHICLE_STATUSES.IN_USE]: {
    label: "In Use",
    badge: "bg-violet-50 text-violet-700 border-violet-200",
    bar: "bg-violet-500",
    button: "bg-gray-200 text-gray-400 cursor-not-allowed",
    buttonText: "In Use",
    disabled: true,
  },
  [VEHICLE_STATUSES.CHARGING]: {
    label: "Charging",
    badge: "bg-yellow-50 text-yellow-700 border-yellow-200",
    bar: "bg-yellow-500",
    button: "bg-yellow-400 text-yellow-950 cursor-not-allowed",
    buttonText: "Charging",
    disabled: true,
  },
};

const LOW_CHARGE_STATUS = {
  label: "Needs Charging",
  badge: "bg-amber-50 text-amber-700 border-amber-200",
  bar: "bg-amber-500",
  button: "bg-gray-200 text-gray-400 cursor-not-allowed",
  buttonText: "Needs Charging",
  disabled: true,
};

const getDisplayStatus = (vehicle) => {
  if (vehicle.status === VEHICLE_STATUSES.AVAILABLE && Number(vehicle.batteryPercent) <= LOW_CHARGE_RESERVATION_LIMIT) {
    return "needs_charging";
  }

  return vehicle.status;
};

const FleetSection = ({ onVehicleSelect, onUserChange }) => {
  const [activeFilter, setActiveFilter] = useState("all");
  const [activeBrandFilter, setActiveBrandFilter] = useState("all");
  const [activePriceFilter, setActivePriceFilter] = useState("all");
  const [authVehicle, setAuthVehicle] = useState(null);
  const [reservationsRevision, setReservationsRevision] = useState(0);
  const { vehicles: backendVehicles, isLoading: isLoadingVehicles, error: vehicleError } = useVehicles();
  const [userLocation, setUserLocation] = useState(DEFAULT_PICKUP_USER_LOCATION);
  const [hasResolvedUserLocation, setHasResolvedUserLocation] = useState(() => !("geolocation" in navigator));

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      return undefined;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setUserLocation([position.coords.latitude, position.coords.longitude]);
        setHasResolvedUserLocation(true);
      },
      () => {
        setUserLocation(DEFAULT_PICKUP_USER_LOCATION);
        setHasResolvedUserLocation(true);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 12000,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const visibleVehicles = useMemo(
    () => backendVehicles.filter((vehicle) => vehicle.status !== VEHICLE_STATUSES.COMPLETED),
    [backendVehicles]
  );

  const brandFilters = useMemo(
    () => [
      { label: "All Cars", value: "all" },
      ...[...new Set(visibleVehicles.map((vehicle) => vehicle.brand).filter(Boolean))]
        .sort((first, second) => first.localeCompare(second))
        .map((brand) => ({ label: brand, value: brand })),
    ],
    [visibleVehicles]
  );

  useEffect(() => {
    const refreshReservations = (event) => {
      if (!event || event.type === RESERVATIONS_UPDATED_EVENT || event.key === "reservedVehicles") {
        setReservationsRevision((revision) => revision + 1);
        refreshVehicles();
      }
    };

    window.addEventListener("storage", refreshReservations);
    window.addEventListener(RESERVATIONS_UPDATED_EVENT, refreshReservations);

    return () => {
      window.removeEventListener("storage", refreshReservations);
      window.removeEventListener(RESERVATIONS_UPDATED_EVENT, refreshReservations);
    };
  }, []);

  const isUserAuthorized = () => Boolean(localStorage.getItem("electroStreetUser"));

  const handleReserveClick = (vehicle) => {
    const storedUser = (() => {
      try {
        return JSON.parse(localStorage.getItem("electroStreetUser") || "null");
      } catch {
        return null;
      }
    })();

    if (!isUserAuthorized()) {
      setAuthVehicle(vehicle);
      return;
    }

    if (storedUser?.emailVerified === false) {
      window.dispatchEvent(
        new CustomEvent("electrostreet:email-gate", {
          detail: "Подтвердите email, чтобы забронировать автомобиль.",
        })
      );
      return;
    }

    onVehicleSelect?.(vehicle);
  };

  const filteredAndSortedVehicles = useMemo(() => {
    void reservationsRevision;
    const effectiveBrandFilter = brandFilters.some((filter) => filter.value === activeBrandFilter)
      ? activeBrandFilter
      : "all";
    const priceFilter = PRICE_FILTERS.find((filter) => filter.value === activePriceFilter) || PRICE_FILTERS[0];

    return visibleVehicles
      .map((vehicle) => {
        const vehicleLocation = [vehicle.location?.lat, vehicle.location?.lng];
        const distanceMeters = hasResolvedUserLocation
          ? getDistanceMeters(userLocation, vehicleLocation)
          : Number.POSITIVE_INFINITY;

        return {
          ...vehicle,
          distanceMeters,
          walkTimeMinutes: hasResolvedUserLocation ? getWalkMinutes(distanceMeters) : null,
        };
      })
      .filter((vehicle) => {
        const displayStatus = getDisplayStatus(vehicle);
        const pricePerMinute = Number(vehicle.pricePerMinute || 0);
        const matchesStatus = activeFilter === "all" || displayStatus === activeFilter;
        const matchesBrand = effectiveBrandFilter === "all" || vehicle.brand === effectiveBrandFilter;
        const matchesPrice = priceFilter.matches(pricePerMinute);
        return matchesStatus && matchesBrand && matchesPrice;
      })
      .sort((a, b) => a.distanceMeters - b.distanceMeters);
  }, [activeFilter, activeBrandFilter, activePriceFilter, brandFilters, hasResolvedUserLocation, reservationsRevision, userLocation, visibleVehicles]);

  return (
    <section id="fleet" className="scroll-mt-24 bg-white py-16 md:py-24 border-b border-gray-100">
      <div className="container mx-auto px-4 md:px-6 max-w-7xl">
        
        {/* Заголовок и фильтры статуса в твоем стиле */}
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between pb-8 mb-4">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#E53E3E]">
              AVAILABLE FLEET
            </p>
            <h2 className="text-3xl font-black leading-tight text-gray-900 md:text-4xl tracking-tight">
              Choose Your Electric Ride
            </h2>
            <p className="text-sm text-gray-400 mt-1">All vehicles are charged, insured and ready to go.</p>
          </div>

          <div className="flex flex-wrap gap-2 bg-gray-50 p-1.5 rounded-xl border border-gray-100 h-fit">
            {FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setActiveFilter(filter.value)}
                className={`rounded-lg px-5 py-2 text-xs font-bold transition-all duration-300 ${
                  activeFilter === filter.value
                    ? "bg-[#E53E3E] text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* Дополнительный фильтр по брендам */}
        <div className="flex items-center gap-2 mb-10 overflow-x-auto pb-2 no-scrollbar">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mr-2 whitespace-nowrap flex items-center gap-1">
            <FiSliders /> Filter by Brand:
          </span>
          {brandFilters.map((brand) => (
            <button
              key={brand.value}
              type="button"
              onClick={() => setActiveBrandFilter(brand.value)}
              className={`px-4 py-1.5 text-xs font-bold rounded-full border transition-all duration-200 ${
                activeBrandFilter === brand.value
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-gray-200 text-gray-500 hover:border-gray-400 bg-white"
              }`}
            >
              {brand.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 mb-10 -mt-6 overflow-x-auto pb-2 no-scrollbar">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mr-2 whitespace-nowrap flex items-center gap-1">
            <FiSliders /> Filter by Price:
          </span>
          {PRICE_FILTERS.map((priceFilter) => (
            <button
              key={priceFilter.value}
              type="button"
              onClick={() => setActivePriceFilter(priceFilter.value)}
              className={`px-4 py-1.5 text-xs font-bold rounded-full border transition-all duration-200 ${
                activePriceFilter === priceFilter.value
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-gray-200 text-gray-500 hover:border-gray-400 bg-white"
              }`}
            >
              {priceFilter.label}
            </button>
          ))}
        </div>

        {/* Сетка автомобилей точь-в-точь как в твоем UI */}
        {vehicleError && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">
            {vehicleError}
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {isLoadingVehicles ? (
            <div className="rounded-3xl border border-gray-100 bg-white p-8 text-sm font-black text-gray-500 shadow-sm md:col-span-2 lg:col-span-3">
              Loading EVs...
            </div>
          ) : filteredAndSortedVehicles.length ? filteredAndSortedVehicles.map((vehicle) => {
            const status = getDisplayStatus(vehicle) === "needs_charging"
              ? LOW_CHARGE_STATUS
              : STATUS_STYLES[vehicle.status] || STATUS_STYLES[VEHICLE_STATUSES.AVAILABLE];

            return (
              <article
                key={vehicle.id}
                className="group rounded-3xl border border-gray-100 bg-white p-6 shadow-[0_4px_25px_-5px_rgba(0,0,0,0.01)] transition-all duration-300 hover:shadow-md flex flex-col justify-between"
              >
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <span className={`rounded-full px-3 py-1 text-[10px] font-bold tracking-wide border ${status.badge}`}>
                      {status.label}
                    </span>
                    <span className="text-xs font-bold text-gray-300">
                      {vehicle.year || "2025"}
                    </span>
                  </div>

                  {/* Изображение */}
                  <div className="flex aspect-[16/10] items-center justify-center overflow-hidden rounded-2xl bg-white">
                    <img
                      src={vehicle.image}
                      alt={`${vehicle.brand} ${vehicle.model}`}
                      className="h-full w-full object-contain p-2 transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>

                  {/* Название и Госномер */}
                  <div className="mt-5">
                    <h3 className="text-lg font-black text-gray-900 tracking-tight">
                      {vehicle.brand} {vehicle.model}
                    </h3>
                    <p className="text-[11px] font-bold text-gray-400 mt-0.5 uppercase">
                      {vehicle.plateNumber}
                    </p>
                  </div>

                  {/* Индикатор заряда батареи */}
                  <div className="mt-5">
                    <div className="mb-2 flex items-center justify-between text-[11px] font-bold text-gray-700">
                      <span className="flex items-center gap-1">
                        <BsBatteryCharging className="text-gray-400 text-sm" /> Battery
                      </span>
                      <span className="font-black text-gray-900">{vehicle.batteryPercent}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${status.bar}`}
                        style={{ width: `${vehicle.batteryPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Спецификации (Нижний триплет параметров) */}
                  <div className="mt-6 grid grid-cols-3 gap-2 pt-4 border-t border-gray-100 text-left">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Range</p>
                      <p className="mt-0.5 text-xs font-black text-gray-900">{vehicle.rangeKm} km</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Price</p>
                      <p className="mt-0.5 text-xs font-black text-gray-900">{vehicle.pricePerMinute} AZN/min</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Location</p>
                      <p className="mt-0.5 text-[11px] font-black text-gray-900 truncate flex items-center gap-0.5">
                        <FiNavigation className="text-[9px] text-red-500 flex-shrink-0" />
                        {vehicle.walkTimeMinutes ? `${vehicle.walkTimeMinutes} min walk` : "Detecting..."}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Кнопка резервации */}
                <button
                  type="button"
                  disabled={status.disabled}
                  onClick={() => handleReserveClick(vehicle)}
                  className={`mt-6 w-full rounded-xl py-3.5 text-xs font-black uppercase tracking-wider transition-all duration-200 ${status.button}`}
                >
                  {status.buttonText}
                </button>
              </article>
            );
          }) : (
            <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm font-black text-gray-500 md:col-span-2 lg:col-span-3">
              No EVs match these filters.
            </div>
          )}
        </div>
      </div>

      {/* Экран 360° бронирования */}
      {authVehicle && (
        <div className="fixed inset-0 z-[120] overflow-y-auto bg-zinc-950/70 backdrop-blur-md">
          <AuthModal
            onClose={() => setAuthVehicle(null)}
            reservationNotice="Для резервации автомобиля необходимо войти или зарегистрироваться"
            onAuthSuccess={(nextUser) => {
              onUserChange?.(nextUser);
              if (nextUser.emailVerified === false) {
                window.dispatchEvent(
                  new CustomEvent("electrostreet:email-gate", {
                    detail: "Сначала подтвердите email по ссылке из письма.",
                  })
                );
                setAuthVehicle(null);
                return;
              }
              onVehicleSelect?.(authVehicle);
              setAuthVehicle(null);
            }}
          />
        </div>
      )}
    </section>
  );
};

export default FleetSection;
