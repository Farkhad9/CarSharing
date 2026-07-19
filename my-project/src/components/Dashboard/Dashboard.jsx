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
  FiSend,
  FiShield,
  FiSmartphone,
  FiStar,
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
import { useConfirmDialog } from "../ui/useConfirmDialog";
import { paymentApi } from "../../api/paymentApi";
import { invoiceApi } from "../../api/invoiceApi";
import { reservationApi } from "../../api/reservationApi";
import { tripApi } from "../../api/tripApi";
import { tripReviewsApi } from "../../api/tripReviewsApi";
import { userApi } from "../../api/userApi";
import { vehicleApi } from "../../api/vehicleApi";
import {
  DEFAULT_PICKUP_USER_LOCATION,
  formatPickupDistance,
  getDistanceMeters,
  getWalkingRouteUrl,
  getWalkMinutes,
} from "../../utils/pickupMetrics";
import { RESERVATION_SECONDS } from "../../utils/reservations";

const DEFAULT_USER_LOCATION = DEFAULT_PICKUP_USER_LOCATION;
const TRIP_PHOTO_ANGLES = [
  { id: "front", label: "Front", hint: "Full front side of the car" },
  { id: "rear", label: "Rear", hint: "Full rear side of the car" },
  { id: "left", label: "Left side", hint: "Driver side from bumper to bumper" },
  { id: "right", label: "Right side", hint: "Passenger side from bumper to bumper" },
];

const TRIP_STATUS = {
  Active: 1,
  PendingCompletionReview: 2,
  AwaitingPayment: 3,
  Completed: 4,
  Cancelled: 5,
};

const USER_VERIFICATION_STATUS = {
  Pending: 1,
  Verified: 2,
  Rejected: 3,
  Internal: 4,
};

const DASHBOARD_TAB_STORAGE_KEY = "electroStreetDashboardActiveTab";
const AUTO_PAY_TRIP_STORAGE_KEY = "electroStreetAutoPayTripId";
const PENDING_TRIP_REVIEW_STORAGE_KEY = "electroStreetPendingTripReview";
const LEGACY_DOCUMENTS_STORAGE_KEY = "electroStreetDocuments";
const getDocumentsStorageKey = (userId) => `${LEGACY_DOCUMENTS_STORAGE_KEY}:${userId || "anonymous"}`;
const EMPTY_DOCUMENTS = {
  license: { status: "Upload required", fileName: "", url: "" },
  passport: { status: "Upload required", fileName: "", url: "" },
};

const COMPLETION_REQUEST_STATUS = {
  PendingReview: 1,
  Approved: 2,
  Rejected: 3,
};

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

const getInitialDashboardTab = () => {
  const params = new URLSearchParams(window.location.search);
  if (params.get("stripe") === "success") return "trip";

  const requestedTab = params.get("tab");
  if (tabs.some((tab) => tab.id === requestedTab)) return requestedTab;

  const navigationType = window.performance?.getEntriesByType?.("navigation")?.[0]?.type;
  if (navigationType === "reload") {
    const storedTab = localStorage.getItem(DASHBOARD_TAB_STORAGE_KEY);
    if (tabs.some((tab) => tab.id === storedTab)) return storedTab;
  }

  return "trip";
};

const readPendingTripReview = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(PENDING_TRIP_REVIEW_STORAGE_KEY) || "null");
    return parsed?.tripId ? parsed : null;
  } catch {
    return null;
  }
};

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

const parseBackendDate = (value) => {
  if (!value) return null;
  const text = String(value);
  const normalized = /Z$|[+-]\d{2}:\d{2}$/.test(text) ? text : `${text}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getBackendTime = (value) => parseBackendDate(value)?.getTime() ?? 0;

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

const formatPaymentMethod = (method) => {
  if (method === 2 || String(method).toLowerCase() === "stripe") return "Card";
  if (String(method).toLowerCase() === "balance") return "Balance";
  return method || "Payment";
};

const isUserVerificationStatus = (value, statusName) => {
  const expected = USER_VERIFICATION_STATUS[statusName];
  return value === expected || String(value).toLowerCase() === statusName.toLowerCase();
};

const formatSupportTime = (value) =>
  (parseBackendDate(value) || new Date(value)).toLocaleTimeString([], {
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
          file,
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

const getReservationVehicle = (reservation, backendVehicles = []) => {
  if (!reservation) return null;

  const vehicle = backendVehicles.find((item) => item.id === reservation.vehicleId);
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

const mapBackendRideState = ({ reservations, activeTrips, vehicles }) => {
  const mappedReservations = (Array.isArray(reservations) ? reservations : []).map((reservation) => {
    const vehicle = vehicles.find((item) => item.id === reservation.vehicleId);
    return {
      ...reservation,
      reservationId: reservation.id,
      rate: Number(vehicle?.pricePerMinute || 0),
    };
  });

  const mappedTrips = (Array.isArray(activeTrips) ? activeTrips : []).map((activeTrip) => {
    const completion = activeTrip.latestCompletionRequest;
    const completionStatus = completion?.status;
    const isRejected =
      completionStatus === COMPLETION_REQUEST_STATUS.Rejected ||
      String(completionStatus).toLowerCase() === "rejected";
    return {
      id: activeTrip.reservationId || activeTrip.id,
      reservationId: activeTrip.reservationId || activeTrip.id,
      tripId: activeTrip.id,
      vehicleId: activeTrip.vehicleId,
      reservedAt: activeTrip.startedAt,
      expiresAt: activeTrip.startedAt,
      tripStartedAt: activeTrip.startedAt,
      billingStartedAt: activeTrip.startedAt,
      finishRequestedAt: activeTrip.endRequestedAt,
      tripStatus:
        activeTrip.status === TRIP_STATUS.AwaitingPayment
          ? "awaiting_payment"
          : activeTrip.status === TRIP_STATUS.PendingCompletionReview
            ? isRejected ? "completion_rejected" : "pending_review"
            : "active",
      completionRequestId: completion?.id || null,
      completionRejectionReason: completion?.rejectionReason || "",
      rate: Number(activeTrip.pricePerMinute || 0),
      baseRideCost: Number(activeTrip.basePrice || 0),
      finalRideCost: Number(activeTrip.totalPrice || 0),
      rideCost: Number(activeTrip.totalPrice || 0),
      discountPercent: Number(activeTrip.discountPercent || 0),
      discountAmount: Number(activeTrip.discountAmount || 0),
      currency: activeTrip.currency || "AZN",
      latestCompletionRequest: activeTrip.latestCompletionRequest || null,
    };
  });

  if (mappedTrips.length) {
    const tripsByReservationId = new Map(mappedTrips.map((trip) => [trip.reservationId, trip]));
    const tripsByVehicleId = new Map(mappedTrips.map((trip) => [trip.vehicleId, trip]));
    const usedTripIds = new Set();

    const mergedReservations = mappedReservations.map((reservation) => {
      const mappedTrip = tripsByReservationId.get(reservation.id || reservation.reservationId)
        || tripsByVehicleId.get(reservation.vehicleId);
      if (!mappedTrip) return reservation;
      usedTripIds.add(mappedTrip.tripId);
      return { ...reservation, ...mappedTrip };
    });

    return [
      ...mappedTrips.filter((trip) => !usedTripIds.has(trip.tripId)),
      ...mergedReservations,
    ];
  }

  return mappedReservations;
};

const getVehiclePosition = (vehicle) => [
  vehicle?.location?.lat || DEFAULT_USER_LOCATION[0],
  vehicle?.location?.lng || DEFAULT_USER_LOCATION[1],
];

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
  const [activeTab, setActiveTab] = useState(getInitialDashboardTab);
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
  const [reservations, setReservations] = useState([]);
  const [backendVehicles, setBackendVehicles] = useState([]);
  const [activeTrip, setActiveTrip] = useState(null);
  const [activeTrips, setActiveTrips] = useState([]);
  const [isLoadingRideState, setIsLoadingRideState] = useState(false);
  const [rideStateError, setRideStateError] = useState("");
  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("50");
  const [cardForm, setCardForm] = useState({ number: "", holder: user.name || "Farhad" });
  const [paymentCards, setPaymentCards] = useState(() =>
    getStoredJson("electroStreetCards", [])
  );
  const [documents, setDocuments] = useState(() =>
    getStoredJson(getDocumentsStorageKey(user.id), EMPTY_DOCUMENTS)
  );
  const [identityDocumentFiles, setIdentityDocumentFiles] = useState({
    license: null,
    passport: null,
  });
  const [isSubmittingDocuments, setIsSubmittingDocuments] = useState(false);
  const [documentsError, setDocumentsError] = useState("");
  const [blockedNotice, setBlockedNotice] = useState("");
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
  const [hasResolvedUserLocation, setHasResolvedUserLocation] = useState(() => !("geolocation" in navigator));
  const [routeStates, setRouteStates] = useState({});
  const [selectedMapReservationId, setSelectedMapReservationId] = useState(null);
  const [cancelReservationTarget, setCancelReservationTarget] = useState(null);
  const [completionTarget, setCompletionTarget] = useState(null);
  const [completionPhotos, setCompletionPhotos] = useState({});
  const [completionError, setCompletionError] = useState("");
  const [isPreparingPhoto, setIsPreparingPhoto] = useState(false);
  const [isSubmittingCompletion, setIsSubmittingCompletion] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [paymentBalance, setPaymentBalance] = useState(null);
  const [paymentTransactions, setPaymentTransactions] = useState([]);
  const [paymentInvoices, setPaymentInvoices] = useState([]);
  const [isLoadingPayments, setIsLoadingPayments] = useState(false);
  const [isPayingTrip, setIsPayingTrip] = useState(false);
  const [tripPaymentMethod, setTripPaymentMethod] = useState("balance");
  const [hiddenPaymentTripIds, setHiddenPaymentTripIds] = useState(() => new Set());
  const [isOpeningTopUp, setIsOpeningTopUp] = useState(false);
  const [finishPromoCode, setFinishPromoCode] = useState("");
  const [finishPromoMessage, setFinishPromoMessage] = useState("");
  const [reviewTrip, setReviewTrip] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [paymentSuccessDialog, setPaymentSuccessDialog] = useState(null);
  const { confirm, dialog } = useConfirmDialog();

  const licenseInputRef = useRef(null);
  const passportInputRef = useRef(null);
  const supportReplyTimersRef = useRef([]);
  const autoPayInFlightRef = useRef(false);

  const activeReservations = useMemo(() => {
    return reservations.map((reservation) => {
      const vehicle = getReservationVehicle(reservation, backendVehicles);
      const isVehicleUnlocked = Boolean(reservation?.unlockedAt);
      const rideStartedAt = reservation?.tripStartedAt || reservation?.unlockedAt || null;
      const isRideActive = Boolean(rideStartedAt);
      const isFinishingRide = reservation?.tripStatus === "finishing";
      const isCompletionPending = reservation?.tripStatus === "pending_review";
      const isCompletionRejected = reservation?.tripStatus === "completion_rejected";
      const isAwaitingPayment = reservation?.tripStatus === "awaiting_payment";
      const rideTimerEnd = (isFinishingRide || isCompletionPending || isCompletionRejected || isAwaitingPayment) && reservation?.finishRequestedAt
        ? getBackendTime(reservation.finishRequestedAt)
        : timerNow;
      const reservationRemainingSeconds = Math.max(
        0,
        Math.floor((getBackendTime(reservation.expiresAt) - timerNow) / 1000)
      );
      const reservationProgress = Math.max(0, Math.min(100, (reservationRemainingSeconds / RESERVATION_SECONDS) * 100));
      const rideElapsedSeconds = rideStartedAt
        ? Math.max(0, Math.floor((rideTimerEnd - getBackendTime(rideStartedAt)) / 1000))
        : 0;
      const liveRideCost = isRideActive
        ? Number((((rideElapsedSeconds || 0) / 60) * Number(vehicle?.rate || vehicle?.pricePerMinute || 0)).toFixed(2))
        : 0;
      const storedFinalCost = Number(
        reservation?.latestCompletionRequest?.finalRideCost
          || reservation?.finalRideCost
          || reservation?.frozenRideCost
          || reservation?.rideCost
          || 0
      );
      const rideCost = isFinishingRide || isCompletionPending || isCompletionRejected || isAwaitingPayment
        ? storedFinalCost
        : liveRideCost;
      const resolvedReservationId = reservation.reservationId || reservation.id || reservation.vehicleId || reservation.tripId;

      return {
        ...vehicle,
        reservationId: resolvedReservationId,
        isVehicleUnlocked,
        rideStartedAt,
        isRideActive,
        isFinishingRide,
        isCompletionPending,
        isCompletionRejected,
        isAwaitingPayment,
        reservationRemainingSeconds,
        reservationProgress,
        rideElapsedSeconds,
        rideCost,
      };
    });
  }, [backendVehicles, reservations, timerNow]);
  const activeVehicle = activeReservations[0] || null;
  const selectedMapVehicle = activeReservations.find((vehicle) => vehicle.reservationId === selectedMapReservationId)
    || activeVehicle;
  const paymentVehicle = activeReservations.find((vehicle) => {
    const tripId = vehicle?.tripId || vehicle?.id;
    return vehicle.isAwaitingPayment && !hiddenPaymentTripIds.has(tripId);
  }) || null;
  const paymentTrip = paymentVehicle
    ? activeTrips.find((trip) => trip.id === paymentVehicle.tripId)
    : null;
  const paymentRequest = paymentVehicle?.latestCompletionRequest || paymentTrip?.latestCompletionRequest || null;
  const tripCardAmount = toMoney(paymentRequest?.finalRideCost || paymentVehicle?.finalRideCost || paymentVehicle?.rideCost || 0);
  const isTripCardAmountTooSmall = Boolean(paymentVehicle && tripCardAmount > 0 && tripCardAmount < 1.1);
  const activeSupportTicket = useMemo(
    () => supportTickets.find((ticket) => ticket.id === activeSupportTicketId) || supportTickets[0] || null,
    [activeSupportTicketId, supportTickets]
  );
  const profileBalance = Number(paymentBalance?.balance ?? user.balance ?? 0);
  const profilePendingHold = Number(user.pendingHold ?? 0);
  const receiptByTransactionId = useMemo(() => {
    return new Map(
      paymentInvoices
        .filter((invoice) => invoice?.paymentTransactionId)
        .map((invoice) => [invoice.paymentTransactionId, invoice])
    );
  }, [paymentInvoices]);

  const recentTrips = useMemo(() => [], []);

  const pendingVerification = getStoredJson("electroStreetPendingEmailVerification");

  const persistUser = (nextUser) => {
    setUser(nextUser);
    localStorage.setItem("electroStreetUser", JSON.stringify(nextUser));
  };

  const persistCards = (nextCards) => {
    setPaymentCards(nextCards);
    localStorage.setItem("electroStreetCards", JSON.stringify(nextCards));
  };

  const persistDocuments = (nextDocuments, userId = user.id) => {
    setDocuments(nextDocuments);
    localStorage.setItem(getDocumentsStorageKey(userId), JSON.stringify(nextDocuments));
  };

  const clearIdentityFileInputs = () => {
    if (licenseInputRef.current) licenseInputRef.current.value = "";
    if (passportInputRef.current) passportInputRef.current.value = "";
  };

  const syncDocumentsFromUser = (nextUser, selectedFileNames = {}) => {
    const verificationStatus = nextUser?.verificationStatus;
    const hasSubmittedDocuments = Boolean(nextUser?.driverLicenseDocumentUrl || nextUser?.passportDocumentUrl || nextUser?.verificationSubmittedAt);
    const isRejected = isUserVerificationStatus(verificationStatus, "Rejected");
    const isVerified = isUserVerificationStatus(verificationStatus, "Verified");
    const hasPendingLocalSelection = Boolean(
      identityDocumentFiles.license ||
      identityDocumentFiles.passport ||
      documents.license?.fileName ||
      documents.passport?.fileName
    );

    if (!hasSubmittedDocuments && !isRejected && !isVerified) {
      if (hasPendingLocalSelection) return;
      persistDocuments(EMPTY_DOCUMENTS, nextUser?.id);
      return;
    }

    if (isRejected) {
      setIdentityDocumentFiles({ license: null, passport: null });
      clearIdentityFileInputs();
      persistDocuments({
        license: { status: "Rejected", fileName: "", url: "" },
        passport: { status: "Rejected", fileName: "", url: "" },
      }, nextUser?.id);
      return;
    }

    const nextStatus = isVerified
      ? "Verified"
      : "Under review";

    persistDocuments({
      license: {
        status: nextStatus,
        fileName: selectedFileNames.license || (nextUser.driverLicenseDocumentUrl ? "Driver license uploaded" : ""),
        url: nextUser.driverLicenseDocumentUrl || "",
      },
      passport: {
        status: nextStatus,
        fileName: selectedFileNames.passport || (nextUser.passportDocumentUrl ? "Passport uploaded" : ""),
        url: nextUser.passportDocumentUrl || "",
      },
    }, nextUser?.id);
  };

  const loadUserProfile = async () => {
    if (!localStorage.getItem("electroStreetAccessToken")) return;
    try {
      const nextUser = await userApi.getMe();
      if (nextUser.isActive === false) {
        localStorage.removeItem("electroStreetAccessToken");
        localStorage.removeItem("electroStreetUser");
        setBlockedNotice(nextUser.blockReason || "Your account is blocked. Contact support for details.");
        return;
      }
      persistUser({
        ...user,
        ...nextUser,
        balance: paymentBalance?.balance ?? nextUser.balance ?? user.balance,
      });
      syncDocumentsFromUser(nextUser);
    } catch (error) {
      const isBlocked = error.code === "User.Blocked" || error.errors?.some((item) => item.code === "User.Blocked");
      if (isBlocked || error.status === 403) {
        localStorage.removeItem("electroStreetAccessToken");
        localStorage.removeItem("electroStreetUser");
        setBlockedNotice(error.message || "Your account is blocked. Contact support for details.");
      }
    }
  };

  const persistSupportTickets = (nextTickets) => {
    setSupportTickets(nextTickets);
    localStorage.setItem("electroStreetSupportTickets", JSON.stringify(nextTickets));
  };

  const loadPayments = async () => {
    if (!localStorage.getItem("electroStreetAccessToken")) return;
    setIsLoadingPayments(true);
    try {
      const [balance, transactions] = await Promise.all([
        paymentApi.getBalance(),
        paymentApi.getTransactions(),
      ]);
      setPaymentBalance(balance);
      setPaymentTransactions(transactions);
      persistUser({
        ...getStoredJson("electroStreetUser", user),
        balance: balance.balance,
        pendingHold: 0,
      });

      try {
        const invoices = await invoiceApi.getMyInvoices();
        setPaymentInvoices(Array.isArray(invoices) ? invoices : []);
      } catch (error) {
        if (error.status !== 404) {
          setPaymentInvoices([]);
        }
      }
    } catch (error) {
      setPaymentError(error.message || "Payment information could not be loaded.");
    } finally {
      setIsLoadingPayments(false);
    }
  };

  const loadRideState = async (options = {}) => {
    const silent = options.silent === true;
    if (!localStorage.getItem("electroStreetAccessToken")) {
      setRideStateError("Sign in again to load your reservations.");
      return;
    }
    if (!silent) setIsLoadingRideState(true);
    setRideStateError("");
    try {
      const [vehiclesResult, reservationsResult, tripResult] = await Promise.allSettled([
        vehicleApi.getVehicles(),
        reservationApi.getMyActive(),
        tripApi.getMyActive(),
      ]);
      const vehicles = vehiclesResult.status === "fulfilled" ? vehiclesResult.value : [];
      const activeReservations = reservationsResult.status === "fulfilled" ? reservationsResult.value : [];
      const nextActiveTrips = tripResult.status === "fulfilled"
        ? Array.isArray(tripResult.value) ? tripResult.value : (tripResult.value ? [tripResult.value] : [])
        : [];

      setBackendVehicles(Array.isArray(vehicles) ? vehicles : []);
      setActiveTrips(nextActiveTrips);
      setActiveTrip(nextActiveTrips[0] || null);
      setReservations(mapBackendRideState({
        reservations: activeReservations,
        activeTrips: nextActiveTrips,
        vehicles: Array.isArray(vehicles) ? vehicles : [],
      }));

      const errors = [vehiclesResult, reservationsResult, tripResult]
        .filter((result) => result.status === "rejected")
        .map((result) => result.reason?.message)
        .filter(Boolean);
      if (errors.length) {
        setRideStateError(errors.join("\n"));
      }
    } catch (error) {
      setRideStateError(error.message || "Ride state could not be loaded.");
    } finally {
      if (!silent) setIsLoadingRideState(false);
    }
  };

  const downloadReceipt = async (invoice) => {
    if (!invoice?.id) return;

    try {
      await invoiceApi.openMyReceipt(invoice.id);
    } catch (error) {
      setPaymentError(error.message || "Receipt could not be opened.");
    }
  };

  const downloadTransactionReceipt = async (transaction) => {
    if (!transaction?.id) return;

    setPaymentError("");
    const existingReceipt = receiptByTransactionId.get(transaction.id);
    if (existingReceipt?.id) {
      await downloadReceipt(existingReceipt);
      return;
    }

    try {
      const invoices = await invoiceApi.getMyInvoices();
      const nextInvoices = Array.isArray(invoices) ? invoices : [];
      setPaymentInvoices(nextInvoices);
      const receipt = nextInvoices.find((invoice) => invoice?.paymentTransactionId === transaction.id);
      if (receipt?.id) {
        await invoiceApi.openMyReceipt(receipt.id);
        return;
      }
      setPaymentError("Receipt is still being prepared. Please refresh in a moment.");
    } catch (error) {
      setPaymentError(error.message || "Receipt could not be opened.");
    }
  };

  useEffect(() => {
    localStorage.setItem(DASHBOARD_TAB_STORAGE_KEY, activeTab);
  }, [activeTab]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadUserProfile();
      loadRideState({ silent: true });
      loadPayments();
      const stripeResult = new URLSearchParams(window.location.search).get("stripe");
      if (stripeResult === "success") {
        const pendingReview = readPendingTripReview();
        setTripNotice("Card payment was accepted. Balance will update after confirmation.");
        if (pendingReview) {
          setReviewTrip({
            tripId: pendingReview.tripId,
            vehicleName: pendingReview.vehicleName || "your EV",
            paymentMethod: "card",
          });
          setReviewRating(5);
          setReviewComment("");
          setReviewError("");
        } else {
          setPaymentSuccessDialog({ source: "card" });
        }
      }
      if (stripeResult === "cancelled") setPaymentError("Card checkout was cancelled. Your balance was not changed.");
      if (stripeResult) {
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete("stripe");
        if (cleanUrl.searchParams.get("tab") === "payments") {
          cleanUrl.searchParams.delete("tab");
        }
        window.history.replaceState({}, "", `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
      }
    }, 0);
    return () => window.clearTimeout(timer);
    // Payment state is loaded once when the dashboard opens or returns from card checkout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      loadUserProfile();
      loadRideState({ silent: true });
      loadPayments();
    }, 15000);

    return () => window.clearInterval(timer);
    // Polling keeps customer payment state in sync after review approval.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!reservations.length) return undefined;

    const interval = window.setInterval(() => {
      setTimerNow(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, [reservations.length]);

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
        setUserLocation(DEFAULT_USER_LOCATION);
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

  useEffect(() => {
    if (!activeReservations.length) {
      const timer = window.setTimeout(() => setSelectedMapReservationId(null), 0);
      return () => window.clearTimeout(timer);
    }

    if (!activeReservations.some((vehicle) => vehicle.reservationId === selectedMapReservationId)) {
      const timer = window.setTimeout(() => setSelectedMapReservationId(activeReservations[0].reservationId), 0);
      return () => window.clearTimeout(timer);
    }

    return undefined;
  }, [activeReservations, selectedMapReservationId]);

  useEffect(() => {
    if (!activeReservations.length) {
      const clearRouteTimer = window.setTimeout(() => setRouteStates({}), 0);
      return () => window.clearTimeout(clearRouteTimer);
    }

    if (!hasResolvedUserLocation) {
      return undefined;
    }

    const controllers = [];

    activeReservations
      .filter((vehicle) =>
        vehicle?.reservationId &&
        !vehicle.isRideActive &&
        Number.isFinite(Number(vehicle?.latitude)) &&
        Number.isFinite(Number(vehicle?.longitude))
      )
      .forEach((vehicle) => {
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
              durationSeconds: null,
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
  }, [activeReservations, hasResolvedUserLocation, userLocation]);

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

  const cancelReservation = async (reservationId) => {
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

    try {
      await reservationApi.cancel(reservationId);
      await loadRideState();
      setTripNotice("");
      setCancelReservationTarget(null);
    } catch (error) {
      setTripNotice("");
      setRideStateError(error.message || "Reservation could not be cancelled.");
    }
  };

  const requestCancelReservation = (vehicle) => {
    setCancelReservationTarget(vehicle);
  };

  const openTripCompletion = (vehicle) => {
    if (vehicle.isCompletionPending) return;

    const finishRequestedAt = new Date().toISOString();
    const frozenVehicle = {
      ...vehicle,
      previousTripStatus: vehicle.isCompletionRejected ? "completion_rejected" : "active",
      finishRequestedAt,
      rideCost: vehicle.rideCost,
      rideElapsedSeconds: vehicle.rideElapsedSeconds,
    };

    setReservations((currentReservations) =>
      currentReservations.map((reservation) =>
        (reservation.id || reservation.vehicleId) === vehicle.reservationId
          ? {
              ...reservation,
              previousTripStatus: vehicle.isCompletionRejected ? "completion_rejected" : "active",
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
              tripStatus: reservation.previousTripStatus || completionTarget?.previousTripStatus || "active",
              finishRequestedAt: null,
              frozenRideCost: null,
              previousTripStatus: null,
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
      message: "Send these four photos for review? You will not be able to finish the trip until they are approved.",
      confirmLabel: "Send for review",
      tone: "info",
    });

    if (!confirmed) {
      return;
    }

    setIsSubmittingCompletion(true);
    setCompletionError("");

    try {
      await tripApi.submitCompletion(completionTarget.tripId, completionPhotos);
      await loadRideState();
      setTripNotice(
        "Four photos were sent for review. The ride will close after approval."
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

    try {
      const trip = await tripApi.start(reservationId);
      setActiveTrip(trip);
      await loadRideState();
      setTripNotice("Ride started. You can finish the ride when you arrive.");
    } catch (error) {
      setRideStateError(error.message || "The trip could not be started.");
    }
  };

  const handleOpenTopUpForTrip = (targetVehicle = paymentVehicle) => {
    const tripId = targetVehicle?.tripId || targetVehicle?.id;
    if (!tripId) return;

    const targetRequest = targetVehicle?.latestCompletionRequest || paymentRequest;
    const amount = toMoney(targetRequest?.finalRideCost || targetVehicle.finalRideCost || targetVehicle.rideCost || 0);
    const missingAmount = Math.max(5, Math.ceil(Math.max(0, amount - profileBalance) * 100) / 100);

    localStorage.setItem(AUTO_PAY_TRIP_STORAGE_KEY, tripId);
    setHiddenPaymentTripIds((items) => new Set([...items, tripId]));
    setTopUpAmount(missingAmount.toFixed(2));
    setPaymentError("");
    setActiveTab("payments");
    setIsTopUpModalOpen(true);
  };

  const handlePayTrip = async (targetVehicle = paymentVehicle, options = {}) => {
    const tripId = targetVehicle?.tripId || targetVehicle?.id;
    if (!tripId) return;
    const targetRequest = targetVehicle?.latestCompletionRequest || paymentRequest;
    const amount = toMoney(targetRequest?.finalRideCost || targetVehicle.finalRideCost || targetVehicle.rideCost || 0);

    if (!options.skipConfirm) {
      const confirmed = await confirm({
        title: "Confirm payment",
        message: `Confirm payment of ${amount.toFixed(2)} AZN from your ElectroStreet balance?`,
        confirmLabel: "Pay now",
        tone: "success",
      });

      if (!confirmed) {
        return;
      }
    }

    setIsPayingTrip(true);
    setPaymentError("");

    try {
      const result = await paymentApi.payTrip(tripId);
      setPaymentBalance((current) => ({ ...(current || {}), balance: result.remainingBalance, pendingHold: 0, currency: "AZN" }));
      setPaymentTransactions((current) => [result.transaction, ...current]);
      await loadRideState();
      await loadPayments();
      setTripNotice(`Payment of ${amount.toFixed(2)} AZN was successful. The ride is completed.`);
      localStorage.removeItem(AUTO_PAY_TRIP_STORAGE_KEY);
      setHiddenPaymentTripIds((items) => {
        const next = new Set(items);
        next.delete(tripId);
        return next;
      });
      setReviewTrip({ tripId, vehicleName: `${targetVehicle.brand} ${targetVehicle.model}` });
      setReviewRating(5);
      setReviewComment("");
      setReviewError("");
    } catch (error) {
      if (!options.silent) {
        setPaymentError(error.message || "The payment could not be completed.");
      }
      await loadPayments();
    } finally {
      setIsPayingTrip(false);
    }
  };

  const handleFinishPromo = async () => {
    setFinishPromoMessage("");
    setPaymentError("");

    const targetTrip = activeTrips.find((trip) => trip.id === paymentVehicle?.tripId)
      || activeTrip;
    const tripId = paymentVehicle?.tripId || targetTrip?.id;
    const code = finishPromoCode.trim();
    if (!tripId || !code) return;

    try {
      const updatedTrip = await tripApi.applyPromoCode(tripId, code);
      setActiveTrip(updatedTrip);
      setActiveTrips((items) => items.map((trip) => (trip.id === updatedTrip.id ? updatedTrip : trip)));
      setFinishPromoCode("");
      setFinishPromoMessage(`Promo code applied. You saved ${formatMoney(updatedTrip?.discountAmount || updatedTrip?.latestCompletionRequest?.discountAmount || 0)}.`);
      await loadRideState();
    } catch (error) {
      setPaymentError(error.message || "Promo code could not be applied.");
    }
  };

  const handlePayTripByCard = async (targetVehicle = paymentVehicle) => {
    const tripId = targetVehicle?.tripId || targetVehicle?.id;
    if (!tripId) return;

    const amount = toMoney(paymentRequest?.finalRideCost || targetVehicle.finalRideCost || targetVehicle.rideCost || 0);
    const confirmed = await confirm({
      title: "Pay by card",
      message: `Open secure card checkout and pay ${amount.toFixed(2)} AZN?`,
      confirmLabel: "Continue",
      tone: "success",
      });

    if (!confirmed) return;

    setIsPayingTrip(true);
    setPaymentError("");

    try {
      localStorage.setItem(PENDING_TRIP_REVIEW_STORAGE_KEY, JSON.stringify({
        tripId,
        vehicleName: `${targetVehicle.brand} ${targetVehicle.model}`,
        createdAt: new Date().toISOString(),
      }));
      const checkout = await paymentApi.createTripCheckout(tripId);
      window.location.assign(checkout.checkoutUrl);
    } catch (error) {
      localStorage.removeItem(PENDING_TRIP_REVIEW_STORAGE_KEY);
      setPaymentError(error.message || "Card checkout could not be opened.");
      await loadPayments();
    } finally {
      setIsPayingTrip(false);
    }
  };

  useEffect(() => {
    const tripId = localStorage.getItem(AUTO_PAY_TRIP_STORAGE_KEY);
    if (!tripId || autoPayInFlightRef.current || isPayingTrip) return;

    const targetVehicle = activeReservations.find((vehicle) => {
      const vehicleTripId = vehicle?.tripId || vehicle?.id;
      return vehicleTripId === tripId && vehicle.isAwaitingPayment;
    });
    if (!targetVehicle) return;

    const targetRequest = targetVehicle.latestCompletionRequest;
    const amount = toMoney(targetRequest?.finalRideCost || targetVehicle.finalRideCost || targetVehicle.rideCost || 0);
    if (amount <= 0 || profileBalance + 0.001 < amount) return;

    autoPayInFlightRef.current = true;
    const timer = window.setTimeout(() => {
      handlePayTrip(targetVehicle, { skipConfirm: true, silent: true })
        .finally(() => {
          autoPayInFlightRef.current = false;
        });
    }, 0);

    return () => window.clearTimeout(timer);
    // This effect intentionally watches loaded payment/ride state and retries once the top-up appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeReservations, profileBalance, isPayingTrip]);

  const showPaymentSuccessDialog = () => {
    localStorage.removeItem(PENDING_TRIP_REVIEW_STORAGE_KEY);
    setPaymentSuccessDialog({ source: reviewTrip?.paymentMethod || "balance" });
    setReviewTrip(null);
    setReviewComment("");
    setReviewError("");
    setIsSubmittingReview(false);
  };

  const submitTripReview = async () => {
    if (!reviewTrip) return;

    if (!reviewComment.trim()) {
      setReviewError("Write a short comment about your trip.");
      return;
    }

    if (!reviewTrip.tripId) {
      setReviewError("Trip id is missing. Refresh the dashboard and try again.");
      return;
    }

    setIsSubmittingReview(true);
    setReviewError("");

    try {
      await tripReviewsApi.create({
        tripId: reviewTrip.tripId,
        rating: reviewRating,
        comment: reviewComment.trim(),
      });
      setTripNotice("Thank you! Your trip review was received.");
      showPaymentSuccessDialog();
    } catch (error) {
      setReviewError(error.message || "Your comment could not be saved.");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const openPaymentHistory = () => {
    setPaymentSuccessDialog(null);
    setActiveTab("payments");
  };

  const handleTopUp = (event) => {
    event.preventDefault();
    if (user.emailVerified === false) {
      setPaymentError("Please confirm your email before topping up your balance.");
      return;
    }
    const amount = Number(topUpAmount);
    if (!Number.isFinite(amount) || amount < 5 || amount > 1000) {
      setPaymentError("Top-up amount must be between 5 and 1000 AZN.");
      return;
    }
    setIsOpeningTopUp(true);
    setPaymentError("");
    paymentApi.createTopUp(amount)
      .then((checkout) => { window.location.href = checkout.checkoutUrl; })
      .catch((error) => setPaymentError(error.message || "Card checkout could not be opened."))
      .finally(() => setIsOpeningTopUp(false));
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

  const handleDocumentUpload = (type, event) => {
    if (isUserVerificationStatus(user.verificationStatus, "Verified")) {
      event.target.value = "";
      return;
    }

    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      event.target.value = "";
      setDocumentsError("This photo exceeds 10 MB. Please upload a smaller photo.");
      return;
    }

    const isSupportedPhoto = file.type === "image/jpeg" || file.type === "image/png" || /\.(jpe?g|png)$/i.test(file.name);
    if (!isSupportedPhoto) {
      event.target.value = "";
      setDocumentsError("Please upload a JPEG or PNG photo. PDF files are not accepted.");
      return;
    }

    setIdentityDocumentFiles((current) => ({
      ...current,
      [type]: file,
    }));
    setDocumentsError("");
    persistDocuments({
      ...documents,
      [type]: {
        status: "Ready to send",
        fileName: file.name,
        url: "",
      },
    });
  };

  const submitIdentityDocuments = async () => {
    if (isUserVerificationStatus(user.verificationStatus, "Verified")) {
      setDocumentsError("Your identity is already verified.");
      return;
    }

    if (!identityDocumentFiles.license || !identityDocumentFiles.passport) {
      setDocumentsError("Upload both driver license and passport before sending them for verification.");
      return;
    }

    setIsSubmittingDocuments(true);
    setDocumentsError("");

    try {
      const updatedUser = await userApi.submitIdentityDocuments({
        driverLicense: identityDocumentFiles.license,
        passport: identityDocumentFiles.passport,
      });
      persistUser(updatedUser);
      syncDocumentsFromUser(updatedUser, {
        license: identityDocumentFiles.license.name,
        passport: identityDocumentFiles.passport.name,
      });
      setIdentityDocumentFiles({ license: null, passport: null });
      clearIdentityFileInputs();
    } catch (error) {
      setDocumentsError(error.message || "Documents could not be sent for verification.");
    } finally {
      setIsSubmittingDocuments(false);
    }
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
        const fallbackDistanceMeters = getDistanceMeters(userLocation, vehiclePosition);
        const displayDistanceMeters = Number.isFinite(routeState.distanceMeters)
          ? routeState.distanceMeters
          : fallbackDistanceMeters;
        const routePositions = vehicle.isRideActive
          ? [vehiclePosition]
          : routeState.positions?.length > 1 || hasResolvedUserLocation ? routeState.positions?.length > 1 ? routeState.positions : [userLocation, vehiclePosition] : [vehiclePosition];
        const routeMinutes = getWalkMinutes(displayDistanceMeters);
        const routeDistanceLabel = vehicle.isRideActive || !hasResolvedUserLocation ? "" : formatPickupDistance(displayDistanceMeters);
        const mapKey = `${vehicle.reservationId}-${vehicle.tripId || "reserved"}-${vehicle.vehicleId || vehicle.id || "vehicle"}`;

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
        <MapContainer key={mapKey} center={vehiclePosition} zoom={13} scrollWheelZoom className="h-full w-full !z-0">
          <ReservationMapBounds points={routePositions} />
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />
          {!vehicle.isRideActive && hasResolvedUserLocation && (
            <>
              <Polyline
                positions={routePositions}
                pathOptions={{ color: "#ef4444", weight: 4, opacity: 0.85 }}
              />
              <Marker position={userLocation} icon={userIcon}>
                <Popup>You are here</Popup>
              </Marker>
            </>
          )}
          <Marker position={vehiclePosition}>
            <Popup>
              {vehicle.brand} {vehicle.model}
            </Popup>
          </Marker>
        </MapContainer>
      </div>
      <div className="flex items-center justify-between border-t border-zinc-100 px-5 py-3 text-xs font-bold text-zinc-500">
        <span>
          {vehicle.isRideActive
            ? "Ride in progress"
            : !hasResolvedUserLocation
            ? "Detecting your location..."
            : routeState.status === "loading"
            ? "Loading road route..."
            : `${routeMinutes} min walk`}
        </span>
        <span>{routeDistanceLabel}</span>
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
          {isLoadingRideState && (
            <p className="mt-3 text-sm font-bold text-zinc-500">Syncing your ride...</p>
          )}
          {rideStateError && (
            <p className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {rideStateError}
            </p>
          )}
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
                        : vehicle.isCompletionRejected
                          ? "Rejected"
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
                        {vehicle.isCompletionPending || vehicle.isCompletionRejected || vehicle.isAwaitingPayment
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
                          <p className="text-sm font-black text-amber-900">Waiting for review approval</p>
                          <p className="mt-1 text-xs font-semibold leading-5 text-amber-700">
                            Your four vehicle photos were submitted. The ride remains in review and will close automatically after approval.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {vehicle.isCompletionRejected && (
                    <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
                      <div className="flex items-start gap-3">
                        <FiAlertCircle className="mt-0.5 shrink-0 text-red-600" />
                        <div>
                          <p className="text-sm font-black text-red-900">Photos were rejected</p>
                          <p className="mt-1 text-xs font-semibold leading-5 text-red-700">
                            {vehicle.completionRejectionReason || "Staff asked you to retake the vehicle photos before payment."}
                          </p>
                          <p className="mt-1 text-xs font-semibold leading-5 text-red-700">
                            Retake all four photos and send them again from this ride card.
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
                            The vehicle condition was approved. Confirm payment to complete the ride.
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
                          : vehicle.isCompletionRejected
                          ? "bg-red-500 hover:bg-red-600"
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
                        : vehicle.isCompletionRejected
                        ? "Retake photos"
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

        {selectedMapVehicle && (
          <div className="grid gap-4">
            {activeReservations.length > 1 && (
              <div className="rounded-3xl border border-zinc-200 bg-white p-3 shadow-sm">
                <div className="grid gap-2 sm:grid-cols-2">
                  {activeReservations.map((vehicle) => {
                    const isSelected = vehicle.reservationId === selectedMapVehicle.reservationId;
                    return (
                      <button
                        key={`map-switch-${vehicle.reservationId}`}
                        type="button"
                        onClick={() => setSelectedMapReservationId(vehicle.reservationId)}
                        className={`rounded-2xl px-4 py-3 text-left text-xs font-black transition ${
                          isSelected
                            ? "bg-zinc-950 text-white"
                            : "bg-zinc-50 text-zinc-600 hover:bg-red-50 hover:text-red-600"
                        }`}
                      >
                        <span className="block truncate">{vehicle.brand} {vehicle.model}</span>
                        <span className={`mt-1 block text-[10px] uppercase tracking-wide ${isSelected ? "text-white/55" : "text-zinc-400"}`}>
                          {vehicle.isRideActive ? "in ride" : "reserved"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {renderReservationMap(selectedMapVehicle)}
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
              Verify email
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
          </div>
          <div className="rounded-2xl bg-white/10 p-4">
            <FiSmartphone className="text-3xl" />
          </div>
        </div>

        <div className="mt-6 rounded-2xl bg-white/10 px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-wide text-white/40">Secure top-up</p>
          <p className="mt-1 text-sm font-black">Card payments are processed securely. Card details never reach ElectroStreet.</p>
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
            <p className="text-xs font-black uppercase tracking-[0.22em] text-red-500">Payment history</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-zinc-950">Balance transactions</h2>
          </div>
          <button
            type="button"
            onClick={loadPayments}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-black text-white transition hover:bg-red-500"
          >
            <FiActivity /> {isLoadingPayments ? "Loading..." : "Refresh"}
          </button>
        </div>

        <div className="mt-6 grid gap-3">
          {paymentTransactions.length === 0 && (
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm font-bold text-zinc-500">
              No transactions yet. Your card top-ups and trip payments will appear here.
            </div>
          )}
          {paymentTransactions.map((transaction) => {
            const isCompleted = transaction.status === 2 || String(transaction.status).toLowerCase() === "completed";
            const canDownloadReceipt = isCompleted;

            return (
            <div key={transaction.id} className="flex flex-col gap-3 rounded-2xl border border-zinc-100 bg-zinc-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-black text-zinc-950">{transaction.type === 1 ? "Card top-up" : "Trip payment"}</p>
                <p className="mt-1 text-xs font-bold text-zinc-500">
                  {transaction.cardBrand && transaction.cardLast4 ? `${transaction.cardBrand} •••• ${transaction.cardLast4}` : formatPaymentMethod(transaction.paymentMethod)}
                  {" · "}{new Date(transaction.createdAt).toLocaleString()}
                </p>
                {transaction.failureReason && <p className="mt-1 text-xs font-bold text-red-600">{transaction.failureReason}</p>}
              </div>
              <div className="flex flex-col gap-2 sm:items-end sm:text-right">
                <p className={`text-lg font-black ${transaction.type === 1 ? "text-emerald-600" : "text-zinc-950"}`}>
                  {transaction.type === 1 ? "+" : "−"}{formatMoney(transaction.amount)}
                </p>
                <p className="text-[10px] font-black uppercase tracking-wide text-zinc-400">
                  {transaction.status === 2 ? "Completed" : transaction.status === 3 ? "Failed" : "Pending"}
                </p>
                {isCompleted && (
                  <button
                    type="button"
                    onClick={() => downloadTransactionReceipt(transaction)}
                    disabled={!canDownloadReceipt}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-black text-zinc-700 transition hover:border-red-200 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <FiFileText />
                    Receipt
                  </button>
                )}
              </div>
            </div>
            );
          })}
        </div>
      </section>
    </motion.div>
  );

  const renderDocumentsPanel = () => {
    const documentsRejected = isUserVerificationStatus(user.verificationStatus, "Rejected");
    const documentsVerified = isUserVerificationStatus(user.verificationStatus, "Verified");
    const canSubmitDocuments = !documentsVerified && Boolean(identityDocumentFiles.license && identityDocumentFiles.passport);
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

          {documentsRejected && (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm font-black text-red-800">Your documents were rejected.</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-red-700">
                Please upload clear photos of your driver license and passport again, then send them for verification.
              </p>
            </div>
          )}

          {documentsVerified && (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-sm font-black text-emerald-800">Successfully verified.</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-emerald-700">
                Driver license and passport were approved by an administrator.
              </p>
            </div>
          )}

          <input ref={licenseInputRef} type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" className="hidden" onChange={(event) => handleDocumentUpload("license", event)} />
          <input ref={passportInputRef} type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" className="hidden" onChange={(event) => handleDocumentUpload("passport", event)} />

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
                    disabled={documentsVerified}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-black text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500"
                  >
                    <FiUploadCloud /> {documentsVerified ? "Approved" : uploaded ? "Replace file" : "Upload"}
                  </button>
                </div>
              );
            })}
          </div>

          {documentsError && (
            <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {documentsError}
            </p>
          )}

          <button
            type="button"
            onClick={submitIdentityDocuments}
            disabled={!canSubmitDocuments || isSubmittingDocuments}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-red-500 px-5 py-4 text-sm font-black text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500"
          >
            <FiSend />
            {isSubmittingDocuments ? "Sending documents..." : documentsRejected ? "Send new documents for verification" : "Send for verification"}
          </button>
        </section>

        <aside className="rounded-3xl bg-red-500 p-6 text-white shadow-xl shadow-red-500/20">
          <FiCheckCircle className="text-4xl" />
          <h3 className="mt-8 text-2xl font-black">Access status</h3>
          <div className="mt-5 space-y-3">
            {[
              ["Email", user.emailVerified ? "Verified" : "Pending"],
              ["License", documents.license?.status || "Upload needed"],
              ["Passport", documents.passport?.status || "Upload needed"],
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

  if (blockedNotice) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f7fb] px-4 text-zinc-950">
        <section className="w-full max-w-lg rounded-3xl border border-red-200 bg-white p-8 text-center shadow-2xl shadow-red-950/10">
          <FiAlertCircle className="mx-auto text-4xl text-red-500" />
          <h1 className="mt-5 text-3xl font-black tracking-tight">Account blocked</h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-zinc-500">{blockedNotice}</p>
          <button
            type="button"
            onClick={onLogout}
            className="mt-6 rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-black text-white transition hover:bg-red-500"
          >
            Log out
          </button>
        </section>
      </main>
    );
  }

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
              min="5"
              max="1000"
              step="0.01"
              value={topUpAmount}
              onChange={(event) => setTopUpAmount(event.target.value)}
              placeholder="Amount"
            />

            {paymentError && (
              <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
                {paymentError}
              </div>
            )}

            <button type="submit" disabled={isOpeningTopUp} className="mt-5 w-full rounded-2xl bg-zinc-950 px-5 py-4 text-sm font-black text-white transition hover:bg-red-500 disabled:opacity-50">
              {isOpeningTopUp ? "Opening payment..." : "Pay"}
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
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                <p>{paymentError}</p>
                {paymentError.toLowerCase().includes("insufficient balance") && (
                  <button
                    type="button"
                    onClick={() => handleOpenTopUpForTrip(paymentVehicle)}
                    className="mt-3 text-left text-sm font-black text-red-700 underline decoration-2 underline-offset-4 transition hover:text-red-900"
                  >
                    Click here to top up your balance
                  </button>
                )}
              </div>
            )}

            <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-zinc-500">
                Payment method
              </p>
              <p className="mt-1 text-xs font-semibold text-zinc-500">
                Choose how to pay for this trip.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setTripPaymentMethod("balance");
                    setPaymentError("");
                  }}
                  className={`rounded-xl border px-4 py-3 text-left text-sm font-black transition ${
                    tripPaymentMethod === "balance"
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                      : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
                  }`}
                >
                  Profile balance
                  <span className="mt-1 block text-xs font-bold opacity-70">
                    Available: {formatMoney(profileBalance)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (isTripCardAmountTooSmall) {
                      setPaymentError("Card checkout is available from 1.10 AZN. Use profile balance for smaller fares.");
                      return;
                    }
                    setTripPaymentMethod("card");
                    setPaymentError("");
                  }}
                  disabled={isTripCardAmountTooSmall}
                  className={`rounded-xl border px-4 py-3 text-left text-sm font-black transition ${
                    tripPaymentMethod === "card"
                      ? "border-red-300 bg-red-50 text-red-600"
                      : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
                  }`}
                >
                  Pay with card
                  <span className="mt-1 block text-xs font-bold opacity-70">
                    {isTripCardAmountTooSmall ? "Available from 1.10 AZN" : "Opens secure checkout"}
                  </span>
                </button>
              </div>
            </div>

            <div className="mt-6">
              <button
                type="button"
                onClick={() =>
                  tripPaymentMethod === "card"
                    ? handlePayTripByCard(paymentVehicle)
                    : handlePayTrip(paymentVehicle)
                }
                disabled={isPayingTrip || (tripPaymentMethod === "card" && isTripCardAmountTooSmall)}
                className={`w-full rounded-2xl px-5 py-4 text-sm font-black text-white transition disabled:opacity-50 ${
                  tripPaymentMethod === "card"
                    ? "bg-red-500 hover:bg-red-600"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {isPayingTrip
                  ? "Paying..."
                  : tripPaymentMethod === "card"
                    ? "Pay with card"
                    : Number(paymentVehicle.debtAmount || paymentRequest?.debtAmount || 0) > 0
                    ? "Pay outstanding balance"
                    : "Pay from profile balance"}
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
                onClick={showPaymentSuccessDialog}
                disabled={isSubmittingReview}
                className="rounded-2xl border border-zinc-200 px-5 py-4 text-sm font-black text-zinc-600 transition hover:border-zinc-300"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={submitTripReview}
                disabled={isSubmittingReview}
                className="rounded-2xl bg-red-500 px-5 py-4 text-sm font-black text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmittingReview ? "Sending..." : "Send comment"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {paymentSuccessDialog && !reviewTrip && (
        <div className="fixed inset-0 z-[2290] flex items-center justify-center bg-zinc-950/70 p-4 backdrop-blur">
          <motion.div
            className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <FiCheckCircle className="text-3xl" />
            </div>
            <p className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-emerald-600">
              Payment completed
            </p>
            <h2 className="mt-2 text-3xl font-black text-zinc-950">Thank you for your payment</h2>
            <p className="mx-auto mt-3 max-w-sm text-sm font-semibold leading-6 text-zinc-500">
              You can view the transaction{" "}
              <button
                type="button"
                onClick={openPaymentHistory}
                className="font-black text-red-500 underline decoration-red-200 underline-offset-4 transition hover:text-red-600"
              >
                here
              </button>
              .
            </p>
            <button
              type="button"
              onClick={() => setPaymentSuccessDialog(null)}
              className="mt-6 rounded-2xl bg-zinc-950 px-6 py-3 text-sm font-black text-white transition hover:bg-zinc-800"
            >
              Stay on trip
            </button>
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
                    Photograph the complete front, rear, left, and right sides. The review team will approve them before the ride is closed.
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
