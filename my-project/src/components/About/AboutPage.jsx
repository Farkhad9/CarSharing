import { Fragment, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
import {
  FiArrowRight,
  FiBatteryCharging,
  FiCheckCircle,
  FiClock,
  FiCpu,
  FiMapPin,
  FiNavigation,
  FiShield,
  FiSliders,
  FiZap,
} from "react-icons/fi";
import { FaCar } from "react-icons/fa";
import headerImage from "../../assets/img/header-bg.png";
import UserComments from "../UserComments/UserComments";
import { VEHICLE_STATUSES } from "../../data/statuses";
import { useVehicles } from "../../hooks/useVehicles";

const operatingLayers = [
  {
    id: "fleet",
    icon: FiCpu,
    title: "Fleet intelligence",
    label: "Live balancing",
    text: "Every vehicle is monitored by battery, reservation state, parking zone, and demand pressure so the closest useful EV stays visible to riders.",
    details: ["Battery thresholds", "Demand heat", "Availability signals"],
  },
  {
    id: "charging",
    icon: FiBatteryCharging,
    title: "Charging rhythm",
    label: "Always ready",
    text: "Low-charge cars are moved into charging workflows before they become a rider problem, keeping trips short, clean, and predictable.",
    details: ["CCS2 network", "Priority queues", "Range forecasting"],
  },
  {
    id: "safety",
    icon: FiShield,
    title: "Trust layer",
    label: "Verified rides",
    text: "Documents, ride state, payment readiness, and support context are connected so each unlock has the right account, car, and insurance state.",
    details: ["Document checks", "Ride support", "Access control"],
  },
];

const timeline = [
  {
    year: "2024",
    title: "Pilot map",
    text: "ElectroStreet starts with dense city zones around the seaside, central streets, and business districts.",
  },
  {
    year: "2025",
    title: "Smarter reservations",
    text: "The product grows into timed reservations, walk routes, account verification, and live support inside the rider cabinet.",
  },
  {
    year: "Now",
    title: "Operational city layer",
    text: "Fleet, charging, pricing, and safety data work together so riders can choose, unlock, drive, and finish without friction.",
  },
];

const StatTile = ({ value, label, Icon, accent }) => (
  <motion.div
    whileHover={{ y: -5 }}
    className="rounded-2xl border border-white/15 bg-white/10 p-5 text-white shadow-2xl shadow-zinc-950/10 backdrop-blur-md"
  >
    <div className="flex items-center justify-between gap-4">
      <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${accent}`}>
        <Icon />
      </span>
      <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.85)]" />
    </div>
    <p className="mt-6 text-3xl font-black">{value}</p>
    <p className="mt-1 text-sm font-bold text-white/65">{label}</p>
  </motion.div>
);

const AboutPage = () => {
  const { vehicles, isLoading, error } = useVehicles();
  const [activeLayer, setActiveLayer] = useState(operatingLayers[0].id);
  const [spotlightIndex, setSpotlightIndex] = useState(0);
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.35], [0, 90]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.28], [1, 0.55]);

  const activeLayerData = operatingLayers.find((layer) => layer.id === activeLayer) || operatingLayers[0];
  const availableVehicles = vehicles.filter((vehicle) => vehicle.status === VEHICLE_STATUSES.AVAILABLE).length;
  const averageBattery = Math.round(
    vehicles.reduce((total, vehicle) => total + Number(vehicle.batteryPercent || 0), 0) / Math.max(vehicles.length, 1)
  );
  const spotlightVehicle = vehicles[spotlightIndex % Math.max(vehicles.length, 1)];

  const cityZones = useMemo(
    () => [...new Set(vehicles.map((vehicle) => vehicle.location?.zone).filter(Boolean))],
    [vehicles]
  );

  useEffect(() => {
    if (!vehicles.length) return undefined;

    const intervalId = window.setInterval(() => {
      setSpotlightIndex((current) => (current + 1) % vehicles.length);
    }, 3200);

    return () => window.clearInterval(intervalId);
  }, [vehicles.length]);

  if (isLoading || error || !spotlightVehicle) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-5 text-zinc-950">
        <section className="w-full max-w-xl rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-red-500">ElectroStreet About</p>
          <h1 className="mt-4 text-3xl font-black">
            {isLoading ? "Loading live fleet..." : "Fleet data unavailable"}
          </h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-zinc-500">
            {isLoading ? "Please wait while the backend fleet is loaded." : error || "No vehicles available from backend."}
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="bg-white text-zinc-950">
      <section className="relative min-h-[84vh] overflow-hidden bg-zinc-950">
        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_24%,rgba(239,68,68,0.28),transparent_28%),radial-gradient(circle_at_82%_78%,rgba(14,165,233,0.22),transparent_24%),linear-gradient(135deg,#09090b_0%,#18181b_46%,#27272a_100%)]" />
          <div className="absolute inset-0 opacity-[0.14] [background-image:linear-gradient(rgba(255,255,255,0.38)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.38)_1px,transparent_1px)] [background-size:72px_72px]" />
          <div className="absolute right-[-12%] top-14 hidden h-[650px] w-[650px] rounded-full border border-white/10 lg:block" />
          <div className="absolute right-[3%] top-28 hidden h-[430px] w-[430px] rounded-full border border-red-400/20 lg:block" />
          <div className="absolute right-[12%] top-44 hidden h-[230px] w-[230px] rounded-full border border-sky-300/15 lg:block" />
          <div className="absolute right-[8%] top-24 hidden w-[520px] lg:block">
            <div className="relative h-[470px]">
              {vehicles.slice(0, 6).map((vehicle, index) => {
                const positions = [
                  "left-[10%] top-[18%]",
                  "left-[54%] top-[9%]",
                  "left-[72%] top-[41%]",
                  "left-[36%] top-[58%]",
                  "left-[6%] top-[72%]",
                  "left-[58%] top-[78%]",
                ];

                return (
                  <motion.div
                    key={vehicle.id}
                    className={`absolute ${positions[index]} h-4 w-4 rounded-full border-2 border-white bg-red-500 shadow-[0_0_28px_rgba(239,68,68,0.85)]`}
                    animate={{ scale: [1, 1.35, 1], opacity: [0.75, 1, 0.75] }}
                    transition={{ duration: 2.4, repeat: Infinity, delay: index * 0.22 }}
                  >
                    <span className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-red-300/20" />
                  </motion.div>
                );
              })}
              <svg className="absolute inset-0 h-full w-full" viewBox="0 0 520 470" aria-hidden="true">
                <path d="M68 86 C158 42 232 46 296 72 S405 156 420 205 S368 309 270 282 S98 300 44 348" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="2" strokeDasharray="8 12" />
                <path d="M282 54 C270 144 334 184 402 198 S458 318 350 368 S183 390 68 348" fill="none" stroke="rgba(239,68,68,0.35)" strokeWidth="2" />
                <path d="M58 344 C126 280 176 250 260 274 S392 250 425 196" fill="none" stroke="rgba(14,165,233,0.28)" strokeWidth="2" />
              </svg>
              <motion.div
                className="absolute right-6 top-32 rounded-2xl border border-white/15 bg-white/10 p-4 text-white shadow-2xl backdrop-blur-md"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              >
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/50">Live ops</p>
                <p className="mt-2 text-2xl font-black">{averageBattery}%</p>
                <p className="text-xs font-bold text-white/60">fleet charge</p>
              </motion.div>
              <motion.div
                className="absolute bottom-12 left-12 rounded-2xl border border-white/15 bg-white/10 p-4 text-white shadow-2xl backdrop-blur-md"
                animate={{ y: [0, 12, 0] }}
                transition={{ duration: 4.6, repeat: Infinity, ease: "easeInOut" }}
              >
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/50">Zones</p>
                <p className="mt-2 text-2xl font-black">{cityZones.length}</p>
                <p className="text-xs font-bold text-white/60">active districts</p>
              </motion.div>
            </div>
          </div>
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(9,9,11,0.95),rgba(9,9,11,0.68),rgba(9,9,11,0.1))]" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(0deg,#ffffff,rgba(255,255,255,0))]" />
        </motion.div>

        <div className="container relative z-10 flex min-h-[84vh] flex-col justify-center py-20">
          <motion.div
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="max-w-4xl"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white backdrop-blur-md">
              <FiZap className="text-red-300" />
              ElectroStreet About
            </span>
            <h1 className="mt-8 max-w-3xl text-5xl font-black leading-[1.02] text-white sm:text-6xl lg:text-7xl">
              Electric mobility built for the rhythm of Baku.
            </h1>
            <p className="mt-7 max-w-2xl text-lg font-semibold leading-8 text-white/72">
              We combine EV sharing, live fleet intelligence, charging operations, and instant support into one city-scale mobility service.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a
                href="/#fleet"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-red-500 px-6 py-4 text-sm font-black text-white shadow-xl shadow-red-950/20 transition hover:bg-red-600"
              >
                Explore fleet
                <FiArrowRight />
              </a>
              <a
                href="/charging"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 px-6 py-4 text-sm font-black text-white backdrop-blur-md transition hover:bg-white hover:text-zinc-950"
              >
                Charging network
                <FiBatteryCharging />
              </a>
            </div>
          </motion.div>

          <div className="mt-14 grid gap-4 sm:grid-cols-3">
            <StatTile value={`${vehicles.length} EVs`} label="connected to the city map" Icon={FaCar} accent="bg-red-500" />
            <StatTile value={`${averageBattery}%`} label="average fleet battery" Icon={FiBatteryCharging} accent="bg-emerald-500" />
            <StatTile value={`${availableVehicles}`} label="ready to reserve now" Icon={FiCheckCircle} accent="bg-sky-500" />
          </div>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="container grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-red-500">How it works</p>
            <h2 className="mt-4 text-4xl font-black leading-tight text-zinc-950 sm:text-5xl">
              Behind every unlock is a live operating system.
            </h2>
            <p className="mt-5 max-w-xl text-base font-semibold leading-7 text-zinc-500">
              The About page is not just a story. It shows the moving parts that make the service reliable: cars, chargers, people, payments, and safety checks.
            </p>

            <div className="mt-8 grid gap-3">
              {operatingLayers.map((layer) => {
                const Icon = layer.icon;
                const isActive = activeLayer === layer.id;

                return (
                  <Fragment key={layer.id}>
                  <button
                    type="button"
                    onClick={() => setActiveLayer(layer.id)}
                    className={`flex items-center justify-between gap-4 rounded-2xl border p-4 text-left transition ${
                      isActive
                        ? "border-red-200 bg-red-50 text-red-700 shadow-lg shadow-red-950/5"
                        : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-4">
                      <span className={`flex h-12 w-12 items-center justify-center rounded-xl ${isActive ? "bg-red-500 text-white" : "bg-zinc-100 text-zinc-500"}`}>
                        <Icon />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-base font-black">{layer.title}</span>
                        <span className="block text-sm font-bold opacity-65">{layer.label}</span>
                      </span>
                    </span>
                    <FiArrowRight className={isActive ? "text-red-500" : "text-zinc-300"} />
                  </button>
                  <AnimatePresence>
                    {isActive && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, y: -8 }}
                        animate={{ opacity: 1, height: "auto", y: 0 }}
                        exit={{ opacity: 0, height: 0, y: -8 }}
                        transition={{ duration: 0.24 }}
                        className="overflow-hidden rounded-2xl border border-red-100 bg-white px-5 py-4 text-sm font-semibold leading-6 text-zinc-500 shadow-sm"
                      >
                        <p>{layer.text}</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {layer.details.map((detail) => (
                            <span key={detail} className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-600">
                              {detail}
                            </span>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  </Fragment>
                );
              })}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-3xl bg-zinc-950 p-5 text-white shadow-2xl shadow-zinc-950/15">
            <img src={headerImage} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20" />
            <div className="relative">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeLayerData.id}
                  initial={{ opacity: 0, x: 22 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -22 }}
                  transition={{ duration: 0.28 }}
                  className="rounded-2xl border border-white/10 bg-white/10 p-6 backdrop-blur-md"
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-zinc-950">
                      {activeLayerData.label}
                    </span>
                    <activeLayerData.icon className="text-3xl text-red-300" />
                  </div>
                  <h3 className="mt-16 text-4xl font-black leading-tight">{activeLayerData.title}</h3>
                  <p className="mt-5 text-base font-semibold leading-7 text-white/65">{activeLayerData.text}</p>
                  <div className="mt-8 grid gap-3 sm:grid-cols-3">
                    {activeLayerData.details.map((detail) => (
                      <span key={detail} className="rounded-2xl border border-white/10 bg-zinc-950/45 px-4 py-4 text-sm font-black text-white/80">
                        {detail}
                      </span>
                    ))}
                  </div>
                </motion.div>
              </AnimatePresence>

              <div className="mt-5 grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
                <div className="rounded-2xl border border-white/10 bg-white p-5 text-zinc-950">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">Spotlight EV</p>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={spotlightVehicle.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -15 }}
                      transition={{ duration: 0.24 }}
                    >
                      <img src={spotlightVehicle.image} alt={`${spotlightVehicle.brand} ${spotlightVehicle.model}`} className="mt-4 h-28 w-full object-contain" />
                      <p className="mt-4 text-xl font-black">
                        {spotlightVehicle.brand} {spotlightVehicle.model || "Executive"}
                      </p>
                      <div className="mt-3 flex items-center justify-between gap-3 text-sm font-bold text-zinc-500">
                        <span>{spotlightVehicle.batteryPercent}% battery</span>
                        <span>{spotlightVehicle.rangeKm} km</span>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur-md">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-white/45">City zones</p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    {cityZones.map((zone, index) => (
                      <span
                        key={zone}
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-black text-white"
                      >
                        <span className={`h-2 w-2 rounded-full ${index % 3 === 0 ? "bg-red-400" : index % 3 === 1 ? "bg-emerald-400" : "bg-sky-400"}`} />
                        {zone}
                      </span>
                    ))}
                  </div>
                  <div className="mt-6 rounded-2xl bg-zinc-950/55 p-4">
                    <div className="flex items-center gap-3">
                      <FiNavigation className="text-xl text-red-300" />
                      <p className="text-sm font-bold text-white/75">Fleet placement adapts to rider demand around offices, leisure districts, and transit-heavy streets.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-zinc-50 py-20">
        <div className="container">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-red-500">Our path</p>
              <h2 className="mt-4 text-4xl font-black leading-tight text-zinc-950 sm:text-5xl">From car sharing to city infrastructure.</h2>
            </div>
            <div className="flex items-center gap-3 rounded-full border border-zinc-200 bg-white px-4 py-3 text-sm font-black text-zinc-600">
              <FiClock className="text-red-500" />
              Built for daily use, not occasional demos
            </div>
          </div>

          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {timeline.map((item, index) => (
              <motion.article
                key={item.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ delay: index * 0.08, duration: 0.45 }}
                className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
              >
                <span className="absolute right-5 top-5 text-6xl font-black leading-none text-zinc-100">{index + 1}</span>
                <p className="relative text-sm font-black uppercase tracking-[0.16em] text-red-500">{item.year}</p>
                <h3 className="relative mt-8 text-2xl font-black text-zinc-950">{item.title}</h3>
                <p className="relative mt-4 text-sm font-semibold leading-7 text-zinc-500">{item.text}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <UserComments />

      <section className="bg-white py-20">
        <div className="container grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-red-500">What we optimize</p>
            <h2 className="mt-4 text-4xl font-black leading-tight text-zinc-950">Less waiting. Cleaner rides. Better control.</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { icon: FiMapPin, title: "Closer cars", text: "Vehicles are positioned near rider demand and recognizable city anchors." },
              { icon: FiSliders, title: "Clear pricing", text: "Per-minute rates keep trips understandable before the first unlock." },
              { icon: FiShield, title: "Safer access", text: "Verification, support, and trip state stay connected throughout the ride." },
            ].map(({ icon: Icon, title, text }) => (
              <motion.div key={title} whileHover={{ y: -4 }} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-xl text-red-500 shadow-sm">
                  <Icon />
                </span>
                <h3 className="mt-8 text-xl font-black text-zinc-950">{title}</h3>
                <p className="mt-3 text-sm font-semibold leading-6 text-zinc-500">{text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
};

export default AboutPage;
