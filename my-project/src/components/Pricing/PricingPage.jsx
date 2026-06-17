import { useMemo, useState } from "react";
import {
  FiBatteryCharging,
  FiCheck,
  FiClock,
  FiCreditCard,
  FiMapPin,
  FiShield,
  FiZap,
} from "react-icons/fi";

const plans = [
  {
    name: "City",
    price: "0.42",
    unit: "AZN / min",
    description: "Short trips across central Baku with simple minute billing.",
    highlight: false,
    features: ["Unlock included", "Public parking zones", "Battery above 20%", "In-app support"],
  },
  {
    name: "Daily",
    price: "69",
    unit: "AZN / day",
    description: "Keep one EV for errands, meetings, and evening plans.",
    highlight: true,
    features: ["24 hour access", "180 km included", "Priority reservations", "Reduced minute overage"],
  },
  {
    name: "Business",
    price: "Custom",
    unit: "team plan",
    description: "Shared balance, monthly reporting, and fleet access for teams.",
    highlight: false,
    features: ["Team dashboard", "Monthly invoice", "Role based access", "Dedicated support"],
  },
];

const extras = [
  { label: "Reservation hold", value: "Free for 15 min", icon: FiClock },
  { label: "Charging", value: "Included", icon: FiBatteryCharging },
  { label: "Insurance", value: "Included", icon: FiShield },
  { label: "Service zone", value: "Baku city", icon: FiMapPin },
];

const minuteRate = 0.42;
const unlockFee = 1.5;
const airportFee = 7;

const PricingPage = () => {
  const [minutes, setMinutes] = useState(35);
  const [airport, setAirport] = useState(false);

  const estimate = useMemo(() => {
    const ride = minutes * minuteRate;
    const total = ride + unlockFee + (airport ? airportFee : 0);

    return {
      ride: ride.toFixed(2),
      total: total.toFixed(2),
    };
  }, [airport, minutes]);

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-zinc-950">
      <section className="border-b border-zinc-200 bg-white">
        <div className="container grid gap-10 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-20">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-red-500">Pricing</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
              Transparent EV sharing rates for every Baku trip.
            </h1>
            <p className="mt-5 max-w-2xl text-base font-semibold leading-7 text-zinc-600 sm:text-lg">
              Pay by the minute for quick rides, switch to a daily cap for longer plans, or give your team one shared
              electric mobility account.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="/#fleet"
                className="inline-flex items-center justify-center gap-2 rounded-md bg-red-500 px-6 py-3 text-sm font-black text-white shadow-lg shadow-red-500/20 transition hover:-translate-y-0.5 hover:bg-red-600"
              >
                <FiZap />
                Choose an EV
              </a>
              <a
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 rounded-md border border-zinc-200 bg-white px-6 py-3 text-sm font-black text-zinc-800 transition hover:border-red-200 hover:text-red-500"
              >
                <FiCreditCard />
                Payment cabinet
              </a>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-zinc-950 p-5 text-white shadow-2xl shadow-zinc-950/10 sm:p-7">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-red-300">Cost estimate</p>
                <h2 className="mt-2 text-2xl font-black">Trip calculator</h2>
              </div>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black">AZN</span>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between gap-4">
                <label htmlFor="minutes" className="text-sm font-black">
                  Ride duration
                </label>
                <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-zinc-950">{minutes} min</span>
              </div>
              <input
                id="minutes"
                type="range"
                min="10"
                max="180"
                step="5"
                value={minutes}
                onChange={(event) => setMinutes(Number(event.target.value))}
                className="mt-4 w-full accent-red-500"
              />
            </div>

            <button
              type="button"
              onClick={() => setAirport((value) => !value)}
              className={`mt-6 flex w-full items-center justify-between rounded-xl border p-4 text-left transition ${
                airport ? "border-red-400 bg-red-500/15" : "border-white/10 bg-white/5 hover:bg-white/10"
              }`}
            >
              <span>
                <span className="block text-sm font-black">Airport zone</span>
                <span className="mt-1 block text-xs font-semibold text-white/55">Add airport pickup or drop-off fee</span>
              </span>
              <span className={`h-6 w-11 rounded-full p-1 transition ${airport ? "bg-red-500" : "bg-white/20"}`}>
                <span className={`block h-4 w-4 rounded-full bg-white transition ${airport ? "translate-x-5" : ""}`} />
              </span>
            </button>

            <div className="mt-6 space-y-3 rounded-xl bg-white p-4 text-zinc-950">
              <div className="flex justify-between text-sm font-bold text-zinc-500">
                <span>Ride</span>
                <span>{estimate.ride} AZN</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-zinc-500">
                <span>Unlock</span>
                <span>{unlockFee.toFixed(2)} AZN</span>
              </div>
              {airport && (
                <div className="flex justify-between text-sm font-bold text-zinc-500">
                  <span>Airport zone</span>
                  <span>{airportFee.toFixed(2)} AZN</span>
                </div>
              )}
              <div className="border-t border-zinc-100 pt-3">
                <div className="flex items-end justify-between gap-4">
                  <span className="text-sm font-black uppercase tracking-wide text-zinc-400">Estimated total</span>
                  <span className="text-3xl font-black">{estimate.total} AZN</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container py-12 lg:py-16">
        <div className="grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={`rounded-2xl border p-6 shadow-sm ${
                plan.highlight
                  ? "border-red-200 bg-white shadow-red-500/10"
                  : "border-zinc-200 bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.18em] text-red-500">{plan.name}</p>
                  <p className="mt-4 text-4xl font-black tracking-tight">{plan.price}</p>
                  <p className="mt-1 text-sm font-bold text-zinc-400">{plan.unit}</p>
                </div>
                {plan.highlight && (
                  <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black uppercase text-red-600">
                    Popular
                  </span>
                )}
              </div>
              <p className="mt-5 min-h-14 text-sm font-semibold leading-6 text-zinc-600">{plan.description}</p>
              <ul className="mt-6 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3 text-sm font-bold text-zinc-700">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-50 text-red-500">
                      <FiCheck />
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-zinc-200 bg-white">
        <div className="container py-12">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {extras.map((item) => {
              const Icon = item.icon;

              return (
                <div key={item.label} className="rounded-2xl border border-zinc-100 bg-zinc-50 p-5">
                  <Icon className="text-2xl text-red-500" />
                  <p className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-zinc-400">{item.label}</p>
                  <p className="mt-2 text-xl font-black">{item.value}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
};

export default PricingPage;
