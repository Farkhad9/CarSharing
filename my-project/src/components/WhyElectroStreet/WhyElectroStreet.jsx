import { useEffect, useMemo, useState } from "react";
import { FiBatteryCharging, FiMapPin, FiShield, FiZap } from "react-icons/fi";
import { homeApi } from "../../api/homeApi";
import { VEHICLE_STATUSES } from "../../data/statuses";
import { useUserLocation } from "../../hooks/useUserLocation";
import { useVehicles } from "../../hooks/useVehicles";
import { getDistanceMeters, getWalkMinutes } from "../../utils/pickupMetrics";

const WhyElectroStreet = () => {
  const [summary, setSummary] = useState(null);
  const [summaryError, setSummaryError] = useState("");
  const { vehicles } = useVehicles();
  const { userLocation, hasResolvedUserLocation } = useUserLocation();

  useEffect(() => {
    let isMounted = true;

    homeApi.getSummary()
      .then((data) => {
        if (isMounted) {
          setSummary(data);
          setSummaryError("");
        }
      })
      .catch((error) => {
        if (isMounted) {
          setSummaryError(error.message || "Fleet facts could not be loaded.");
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const nearestWalkMinutes = useMemo(() => {
    if (!hasResolvedUserLocation) return null;

    const nearestDistance = vehicles
      .filter((vehicle) => vehicle.status === VEHICLE_STATUSES.AVAILABLE)
      .map((vehicle) => getDistanceMeters(userLocation, [vehicle.location?.lat, vehicle.location?.lng]))
      .filter(Number.isFinite)
      .sort((first, second) => first - second)[0];

    return Number.isFinite(nearestDistance) ? getWalkMinutes(nearestDistance) : null;
  }, [hasResolvedUserLocation, userLocation, vehicles]);

  const completedTripsLabel = summary?.completedTrips > 0
    ? `${summary.completedTrips.toLocaleString()} rides completed in Baku`
    : "Completed rides will appear here from backend";
  const minPrice = Number(summary?.minPricePerMinute || 0);
  const readyThreshold = summary?.readyBatteryThresholdPercent ?? 60;
  const availableVehicles = summary?.availableVehicles ?? 0;
  const readyVehicles = summary?.readyAvailableVehicles ?? 0;
  const walkTitle = nearestWalkMinutes
    ? `${nearestWalkMinutes} min walk to nearest car`
    : "Nearest car walk time uses your location";

  const benefits = [
    {
      number: "01",
      Icon: FiZap,
      metric: minPrice > 0 ? `${minPrice.toFixed(2)} AZN` : "Live",
      metricLabel: "per minute",
      title: minPrice > 0 ? `From ${minPrice.toFixed(2)} AZN per minute` : "Live per-minute rates",
      text: "Forget daily rental rates and hidden surcharges. ElectroStreet runs on a simple per-minute model. The clock starts when you unlock the car and stops the moment you park.",
      note: "Rates vary slightly by vehicle model and demand zone, but you always see the final price before you confirm.",
      badge: "No hidden fees",
      accent: "from-red-500 to-rose-500",
    },
    {
      number: "02",
      Icon: FiBatteryCharging,
      metric: `${readyThreshold}%+`,
      metricLabel: "ready battery",
      title: summary?.allAvailableVehiclesReady
        ? `Every available car above ${readyThreshold}% before your ride`
        : `${readyVehicles} of ${availableVehicles} available cars above ${readyThreshold}%`,
      text: `Operations monitors battery levels across the fleet in real time. Vehicles below ${readyThreshold}% are flagged for charging before they return to the available list.`,
      note: "Battery level, estimated range and nearest charging station are always visible on the vehicle card before you reserve.",
      badge: "Always ready",
      accent: "from-emerald-500 to-teal-500",
    },
    {
      number: "03",
      Icon: FiMapPin,
      metric: nearestWalkMinutes ? `${nearestWalkMinutes} min` : "Live",
      metricLabel: "nearest walk",
      title: walkTitle,
      text: "ElectroStreet vehicles are distributed across Baku's highest-traffic zones, and the nearest available vehicle is calculated from live backend vehicle coordinates.",
      note: hasResolvedUserLocation
        ? "This walk estimate is calculated from your current browser location and live backend vehicles."
        : "Allow location access to calculate the nearest available vehicle.",
      badge: "City-wide coverage",
      accent: "from-sky-500 to-blue-500",
    },
    {
      number: "04",
      Icon: FiShield,
      metric: "0 AZN",
      metricLabel: "deposit",
      title: "Full insurance, zero deposit",
      text: "Every ElectroStreet ride is covered by comprehensive insurance from the moment you unlock the vehicle to the moment you end the trip.",
      note: "All vehicles pass regular technical inspection. Safety is not optional.",
      badge: "Zero risk",
      accent: "from-zinc-800 to-zinc-600",
    },
  ];

  return (
    <section className="bg-[#f6f7f9] py-16 lg:py-20">
      <div className="container mx-auto max-w-[1500px] px-4 md:px-6">
        <div className="mb-10 overflow-hidden rounded-[28px] border border-zinc-200 bg-zinc-950 text-white shadow-2xl shadow-zinc-950/10">
          <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="p-6 md:p-8 lg:p-10">
              <span className="mb-4 inline-flex rounded-full bg-red-500 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-white">
                Why ElectroStreet
              </span>
              <h2 className="max-w-3xl text-4xl font-black leading-tight tracking-tight md:text-5xl">
                Practical city rides, priced by the minute.
              </h2>
              <p className="mt-5 max-w-2xl text-base font-semibold leading-7 text-white/65">
                Everything riders need is visible before booking: live price, useful battery, nearest car, and trip protection.
              </p>
              {summaryError && (
                <p className="mt-5 rounded-2xl border border-red-300/25 bg-red-500/15 px-4 py-3 text-sm font-bold text-red-100">
                  {summaryError}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 border-t border-white/10 lg:border-l lg:border-t-0">
              <div className="border-b border-r border-white/10 p-5 md:p-6">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">Fleet</p>
                <p className="mt-3 text-3xl font-black">{availableVehicles}</p>
                <p className="mt-1 text-xs font-bold text-white/55">available cars</p>
              </div>
              <div className="border-b border-white/10 p-5 md:p-6">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">Battery</p>
                <p className="mt-3 text-3xl font-black">{readyVehicles}</p>
                <p className="mt-1 text-xs font-bold text-white/55">ready above {readyThreshold}%</p>
              </div>
              <div className="border-r border-white/10 p-5 md:p-6">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">Walk</p>
                <p className="mt-3 text-3xl font-black">{nearestWalkMinutes || "--"}</p>
                <p className="mt-1 text-xs font-bold text-white/55">minutes nearby</p>
              </div>
              <div className="p-5 md:p-6">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">Rides</p>
                <p className="mt-3 text-3xl font-black">{summary?.completedTrips?.toLocaleString() || 0}</p>
                <p className="mt-1 text-xs font-bold text-white/55">completed in Baku</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-red-500">Rider advantages</p>
            <h3 className="mt-2 text-2xl font-black tracking-tight text-zinc-950 md:text-3xl">
              Four things that matter before you reserve.
            </h3>
          </div>
          <p className="text-sm font-bold text-zinc-500">{completedTripsLabel}</p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {benefits.map(({ number, Icon, title, text, note, badge }) => {
            const isFeatured = number === "04";

            return (
              <article
                key={title}
                className={`group relative flex min-h-[380px] flex-col overflow-hidden rounded-[28px] border border-zinc-100 bg-white p-7 shadow-[0_18px_60px_rgba(15,23,42,0.055)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_26px_80px_rgba(15,23,42,0.09)] md:p-8 ${
                  isFeatured ? "border-l-4 border-l-red-400 shadow-[0_28px_90px_rgba(15,23,42,0.09)]" : ""
                }`}
              >
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-3xl text-red-500 shadow-sm">
                  <Icon />
                </span>

                <h4 className="mt-11 max-w-xl text-2xl font-black leading-tight text-zinc-950 md:text-3xl">
                  {title}
                </h4>

                <p className="mt-5 max-w-3xl text-base font-semibold leading-8 text-zinc-600">
                  {text}
                </p>

                <p className="mt-auto pt-12 max-w-3xl text-sm font-semibold leading-6 text-zinc-400">
                  {note}
                </p>

                <div className="mt-7 flex items-end justify-between gap-4">
                  <span className="rounded-full border border-red-100 bg-red-50 px-5 py-2 text-sm font-black text-red-500">
                    {badge}
                  </span>
                  <span className="pointer-events-none text-7xl font-black leading-none text-zinc-950/[0.035] transition-colors duration-300 group-hover:text-zinc-950/[0.06]">
                    {number}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default WhyElectroStreet;
