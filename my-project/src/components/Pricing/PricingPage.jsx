import { useMemo, useState } from "react";
import {
  FiArrowRight,
  FiBatteryCharging,
  FiCheckCircle,
  FiClock,
  FiCreditCard,
  FiMapPin,
  FiShield,
  FiSliders,
  FiUserCheck,
  FiZap,
} from "react-icons/fi";
import { VEHICLE_STATUSES } from "../../data/statuses";
import { useVehicles } from "../../hooks/useVehicles";

const billingRules = [
  {
    title: "Pay per minute",
    detail: "The paid ride starts when car access is activated and stops when you finish the trip in the cabinet.",
    icon: FiClock,
  },
  {
    title: "15 min reservation",
    detail: "A confirmed car stays in your cabinet while you walk to it. Billing is based on ride minutes.",
    icon: FiUserCheck,
  },
  {
    title: "Charging included",
    detail: "Battery status is visible before booking. Cars that need charging are marked in the fleet.",
    icon: FiBatteryCharging,
  },
];

const serviceNotes = [
  "Per-minute ride pricing",
  "15 minute reservation window",
  "No daily rental plan",
  "No team tariff",
];

const formatMoney = (value) => `${Number(value || 0).toFixed(2)} AZN`;

const PricingPage = ({ user, onVehicleSelect }) => {
  const { vehicles, isLoading, error } = useVehicles();
  const bookableVehicles = useMemo(
    () => vehicles.filter((vehicle) => vehicle.status === VEHICLE_STATUSES.AVAILABLE),
    [vehicles]
  );
  const selectableVehicles = bookableVehicles.length ? bookableVehicles : vehicles;
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [minutes, setMinutes] = useState(25);
  const [comfortMode, setComfortMode] = useState(false);

  const selectedVehicle = useMemo(
    () => selectableVehicles.find((vehicle) => vehicle.id === selectedVehicleId) || selectableVehicles[0],
    [selectableVehicles, selectedVehicleId]
  );
  const baseRate = Number(selectedVehicle?.pricePerMinute || 0);
  const finalRate = Number((baseRate + (comfortMode ? 0.05 : 0)).toFixed(2));
  const estimate = Number((finalRate * minutes).toFixed(2));
  const cabinetHref = user ? "/dashboard" : "/auth";
  const cabinetLabel = user ? "Payment cabinet" : "Create account";
  const averageBattery = bookableVehicles.length
    ? Math.round(
        bookableVehicles.reduce((total, vehicle) => total + Number(vehicle.batteryPercent || 0), 0) /
          bookableVehicles.length
      )
    : 0;
  const readinessItems = [
    {
      label: "Insurance",
      value: "Included",
      icon: FiShield,
      tone: "text-emerald-400",
    },
    {
      label: "Payment",
      value: user ? "Cabinet ready" : "Registration first",
      icon: FiCreditCard,
      tone: user ? "text-emerald-400" : "text-amber-300",
    },
    {
      label: "Charging",
      value: `${averageBattery}% average`,
      icon: FiBatteryCharging,
      tone: "text-red-300",
    },
  ];

  const handleReserve = (vehicle = selectedVehicle) => {
    if (!vehicle) return;

    if (!user) {
      window.location.href = "/auth";
      return;
    }

    onVehicleSelect?.(vehicle);
  };

  if (isLoading || error || !selectedVehicle) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f6f8] px-5 text-zinc-950">
        <section className="w-full max-w-xl rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-red-500">ElectroStreet pricing</p>
          <h1 className="mt-4 text-3xl font-black">
            {isLoading ? "Loading live vehicle rates..." : "Vehicle rates unavailable"}
          </h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-zinc-500">
            {isLoading ? "Please wait while the backend fleet is loaded." : error || "No vehicles available from backend."}
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f6f8] text-zinc-950">
      <section className="relative overflow-hidden bg-zinc-950 text-white">
        <div className="absolute inset-x-0 top-0 h-px bg-white/10" />
        <div className="container grid gap-10 py-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:py-16">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-red-300">ElectroStreet pricing</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
              Choose an EV, see the minute rate, start the ride.
            </h1>
            <p className="mt-5 max-w-2xl text-base font-semibold leading-7 text-white/60 sm:text-lg">
              Pricing now follows the real project flow: every car has its own per-minute rate, reservation is limited
              to the cabinet flow, and the final cost depends on actual ride time.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => handleReserve()}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-red-500 px-6 py-3 text-sm font-black text-white shadow-lg shadow-red-500/25 transition hover:-translate-y-0.5 hover:bg-red-600"
              >
                <FiZap />
                Reserve selected EV
              </button>
              <a
                href={cabinetHref}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-white/15 bg-white px-6 py-3 text-sm font-black text-zinc-950 transition hover:-translate-y-0.5 hover:bg-zinc-100"
              >
                <FiCreditCard />
                {cabinetLabel}
              </a>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {serviceNotes.map((note) => (
                <div key={note} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <FiCheckCircle className="shrink-0 text-red-300" />
                  <span className="text-sm font-bold text-white/75">{note}</span>
                </div>
              ))}
            </div>
          </div>

          <section className="overflow-hidden rounded-2xl border border-white/10 bg-white text-zinc-950 shadow-2xl shadow-black/30">
            <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="flex min-h-[320px] flex-col justify-between bg-[linear-gradient(180deg,#fafafa,#eef1f5)] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-red-500">Selected EV</p>
                    <h2 className="mt-2 text-3xl font-black">
                      {selectedVehicle.brand} {selectedVehicle.model || "EV"}
                    </h2>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase text-emerald-700">
                    {selectedVehicle.status}
                  </span>
                </div>
                <img
                  src={selectedVehicle.image}
                  alt={`${selectedVehicle.brand} ${selectedVehicle.model}`}
                  className="mx-auto mt-4 aspect-[16/9] w-full max-w-md object-contain"
                />
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-white p-3 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-wide text-zinc-400">Rate</p>
                    <p className="mt-1 text-sm font-black">{formatMoney(baseRate)}/min</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-wide text-zinc-400">Battery</p>
                    <p className="mt-1 text-sm font-black">{selectedVehicle.batteryPercent}%</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-wide text-zinc-400">Range</p>
                    <p className="mt-1 text-sm font-black">{selectedVehicle.rangeKm} km</p>
                  </div>
                </div>
              </div>

              <div className="p-5 sm:p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Ride calculator</p>
                    <h3 className="mt-2 text-2xl font-black">Estimate by minutes</h3>
                  </div>
                  <FiSliders className="text-2xl text-red-500" />
                </div>

                <label htmlFor="vehicle" className="mt-6 block text-sm font-black text-zinc-700">
                  Vehicle
                </label>
                <select
                  id="vehicle"
                  value={selectedVehicle.id}
                  onChange={(event) => setSelectedVehicleId(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-bold outline-none transition focus:border-red-400 focus:bg-white"
                >
                  {selectableVehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.brand} {vehicle.model || "EV"} - {formatMoney(vehicle.pricePerMinute)}/min
                    </option>
                  ))}
                </select>

                <div className="mt-6">
                  <div className="flex items-center justify-between gap-4">
                    <label htmlFor="minutes" className="text-sm font-black text-zinc-700">
                      Ride duration
                    </label>
                    <span className="rounded-full bg-zinc-950 px-3 py-1 text-sm font-black text-white">{minutes} min</span>
                  </div>
                  <input
                    id="minutes"
                    type="range"
                    min="5"
                    max="120"
                    step="5"
                    value={minutes}
                    onChange={(event) => setMinutes(Number(event.target.value))}
                    className="mt-4 w-full accent-red-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setComfortMode((value) => !value)}
                  className={`mt-6 flex w-full items-center justify-between rounded-xl border p-4 text-left transition ${
                    comfortMode ? "border-red-200 bg-red-50" : "border-zinc-200 bg-zinc-50 hover:border-zinc-300"
                  }`}
                >
                  <span>
                    <span className="block text-sm font-black">Comfort climate mode</span>
                    <span className="mt-1 block text-xs font-semibold text-zinc-500">
                      Optional +0.05 AZN/min, same logic as reservation settings.
                    </span>
                  </span>
                  <span className={`h-6 w-11 rounded-full p-1 transition ${comfortMode ? "bg-red-500" : "bg-zinc-300"}`}>
                    <span className={`block h-4 w-4 rounded-full bg-white transition ${comfortMode ? "translate-x-5" : ""}`} />
                  </span>
                </button>

                <div className="mt-6 rounded-xl bg-zinc-950 p-5 text-white">
                  <div className="flex justify-between text-sm font-bold text-white/55">
                    <span>Final rate</span>
                    <span>{formatMoney(finalRate)}/min</span>
                  </div>
                  <div className="mt-3 flex justify-between text-sm font-bold text-white/55">
                    <span>Estimated ride</span>
                    <span>{minutes} min</span>
                  </div>
                  <div className="mt-4 border-t border-white/10 pt-4">
                    <div className="flex items-end justify-between gap-4">
                      <span className="text-xs font-black uppercase tracking-wide text-red-300">Total estimate</span>
                      <span className="text-4xl font-black">{formatMoney(estimate)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </section>

      <section className="container py-12 lg:py-16">
        <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-red-500">How billing works</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Simple rules, visible before booking.</h2>
          </div>
          <a href="/#fleet" className="inline-flex items-center gap-2 text-sm font-black text-red-500 hover:text-red-600">
            View full fleet <FiArrowRight />
          </a>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {billingRules.map((rule) => {
            const Icon = rule.icon;

            return (
              <article key={rule.title} className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-2xl text-red-500">
                  <Icon />
                </span>
                <h3 className="mt-6 text-xl font-black">{rule.title}</h3>
                <p className="mt-3 text-sm font-semibold leading-6 text-zinc-600">{rule.detail}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="border-y border-zinc-200 bg-white">
        <div className="container py-12 lg:py-16">
          <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-red-500">Live rates</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Available cars and minute prices.</h2>
            </div>
            <span className="rounded-full bg-zinc-100 px-4 py-2 text-sm font-black text-zinc-600">
              {bookableVehicles.length} EVs ready
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {bookableVehicles.map((vehicle) => {
              return (
                <article
                  key={vehicle.id}
                  className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
                >
                  <div className="bg-[linear-gradient(180deg,#f8fafc,#eef2f7)] p-4">
                    <img
                      src={vehicle.image}
                      alt={`${vehicle.brand} ${vehicle.model}`}
                      className="aspect-[16/9] w-full object-contain"
                    />
                  </div>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-xl font-black">
                          {vehicle.brand} {vehicle.model || "EV"}
                        </h3>
                        <p className="mt-1 flex items-center gap-1 text-xs font-bold text-zinc-400">
                          <FiMapPin /> {vehicle.location.label}
                        </p>
                      </div>
                      <span
                        className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase text-emerald-700"
                      >
                        {vehicle.status}
                      </span>
                    </div>

                    <div className="mt-5 grid grid-cols-3 gap-2">
                      <div className="rounded-xl bg-zinc-50 p-3">
                        <p className="text-[10px] font-black uppercase text-zinc-400">Price</p>
                        <p className="mt-1 text-sm font-black">{formatMoney(vehicle.pricePerMinute)}</p>
                      </div>
                      <div className="rounded-xl bg-zinc-50 p-3">
                        <p className="text-[10px] font-black uppercase text-zinc-400">Battery</p>
                        <p className="mt-1 text-sm font-black">{vehicle.batteryPercent}%</p>
                      </div>
                      <div className="rounded-xl bg-zinc-50 p-3">
                        <p className="text-[10px] font-black uppercase text-zinc-400">Seats</p>
                        <p className="mt-1 text-sm font-black">{vehicle.seats}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleReserve(vehicle)}
                      className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-zinc-950 px-5 py-3 text-sm font-black text-white transition hover:bg-red-500"
                    >
                      Reserve this EV
                      <FiArrowRight />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="container py-12">
        <div className="overflow-hidden rounded-2xl border border-zinc-900 bg-zinc-950 text-white shadow-2xl shadow-zinc-950/10">
          <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="border-b border-white/10 p-6 lg:border-b-0 lg:border-r lg:p-8">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-red-300">Trip readiness</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Ready before you reserve.</h2>
              <p className="mt-4 max-w-xl text-sm font-semibold leading-6 text-white/55">
                Pricing shows only cars that can be reserved now. Account, coverage, and charging status stay visible
                before the rider moves to the cabinet.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => handleReserve()}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-red-500 px-5 py-3 text-sm font-black text-white transition hover:bg-red-600"
                >
                  Reserve selected EV
                  <FiArrowRight />
                </button>
                <a
                  href={cabinetHref}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-black text-zinc-950 transition hover:bg-zinc-100"
                >
                  {cabinetLabel}
                </a>
              </div>
            </div>

            <div className="grid gap-0 sm:grid-cols-3">
              {readinessItems.map((item) => {
                const Icon = item.icon;

                return (
                  <div key={item.label} className="border-b border-white/10 p-6 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 lg:p-8">
                    <Icon className={`text-3xl ${item.tone}`} />
                    <p className="mt-8 text-xs font-black uppercase tracking-[0.2em] text-white/35">{item.label}</p>
                    <p className="mt-2 text-2xl font-black">{item.value}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default PricingPage;
