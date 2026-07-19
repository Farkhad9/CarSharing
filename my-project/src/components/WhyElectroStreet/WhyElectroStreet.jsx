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
    ? `${nearestWalkMinutes} min walk to nearest EV`
    : "Nearest EV walk time uses your location";

  const benefits = [
    {
      number: "01",
      Icon: FiZap,
      title: minPrice > 0 ? `From ${minPrice.toFixed(2)} AZN per minute` : "Live per-minute rates",
      text: "Forget daily rental rates and hidden surcharges. ElectroStreet runs on a simple per-minute model. The clock starts when you unlock the car and stops the moment you park.",
      note: "Rates vary slightly by vehicle model and demand zone, but you always see the final price before you confirm.",
      badge: "No hidden fees",
    },
    {
      number: "02",
      Icon: FiBatteryCharging,
      title: summary?.allAvailableVehiclesReady
        ? `Every available car above ${readyThreshold}% before your ride`
        : `${readyVehicles} of ${availableVehicles} available cars above ${readyThreshold}%`,
      text: `Operations monitors battery levels across the fleet in real time. Vehicles below ${readyThreshold}% are flagged for charging before they return to the available list.`,
      note: "Battery level, estimated range and nearest charging station are always visible on the vehicle card before you reserve.",
      badge: "Always ready",
    },
    {
      number: "03",
      Icon: FiMapPin,
      title: walkTitle,
      text: "ElectroStreet vehicles are distributed across Baku's highest-traffic zones, and the nearest available vehicle is calculated from live backend vehicle coordinates.",
      note: hasResolvedUserLocation
        ? "This walk estimate is calculated from your current browser location and live backend vehicles."
        : "Allow location access to calculate the nearest available vehicle.",
      badge: "City-wide coverage",
    },
    {
      number: "04",
      Icon: FiShield,
      title: "Full insurance, zero deposit",
      text: "Every ElectroStreet ride is covered by comprehensive insurance from the moment you unlock the vehicle to the moment you end the trip.",
      note: "All vehicles pass regular technical inspection. Safety is not optional.",
      badge: "Zero risk",
    },
  ];

  return (
    <section className="bg-[#fafafa] py-16 lg:py-20">
      <div className="container mx-auto max-w-[1500px] px-4 md:px-6">
        <div className="mb-12 max-w-3xl">
          <span className="mb-4 block text-sm font-bold uppercase tracking-widest text-red-500">
            Why ElectroStreet
          </span>
          <h2 className="mb-4 text-4xl font-extrabold tracking-tight text-gray-900 md:text-5xl">
            Why Baku Rides Electric
          </h2>
          <div className="mb-3 text-lg font-semibold text-gray-800">
            {completedTripsLabel}
          </div>
          <p className="text-base text-gray-500">
            Everything you need to know before your first ride.
          </p>
          {summaryError && (
            <p className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {summaryError}
            </p>
          )}
          <div className="mt-8 h-1 w-24 rounded-full bg-red-500" />
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:gap-6">
          {benefits.map(({ number, Icon, title, text, note, badge }) => (
            <article
              key={title}
              className="group relative flex min-h-[410px] flex-col overflow-hidden rounded-2xl border border-gray-100 border-l-4 border-l-transparent bg-white p-6 shadow-[0_2px_20px_-4px_rgba(0,0,0,0.03)] transition-all duration-500 hover:-translate-y-1 hover:border-l-red-500 hover:shadow-[0_20px_40px_-4px_rgba(0,0,0,0.1)] lg:p-8"
            >
              <span className="pointer-events-none absolute bottom-6 right-8 z-0 select-none text-7xl font-black leading-none text-gray-100 transition-colors duration-500 group-hover:text-red-100">
                {number}
              </span>

              <div className="relative z-10 flex h-full flex-col">
                <div className="mb-7 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-3xl text-red-500 shadow-inner transition-transform duration-500 group-hover:scale-110">
                  <Icon />
                </div>

                <h3 className="mb-4 text-2xl font-bold text-gray-900">
                  {title}
                </h3>

                <p className="mb-4 flex-grow text-base leading-7 text-gray-600">
                  {text}
                </p>

                <p className="text-sm leading-relaxed text-gray-400">
                  {note}
                </p>

                <div className="mt-6">
                  <span className="inline-flex items-center rounded-full border border-red-100 bg-red-50 px-4 py-1.5 text-sm font-bold text-red-600">
                    {badge}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhyElectroStreet;
