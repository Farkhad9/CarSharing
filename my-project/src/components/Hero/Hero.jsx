import { FaBatteryThreeQuarters, FaBolt, FaCar, FaLocationDot } from "react-icons/fa6";

import img from "../../assets/img/hero.png";
import { VEHICLE_STATUSES } from "../../data/statuses";
import { useVehicles } from "../../hooks/useVehicles";

const Hero = ({ onReserveClick, onFeaturedReserve }) => {
  const { vehicles, isLoading, error } = useVehicles();
  const availableVehicle = vehicles.find(
    (vehicle) => vehicle.status === VEHICLE_STATUSES.AVAILABLE
  );
  const onlineVehiclesCount = vehicles.length;
  const primaryPrice = availableVehicle
    ? `${availableVehicle.pricePerMinute.toFixed(2)} ${availableVehicle.currency || "AZN"}/min`
    : "0.00 AZN/min";

  return (
    <section className="relative overflow-hidden bg-[#fef6f6] py-12 lg:py-20 px-5 lg:px-14">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_26%,rgba(239,68,68,0.12),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.55),transparent_42%)]" />
      <div className="absolute left-0 top-0 h-full w-1/2 opacity-40 bg-[linear-gradient(90deg,rgba(239,68,68,0.08)_1px,transparent_1px),linear-gradient(180deg,rgba(239,68,68,0.08)_1px,transparent_1px)] bg-[size:36px_36px]" />

      <div className="relative max-w-[1300px] mx-auto flex flex-col lg:flex-row items-center justify-between gap-10">
        {/* LEFT SIDE - TEXT */}
        <div className="flex-1 space-y-6">
          <h3
            className="text-red-500 font-semibold text-sm tracking-widest uppercase"
            data-aos="fade-up"
            data-aos-delay="100"
          >
            ELECTROSTREET
          </h3>
          <h1
            className="text-4xl font-extrabold leading-tight text-gray-900"
            data-aos="fade-up"
            data-aos-delay="200"
          >
            Drive the <span className="text-red-500">Electric City</span>
          </h1>
          <div
            className="inline-flex items-center gap-2 rounded-full border border-red-100 bg-white px-4 py-2 text-xs font-semibold text-gray-700 shadow-sm"
            data-aos="fade-up"
            data-aos-delay="250"
          >
            <span className="h-2 w-2 rounded-full bg-green-500" />
            <span>
              Live Fleet <span>&middot;</span>{" "}
              {isLoading ? "Loading vehicles" : `${onlineVehiclesCount} vehicles online`}
            </span>
          </div>
          {error && (
            <div
              className="max-w-[500px] rounded-lg border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-600 shadow-sm"
              data-aos="fade-up"
              data-aos-delay="275"
            >
              {error}
            </div>
          )}
          <p
            className="text-gray-600 text-sm md:text-base max-w-[500px]"
            data-aos="fade-up"
            data-aos-delay="300"
          >
            ElectroStreet puts Baku's electric fleet at your fingertips. Pick a car
            nearby, reserve it instantly, and hit the road - no paperwork, no daily
            fees, just pay by the minute.
          </p>

          <div className="flex gap-4" data-aos="fade-up" data-aos-delay="400">
            <button
              type="button"
              onClick={onReserveClick}
              className="bg-red-500 text-white px-6 py-2.5 rounded-md font-medium hover:bg-red-600 transition text-sm"
            >
              Reserve Car
            </button>
          </div>

          <div
            className="grid max-w-[520px] grid-cols-1 gap-3 sm:grid-cols-3"
            data-aos="fade-up"
            data-aos-delay="450"
          >
            <div className="flex items-center gap-3 rounded-lg bg-white/80 px-4 py-3 shadow-sm">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-red-500">
                <FaCar />
              </span>
              <div>
                <p className="text-lg font-bold text-gray-900">{onlineVehiclesCount}</p>
                <p className="text-xs font-medium text-gray-500">EVs Available</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-white/80 px-4 py-3 shadow-sm">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-red-500">
                <FaBolt />
              </span>
              <div>
                <p className="text-lg font-bold text-gray-900">{primaryPrice}</p>
                <p className="text-xs font-medium text-gray-500">Start rate</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-white/80 px-4 py-3 shadow-sm">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-red-500">
                <FaLocationDot />
              </span>
              <div>
                <p className="text-lg font-bold text-gray-900">Baku</p>
                <p className="text-xs font-medium text-gray-500">City</p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT SIDE - IMAGE */}
        <div className="flex-1" data-aos="zoom-in" data-aos-delay="300">
          <img src={img} alt="Mercedes Benz" className="w-full h-auto object-contain" />
          {availableVehicle && (
            <div className="mt-5 rounded-xl border border-red-100 bg-white p-5 shadow-lg shadow-red-100/60">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-red-500">
                    Featured EV
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-gray-900">
                    {availableVehicle.brand} {availableVehicle.model}
                  </h2>
                </div>
                <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-500">
                  Status: Available
                </span>
              </div>

              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 font-semibold text-gray-900">
                    <FaBatteryThreeQuarters className="text-red-500" />
                    Battery
                  </span>
                  <span className="font-bold text-red-500">
                    {availableVehicle.batteryPercent}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-red-50">
                  <div
                    className="h-full rounded-full bg-red-500"
                    style={{ width: `${availableVehicle.batteryPercent}%` }}
                  />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                <div className="flex items-center gap-3 rounded-lg bg-[#fef6f6] p-3">
                  <FaBolt className="text-red-500" />
                  <div>
                    <p className="text-gray-500">Range</p>
                    <p className="font-semibold text-gray-900">
                      {availableVehicle.rangeKm} km
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg bg-[#fef6f6] p-3">
                  <FaBolt className="text-red-500" />
                  <div>
                    <p className="text-gray-500">Price</p>
                    <p className="font-semibold text-gray-900">{primaryPrice}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg bg-[#fef6f6] p-3">
                  <FaLocationDot className="text-red-500" />
                  <div>
                    <p className="text-gray-500">Location</p>
                    <p className="font-semibold text-gray-900">
                      {availableVehicle.location.label}
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onFeaturedReserve?.(availableVehicle)}
                className="mt-5 w-full rounded-md bg-red-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-red-600"
              >
                Reserve
              </button>
              <p className="mt-3 text-center text-xs font-medium text-gray-500">
                Fully insured <span>&middot;</span> No deposit <span>&middot;</span>{" "}
                Cancel anytime
              </p>
            </div>
          )}
        </div>
      </div>

    </section>
  );
};

export default Hero;
