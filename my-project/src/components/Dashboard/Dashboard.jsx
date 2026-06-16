import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  FiActivity,
  FiAlertCircle,
  FiArrowLeft,
  FiCheckCircle,
  FiClock,
  FiCreditCard,
  FiDollarSign,
  FiFileText,
  FiHeadphones,
  FiLock,
  FiMail,
  FiMapPin,
  FiMessageSquare,
  FiNavigation,
  FiPlus,
  FiSend,
  FiShield,
  FiSmartphone,
  FiTrash2,
  FiUploadCloud,
  FiUserCheck,
  FiX,
  FiZap,
} from "react-icons/fi";
import { FaCar } from "react-icons/fa";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { vehicles } from "../../data/vehicles";
import { trips } from "../../data/trips";

const RESERVATION_SECONDS = 15 * 60;
const MAX_ACTIVE_RESERVATIONS = 2;
const DEFAULT_USER_LOCATION = [40.3772, 49.8475];

const defaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const userIcon = L.divIcon({
  className: "dashboard-user-marker",
  html: '<span style="display:block;width:18px;height:18px;border-radius:9999px;background:#ef4444;border:3px solid white;box-shadow:0 4px 12px rgba(239,68,68,0.35);"></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

L.Marker.prototype.options.icon = defaultIcon;

const tabs = [
  { id: "trip", label: "Trip", icon: FiActivity },
  { id: "payments", label: "Payments", icon: FiCreditCard },
  { id: "documents", label: "Documents", icon: FiFileText },
  { id: "security", label: "Security", icon: FiLock },
  { id: "support", label: "Support", icon: FiHeadphones },
];

const panelMotion = {
  initial: { opacity: 0, y: 18, scale: 0.99 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -12, scale: 0.99 },
  transition: { duration: 0.28, ease: "easeOut" },
};

const supportQuickActions = [
  {
    id: "unlock",
    title: "Car will not unlock",
    draft: "I am next to the car and I need help unlocking it.",
  },
  {
    id: "billing",
    title: "Payment question",
    draft: "I need help with a charge, hold, or trip price.",
  },
  {
    id: "vehicle",
    title: "Problem with the car",
    draft: "I found a problem with the car and want support to check it.",
  },
];

const getStoredJson = (key, fallback = null) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const formatTimer = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
};

const formatDuration = (seconds) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const rest = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${rest.toString().padStart(2, "0")}`;
  }

  return `${minutes}:${rest.toString().padStart(2, "0")}`;
};

const formatMoney = (amount) => `${Number(amount || 0).toFixed(2)} AZN`;

const formatSupportTime = (value) =>
  new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

const createSupportMessage = (body, sender = "user", author = "You") => ({
  id: `support-message-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
  body,
  sender,
  author,
  createdAt: new Date().toISOString(),
});

const getSupportReply = (text) => {
  const normalizedText = text.toLowerCase();

  if (normalizedText.includes("unlock") || normalizedText.includes("door")) {
    return "We can see your unlock request. Please try the unlock action again in the cabinet. If it still fails, an operator can remotely open the car.";
  }

  if (normalizedText.includes("battery") || normalizedText.includes("charge")) {
    return "We are checking the battery status and nearby charging options. Support can also suggest the closest available EV.";
  }

  if (normalizedText.includes("charge") || normalizedText.includes("hold") || normalizedText.includes("price")) {
    return "Your billing request was forwarded. We will answer in this chat after checking the payment details.";
  }

  return "Your message was received. A support operator will continue the conversation in this chat.";
};

const getReservationVehicle = (reservation) => {
  if (!reservation) return null;

  const vehicle = vehicles.find((item) => item.id === reservation.vehicleId);
  return {
    ...vehicle,
    ...reservation,
    brand: reservation.brand || vehicle?.brand || "Tesla",
    model: reservation.model || vehicle?.model || "Model 3",
    image: reservation.image || vehicle?.image,
    plateNumber: reservation.plateNumber || vehicle?.plateNumber || "99-AA-000",
    location: reservation.location || vehicle?.location,
  };
};

const getStoredReservations = () => {
  const storedReservations = getStoredJson("reservedVehicles");

  if (Array.isArray(storedReservations)) {
    return storedReservations;
  }

  const legacyReservation = getStoredJson("reservedVehicle");
  return legacyReservation ? [legacyReservation] : [];
};

const getVehiclePosition = (vehicle) => [
  vehicle?.location?.lat || DEFAULT_USER_LOCATION[0],
  vehicle?.location?.lng || DEFAULT_USER_LOCATION[1],
];

const getWalkingRouteUrl = ([fromLat, fromLng], [toLat, toLng]) =>
  `https://router.project-osrm.org/route/v1/foot/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson&steps=false`;

const ReservationMapBounds = ({ points }) => {
  const map = useMap();

  useEffect(() => {
    if (!points?.length) return;

    const validPoints = points.filter(
      (point) => Array.isArray(point) && point.length === 2 && Number.isFinite(point[0]) && Number.isFinite(point[1])
    );

    if (validPoints.length === 1) {
      map.setView(validPoints[0], 14);
      return;
    }

    map.fitBounds(validPoints, {
      padding: [36, 36],
      maxZoom: 15,
    });
  }, [map, points]);

  return null;
};

const Dashboard = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState("trip");
  const [user, setUser] = useState(() =>
    getStoredJson("electroStreetUser", {
      name: "Farhad",
      email: "farhad@electrostreet.az",
      balance: 0,
      avatarInitial: "F",
      emailVerified: true,
    })
  );
  const [reservations, setReservations] = useState(() => getStoredReservations());
  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("50");
  const [cardForm, setCardForm] = useState({ number: "", holder: user.name || "Farhad" });
  const [paymentCards, setPaymentCards] = useState(() =>
    getStoredJson("electroStreetCards", [{ id: "visa-4321", holder: "Farhad", brand: "Visa", last4: "4321" }])
  );
  const [documents, setDocuments] = useState(() =>
    getStoredJson("electroStreetDocuments", {
      license: { status: "Under review", fileName: "driver-license-front.jpg" },
      passport: { status: "Upload required", fileName: "" },
    })
  );
  const [security, setSecurity] = useState({
    twoFactor: true,
    biometrics: false,
    rideAlerts: true,
  });
  const [supportTickets, setSupportTickets] = useState(() =>
    getStoredJson("electroStreetSupportTickets", [
      {
        id: "support-ticket-welcome",
        subject: "General support chat",
        status: "open",
        updatedAt: new Date().toISOString(),
        messages: [
          {
            id: "support-message-welcome",
            sender: "support",
            author: "ElectroStreet Support",
            body: "Hello. If you have a problem with a car, payment, or booking, write here and support will help.",
            createdAt: new Date().toISOString(),
          },
        ],
      },
    ])
  );
  const [activeSupportTicketId, setActiveSupportTicketId] = useState(() => {
    const storedTickets = getStoredJson("electroStreetSupportTickets", null);
    return storedTickets?.[0]?.id || "support-ticket-welcome";
  });
  const [supportDraft, setSupportDraft] = useState("");
  const [tripNotice, setTripNotice] = useState("");
  const [timerNow, setTimerNow] = useState(() => Date.now());
  const [userLocation, setUserLocation] = useState(DEFAULT_USER_LOCATION);
  const [routeStates, setRouteStates] = useState({});
  const [cancelReservationTarget, setCancelReservationTarget] = useState(null);

  const licenseInputRef = useRef(null);
  const passportInputRef = useRef(null);
  const supportReplyTimersRef = useRef([]);

  const activeReservations = useMemo(() => {
    return reservations.map((reservation) => {
      const vehicle = getReservationVehicle(reservation);
      const isVehicleUnlocked = Boolean(reservation?.unlockedAt);
      const rideStartedAt = reservation?.tripStartedAt || reservation?.unlockedAt || null;
      const isRideActive = Boolean(rideStartedAt);
      const reservationRemainingSeconds = Math.max(
        0,
        RESERVATION_SECONDS - Math.floor((timerNow - new Date(reservation.reservedAt).getTime()) / 1000)
      );
      const reservationProgress = Math.max(0, Math.min(100, (reservationRemainingSeconds / RESERVATION_SECONDS) * 100));
      const rideElapsedSeconds = rideStartedAt
        ? Math.max(0, Math.floor((timerNow - new Date(rideStartedAt).getTime()) / 1000))
        : 0;
      const rideCost = isRideActive
        ? Number((((rideElapsedSeconds || 0) / 60) * Number(vehicle?.rate || vehicle?.pricePerMinute || 0)).toFixed(2))
        : 0;

      return {
        ...vehicle,
        reservationId: reservation.id || reservation.vehicleId,
        isVehicleUnlocked,
        rideStartedAt,
        isRideActive,
        reservationRemainingSeconds,
        reservationProgress,
        rideElapsedSeconds,
        rideCost,
      };
    });
  }, [reservations, timerNow]);
  const activeVehicle = activeReservations[0] || null;
  const activeSupportTicket = useMemo(
    () => supportTickets.find((ticket) => ticket.id === activeSupportTicketId) || supportTickets[0] || null,
    [activeSupportTicketId, supportTickets]
  );

  const recentTrips = useMemo(
    () =>
      trips.slice(0, 4).map((trip) => ({
        ...trip,
        vehicle: vehicles.find((vehicle) => vehicle.id === trip.vehicleId),
      })),
    []
  );

  const pendingVerification = useMemo(
    () => getStoredJson("electroStreetPendingEmailVerification"),
    [user?.emailVerified]
  );

  useEffect(() => {
    localStorage.removeItem("reservedVehicle");
    localStorage.setItem("reservedVehicles", JSON.stringify(reservations));
  }, [reservations]);

  useEffect(() => {
    if (!reservations.length) return undefined;

    const migrateLegacyReservations = reservations.map((reservation) =>
      reservation?.unlockedAt && !reservation?.tripStartedAt
        ? {
            ...reservation,
            tripStartedAt: reservation.unlockedAt,
            billingStartedAt: reservation.billingStartedAt || reservation.unlockedAt,
            tripStatus: reservation.tripStatus || "active",
          }
        : reservation
    );

    const changed = migrateLegacyReservations.some((reservation, index) => reservation !== reservations[index]);
    if (changed) {
      setReservations(migrateLegacyReservations);
    }
  }, [reservations]);

  useEffect(() => {
    if (!reservations.length) return undefined;

    const interval = window.setInterval(() => {
      setTimerNow(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, [reservations.length]);

  useEffect(() => {
    if (!("geolocation" in navigator)) return undefined;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setUserLocation([position.coords.latitude, position.coords.longitude]);
      },
      () => {
        setUserLocation(DEFAULT_USER_LOCATION);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 12000,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    if (!activeReservations.length) {
      setRouteStates({});
      return undefined;
    }

    const controllers = [];

    activeReservations.forEach((vehicle) => {
      const controller = new AbortController();
      controllers.push(controller);

      const vehiclePosition = getVehiclePosition(vehicle);

      setRouteStates((current) => ({
        ...current,
        [vehicle.reservationId]: {
          ...current[vehicle.reservationId],
          status: "loading",
          error: "",
        },
      }));

      fetch(getWalkingRouteUrl(userLocation, vehiclePosition), {
        signal: controller.signal,
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error("Route service is unavailable.");
          }

          return response.json();
        })
        .then((data) => {
          const route = data.routes?.[0];
          const coordinates = route?.geometry?.coordinates;

          if (!coordinates?.length) {
            throw new Error("Route was not found.");
          }

          setRouteStates((current) => ({
            ...current,
            [vehicle.reservationId]: {
              positions: coordinates.map(([lng, lat]) => [lat, lng]),
              distanceMeters: route.distance,
              durationSeconds: route.duration,
              status: "ready",
              error: "",
            },
          }));
        })
        .catch((error) => {
          if (error.name === "AbortError") return;

          setRouteStates((current) => ({
            ...current,
            [vehicle.reservationId]: {
              positions: [userLocation, vehiclePosition],
              distanceMeters: null,
              durationSeconds: null,
              status: "error",
              error: "Road route is temporarily unavailable.",
            },
          }));
        });
    });

    return () => {
      controllers.forEach((controller) => controller.abort());
    };
  }, [activeReservations, userLocation]);

  useEffect(() => {
    if (!supportTickets.some((ticket) => ticket.id === activeSupportTicketId) && supportTickets[0]) {
      setActiveSupportTicketId(supportTickets[0].id);
    }
  }, [activeSupportTicketId, supportTickets]);

  useEffect(
    () => () => {
      supportReplyTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    },
    []
  );

  const persistUser = (nextUser) => {
    setUser(nextUser);
    localStorage.setItem("electroStreetUser", JSON.stringify(nextUser));
  };

  const persistCards = (nextCards) => {
    setPaymentCards(nextCards);
    localStorage.setItem("electroStreetCards", JSON.stringify(nextCards));
  };

  const persistDocuments = (nextDocuments) => {
    setDocuments(nextDocuments);
    localStorage.setItem("electroStreetDocuments", JSON.stringify(nextDocuments));
  };

  const persistSupportTickets = (nextTickets) => {
    setSupportTickets(nextTickets);
    localStorage.setItem("electroStreetSupportTickets", JSON.stringify(nextTickets));
  };

  const cancelReservation = (reservationId) => {
    setReservations((currentReservations) =>
      currentReservations.filter((reservation) => (reservation.id || reservation.vehicleId) !== reservationId)
    );
    setTripNotice("");
    setCancelReservationTarget(null);
  };

  const requestCancelReservation = (vehicle) => {
    setCancelReservationTarget(vehicle);
  };

  const handleCompleteReservation = (reservationId) => {
    const completedReservation = reservations.find(
      (reservation) => (reservation.id || reservation.vehicleId) === reservationId
    );

    setReservations((currentReservations) =>
      currentReservations.filter((reservation) => (reservation.id || reservation.vehicleId) !== reservationId)
    );

    if (completedReservation?.tripStartedAt || completedReservation?.unlockedAt) {
      setTripNotice("The ride has been completed and the vehicle was removed from your cabinet.");
      return;
    }

    setTripNotice("The reservation has been completed and removed from your cabinet.");
  };

  const handleUnlockVehicle = (reservationId) => {
    const unlockedAt = new Date().toISOString();
    setReservations((currentReservations) =>
      currentReservations.map((reservation) =>
        (reservation.id || reservation.vehicleId) === reservationId && !reservation.unlockedAt
          ? {
              ...reservation,
              unlockedAt,
              tripStartedAt: unlockedAt,
              billingStartedAt: unlockedAt,
              accessState: "unlocked",
              tripStatus: "active",
            }
          : reservation
      )
    );
    setTimerNow(Date.now());
    setTripNotice("The reservation timer is stopped. Ride time and billing started from the moment you unlocked the car.");
  };

  const handleTopUp = (event) => {
    event.preventDefault();
    const amount = Number(topUpAmount);

    if (!Number.isFinite(amount) || amount <= 0) return;

    persistUser({
      ...user,
      balance: Number(((user.balance || 0) + amount).toFixed(2)),
    });
    setTopUpAmount("50");
    setIsTopUpModalOpen(false);
  };

  const handleAddCard = (event) => {
    event.preventDefault();
    const digits = cardForm.number.replace(/\D/g, "");
    const last4 = digits.slice(-4) || String(Math.floor(1000 + Math.random() * 9000));
    const brand = digits.startsWith("5") ? "Mastercard" : "Visa";

    persistCards([
      ...paymentCards,
      {
        id: `card-${Date.now()}`,
        holder: cardForm.holder.trim() || user.name || "Farhad",
        brand,
        last4,
      },
    ]);
    setCardForm({ number: "", holder: user.name || "Farhad" });
    setIsCardModalOpen(false);
  };

  const handleRemoveCard = (cardId) => {
    persistCards(paymentCards.filter((card) => card.id !== cardId));
  };

  const handleDocumentUpload = (type, event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    persistDocuments({
      ...documents,
      [type]: {
        status: "Uploaded",
        fileName: file.name,
      },
    });
  };

  const verifyEmailNow = () => {
    const verifiedUser = {
      ...user,
      emailVerified: true,
      emailVerifiedAt: new Date().toISOString(),
    };

    localStorage.removeItem("electroStreetPendingEmailVerification");
    persistUser(verifiedUser);
  };

  const handleQuickSupportAction = (action) => {
    setActiveTab("support");
    setSupportDraft(action.draft);
  };

  const handleSendSupportMessage = () => {
    const body = supportDraft.trim();
    if (!body || !activeSupportTicket) return;

    const nextMessage = createSupportMessage(body);
    const nextTickets = supportTickets.map((ticket) =>
      ticket.id === activeSupportTicket.id
        ? {
            ...ticket,
            status: "waiting",
            updatedAt: nextMessage.createdAt,
            messages: [...ticket.messages, nextMessage],
          }
        : ticket
    );

    persistSupportTickets(nextTickets);
    setSupportDraft("");

    const timerId = window.setTimeout(() => {
      setSupportTickets((currentTickets) => {
        const updatedTickets = currentTickets.map((ticket) =>
          ticket.id === activeSupportTicket.id
            ? {
                ...ticket,
                status: "open",
                updatedAt: new Date().toISOString(),
                messages: [
                  ...ticket.messages,
                  createSupportMessage(getSupportReply(body), "support", "ElectroStreet Support"),
                ],
              }
            : ticket
        );

        localStorage.setItem("electroStreetSupportTickets", JSON.stringify(updatedTickets));
        return updatedTickets;
      });
    }, 1200);

    supportReplyTimersRef.current.push(timerId);
  };

  const renderReservationMap = (vehicle) => (
    <div key={`map-${vehicle.reservationId}`} className="relative z-0 overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
      {(() => {
        const vehiclePosition = getVehiclePosition(vehicle);
        const routeState = routeStates[vehicle.reservationId] || {};
        const routePositions = routeState.positions?.length > 1 ? routeState.positions : [userLocation, vehiclePosition];
        const routeMinutes = routeState.durationSeconds ? Math.max(1, Math.round(routeState.durationSeconds / 60)) : null;
        const routeDistanceKm = routeState.distanceMeters ? (routeState.distanceMeters / 1000).toFixed(1) : null;

        return (
          <>
      <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">Vehicle location</p>
          <p className="mt-1 text-sm font-black text-zinc-950">
            {vehicle.brand} {vehicle.model}
          </p>
        </div>
        <span className="rounded-full bg-red-50 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-red-600">
          {vehicle.isRideActive ? "in ride" : "reserved"}
        </span>
      </div>
      <div className="h-[220px]">
        <MapContainer center={getVehiclePosition(vehicle)} zoom={13} scrollWheelZoom className="h-full w-full !z-0">
          <ReservationMapBounds points={routePositions} />
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />
          <Polyline
            positions={routePositions}
            pathOptions={{ color: "#ef4444", weight: 4, opacity: 0.85 }}
          />
          <Marker position={userLocation} icon={userIcon}>
            <Popup>You are here</Popup>
          </Marker>
          <Marker position={vehiclePosition}>
            <Popup>
              {vehicle.brand} {vehicle.model}
            </Popup>
          </Marker>
        </MapContainer>
      </div>
      <div className="flex items-center justify-between border-t border-zinc-100 px-5 py-3 text-xs font-bold text-zinc-500">
        <span>
          {routeState.status === "loading"
            ? "Loading road route..."
            : routeState.error || `${routeMinutes || 1} min walk`}
        </span>
        <span>{routeDistanceKm ? `${routeDistanceKm} km` : ""}</span>
      </div>
          </>
        );
      })()}
    </div>
  );

  const renderTripPanel = () => (
    <motion.div {...panelMotion} className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
      <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 p-6">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-red-500">Active ride</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-zinc-950">
            {activeVehicle ? "Vehicle reserved" : "Ready for the next trip"}
          </h2>
        </div>

        {activeReservations.length ? (
          <div className="grid gap-6 p-6 lg:grid-cols-2">
            {activeReservations.map((vehicle) => (
              <article key={vehicle.reservationId} className="overflow-hidden rounded-3xl border border-zinc-100 bg-zinc-50">
                <div className="relative flex min-h-[280px] items-center justify-center bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.16),transparent_60%)] p-8">
                  <img
                    src={vehicle.image}
                    alt={`${vehicle.brand} ${vehicle.model}`}
                    className="relative z-10 max-h-[220px] w-full object-contain drop-shadow-2xl"
                  />
                  <div className="absolute bottom-14 h-5 w-2/3 rounded-full bg-zinc-950/20 blur-xl" />
                </div>

                <div className="border-t border-zinc-100 bg-white p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">{vehicle.plateNumber}</p>
                      <h3 className="mt-2 text-2xl font-black text-zinc-950">
                        {vehicle.brand} {vehicle.model}
                      </h3>
                    </div>
                    <span className="rounded-full bg-zinc-950 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-white">
                      {vehicle.isRideActive ? "In ride" : "Reserved"}
                    </span>
                  </div>

                  <div className="mt-6 rounded-2xl bg-zinc-950 p-5 text-white">
                    <div className="flex items-end justify-between gap-4">
                      <span className="font-mono text-4xl font-black tabular-nums">
                        {vehicle.isRideActive ? formatDuration(vehicle.rideElapsedSeconds) : formatTimer(vehicle.reservationRemainingSeconds)}
                      </span>
                      <span className="pb-1 text-xs font-black uppercase tracking-wide text-white/45">
                        {vehicle.isRideActive ? "ride time" : "free walk"}
                      </span>
                    </div>
                    {vehicle.isRideActive ? (
                      <div className="mt-5 grid grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-white/10 p-4">
                          <p className="text-[11px] font-black uppercase tracking-wide text-white/45">Trip started</p>
                          <p className="mt-2 text-sm font-black">{formatSupportTime(vehicle.rideStartedAt)}</p>
                        </div>
                        <div className="rounded-2xl bg-white/10 p-4">
                          <p className="text-[11px] font-black uppercase tracking-wide text-white/45">Live cost</p>
                          <p className="mt-2 text-sm font-black">{formatMoney(vehicle.rideCost)}</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
                          <div className="h-full rounded-full bg-red-500 transition-all duration-1000" style={{ width: `${vehicle.reservationProgress}%` }} />
                        </div>
                        <p className="mt-4 text-xs font-semibold leading-5 text-white/60">
                          These 15 minutes are reserved for walking to this EV and starting the trip.
                        </p>
                      </>
                    )}
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-zinc-50 p-4">
                      <FiMapPin className="text-red-500" />
                      <p className="mt-3 text-xs font-bold text-zinc-400">Pickup</p>
                      <p className="text-sm font-black text-zinc-950">{vehicle.location?.label || "Baku"}</p>
                    </div>
                    <div className="rounded-2xl bg-zinc-50 p-4">
                      <FiDollarSign className="text-red-500" />
                      <p className="mt-3 text-xs font-bold text-zinc-400">{vehicle.isRideActive ? "Charged from" : "Rate"}</p>
                      <p className="text-sm font-black text-zinc-950">
                        {vehicle.isRideActive
                          ? formatSupportTime(vehicle.billingStartedAt || vehicle.rideStartedAt)
                          : `${formatMoney(vehicle.rate)}/min`}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() =>
                        vehicle.isRideActive
                          ? handleCompleteReservation(vehicle.reservationId)
                          : requestCancelReservation(vehicle)
                      }
                      className="rounded-2xl border border-zinc-200 px-5 py-4 text-sm font-black text-zinc-700 transition hover:border-red-200 hover:text-red-600"
                    >
                      {vehicle.isRideActive ? "Cancel reservation" : "Cancel reservation"}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        vehicle.isRideActive
                          ? handleCompleteReservation(vehicle.reservationId)
                          : handleUnlockVehicle(vehicle.reservationId)
                      }
                      className={`rounded-2xl px-5 py-4 text-sm font-black text-white transition ${
                        vehicle.isRideActive ? "bg-zinc-950 hover:bg-zinc-800" : "bg-red-500 hover:bg-red-600"
                      } ${vehicle.isVehicleUnlocked && !vehicle.isRideActive ? "cursor-not-allowed bg-zinc-100 text-zinc-400" : ""}`}
                      disabled={vehicle.isVehicleUnlocked && !vehicle.isRideActive}
                    >
                      {vehicle.isRideActive ? "Finish ride" : vehicle.isVehicleUnlocked ? "Car unlocked" : "Unlock car"}
                    </button>
                  </div>
                </div>
              </article>
            ))}

            {tripNotice && (
              <div className="lg:col-span-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                {tripNotice}
              </div>
            )}

            <div className="lg:col-span-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="flex items-start gap-3">
                <FiMessageSquare className="mt-0.5 text-red-500" />
                <div>
                  <p className="text-sm font-black text-zinc-950">Need help near the car?</p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-zinc-500">
                    Support chat is available inside the cabinet if the door does not react, payment looks wrong, or you found a problem with one of the reserved EVs.
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {supportQuickActions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => handleQuickSupportAction(action)}
                    className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs font-black text-zinc-700 transition hover:border-red-200 hover:text-red-600"
                  >
                    {action.title}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-5 p-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-3xl bg-zinc-950 p-6 text-white">
              <FiNavigation className="text-3xl text-red-400" />
              <h3 className="mt-8 text-2xl font-black">No active reservation</h3>
              <p className="mt-3 text-sm font-semibold leading-6 text-white/55">
                Pick a vehicle on the main page, review the EV, confirm the booking, and it will appear here.
              </p>
              <a
                href="/#fleet"
                className="mt-8 inline-flex rounded-2xl bg-white px-5 py-3 text-sm font-black text-zinc-950 transition hover:bg-red-50 hover:text-red-600"
              >
                Choose a vehicle
              </a>
            </div>

            <div className="grid gap-3">
              {recentTrips.slice(0, 3).map((trip) => (
                <div key={trip.id} className="flex items-center gap-4 rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
                  <div className="flex h-14 w-16 items-center justify-center rounded-2xl bg-white">
                    {trip.vehicle?.image ? (
                      <img src={trip.vehicle.image} alt="" className="h-10 w-full object-contain" />
                    ) : (
                      <FaCar />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-zinc-950">
                      {trip.vehicle?.brand} {trip.vehicle?.model}
                    </p>
                    <p className="text-xs font-bold text-zinc-400">
                      {trip.startLocation} to {trip.endLocation || trip.currentLocation || "Reserved"}
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-wide text-zinc-500">
                    {trip.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <aside className="grid gap-5">
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-zinc-400">Fleet pass</p>
          <div className="mt-5 grid grid-cols-3 gap-3">
            {[
              ["Balance", formatMoney(user.balance)],
              ["Cards", paymentCards.length],
              ["Reservations", activeReservations.length],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-zinc-50 p-4">
                <p className="text-xs font-bold text-zinc-400">{label}</p>
                <p className="mt-2 text-lg font-black text-zinc-950">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {activeReservations.length > 0 && (
          <div className="grid gap-4">
            {activeReservations.map((vehicle) => renderReservationMap(vehicle))}
          </div>
        )}

        {user.emailVerified === false && (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
            <FiMail className="text-2xl text-amber-600" />
            <h3 className="mt-4 text-xl font-black text-zinc-950">Verify email</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-zinc-600">
              Email verification is still required for the full booking and payment flow.
            </p>
            <button
              type="button"
              onClick={verifyEmailNow}
              className="mt-5 rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-black text-white transition hover:bg-zinc-800"
            >
              Verify in demo
            </button>
            {pendingVerification?.link && (
              <a href={pendingVerification.link} className="mt-3 block break-all text-xs font-bold text-amber-700 underline">
                Open email link
              </a>
            )}
          </div>
        )}
      </aside>
    </motion.div>
  );

  const renderPaymentsPanel = () => (
    <motion.div {...panelMotion} className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
      <section className="rounded-3xl bg-zinc-950 p-6 text-white shadow-xl shadow-zinc-950/10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-red-300">Profile balance</p>
            <p className="mt-4 text-5xl font-black tracking-tight">{formatMoney(user.balance)}</p>
            <p className="mt-3 text-sm font-semibold text-white/50">Choose a payment method and top up the wallet used for rides.</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-4">
            <FiSmartphone className="text-3xl" />
          </div>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-2">
          {["25", "50", "100"].map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => {
                setTopUpAmount(amount);
                setIsTopUpModalOpen(true);
              }}
              className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-black transition hover:bg-white hover:text-zinc-950"
            >
              +{amount}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setIsTopUpModalOpen(true)}
          className="mt-4 w-full rounded-2xl bg-red-500 px-5 py-4 text-sm font-black transition hover:bg-red-600"
        >
          Top up balance
        </button>
      </section>

      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-red-500">Payment vault</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-zinc-950">Cards and payment methods</h2>
          </div>
          <button
            type="button"
            onClick={() => setIsCardModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-black text-white transition hover:bg-red-500"
          >
            <FiPlus /> Add card
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {paymentCards.map((card, index) => (
            <motion.div
              key={card.id}
              layout
              className={`relative min-h-[210px] overflow-hidden rounded-3xl p-6 text-white shadow-xl ${
                index % 2 === 0 ? "bg-[linear-gradient(135deg,#18181b,#ef4444)]" : "bg-[linear-gradient(135deg,#111827,#2563eb)]"
              }`}
            >
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
              <div className="relative flex items-start justify-between">
                <FiCreditCard className="text-3xl text-white/80" />
                <button
                  type="button"
                  onClick={() => handleRemoveCard(card.id)}
                  className="rounded-full bg-white/10 p-2 text-white/70 transition hover:bg-white hover:text-red-600"
                  aria-label="Remove payment card"
                >
                  <FiTrash2 />
                </button>
              </div>
              <div className="relative mt-16">
                <p className="font-mono text-2xl font-black tracking-widest">.... {card.last4}</p>
                <div className="mt-5 flex items-center justify-between text-xs font-black uppercase tracking-widest text-white/65">
                  <span>{card.holder}</span>
                  <span>{card.brand}</span>
                </div>
              </div>
            </motion.div>
          ))}

          <button
            type="button"
            onClick={() => setIsCardModalOpen(true)}
            className="flex min-h-[210px] flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-300 bg-zinc-50 text-zinc-500 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600"
          >
            <FiPlus className="mb-3 text-3xl" />
            <span className="text-sm font-black">New card</span>
          </button>
        </div>
      </section>
    </motion.div>
  );

  const renderDocumentsPanel = () => {
    const documentCards = [
      {
        type: "license",
        title: "Driver license",
        helper: "Required before a ride starts",
        icon: FiUserCheck,
        inputRef: licenseInputRef,
      },
      {
        type: "passport",
        title: "Passport",
        helper: "Used for KYC verification",
        icon: FiFileText,
        inputRef: passportInputRef,
      },
    ];

    return (
      <motion.div {...panelMotion} className="grid gap-5 xl:grid-cols-[1fr_0.8fr]">
        <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-red-500">Verification</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-zinc-950">My documents</h2>

          <input ref={licenseInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(event) => handleDocumentUpload("license", event)} />
          <input ref={passportInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(event) => handleDocumentUpload("passport", event)} />

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {documentCards.map((doc) => {
              const Icon = doc.icon;
              const data = documents[doc.type] || {};
              const uploaded = Boolean(data.fileName);

              return (
                <div key={doc.type} className="rounded-3xl border border-zinc-100 bg-zinc-50 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="rounded-2xl bg-white p-4 text-red-500 shadow-sm">
                      <Icon className="text-2xl" />
                    </div>
                    <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wide ${uploaded ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {data.status}
                    </span>
                  </div>
                  <h3 className="mt-6 text-xl font-black text-zinc-950">{doc.title}</h3>
                  <p className="mt-1 text-sm font-semibold text-zinc-500">{doc.helper}</p>
                  <p className="mt-4 min-h-5 truncate text-xs font-bold text-zinc-400">{data.fileName || "No file uploaded yet"}</p>
                  <button
                    type="button"
                    onClick={() => doc.inputRef.current?.click()}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-black text-white transition hover:bg-red-500"
                  >
                    <FiUploadCloud /> {uploaded ? "Replace file" : "Upload"}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="rounded-3xl bg-red-500 p-6 text-white shadow-xl shadow-red-500/20">
          <FiCheckCircle className="text-4xl" />
          <h3 className="mt-8 text-2xl font-black">Access status</h3>
          <div className="mt-5 space-y-3">
            {[
              ["Email", user.emailVerified ? "Verified" : "Pending"],
              ["License", documents.license?.fileName ? "Under review" : "Upload needed"],
              ["Passport", documents.passport?.fileName ? "Uploaded" : "Upload needed"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-2xl bg-white/12 px-4 py-3">
                <span className="text-sm font-bold text-white/70">{label}</span>
                <span className="text-sm font-black">{value}</span>
              </div>
            ))}
          </div>
        </aside>
      </motion.div>
    );
  };

  const renderSecurityPanel = () => (
    <motion.div {...panelMotion} className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-red-500">Account</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-zinc-950">Security</h2>
        <div className="mt-6 grid gap-3">
          {[
            ["twoFactor", "Two-factor protection", "Confirmation code during login", FiShield],
            ["biometrics", "Biometrics", "Fast login on trusted devices", FiUserCheck],
            ["rideAlerts", "Ride alerts", "Email and push updates for every ride", FiZap],
          ].map(([key, title, detail, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSecurity((current) => ({ ...current, [key]: !current[key] }))}
              className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-100 bg-zinc-50 p-4 text-left transition hover:border-red-200 hover:bg-red-50"
            >
              <span className="flex min-w-0 items-center gap-4">
                <span className="rounded-2xl bg-white p-3 text-red-500 shadow-sm">
                  <Icon />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-black text-zinc-950">{title}</span>
                  <span className="block truncate text-xs font-bold text-zinc-500">{detail}</span>
                </span>
              </span>
              <span className={`h-7 w-12 rounded-full p-1 transition ${security[key] ? "bg-red-500" : "bg-zinc-300"}`}>
                <span className={`block h-5 w-5 rounded-full bg-white transition ${security[key] ? "translate-x-5" : ""}`} />
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-3xl bg-zinc-950 p-6 text-white">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-red-300">Password</p>
        <h3 className="mt-2 text-3xl font-black tracking-tight">Change password</h3>
        <div className="mt-6 grid gap-3">
          <input className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm font-bold outline-none transition placeholder:text-white/35 focus:border-red-400" type="password" placeholder="Current password" />
          <input className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm font-bold outline-none transition placeholder:text-white/35 focus:border-red-400" type="password" placeholder="New password" />
          <input className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm font-bold outline-none transition placeholder:text-white/35 focus:border-red-400" type="password" placeholder="Repeat password" />
          <button className="rounded-2xl bg-red-500 px-5 py-4 text-sm font-black transition hover:bg-red-600">Update password</button>
        </div>
      </section>
    </motion.div>
  );

  const renderSupportPanel = () => (
    <motion.div {...panelMotion} className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-red-500">Help desk</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-zinc-950">Support</h2>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-700">
            online
          </span>
        </div>

        <div className="mt-6 grid gap-3">
          {supportQuickActions.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={() => handleQuickSupportAction(action)}
              className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4 text-left transition hover:border-red-200 hover:bg-red-50"
            >
              <p className="text-sm font-black text-zinc-950">{action.title}</p>
              <p className="mt-1 text-xs font-semibold text-zinc-500">Open the support chat with a ready-to-send message.</p>
            </button>
          ))}
        </div>

        <div className="mt-6 rounded-3xl bg-zinc-950 p-5 text-white">
          <div className="flex items-start gap-3">
            <FiAlertCircle className="mt-0.5 text-2xl text-red-300" />
            <div>
              <p className="text-sm font-black">Best reasons to use support</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-white/60">
                Door does not open, charging or battery issue, wrong payment, cabin damage, or ride completion did not work.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-3">
          {supportTickets.map((ticket) => {
            const isActive = ticket.id === activeSupportTicket?.id;
            const lastMessage = ticket.messages[ticket.messages.length - 1];

            return (
              <button
                key={ticket.id}
                type="button"
                onClick={() => setActiveSupportTicketId(ticket.id)}
                className={`rounded-2xl border p-4 text-left transition ${isActive ? "border-red-200 bg-red-50" : "border-zinc-100 bg-white hover:border-zinc-200 hover:bg-zinc-50"}`}
              >
                <div className="flex items-center justify-between gap-4">
                  <p className="truncate text-sm font-black text-zinc-950">{ticket.subject}</p>
                  <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wide ${ticket.status === "waiting" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                    {ticket.status === "waiting" ? "waiting" : "active"}
                  </span>
                </div>
                <p className="mt-2 truncate text-xs font-semibold text-zinc-500">{lastMessage?.body}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex min-h-[640px] flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 p-6">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-zinc-400">Live chat</p>
          <h3 className="mt-2 text-2xl font-black text-zinc-950">{activeSupportTicket?.subject || "Support chat"}</h3>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto bg-zinc-50 p-6">
          {activeSupportTicket?.messages.map((message) => {
            const isUserMessage = message.sender === "user";

            return (
              <div key={message.id} className={`flex ${isUserMessage ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-3xl px-4 py-3 shadow-sm ${isUserMessage ? "bg-red-500 text-white" : "border border-zinc-200 bg-white text-zinc-900"}`}>
                  <p className="text-xs font-black uppercase tracking-wide opacity-70">{message.author}</p>
                  <p className="mt-2 text-sm font-semibold leading-6">{message.body}</p>
                  <p className={`mt-3 text-[11px] font-bold ${isUserMessage ? "text-white/75" : "text-zinc-400"}`}>{formatSupportTime(message.createdAt)}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-zinc-100 bg-white p-4">
          <div className="flex gap-3">
            <input
              value={supportDraft}
              onChange={(event) => setSupportDraft(event.target.value)}
              placeholder="Describe the problem and support will answer here"
              className="min-w-0 flex-1 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm font-bold text-zinc-900 outline-none transition focus:border-red-300 focus:bg-white"
            />
            <button
              type="button"
              onClick={handleSendSupportMessage}
              disabled={!supportDraft.trim()}
              className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-950 text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-zinc-200"
              aria-label="Send support message"
            >
              <FiSend />
            </button>
          </div>
        </div>
      </section>
    </motion.div>
  );

  const activeRenderer = {
    trip: renderTripPanel,
    payments: renderPaymentsPanel,
    documents: renderDocumentsPanel,
    security: renderSecurityPanel,
    support: renderSupportPanel,
  }[activeTab];

  return (
    <main className="min-h-screen bg-[#f5f7fb] text-zinc-950">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8">
        <header className="sticky top-0 z-40 -mx-4 mb-5 border-b border-zinc-200/70 bg-[#f5f7fb]/85 px-4 py-4 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <a href="/" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-950 text-white shadow-lg shadow-zinc-950/10">
                <FiArrowLeft />
              </a>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-red-500">ElectroStreet</p>
                <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Personal cabinet</h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-wide text-zinc-400">Balance</p>
                <p className="text-sm font-black">{formatMoney(user.balance)}</p>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-3 py-2 shadow-sm">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500 text-sm font-black text-white">
                  {user.avatarInitial || user.name?.charAt(0) || "F"}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-black">{user.name || "Farhad"}</span>
                  <span className="block truncate text-xs font-bold text-zinc-400">{user.email}</span>
                </span>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm font-black text-zinc-600 shadow-sm transition hover:border-red-200 hover:text-red-600"
              >
                Log out
              </button>
            </div>
          </div>
        </header>

        <section className="mb-5 grid gap-4 lg:grid-cols-[1fr_0.72fr_0.72fr]">
          <div className="overflow-hidden rounded-3xl bg-zinc-950 p-6 text-white shadow-xl shadow-zinc-950/10">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-red-300">Good to see you</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight">Hi, {user.name || "Farhad"}.</h2>
            <p className="mt-3 max-w-xl text-sm font-semibold leading-6 text-white/55">
              Manage rides, balance, documents, support, and account safety from one place.
            </p>
          </div>
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <FiClock className="text-2xl text-red-500" />
            <p className="mt-6 text-xs font-black uppercase tracking-wide text-zinc-400">Next action</p>
            <p className="mt-1 text-xl font-black">
              {activeReservations.length ? `${activeReservations.length} reserved EV${activeReservations.length > 1 ? "s" : ""}` : "Choose an EV"}
            </p>
          </div>
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <FiCheckCircle className={`text-2xl ${user.emailVerified === false ? "text-amber-500" : "text-emerald-500"}`} />
            <p className="mt-6 text-xs font-black uppercase tracking-wide text-zinc-400">Account status</p>
            <p className="mt-1 text-xl font-black">{user.emailVerified === false ? "Email pending" : "Verified"}</p>
          </div>
        </section>

        <div className="mb-5 overflow-x-auto">
          <nav className="inline-flex min-w-full gap-2 rounded-3xl border border-zinc-200 bg-white p-2 shadow-sm lg:min-w-0">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex min-w-40 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black transition ${isActive ? "bg-red-500 text-white shadow-lg shadow-red-500/20" : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-950"}`}
                >
                  <Icon />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <AnimatePresence mode="wait">{activeRenderer?.()}</AnimatePresence>
      </div>

      {isTopUpModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/65 p-4 backdrop-blur">
          <motion.form
            onSubmit={handleTopUp}
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl font-black">Top up balance</h2>
              <button type="button" className="rounded-full bg-zinc-100 p-2 text-zinc-500 hover:text-red-500" onClick={() => setIsTopUpModalOpen(false)}>
                <FiX />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {["25", "50", "100"].map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => setTopUpAmount(amount)}
                  className={`rounded-2xl border px-4 py-3 text-sm font-black transition ${topUpAmount === amount ? "border-red-500 bg-red-500 text-white" : "border-zinc-200 bg-zinc-50 text-zinc-600"}`}
                >
                  {amount} AZN
                </button>
              ))}
            </div>

            <input
              className="mt-3 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm font-bold outline-none focus:border-red-500 focus:bg-white"
              type="number"
              min="1"
              step="1"
              value={topUpAmount}
              onChange={(event) => setTopUpAmount(event.target.value)}
              placeholder="Amount"
            />

            <button type="submit" className="mt-5 w-full rounded-2xl bg-zinc-950 px-5 py-4 text-sm font-black text-white transition hover:bg-red-500">
              Confirm
            </button>
          </motion.form>
        </div>
      )}

      {isCardModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/65 p-4 backdrop-blur">
          <motion.form
            onSubmit={handleAddCard}
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl font-black">New card</h2>
              <button type="button" className="rounded-full bg-zinc-100 p-2 text-zinc-500 hover:text-red-500" onClick={() => setIsCardModalOpen(false)}>
                <FiX />
              </button>
            </div>

            <div className="mb-5 min-h-[190px] rounded-3xl bg-[linear-gradient(135deg,#18181b,#ef4444)] p-6 text-white shadow-xl">
              <FiCreditCard className="text-3xl text-white/80" />
              <p className="mt-16 font-mono text-2xl font-black tracking-widest">.... {cardForm.number.replace(/\D/g, "").slice(-4) || "0000"}</p>
              <p className="mt-4 text-xs font-black uppercase tracking-widest text-white/60">{cardForm.holder || user.name || "Card holder"}</p>
            </div>

            <div className="grid gap-3">
              <input
                className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm font-bold outline-none focus:border-red-500 focus:bg-white"
                placeholder="Card number"
                value={cardForm.number}
                onChange={(event) => setCardForm((current) => ({ ...current, number: event.target.value }))}
              />
              <input
                className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm font-bold outline-none focus:border-red-500 focus:bg-white"
                placeholder="Card holder"
                value={cardForm.holder}
                onChange={(event) => setCardForm((current) => ({ ...current, holder: event.target.value }))}
              />
              <button type="submit" className="rounded-2xl bg-zinc-950 px-5 py-4 text-sm font-black text-white transition hover:bg-red-500">
                Add card
              </button>
            </div>
          </motion.form>
        </div>
      )}

      {cancelReservationTarget && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-zinc-950/65 p-4 backdrop-blur">
          <motion.div
            className="relative z-[2001] w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-red-500">Reservation alert</p>
                <h2 className="mt-2 text-2xl font-black text-zinc-950">Cancel reservation?</h2>
              </div>
              <button
                type="button"
                className="rounded-full bg-zinc-100 p-2 text-zinc-500 hover:text-red-500"
                onClick={() => setCancelReservationTarget(null)}
              >
                <FiX />
              </button>
            </div>

            <p className="mt-4 text-sm font-semibold leading-6 text-zinc-600">
              Are you sure you want to cancel the reservation for{" "}
              <span className="font-black text-zinc-950">
                {cancelReservationTarget.brand} {cancelReservationTarget.model}
              </span>
              ? The car will be removed from your cabinet.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setCancelReservationTarget(null)}
                className="rounded-2xl border border-zinc-200 px-5 py-4 text-sm font-black text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-950"
              >
                Keep reservation
              </button>
              <button
                type="button"
                onClick={() => cancelReservation(cancelReservationTarget.reservationId)}
                className="rounded-2xl bg-red-500 px-5 py-4 text-sm font-black text-white transition hover:bg-red-600"
              >
                Yes, cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </main>
  );
};

export default Dashboard;
