import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  FiActivity,
  FiAlertCircle,
  FiArrowLeft,
  FiCheckCircle,
  FiCamera,
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
  FiStar,
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
import { staffApi } from "../../api/staffApi";
import {
  TRIP_COMPLETION_UPDATED_EVENT,
  TRIP_COMPLETION_STATUSES,
  tripCompletionApi,
} from "../../api/tripCompletionApi";
import { useConfirmDialog } from "../ui/useConfirmDialog";
import {
  RESERVATION_SECONDS,
  RESERVATIONS_UPDATED_EVENT,
  cleanupExpiredReservations,
  isReservationExpired,
} from "../../utils/reservations";

const PROFILE_BALANCE_HOLD_AZN = 20;
const DEFAULT_USER_LOCATION = [40.3772, 49.8475];
const TRIP_PHOTO_ANGLES = [
  { id: "front", label: "Front", hint: "Full front side of the car" },
  { id: "rear", label: "Rear", hint: "Full rear side of the car" },
  { id: "left", label: "Left side", hint: "Driver side from bumper to bumper" },
  { id: "right", label: "Right side", hint: "Passenger side from bumper to bumper" },
];

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

const toMoney = (amount) => Number(Number(amount || 0).toFixed(2));

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

const prepareTripPhoto = (file) =>
  new Promise((resolve, reject) => {
    if (!file?.type.startsWith("image/")) {
      reject(new Error("Please select an image file."));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The photo could not be read."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("The photo could not be processed."));
      image.onload = () => {
        const maxSide = 800;
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));

        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("The photo could not be processed."));
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        resolve({
          name: file.name,
          dataUrl: canvas.toDataURL("image/jpeg", 0.62),
        });
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
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
  return cleanupExpiredReservations();
};

const migrateLegacyReservations = (reservations) =>
  reservations.map((reservation) =>
    reservation?.unlockedAt && !reservation?.tripStartedAt
      ? {
          ...reservation,
          tripStartedAt: reservation.unlockedAt,
          billingStartedAt: reservation.billingStartedAt || reservation.unlockedAt,
          tripStatus: reservation.tripStatus || "active",
        }
      : reservation
  );

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
  const [activeTab, setActiveTab] = useState(() => {
    const requestedTab = new URLSearchParams(window.location.search).get("tab");
    return tabs.some((tab) => tab.id === requestedTab) ? requestedTab : "trip";
  });
  const [user, setUser] = useState(() =>
    getStoredJson("electroStreetUser", {
      name: "Farhad",
      email: "farhad@electrostreet.az",
      balance: 0,
      pendingHold: 0,
      debtAmount: 0,
      avatarInitial: "F",
      emailVerified: true,
    })
  );
  const [reservations, setReservations] = useState(() => migrateLegacyReservations(getStoredReservations()));
  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("50");
  const [cardForm, setCardForm] = useState({ number: "", holder: user.name || "Farhad" });
  const [paymentCards, setPaymentCards] = useState(() =>
    getStoredJson("electroStreetCards", [])
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
  const [completionTarget, setCompletionTarget] = useState(null);
  const [completionPhotos, setCompletionPhotos] = useState({});
  const [completionError, setCompletionError] = useState("");
  const [isPreparingPhoto, setIsPreparingPhoto] = useState(false);
  const [isSubmittingCompletion, setIsSubmittingCompletion] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [isPayingTrip, setIsPayingTrip] = useState(false);
  const [finishPromoCode, setFinishPromoCode] = useState("");
  const [finishPromoMessage, setFinishPromoMessage] = useState("");
  const [reviewTrip, setReviewTrip] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewError, setReviewError] = useState("");
  const { confirm, dialog } = useConfirmDialog();

  const licenseInputRef = useRef(null);
  const passportInputRef = useRef(null);
  const supportReplyTimersRef = useRef([]);

  const activeReservations = useMemo(() => {
    return reservations.map((reservation) => {
      const vehicle = getReservationVehicle(reservation);
      const isVehicleUnlocked = Boolean(reservation?.unlockedAt);
      const rideStartedAt = reservation?.tripStartedAt || reservation?.unlockedAt || null;
      const isRideActive = Boolean(rideStartedAt);
      const isFinishingRide = reservation?.tripStatus === "finishing";
      const isCompletionPending = reservation?.tripStatus === "pending_review";
      const isAwaitingPayment = reservation?.tripStatus === "awaiting_payment";
      const rideTimerEnd = (isFinishingRide || isCompletionPending || isAwaitingPayment) && reservation?.finishRequestedAt
        ? new Date(reservation.finishRequestedAt).getTime()
        : timerNow;
      const reservationRemainingSeconds = Math.max(
        0,
        RESERVATION_SECONDS - Math.floor((timerNow - new Date(reservation.reservedAt).getTime()) / 1000)
      );
      const reservationProgress = Math.max(0, Math.min(100, (reservationRemainingSeconds / RESERVATION_SECONDS) * 100));
      const rideElapsedSeconds = rideStartedAt
        ? Math.max(0, Math.floor((rideTimerEnd - new Date(rideStartedAt).getTime()) / 1000))
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
        isFinishingRide,
        isCompletionPending,
        isAwaitingPayment,
        reservationRemainingSeconds,
        reservationProgress,
        rideElapsedSeconds,
        rideCost,
      };
    });
  }, [reservations, timerNow]);
  const activeVehicle = activeReservations[0] || null;
  const paymentVehicle = activeReservations.find((vehicle) => vehicle.isAwaitingPayment) || null;
  const paymentRequest = paymentVehicle?.completionRequestId
    ? tripCompletionApi.getRequest(paymentVehicle.completionRequestId)
    : null;
  const activeSupportTicket = useMemo(
    () => supportTickets.find((ticket) => ticket.id === activeSupportTicketId) || supportTickets[0] || null,
    [activeSupportTicketId, supportTickets]
  );
  const profileBalance = Number(user.balance || 0);
  const profilePendingHold = Number(user.pendingHold || 0);
  const profileDebt = Number(user.debtAmount || 0);
  const availableProfileBalance = Math.max(0, profileBalance - profilePendingHold);

  const recentTrips = useMemo(
    () =>
      trips.slice(0, 4).map((trip) => ({
        ...trip,
        vehicle: vehicles.find((vehicle) => vehicle.id === trip.vehicleId),
      })),
    []
  );

  const pendingVerification = getStoredJson("electroStreetPendingEmailVerification");

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

  useEffect(() => {
    localStorage.removeItem("reservedVehicle");
    localStorage.setItem("reservedVehicles", JSON.stringify(reservations));
    window.dispatchEvent(new CustomEvent(RESERVATIONS_UPDATED_EVENT));
  }, [reservations]);

  useEffect(() => {
    const syncReservations = (event) => {
      if (
        !event ||
        event.type === TRIP_COMPLETION_UPDATED_EVENT ||
        event.key === "reservedVehicles"
      ) {
        setReservations(getStoredReservations());
      }
    };

    window.addEventListener("storage", syncReservations);
    window.addEventListener(TRIP_COMPLETION_UPDATED_EVENT, syncReservations);

    return () => {
      window.removeEventListener("storage", syncReservations);
      window.removeEventListener(TRIP_COMPLETION_UPDATED_EVENT, syncReservations);
    };
  }, []);

  useEffect(() => {
    if (!reservations.length) return undefined;

    const interval = window.setInterval(() => {
      setTimerNow(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, [reservations.length]);

  useEffect(() => {
    if (!reservations.length) return;

    const expiredReservations = reservations.filter((reservation) =>
      isReservationExpired(reservation, timerNow)
    );

    if (!expiredReservations.length) return;

    const releasedHoldAmount = expiredReservations.reduce(
      (sum, reservation) => sum + Number(reservation.holdAmount || 0),
      0
    );

    const expireTimer = window.setTimeout(() => {
      if (releasedHoldAmount > 0) {
        persistUser({
          ...user,
          pendingHold: Math.max(0, toMoney(profilePendingHold - releasedHoldAmount)),
        });
      }

      setReservations((currentReservations) =>
        currentReservations.filter((reservation) => !isReservationExpired(reservation, timerNow))
      );
      setTripNotice("Reservation time expired. The car is available again in the fleet.");
    }, 0);

    return () => window.clearTimeout(expireTimer);
  }, [profilePendingHold, reservations, timerNow, user]);

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
      const clearRouteTimer = window.setTimeout(() => setRouteStates({}), 0);
      return () => window.clearTimeout(clearRouteTimer);
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
      const selectTicketTimer = window.setTimeout(() => setActiveSupportTicketId(supportTickets[0].id), 0);
      return () => window.clearTimeout(selectTicketTimer);
    }

    return undefined;
  }, [activeSupportTicketId, supportTickets]);

  useEffect(
    () => () => {
      supportReplyTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    },
    []
  );

  const cancelReservation = (reservationId) => {
    const reservationToCancel = reservations.find(
      (reservation) => (reservation.id || reservation.vehicleId) === reservationId
    );
    const holdToRelease = Number(reservationToCancel?.holdAmount || 0);

    if (holdToRelease > 0) {
      persistUser({
        ...user,
        pendingHold: Math.max(0, toMoney(profilePendingHold - holdToRelease)),
      });
    }

    setReservations((currentReservations) =>
      currentReservations.filter((reservation) => (reservation.id || reservation.vehicleId) !== reservationId)
    );
    setTripNotice("");
    setCancelReservationTarget(null);
  };

  const requestCancelReservation = (vehicle) => {
    setCancelReservationTarget(vehicle);
  };

  const openTripCompletion = (vehicle) => {
    if (vehicle.isCompletionPending) return;

    const finishRequestedAt = new Date().toISOString();
    const frozenVehicle = {
      ...vehicle,
      finishRequestedAt,
      rideCost: vehicle.rideCost,
      rideElapsedSeconds: vehicle.rideElapsedSeconds,
    };

    setReservations((currentReservations) =>
      currentReservations.map((reservation) =>
        (reservation.id || reservation.vehicleId) === vehicle.reservationId
          ? {
              ...reservation,
              tripStatus: "finishing",
              finishRequestedAt,
              frozenRideCost: vehicle.rideCost,
            }
          : reservation
      )
    );
    setCompletionTarget(frozenVehicle);
    setCompletionPhotos({});
    setCompletionError("");
  };

  const closeTripCompletion = () => {
    if (isSubmittingCompletion) return;
    const reservationId = completionTarget?.reservationId;
    setReservations((currentReservations) =>
      currentReservations.map((reservation) =>
        (reservation.id || reservation.vehicleId) === reservationId &&
        reservation.tripStatus === "finishing"
          ? {
              ...reservation,
              tripStatus: "active",
              finishRequestedAt: null,
              frozenRideCost: null,
            }
          : reservation
      )
    );
    setCompletionTarget(null);
    setCompletionPhotos({});
    setCompletionError("");
  };

  const handleTripPhoto = async (angle, event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setCompletionError("Each photo must be smaller than 15 MB.");
      return;
    }

    setIsPreparingPhoto(true);
    setCompletionError("");

    try {
      const photo = await prepareTripPhoto(file);
      setCompletionPhotos((current) => ({ ...current, [angle]: photo }));
    } catch (error) {
      setCompletionError(error.message);
    } finally {
      setIsPreparingPhoto(false);
    }
  };

  const submitTripCompletion = async () => {
    const missingAngle = TRIP_PHOTO_ANGLES.find((angle) => !completionPhotos[angle.id]);
    if (missingAngle) {
      setCompletionError(`Add the ${missingAngle.label.toLowerCase()} photo to continue.`);
      return;
    }

    const reservation = reservations.find(
      (item) => (item.id || item.vehicleId) === completionTarget?.reservationId
    );
    if (!reservation || !completionTarget) {
      setCompletionError("The active ride could not be found.");
      return;
    }

    const confirmed = await confirm({
      title: "Send photos for review?",
      message: "Send these four photos to a staff member for review? You will not be able to finish the trip until they approve them.",
      confirmLabel: "Send for review",
      tone: "info",
    });

    if (!confirmed) {
      return;
    }

    setIsSubmittingCompletion(true);
    setCompletionError("");

    try {
      const request = tripCompletionApi.submitRequest({
        reservation,
        vehicle: completionTarget,
        user,
        photos: completionPhotos,
        rideCost: completionTarget.rideCost,
      });

      const hasReviewTask = staffApi
        .getTasks()
        .some((task) => task.completionRequestId === request.id);

      if (!hasReviewTask) {
        staffApi.createTask({
          taskType: "trip_completion_review",
          completionRequestId: request.id,
          title: `Check trip photos: ${request.vehicleName}`,
          description: `${request.userName} submitted four vehicle photos. Review every side and approve the trip completion.`,
          assigneeId: request.assigneeId,
          vehicleId: request.vehicleId,
          priority: "High",
          dueAt: "As soon as possible",
        });
      }

      setReservations((currentReservations) =>
        currentReservations.map((item) =>
          (item.id || item.vehicleId) === request.reservationId
            ? {
                ...item,
                tripStatus: "pending_review",
                completionRequestId: request.id,
                finishRequestedAt: completionTarget.finishRequestedAt,
                frozenRideCost: completionTarget.rideCost,
              }
            : item
        )
      );
      setTripNotice(
        `Four photos were sent to ${request.assigneeName}. The ride will close after staff approval.`
      );
      setCompletionTarget(null);
      setCompletionPhotos({});
    } catch (error) {
      const isStorageError =
        error?.name === "QuotaExceededError" ||
        String(error?.message || "").toLowerCase().includes("quota");
      setCompletionError(
        isStorageError
          ? "The browser could not store these photos. Try smaller images or clear old site data."
          : error.message || "The photos could not be submitted."
      );
    } finally {
      setIsSubmittingCompletion(false);
    }
  };

  const handleUnlockVehicle = async (reservationId) => {
    const confirmed = await confirm({
      title: "Start paid ride?",
      message: "Unlock the car and start the paid ride now?",
      confirmLabel: "Unlock car",
      tone: "success",
    });

    if (!confirmed) return;

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
    setTimerNow(new Date(unlockedAt).getTime());
    setTripNotice("");
  };

  const handlePayTrip = async (targetVehicle = paymentVehicle) => {
    if (!targetVehicle?.completionRequestId) return;

    const request = tripCompletionApi.getRequest(targetVehicle.completionRequestId);
    if (!request || request.status !== TRIP_COMPLETION_STATUSES.APPROVED) {
      setPaymentError("Staff approval has not arrived yet.");
      return;
    }

    const fullAmount = toMoney(request.finalRideCost || request.rideCost || targetVehicle.finalRideCost || 0);
    const existingDebt = toMoney(targetVehicle.debtAmount || request.debtAmount || 0);
    const amount = existingDebt > 0 ? existingDebt : fullAmount;
    const paymentMethod = targetVehicle.paymentMethod || "card";
    const holdAmount = paymentMethod === "profile_balance" && existingDebt <= 0
      ? toMoney(targetVehicle.holdAmount || request.holdAmount || 0)
      : 0;
    const capturableHold = Math.min(holdAmount, amount);
    const availableAfterHold = Math.max(0, profileBalance - profilePendingHold);
    const remainingAfterHold = Math.max(0, amount - capturableHold);
    const extraBalancePayment = paymentMethod === "profile_balance"
      ? Math.min(availableAfterHold, remainingAfterHold)
      : remainingAfterHold;
    const totalPaidNow = toMoney(capturableHold + extraBalancePayment);
    const debtAmount = paymentMethod === "profile_balance"
      ? toMoney(amount - totalPaidNow)
      : 0;

    const confirmed = await confirm({
      title: "Confirm payment",
      message: `Confirm payment of ${amount.toFixed(2)} AZN using ${
        paymentMethod === "profile_balance" ? "your profile balance" : paymentMethod
      }?`,
      confirmLabel: "Pay now",
      tone: "success",
    });

    if (!confirmed) {
      return;
    }

    setIsPayingTrip(true);
    setPaymentError("");

    try {
      if (paymentMethod === "profile_balance" && debtAmount > 0) {
        const nextPendingHold = Math.max(0, toMoney(profilePendingHold - holdAmount));
        const nextUser = {
          ...user,
          balance: Math.max(0, toMoney(profileBalance - totalPaidNow)),
          pendingHold: nextPendingHold,
          debtAmount,
        };

        tripCompletionApi.recordPartialPayment(request.id, paymentMethod, {
          amountPaid: totalPaidNow,
          debtAmount,
          capturedHoldAmount: capturableHold,
          extraBalancePayment,
        });
        persistUser(nextUser);
        setReservations(getStoredReservations());
        setPaymentError(
          `Paid ${totalPaidNow.toFixed(2)} AZN. Outstanding debt: ${debtAmount.toFixed(2)} AZN. Top up your balance to complete the ride.`
        );
        setTripNotice(`Trip payment is partially covered. Outstanding debt: ${debtAmount.toFixed(2)} AZN.`);
        return;
      }

      const paidRequest = tripCompletionApi.payRequest(request.id, paymentMethod);

      if (paymentMethod === "profile_balance") {
        persistUser({
          ...user,
          balance: Math.max(0, toMoney(profileBalance - totalPaidNow)),
          pendingHold: Math.max(0, toMoney(profilePendingHold - holdAmount)),
          debtAmount: 0,
        });
      }

      setReservations(getStoredReservations());
      setTripNotice(`Payment of ${amount.toFixed(2)} AZN was successful. The ride is completed.`);
      setReviewTrip(paidRequest);
      setReviewRating(5);
      setReviewComment("");
      setReviewError("");
    } catch (error) {
      setPaymentError(error.message || "The payment could not be completed.");
    } finally {
      setIsPayingTrip(false);
    }
  };

  const handleFinishPromo = () => {
    if (!paymentRequest) return;

    try {
      const updatedRequest = tripCompletionApi.applyPromoCode(
        paymentRequest.id,
        finishPromoCode
      );
      setReservations(getStoredReservations());
      setFinishPromoMessage(
        `Promo "${updatedRequest.promoCode}" applied: ${updatedRequest.discountPercent}% off.`
      );
      setPaymentError("");
    } catch (error) {
      setFinishPromoMessage("");
      setPaymentError(error.message || "Promo code could not be applied.");
    }
  };

  const submitTripReview = () => {
    if (!reviewTrip) return;

    if (!reviewComment.trim()) {
      setReviewError("Write a short comment about your trip.");
      return;
    }

    try {
      tripCompletionApi.addTripReview(reviewTrip.id, {
        rating: reviewRating,
        comment: reviewComment,
      });
      setTripNotice("Thank you! Your trip review was saved.");
      setReviewTrip(null);
      setReviewComment("");
      setReviewError("");
    } catch (error) {
      setReviewError(error.message || "The review could not be saved.");
    }
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
                      {vehicle.isAwaitingPayment
                        ? "Payment required"
                        : vehicle.isCompletionPending
                          ? "Under review"
                          : vehicle.isRideActive
                            ? "In ride"
                            : "Reserved"}
                    </span>
                  </div>

                  <div className="mt-6 rounded-2xl bg-zinc-950 p-5 text-white">
                    <div className="flex items-end justify-between gap-4">
                      <span className="font-mono text-4xl font-black tabular-nums">
                        {vehicle.isRideActive ? formatDuration(vehicle.rideElapsedSeconds) : formatTimer(vehicle.reservationRemainingSeconds)}
                      </span>
                      <span className="pb-1 text-xs font-black uppercase tracking-wide text-white/45">
                        {vehicle.isCompletionPending || vehicle.isAwaitingPayment
                          ? "final ride time"
                          : vehicle.isRideActive
                            ? "ride time"
                            : "free walk"}
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

                  {vehicle.isCompletionPending && (
                    <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      <div className="flex items-start gap-3">
                        <FiClock className="mt-0.5 shrink-0 text-amber-600" />
                        <div>
                          <p className="text-sm font-black text-amber-900">Waiting for staff approval</p>
                          <p className="mt-1 text-xs font-semibold leading-5 text-amber-700">
                            Your four vehicle photos were submitted. The ride remains in review and will close automatically after approval.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {vehicle.isAwaitingPayment && (
                    <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                      <div className="flex items-start gap-3">
                        <FiCheckCircle className="mt-0.5 shrink-0 text-emerald-600" />
                        <div>
                          <p className="text-sm font-black text-emerald-900">Photos approved — payment required</p>
                          <p className="mt-1 text-xs font-semibold leading-5 text-emerald-700">
                            The staff approved the vehicle condition. Confirm payment to complete the ride.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {Number(vehicle.debtAmount || 0) > 0 && (
                    <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
                      <div className="flex items-start gap-3">
                        <FiAlertCircle className="mt-0.5 shrink-0 text-red-600" />
                        <div>
                          <p className="text-sm font-black text-red-900">
                            Outstanding payment: {formatMoney(vehicle.debtAmount)}
                          </p>
                          <p className="mt-1 text-xs font-semibold leading-5 text-red-700">
                            New reservations are blocked until this debt is paid from your profile balance.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

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
                          ? handleQuickSupportAction(supportQuickActions[2])
                          : requestCancelReservation(vehicle)
                      }
                      className="rounded-2xl border border-zinc-200 px-5 py-4 text-sm font-black text-zinc-700 transition hover:border-red-200 hover:text-red-600"
                    >
                      {vehicle.isRideActive ? "Contact support" : "Cancel reservation"}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        vehicle.isAwaitingPayment
                          ? handlePayTrip(vehicle)
                          : vehicle.isRideActive
                          ? openTripCompletion(vehicle)
                          : handleUnlockVehicle(vehicle.reservationId)
                      }
                      className={`rounded-2xl px-5 py-4 text-sm font-black text-white transition ${
                        vehicle.isAwaitingPayment
                          ? "bg-emerald-600 hover:bg-emerald-700"
                          : vehicle.isCompletionPending
                          ? "cursor-not-allowed bg-amber-500"
                          : vehicle.isRideActive
                            ? "bg-zinc-950 hover:bg-zinc-800"
                            : "bg-red-500 hover:bg-red-600"
                      } ${vehicle.isVehicleUnlocked && !vehicle.isRideActive ? "cursor-not-allowed bg-zinc-100 text-zinc-400" : ""}`}
                      disabled={vehicle.isCompletionPending || (vehicle.isVehicleUnlocked && !vehicle.isRideActive)}
                    >
                      {vehicle.isAwaitingPayment
                        ? `Pay ${formatMoney(vehicle.finalRideCost || vehicle.rideCost)}`
                        : vehicle.isCompletionPending
                        ? "Awaiting approval"
                        : vehicle.isRideActive
                          ? "Finish ride"
                          : vehicle.isVehicleUnlocked
                            ? "Car unlocked"
                            : "Unlock car"}
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
            <p className="mt-4 text-5xl font-black tracking-tight">{formatMoney(profileBalance)}</p>
            <p className="mt-3 text-sm font-semibold text-white/50">
              Available now: {formatMoney(availableProfileBalance)}
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 p-4">
            <FiSmartphone className="text-3xl" />
          </div>
        </div>

        <div className="mt-6 grid gap-2 sm:grid-cols-3">
          {[
            ["Pending hold", formatMoney(profilePendingHold)],
            ["Outstanding debt", formatMoney(profileDebt)],
            ["Ride hold", formatMoney(PROFILE_BALANCE_HOLD_AZN)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-white/10 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-wide text-white/40">{label}</p>
              <p className="mt-1 text-sm font-black">{value}</p>
            </div>
          ))}
        </div>

        {profileDebt > 0 && (
          <div className="mt-4 rounded-2xl border border-red-300/40 bg-red-500/15 px-4 py-3 text-sm font-bold text-red-100">
            Pay the outstanding debt before creating another reservation.
          </div>
        )}

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

      {paymentVehicle && (
        <div className="fixed inset-0 z-[2200] flex items-center justify-center bg-zinc-950/70 p-4 backdrop-blur">
          <motion.div
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-2xl text-emerald-600">
              <FiCheckCircle />
            </span>
            <p className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-emerald-600">
              Staff approved the photos
            </p>
            <h2 className="mt-2 text-3xl font-black text-zinc-950">Confirm trip payment</h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-zinc-500">
              The vehicle condition was approved. Pay the final fare to complete the ride.
            </p>

            <div className="mt-6 rounded-3xl bg-zinc-950 p-5 text-white">
              <div className="mb-5">
                <span className="block text-xs font-black uppercase tracking-wide text-white/45">
                  {paymentVehicle.brand} {paymentVehicle.model}
                </span>
                <span className="mt-1 block text-sm font-bold text-white/70">
                  {paymentVehicle.paymentMethod === "profile_balance"
                    ? "Profile balance"
                    : paymentVehicle.paymentMethod || "Card"}
                </span>
              </div>
              <div className="space-y-3 border-t border-white/10 pt-4 text-sm font-bold">
                <div className="flex justify-between text-white/60">
                  <span>Trip price</span>
                  <span>{formatMoney(paymentRequest?.baseRideCost || paymentVehicle.baseRideCost || paymentVehicle.rideCost)}</span>
                </div>
                <div className="flex justify-between text-emerald-300">
                  <span>
                    Promo discount
                    {paymentRequest?.discountPercent ? ` (${paymentRequest.discountPercent}%)` : ""}
                  </span>
                  <span>-{formatMoney(paymentRequest?.discountAmount || 0)}</span>
                </div>
                {(paymentRequest?.holdAmount || paymentVehicle.holdAmount) > 0 && (
                  <div className="flex justify-between text-white/60">
                    <span>Reserved hold</span>
                    <span>{formatMoney(paymentRequest?.holdAmount || paymentVehicle.holdAmount)}</span>
                  </div>
                )}
                {(paymentRequest?.amountPaid || paymentVehicle.amountPaid) > 0 && (
                  <div className="flex justify-between text-white/60">
                    <span>Already paid</span>
                    <span>{formatMoney(paymentRequest?.amountPaid || paymentVehicle.amountPaid)}</span>
                  </div>
                )}
                {(paymentRequest?.debtAmount || paymentVehicle.debtAmount) > 0 && (
                  <div className="flex justify-between text-red-300">
                    <span>Outstanding debt</span>
                    <span>{formatMoney(paymentRequest?.debtAmount || paymentVehicle.debtAmount)}</span>
                  </div>
                )}
                <div className="flex items-end justify-between border-t border-white/10 pt-4">
                  <span className="text-white/70">Final price</span>
                  <span className="text-3xl font-black">
                    {formatMoney(paymentRequest?.finalRideCost || paymentVehicle.finalRideCost || paymentVehicle.rideCost)}
                  </span>
                </div>
              </div>
            </div>

            {!paymentRequest?.promoCode && (
              <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-zinc-500">
                  Have a promo code?
                </p>
                <p className="mt-1 text-xs font-semibold text-zinc-500">
                  You did not apply one during reservation. Enter it before payment.
                </p>
                <div className="mt-3 flex gap-2">
                  <input
                    value={finishPromoCode}
                    onChange={(event) => {
                      setFinishPromoCode(event.target.value);
                      setPaymentError("");
                    }}
                    placeholder="Enter promo code"
                    className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-red-300"
                  />
                  <button
                    type="button"
                    onClick={handleFinishPromo}
                    disabled={!finishPromoCode.trim()}
                    className="rounded-xl bg-zinc-950 px-4 py-3 text-sm font-black text-white disabled:bg-zinc-300"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}

            {paymentRequest?.promoCode && (
              <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
                Promo “{paymentRequest.promoCode}” applied. You saved {formatMoney(paymentRequest.discountAmount)}.
              </p>
            )}

            {finishPromoMessage && !paymentRequest?.promoCode && (
              <p className="mt-4 text-sm font-bold text-emerald-700">{finishPromoMessage}</p>
            )}

            {paymentError && (
              <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                {paymentError}
              </p>
            )}

            <div className="mt-6">
              <button
                type="button"
                onClick={() => handlePayTrip(paymentVehicle)}
                disabled={isPayingTrip}
                className="w-full rounded-2xl bg-emerald-600 px-5 py-4 text-sm font-black text-white transition hover:bg-emerald-700 disabled:opacity-50"
              >
                {isPayingTrip
                  ? "Paying..."
                  : Number(paymentVehicle.debtAmount || paymentRequest?.debtAmount || 0) > 0
                    ? "Pay outstanding balance"
                    : "Confirm and pay"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {reviewTrip && (
        <div className="fixed inset-0 z-[2300] flex items-center justify-center bg-zinc-950/70 p-4 backdrop-blur">
          <motion.div
            className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
          >
            <p className="text-xs font-black uppercase tracking-[0.18em] text-red-500">
              Payment successful
            </p>
            <h2 className="mt-2 text-3xl font-black text-zinc-950">How was your trip?</h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-zinc-500">
              Rate your ride in {reviewTrip.vehicleName} and leave a short comment.
            </p>

            <div className="mt-6 flex justify-center gap-2 rounded-3xl bg-zinc-50 p-5">
              {Array.from({ length: 5 }).map((_, index) => {
                const value = index + 1;

                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setReviewRating(value)}
                    className={`text-4xl transition hover:scale-110 ${
                      value <= reviewRating ? "text-amber-400" : "text-zinc-200"
                    }`}
                    aria-label={`${value} star rating`}
                  >
                    <FiStar className={value <= reviewRating ? "fill-current" : ""} />
                  </button>
                );
              })}
            </div>

            <textarea
              value={reviewComment}
              onChange={(event) => {
                setReviewComment(event.target.value);
                setReviewError("");
              }}
              maxLength={500}
              rows={5}
              placeholder="Tell us what you liked or what we should improve..."
              className="mt-4 w-full resize-none rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm font-semibold text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-red-300 focus:bg-white"
            />
            <p className="mt-2 text-right text-xs font-bold text-zinc-400">
              {reviewComment.length}/500
            </p>

            {reviewError && (
              <p className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                {reviewError}
              </p>
            )}

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setReviewTrip(null);
                  setReviewComment("");
                  setReviewError("");
                }}
                className="rounded-2xl border border-zinc-200 px-5 py-4 text-sm font-black text-zinc-600 transition hover:border-zinc-300"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={submitTripReview}
                className="rounded-2xl bg-red-500 px-5 py-4 text-sm font-black text-white transition hover:bg-red-600"
              >
                Send comment
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {completionTarget && (
        <div className="fixed inset-0 z-[2100] overflow-y-auto bg-zinc-950/75 p-4 backdrop-blur">
          <div className="flex min-h-full items-center justify-center py-6">
            <motion.div
              className="w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl"
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
            >
              <div className="flex items-start justify-between gap-4 border-b border-zinc-100 p-6">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-red-500">Finish ride safely</p>
                  <h2 className="mt-2 text-3xl font-black text-zinc-950">Add four vehicle photos</h2>
                  <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-zinc-500">
                    Photograph the complete front, rear, left, and right sides. A staff member will review them before the ride is closed.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeTripCompletion}
                  disabled={isSubmittingCompletion}
                  className="rounded-full bg-zinc-100 p-3 text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-950 disabled:opacity-50"
                  aria-label="Close photo upload"
                >
                  <FiX />
                </button>
              </div>

              <div className="grid gap-4 p-6 sm:grid-cols-2">
                {TRIP_PHOTO_ANGLES.map((angle) => {
                  const photo = completionPhotos[angle.id];

                  return (
                    <label
                      key={angle.id}
                      className={`group relative min-h-[230px] cursor-pointer overflow-hidden rounded-3xl border-2 border-dashed transition ${
                        photo
                          ? "border-emerald-300 bg-emerald-50"
                          : "border-zinc-200 bg-zinc-50 hover:border-red-300 hover:bg-red-50"
                      }`}
                    >
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="sr-only"
                        onChange={(event) => handleTripPhoto(angle.id, event)}
                        disabled={isPreparingPhoto || isSubmittingCompletion}
                      />

                      {photo ? (
                        <>
                          <img
                            src={photo.dataUrl}
                            alt={`${angle.label} vehicle view`}
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-zinc-950/90 to-transparent p-5 pt-12 text-white">
                            <p className="flex items-center gap-2 text-sm font-black">
                              <FiCheckCircle className="text-emerald-300" />
                              {angle.label}
                            </p>
                            <p className="mt-1 truncate text-xs font-semibold text-white/65">
                              {photo.name} · click to replace
                            </p>
                          </div>
                        </>
                      ) : (
                        <span className="flex min-h-[230px] flex-col items-center justify-center p-6 text-center">
                          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-2xl text-red-500 shadow-sm transition group-hover:scale-105">
                            <FiCamera />
                          </span>
                          <span className="mt-4 text-lg font-black text-zinc-950">{angle.label}</span>
                          <span className="mt-1 text-xs font-semibold text-zinc-500">{angle.hint}</span>
                          <span className="mt-4 text-[11px] font-black uppercase tracking-wide text-red-500">
                            Take or choose photo
                          </span>
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>

              <div className="border-t border-zinc-100 bg-zinc-50 p-6">
                {completionError && (
                  <p className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                    {completionError}
                  </p>
                )}

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-bold text-zinc-500">
                    {Object.keys(completionPhotos).length} of 4 photos ready
                    {isPreparingPhoto ? " · processing photo..." : ""}
                  </p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={closeTripCompletion}
                      disabled={isSubmittingCompletion}
                      className="rounded-2xl border border-zinc-200 bg-white px-5 py-4 text-sm font-black text-zinc-700 transition hover:border-zinc-300 disabled:opacity-50"
                    >
                      Not now
                    </button>
                    <button
                      type="button"
                      onClick={submitTripCompletion}
                      disabled={
                        Object.keys(completionPhotos).length !== TRIP_PHOTO_ANGLES.length ||
                        isPreparingPhoto ||
                        isSubmittingCompletion
                      }
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-500 px-6 py-4 text-sm font-black text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-zinc-300"
                    >
                      <FiUploadCloud />
                      {isSubmittingCompletion ? "Sending..." : "Send for approval"}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
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
      {dialog}
    </main>
  );
};

export default Dashboard;
