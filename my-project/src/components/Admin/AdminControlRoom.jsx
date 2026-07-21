import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Circle, MapContainer, Marker, Polygon, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  FiActivity,
  FiAlertTriangle,
  FiBell,
  FiClock,
  FiCommand,
  FiDollarSign,
  FiEdit3,
  FiEye,
  FiEyeOff,
  FiFileText,
  FiMap,
  FiMenu,
  FiMessageSquare,
  FiNavigation,
  FiPlus,
  FiRadio,
  FiSearch,
  FiSend,
  FiShield,
  FiTool,
  FiTrendingUp,
  FiTrash2,
  FiUserCheck,
  FiUserX,
  FiUsers,
  FiZap,
} from "react-icons/fi";
import { FaCarSide } from "react-icons/fa";
import { CHARGING_STATION_STATUSES, VEHICLE_STATUSES } from "../../data/statuses";
import { chargingApi } from "../../api/chargingApi";
import { invoiceApi } from "../../api/invoiceApi";
import { authApi } from "../../api/authApi";
import { adminStatisticsApi } from "../../api/adminStatisticsApi";
import { adminPricingApi, PRICING_MODES, normalizePricingMode } from "../../api/adminPricingApi";
import { adminUsersApi, USER_BLOCK_DURATIONS, USER_ROLES, USER_VERIFICATION_STATUSES, normalizeRole } from "../../api/adminUsersApi";
import { parkingZoneApi } from "../../api/parkingZoneApi";
import { createOperationsConnection, REALTIME_EVENTS, startConnection, stopConnection } from "../../api/realtimeClient";
import { adminStaffTasksApi, normalizeStaffTask, STAFF_TASK_PRIORITIES, STAFF_TASK_STATUSES, STAFF_TASK_TYPES } from "../../api/staffTasksApi";
import {
  SUPPORT_MESSAGE_SENDER_TYPES,
  SUPPORT_REALTIME_EVENTS,
  SUPPORT_TICKET_PRIORITIES,
  SUPPORT_TICKET_STATUSES,
  adminSupportApi,
  createSupportConnection,
  startSupportConnection,
  stopSupportConnection,
} from "../../api/supportApi";
import { vehicleApi } from "../../api/vehicleApi";
import { useConfirmDialog } from "../ui/useConfirmDialog";

const STAFF_TASK_STATUS_LABELS = {
  [STAFF_TASK_STATUSES.Waiting]: "Waiting",
  [STAFF_TASK_STATUSES.InProgress]: "In progress",
  [STAFF_TASK_STATUSES.Done]: "Done",
};

const STAFF_TASK_PRIORITY_LABELS = {
  [STAFF_TASK_PRIORITIES.Low]: "Low",
  [STAFF_TASK_PRIORITIES.Medium]: "Medium",
  [STAFF_TASK_PRIORITIES.High]: "High",
};

const STAFF_TASK_PRIORITY_STYLES = {
  [STAFF_TASK_PRIORITIES.Low]: "border-sky-400/30 bg-sky-500/10 text-sky-200",
  [STAFF_TASK_PRIORITIES.Medium]: "border-amber-400/30 bg-amber-500/10 text-amber-200",
  [STAFF_TASK_PRIORITIES.High]: "border-red-400/35 bg-red-500/15 text-red-100",
};

const STAFF_TASK_STATUS_STYLES = {
  [STAFF_TASK_STATUSES.Waiting]: "border-slate-400/25 bg-slate-500/10 text-slate-200",
  [STAFF_TASK_STATUSES.InProgress]: "border-blue-400/30 bg-blue-500/10 text-blue-200",
  [STAFF_TASK_STATUSES.Done]: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
};

const isTaskManagerTask = (task) => Number(task?.type ?? STAFF_TASK_TYPES.General) !== STAFF_TASK_TYPES.Charging;

const SUPPORT_STATUS_LABELS = {
  [SUPPORT_TICKET_STATUSES.Open]: "Active",
  [SUPPORT_TICKET_STATUSES.WaitingForStaff]: "Waiting staff",
  [SUPPORT_TICKET_STATUSES.WaitingForRider]: "Waiting rider",
  [SUPPORT_TICKET_STATUSES.EscalatedToAdmin]: "Admin review",
  [SUPPORT_TICKET_STATUSES.Resolved]: "Resolved",
  [SUPPORT_TICKET_STATUSES.Closed]: "Closed",
};

const SUPPORT_PRIORITY_LABELS = {
  [SUPPORT_TICKET_PRIORITIES.Low]: "Low",
  [SUPPORT_TICKET_PRIORITIES.Normal]: "Normal",
  [SUPPORT_TICKET_PRIORITIES.High]: "High",
  [SUPPORT_TICKET_PRIORITIES.Urgent]: "Urgent",
};

const upsertSupportTicket = (items, nextTicket) => {
  const exists = items.some((ticket) => ticket.id === nextTicket.id);
  const nextItems = exists
    ? items.map((ticket) => (ticket.id === nextTicket.id ? nextTicket : ticket))
    : [nextTicket, ...items];

  return [...nextItems].sort((first, second) => new Date(second.lastMessageAt || 0) - new Date(first.lastMessageAt || 0));
};

const KPI_COLUMN_LABELS = {
  name: "Staff member",
  ordersCompleted: "Completed",
  avgCompletionMinutes: "Avg time",
  rating: "Rating",
  complaints: "Complaints",
  praises: "Praises",
  activeShiftHours: "Active time",
  weeklyChange: "Vs last week",
};

const BAKU_TIME_ZONE = "Asia/Baku";
const BAKU_UTC_OFFSET = "+04:00";
const BAKU_CENTER = [40.3777, 49.8499];
const BAKU_MAP_BOUNDS = [
  [40.2, 49.55],
  [40.6, 50.25],
];

const getBakuDateParts = (date = new Date()) =>
  Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: BAKU_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

const toDateTimeLocalValue = (date = new Date()) => {
  const parts = getBakuDateParts(date);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
};

const parseBakuDateTimeLocalMs = (value) => {
  if (!value) return Number.NaN;
  return new Date(`${value}:00${BAKU_UTC_OFFSET}`).getTime();
};

const toBakuDeadlineApiValue = (value) => (value ? `${value}:00` : null);

const upsertStaffTask = (items, nextTask) => {
  const normalizedTask = normalizeStaffTask(nextTask);
  if (!normalizedTask) return items;

  const exists = items.some((task) => task.id === normalizedTask.id);
  return exists
    ? items.map((task) => (task.id === normalizedTask.id ? normalizedTask : task))
    : [normalizedTask, ...items];
};

const upsertAdminUser = (items, nextUser) => {
  const exists = items.some((user) => user.id === nextUser.id);
  return exists
    ? items.map((user) => (user.id === nextUser.id ? nextUser : user))
    : [nextUser, ...items];
};

const mapBackendStaffUser = (user) => ({
  id: user.id,
  name: `${user.firstName} ${user.lastName}`.trim() || user.email,
  role: "Staff",
  specialty: user.email,
  active: user.isActive,
  ordersCompleted: 0,
  avgCompletionMinutes: 0,
  rating: 0,
  complaints: 0,
  praises: 0,
  activeShiftHours: 0,
  weeklyChange: 0,
  kycRating: user.verificationStatus === USER_VERIFICATION_STATUSES.Internal ? 10 : 0,
  applicationsProcessed: [],
  supportTicketsClosed: [],
});

const normalizeStaffWorkTitle = (title) => {
  if (title === "Trip completion photo review") return "Vehicle return photo review";
  return title || "Completed staff task";
};

const normalizeStaffWorkResult = (result) => {
  const text = String(result || "").trim();
  if (/^Approved completion photos for trip [0-9a-f-]+\.?$/i.test(text)) {
    return "Approved vehicle return photos.";
  }

  return text.replace(/^Approved completion photos/i, "Approved vehicle return photos");
};

const mapBackendStaffKpiRow = (row) => ({
  id: row.id,
  name: row.name || row.email,
  role: row.role || "Staff",
  specialty: row.email,
  active: Boolean(row.active),
  rating: Number(row.rating || 0),
  complaints: Number(row.complaints || 0),
  praises: Number(row.praises || 0),
  activeShiftHours: Number(row.activeShiftHours || 0),
  weeklyChange: Number(row.weeklyChangePercent || 0),
  kycRating: Number(row.kycRating || 0),
  ordersCompleted: Number(row.ordersCompleted || 0),
  avgCompletionMinutes: Number(row.averageCompletionMinutes || 0),
  applicationsProcessed: Array.isArray(row.completedTasks)
    ? row.completedTasks.map((task) => ({
      id: task.id,
      title: normalizeStaffWorkTitle(task.title),
      result: normalizeStaffWorkResult(task.result),
      time: formatBakuDateTime(task.completedAt, "Completed"),
    }))
    : [],
  supportTicketsClosed: Array.from({ length: Number(row.supportTicketsClosed || 0) }, (_, index) => ({
    id: `${row.id}-ticket-${index + 1}`,
    title: "Closed support ticket",
    result: "Calculated from support data.",
    time: `#${index + 1}`,
  })),
});

const LOW_CHARGE_RECOMMENDATION_PERCENT = 30;
const MIN_CHARGING_COMPLETION_PERCENT = 80;
const CHARGING_PERCENT_PER_MINUTE = 10;
const RANGE_KM_PER_BATTERY_PERCENT = 4;
const PRICING_MODE_OPTIONS = [
  {
    mode: PRICING_MODES.Low,
    key: "Low",
    label: "Low",
    short: "-0.10 AZN/min",
    adjustment: -0.10,
    detail: "Lower every vehicle rate by 0.10 AZN per minute. Trips keep the rate locked at start.",
    className: "border-emerald-400/30 bg-emerald-500/10 text-emerald-100",
  },
  {
    mode: PRICING_MODES.Standard,
    key: "Standard",
    label: "Standard",
    short: "+0.00 AZN/min",
    adjustment: 0,
    detail: "Use regular vehicle rates. Trips keep the rate locked at start.",
    className: "border-slate-400/30 bg-slate-500/10 text-slate-100",
  },
  {
    mode: PRICING_MODES.High,
    key: "High",
    label: "High",
    short: "+0.20 AZN/min",
    adjustment: 0.20,
    detail: "Raise every vehicle rate by 0.20 AZN per minute. Trips keep the rate locked at start.",
    className: "border-red-400/35 bg-red-500/15 text-red-100",
  },
];
const CHARGING_PORT_OPTIONS = [1, 2, 4, 6, 8];
const LEGACY_DEVELOPMENT_ADMIN_EMAIL = "admin@carsharing.local";
const MAINTENANCE_VEHICLE_STATUS = VEHICLE_STATUSES.COMPLETED;
const VEHICLE_CONNECTOR_OPTIONS = ["CCS2", "Type2", "CHAdeMO"];
const SUPERADMIN_VEHICLE_STATUS_OPTIONS = [
  [VEHICLE_STATUSES.AVAILABLE, "Available"],
  [VEHICLE_STATUSES.RESERVED, "Reserved"],
  [VEHICLE_STATUSES.IN_USE, "In Use"],
  [VEHICLE_STATUSES.CHARGING, "Charging"],
  [MAINTENANCE_VEHICLE_STATUS, "Maintenance"],
];

const getLocalDateInputValue = (date = new Date()) => {
  const parts = getBakuDateParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const getDefaultFinancePeriod = () => {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 29);

  return {
    from: getLocalDateInputValue(start),
    to: getLocalDateInputValue(end),
  };
};

const getEmptyVehicleDraft = () => ({
  brand: "",
  model: "",
  year: new Date().getFullYear(),
  plateNumber: "",
  mileageKm: 0,
  batteryPercent: 80,
  rangeKm: 250,
  pricePerMinute: 0.45,
  currency: "AZN",
  seats: 4,
  color: "",
  connectorType: "CCS2",
  chargingStationId: null,
  locationLabel: "Baku",
  zone: "City",
  latitude: BAKU_CENTER[0],
  longitude: BAKU_CENTER[1],
  pickOnMap: false,
  status: VEHICLE_STATUSES.AVAILABLE,
});

const vehicleToDraft = (vehicle) => ({
  brand: vehicle?.brand || "",
  model: vehicle?.model || "",
  year: Number(vehicle?.year || new Date().getFullYear()),
  plateNumber: vehicle?.plateNumber || "",
  mileageKm: Number(vehicle?.mileageKm || 0),
  batteryPercent: Number(vehicle?.batteryPercent || 80),
  rangeKm: Number(vehicle?.rangeKm || 250),
  pricePerMinute: Number(vehicle?.pricePerMinute || 0),
  currency: vehicle?.currency || "AZN",
  seats: Number(vehicle?.seats || 4),
  color: vehicle?.color || "",
  connectorType: vehicle?.connectorType || "CCS2",
  chargingStationId: vehicle?.chargingStationId || null,
  locationLabel: vehicle?.locationLabel || vehicle?.location?.label || "Baku",
  zone: vehicle?.zone || vehicle?.location?.zone || "City",
  latitude: Number(vehicle?.latitude ?? vehicle?.location?.lat ?? BAKU_CENTER[0]),
  longitude: Number(vehicle?.longitude ?? vehicle?.location?.lng ?? BAKU_CENTER[1]),
  pickOnMap: false,
  status: vehicle?.status || VEHICLE_STATUSES.AVAILABLE,
});

const parseVehicleNumber = (value) => Number(String(value ?? "").trim().replace(",", "."));

const sanitizeVehicleDraft = (draft) => {
  const latitude = parseVehicleNumber(draft.latitude);
  const longitude = parseVehicleNumber(draft.longitude);

  return {
    brand: String(draft.brand || "").trim(),
    model: String(draft.model || "").trim(),
    plateNumber: String(draft.plateNumber || "").trim().toUpperCase(),
    mileageKm: parseVehicleNumber(draft.mileageKm),
    batteryPercent: parseVehicleNumber(draft.batteryPercent),
    rangeKm: parseVehicleNumber(draft.rangeKm),
    pricePerMinute: parseVehicleNumber(draft.pricePerMinute),
    currency: "AZN",
    seats: parseVehicleNumber(draft.seats),
    color: String(draft.color || "").trim(),
    connectorType: String(draft.connectorType || "").trim(),
    chargingStationId: draft.chargingStationId || null,
    locationLabel: String(draft.locationLabel || "").trim(),
    zone: String(draft.zone || "").trim(),
    latitude,
    longitude,
    year: parseVehicleNumber(draft.year),
    status: draft.status || VEHICLE_STATUSES.AVAILABLE,
  };
};

const getEmptyVehiclePhotoDraft = () => ({
  mainImage: null,
  galleryImage1: null,
  galleryImage2: null,
  galleryImage3: null,
});

const STATUS_META = {
  available: {
    label: "Free",
    short: "Free",
    color: "#22c55e",
    bg: "bg-emerald-500",
    text: "text-emerald-300",
    ring: "ring-emerald-400/30",
    border: "border-emerald-400/35",
  },
  in_use: {
    label: "In use",
    short: "Ride",
    color: "#3b82f6",
    bg: "bg-blue-500",
    text: "text-blue-300",
    ring: "ring-blue-400/30",
    border: "border-blue-400/35",
  },
  low_charge: {
    label: "Need charge",
    short: "Low",
    color: "#f59e0b",
    bg: "bg-amber-500",
    text: "text-amber-300",
    ring: "ring-amber-400/30",
    border: "border-amber-400/35",
  },
  service: {
    label: "Service",
    short: "Stop",
    color: "#ef4444",
    bg: "bg-red-500",
    text: "text-red-300",
    ring: "ring-red-400/30",
    border: "border-red-400/35",
  },
};

const STATUS_LABELS = {
  available: "Available",
  in_use: "In use",
  low_charge: "Needs charge",
  service: "Service",
};

const STATION_STATUS_META = {
  [CHARGING_STATION_STATUSES.ONLINE]: { label: "Online", color: "#22c55e", tone: "emerald" },
  [CHARGING_STATION_STATUSES.BUSY]: { label: "Busy", color: "#f59e0b", tone: "amber" },
  [CHARGING_STATION_STATUSES.MAINTENANCE]: { label: "Maintenance", color: "#ef4444", tone: "red" },
  [CHARGING_STATION_STATUSES.OFFLINE]: { label: "Offline", color: "#71717a", tone: "zinc" },
};

const CHARGING_STATUS_OPTIONS = [
  { status: CHARGING_STATION_STATUSES.ONLINE, label: "Online" },
  { status: CHARGING_STATION_STATUSES.BUSY, label: "Busy" },
  { status: CHARGING_STATION_STATUSES.MAINTENANCE, label: "Maintenance" },
  { status: CHARGING_STATION_STATUSES.OFFLINE, label: "Offline" },
];

const statusFromVehicle = (vehicle) => {
  if (vehicle.status === VEHICLE_STATUSES.IN_USE) return "in_use";
  if (vehicle.status === VEHICLE_STATUSES.CHARGING || vehicle.batteryPercent <= LOW_CHARGE_RECOMMENDATION_PERCENT) return "low_charge";
  if (vehicle.status === VEHICLE_STATUSES.COMPLETED) return "service";
  return "available";
};

const isCurrentlyBlockedUser = (user) => {
  if (!user?.blockReason) return false;
  if (!user.blockedUntil) return true;
  return new Date(user.blockedUntil).getTime() > Date.now();
};

const parkingZones = [
  {
    id: "green-seaside",
    name: "Seaside Parking Zone",
    type: "allowed",
    positions: [
      [40.3682, 49.8355],
      [40.3722, 49.8582],
      [40.381, 49.8611],
      [40.3794, 49.834],
    ],
  },
  {
    id: "green-center",
    name: "Central Drop-off Zone",
    type: "allowed",
    positions: [
      [40.3696, 49.8248],
      [40.3773, 49.8243],
      [40.3785, 49.8418],
      [40.3713, 49.8441],
    ],
  },
  {
    id: "red-old-city",
    name: "No Parking: Old City",
    type: "restricted",
    positions: [
      [40.3638, 49.8297],
      [40.3679, 49.8319],
      [40.3671, 49.8388],
      [40.3627, 49.8373],
    ],
  },
  {
    id: "red-khyrdalan-west",
    name: "No Parking: Khyrdalan West",
    type: "restricted",
    positions: [
      [40.4208, 49.7359],
      [40.4241, 49.7884],
      [40.3988, 49.8176],
      [40.3864, 49.7633],
    ],
  },
  {
    id: "red-khyrdalan-east",
    name: "No Parking: Khyrdalan East",
    type: "restricted",
    positions: [
      [40.4712, 49.8553],
      [40.4655, 49.9188],
      [40.4302, 49.9093],
      [40.4165, 49.8491],
    ],
  },
];

const PARKING_ZONES_STORAGE_KEY = "electroStreetParkingZones";

const PARKING_ZONE_TYPES = [
  {
    id: "allowed",
    label: "Green",
    title: "Allowed parking",
    description: "Riders can finish parking here.",
    color: "#22c55e",
    badgeClassName: "border-emerald-400/35 bg-emerald-500/12 text-emerald-100",
    activeClassName: "border-emerald-300 bg-emerald-500 text-white",
  },
  {
    id: "restricted",
    label: "Red",
    title: "No parking",
    description: "Riders should not finish a ride in this zone.",
    color: "#ef4444",
    badgeClassName: "border-red-400/35 bg-red-500/15 text-red-100",
    activeClassName: "border-red-300 bg-red-500 text-white",
  },
];

const getParkingZoneMeta = (type) =>
  PARKING_ZONE_TYPES.find((item) => item.id === type) || PARKING_ZONE_TYPES[0];

const normalizeParkingZone = (zone, index) => {
  const positions = Array.isArray(zone?.positions)
    ? zone.positions
        .map((point) => [Number(point?.[0]), Number(point?.[1])])
        .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng))
    : [];

  if (positions.length < 3) return null;

  return {
    id: zone.id || `zone-${index}`,
    name: zone.name || (zone.type === "restricted" ? "No parking zone" : "Allowed parking zone"),
    type: zone.type === "restricted" ? "restricted" : "allowed",
    positions,
  };
};

const mergeParkingZonesWithDefaults = (storedZones = []) => {
  const zonesById = new Map();
  const defaultZoneIds = new Set();

  parkingZones
    .map(normalizeParkingZone)
    .filter(Boolean)
    .forEach((zone) => {
      zonesById.set(zone.id, zone);
      defaultZoneIds.add(zone.id);
    });

  storedZones
    .map(normalizeParkingZone)
    .filter(Boolean)
    .forEach((zone) => {
      if (!defaultZoneIds.has(zone.id)) {
        zonesById.set(zone.id, zone);
      }
    });

  return Array.from(zonesById.values());
};

const getInitialParkingZones = () => {
  try {
    const storedZones = localStorage.getItem(PARKING_ZONES_STORAGE_KEY);
    if (storedZones === null) return parkingZones;

    const parsedZones = JSON.parse(storedZones);
    if (!Array.isArray(parsedZones)) return parkingZones;

    return mergeParkingZonesWithDefaults(parsedZones);
  } catch {
    return parkingZones;
  }
};

const penaltyReasons = [
  { id: "dirty", label: "Dirty interior", amount: 25 },
  { id: "bad-parking", label: "Improper parking", amount: 40 },
  { id: "third-party", label: "Third-party driving", amount: 120 },
  { id: "smoking", label: "Smoking inside the car", amount: 60 },
];

const staffSeed = [
  {
    id: "mgr-001",
    name: "Ayan Karimova",
    role: "KYC Lead",
    kycRating: 9.4,
    ordersCompleted: 46,
    avgCompletionMinutes: 7.8,
    rating: 9.6,
    complaints: 1,
    praises: 14,
    activeShiftHours: 7.4,
    weeklyChange: 12,
    applicationsProcessed: [
      { id: "kyc-101", title: "Leyla Mammadova", result: "Passport and license approved", time: "09:18" },
      { id: "kyc-102", title: "Rashad Aliyev", result: "New passport photo requested", time: "10:05" },
      { id: "kyc-103", title: "Nigar Huseynli", result: "Profile blocked because of duplicate risk", time: "11:42" },
      { id: "kyc-104", title: "Farid Hasanov", result: "Category B license approved", time: "13:20" },
    ],
    supportTicketsClosed: [
      { id: "sup-101", title: "Trunk will not open", result: "Remote unlock completed", time: "10:28" },
      { id: "sup-102", title: "KYC selfie error", result: "Retry upload instructions sent to the customer", time: "14:12" },
    ],
    active: true,
  },
  {
    id: "mgr-002",
    name: "Murad Aliyev",
    role: "Dispatcher",
    kycRating: 8.1,
    ordersCompleted: 39,
    avgCompletionMinutes: 10.5,
    rating: 8.7,
    complaints: 3,
    praises: 9,
    activeShiftHours: 6.9,
    weeklyChange: 4,
    applicationsProcessed: [
      { id: "kyc-201", title: "Gunel Rzayeva", result: "Profile approved after address review", time: "09:35" },
      { id: "kyc-202", title: "Emin Safarov", result: "Review moved to manual moderation", time: "12:10" },
      { id: "kyc-203", title: "Aysel Hajiyeva", result: "Documents approved", time: "15:04" },
    ],
    supportTicketsClosed: [
      { id: "sup-201", title: "Customer could not finish rental", result: "Rental closed remotely without penalty", time: "11:55" },
      { id: "sup-202", title: "Car parked outside the zone", result: "Route to allowed parking was prepared", time: "13:44" },
      { id: "sup-203", title: "Low battery before trip", result: "Reservation moved to the nearest available EV", time: "16:25" },
    ],
    active: true,
  },
  {
    id: "mgr-003",
    name: "Sabina Rustamli",
    role: "Support",
    kycRating: 8.8,
    ordersCompleted: 36,
    avgCompletionMinutes: 9.2,
    rating: 9.1,
    complaints: 2,
    praises: 12,
    activeShiftHours: 7.1,
    weeklyChange: 8,
    applicationsProcessed: [
      { id: "kyc-301", title: "Kamran Nabiyev", result: "License photo accepted, profile activated", time: "10:16" },
      { id: "kyc-302", title: "Laman Aliyeva", result: "Rejected because the license is expired", time: "12:58" },
    ],
    supportTicketsClosed: [
      { id: "sup-301", title: "Bonus was not applied", result: "5 free minutes credited", time: "09:50" },
      { id: "sup-302", title: "Charging cable is locked", result: "Service task created for Nihad", time: "14:33" },
      { id: "sup-303", title: "Noise in cabin after trip", result: "Vehicle sent for inspection", time: "17:08" },
    ],
    active: true,
  },
  {
    id: "field-001",
    name: "Tural",
    role: "Field staff",
    specialty: "Vehicle cleaning",
    kycRating: 7.6,
    ordersCompleted: 28,
    avgCompletionMinutes: 18.6,
    rating: 8.4,
    complaints: 2,
    praises: 8,
    activeShiftHours: 6.2,
    weeklyChange: -3,
    applicationsProcessed: [
      { id: "kyc-401", title: "Tesla Model 3 inspection", result: "Interior photos added to the vehicle record", time: "09:40" },
      { id: "kyc-402", title: "Chevrolet Cruze inspection", result: "Vehicle marked ready after cleaning", time: "13:05" },
    ],
    supportTicketsClosed: [
      { id: "sup-401", title: "Dirty interior after rental", result: "Vehicle cleaned and returned to the fleet", time: "12:30" },
      { id: "sup-402", title: "Cabin odor", result: "Cleaning and ventilation completed", time: "15:45" },
    ],
    active: true,
  },
  {
    id: "field-002",
    name: "Elvin",
    role: "Field staff",
    specialty: "Repair and towing to service",
    kycRating: 7.9,
    ordersCompleted: 24,
    avgCompletionMinutes: 27.4,
    rating: 8.6,
    complaints: 1,
    praises: 7,
    activeShiftHours: 6.8,
    weeklyChange: 6,
    applicationsProcessed: [
      { id: "kyc-501", title: "Kia EV6 inspection", result: "Door lock technical issue recorded", time: "10:22" },
      { id: "kyc-502", title: "RR inspection", result: "Telematics and GPS signal checked", time: "14:05" },
    ],
    supportTicketsClosed: [
      { id: "sup-501", title: "Trunk is not responding", result: "Vehicle moved to service diagnostics", time: "11:20" },
      { id: "sup-502", title: "Telematics loss", result: "Communication module restarted in service", time: "16:10" },
    ],
    active: true,
  },
  {
    id: "field-003",
    name: "Nihad",
    role: "Field staff",
    specialty: "Vehicle charging relocation",
    kycRating: 8.3,
    ordersCompleted: 31,
    avgCompletionMinutes: 22.1,
    rating: 8.9,
    complaints: 1,
    praises: 10,
    activeShiftHours: 7.6,
    weeklyChange: 10,
    applicationsProcessed: [
      { id: "kyc-601", title: "Volkswagen ID.4 check", result: "Low battery confirmed before relocation", time: "09:55" },
      { id: "kyc-602", title: "Tesla Model 3 check", result: "Relocation to a CCS2 station planned", time: "15:18" },
    ],
    supportTicketsClosed: [
      { id: "sup-601", title: "Vehicle below 20% battery", result: "Vehicle delivered to Ganjlik Mall station", time: "10:35" },
      { id: "sup-602", title: "Customer reported low range", result: "Vehicle replaced and sent to charging", time: "13:15" },
      { id: "sup-603", title: "Charging completed", result: "Vehicle returned to the available fleet", time: "17:30" },
    ],
    active: true,
  },
];

const emptyBackendStaffList = staffSeed.slice(0, 0);

const adminProfiles = {
  admin: {
    roleLabel: "Administrator",
    name: "Operations",
  },
  "super-admin": {
    roleLabel: "SuperAdmin",
    name: "Ayan Karimova",
  },
};

const ADMIN_SESSION_STORAGE_KEY = "electroStreetAdminSession";
const ADMIN_ACTIVE_SECTION_STORAGE_KEY = "electroStreetAdminActiveSection";

const normalizeBackendRole = (role) => String(role ?? "").toLowerCase();

const toAdminRole = (role) => {
  const normalizedRole = normalizeBackendRole(role);
  if (normalizedRole === "4" || normalizedRole === "superadmin" || normalizedRole === "super-admin") {
    return "super-admin";
  }

  if (normalizedRole === "3" || normalizedRole === "admin") {
    return "admin";
  }

  return null;
};

const isAdminUser = (user) => Boolean(toAdminRole(user?.role));

const createAdminSession = (user) => ({
  id: user.id,
  role: toAdminRole(user.role),
  email: user.email,
  name: user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email,
  signedInAt: new Date().toISOString(),
});

const sidebarItems = [
  { id: "control", label: "Control Room", icon: FiCommand, filter: "all" },
  { id: "users", label: "Users & KYC", icon: FiUserCheck, filter: "all" },
  { id: "billing", label: "Receipts", icon: FiDollarSign, filter: "all" },
  { id: "pricing", label: "Pricing", icon: FiTrendingUp, filter: "all" },
  { id: "kpi", label: "Staff Work", icon: FiUsers, filter: "all" },
  { id: "tasks", label: "Task Manager", icon: FiTool, filter: "low_charge" },
  { id: "helpdesk", label: "Helpdesk", icon: FiMessageSquare, filter: "all" },
  { id: "chargers", label: "Charging Map", icon: FiZap, filter: "all" },
  { id: "superadmin", label: "SuperAdmin", icon: FiShield, filter: "all", superOnly: true },
];

const incidentSeed = [
  {
    id: "inc-telemetry",
    severity: "critical",
    vehicleId: "ev-006",
    title: "Mercedes S-Class lost telematics",
    detail: "Connection was lost 2 minutes ago. Inspection is required.",
  },
  {
    id: "inc-low-battery",
    severity: "warning",
    vehicleId: "ev-001",
    title: "Tesla Model 3: battery 7%",
    detail: "Vehicle is blocked for new reservations.",
  },
  {
    id: "inc-speed",
    severity: "critical",
    vehicleId: "ev-003",
    userId: "user-003",
    title: "Speeding: 140 km/h",
    detail: "Heydar Aliyev Avenue. Emergency call is available.",
  },
];

const techniciansSeed = [
  { id: "tech-001", name: "Tural", specialty: "Cleaning", status: "free", lat: 40.384, lng: 49.842 },
  { id: "tech-002", name: "Elvin", specialty: "Technical issues", status: "free", lat: 40.372, lng: 49.858 },
  { id: "tech-003", name: "Nihad", specialty: "Charging", status: "busy", lat: 40.392, lng: 49.851 },
];

const tasksSeed = [
  { id: "task-001", vehicleId: "ev-004", technicianId: "tech-003", chargingStationId: "station-004", type: "Charging", status: "Technician on the way" },
  { id: "task-002", vehicleId: "ev-005", technicianId: "tech-001", type: "Cleaning", status: "Vehicle is being serviced" },
];

const maintenanceSeed = [
  { vehicleId: "ev-001", serviceInKm: 480, batteryHealth: 91, profitability: 78, consumption: 16.8, lastService: "2026-05-28", nextService: "in 480 km", odometerKm: 18420, maintenanceStatus: "healthy" },
  { vehicleId: "ev-002", serviceInKm: 820, batteryHealth: 88, profitability: 63, consumption: 18.2, lastService: "2026-05-19", nextService: "in 820 km", odometerKm: 22190, maintenanceStatus: "healthy" },
  { vehicleId: "ev-003", serviceInKm: 310, batteryHealth: 84, profitability: 82, consumption: 20.6, lastService: "2026-06-02", nextService: "in 310 km", odometerKm: 26740, maintenanceStatus: "needs_service" },
  { vehicleId: "ev-004", serviceInKm: 150, batteryHealth: 79, profitability: 41, consumption: 22.1, lastService: "2026-05-12", nextService: "in 150 km", odometerKm: 31980, maintenanceStatus: "needs_service" },
  { vehicleId: "ev-005", serviceInKm: 610, batteryHealth: 93, profitability: 58, consumption: 7.9, lastService: "2026-06-08", nextService: "in 610 km", odometerKm: 14260, maintenanceStatus: "in_service" },
];

const kycProfilesSeed = [
  {
    userId: "user-001",
    status: "verified",
    risk: "low",
    selfie: "Face match 98%",
    passport: "Passport AZE 09481231",
    license: "License B category",
    submittedAt: "2026-06-14 19:20",
    notes: "Clean history, 18 completed trips.",
  },
  {
    userId: "user-002",
    status: "pending",
    risk: "medium",
    selfie: "Face match 86%",
    passport: "Passport scan glare detected",
    license: "License expires in 42 days",
    submittedAt: "2026-06-15 09:12",
    notes: "Needs side-by-side manual verification.",
  },
  {
    userId: "user-003",
    status: "blocked",
    risk: "high",
    selfie: "Face match 61%",
    passport: "Passport mismatch",
    license: "License number duplicated",
    submittedAt: "2026-06-15 10:04",
    notes: "Temporary block until support confirms identity.",
  },
];

const formatDuration = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
};

const parseApiDateMs = (value) => {
  if (!value) return Number.NaN;
  const text = String(value);
  const normalized = /(?:z|[+-]\d{2}:?\d{2})$/i.test(text) ? text : `${text}Z`;
  return new Date(normalized).getTime();
};

const formatBakuDateTime = (value, fallback = "Pending date") => {
  const timeMs = parseApiDateMs(value);
  if (!Number.isFinite(timeMs)) return fallback;

  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: BAKU_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(timeMs));
};

const formatBakuDate = (value, fallback = "") => {
  const timeMs = parseApiDateMs(value);
  if (!Number.isFinite(timeMs)) return fallback;

  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: BAKU_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timeMs));
};

const parseBakuDeadlineMs = (value) => {
  if (!value) return Number.NaN;
  const text = String(value);
  const normalized = /(?:z|[+-]\d{2}:?\d{2})$/i.test(text) ? text : `${text}${text.includes("T") ? "" : "T00:00:00"}${BAKU_UTC_OFFSET}`;
  return new Date(normalized).getTime();
};

const formatBakuDeadline = (value, fallback = "No deadline") => {
  const timeMs = parseBakuDeadlineMs(value);
  if (!Number.isFinite(timeMs)) return fallback;

  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: BAKU_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timeMs));
};

const formatUpdatedTime = (value) => {
  const timeMs = parseApiDateMs(value);
  if (!Number.isFinite(timeMs)) return "unknown";

  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: BAKU_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(timeMs));
};

const isBakuMapPoint = (point) =>
  point &&
  Number.isFinite(Number(point.lat)) &&
  Number.isFinite(Number(point.lng)) &&
  Number(point.lat) >= BAKU_MAP_BOUNDS[0][0] &&
  Number(point.lat) <= BAKU_MAP_BOUNDS[1][0] &&
  Number(point.lng) >= BAKU_MAP_BOUNDS[0][1] &&
  Number(point.lng) <= BAKU_MAP_BOUNDS[1][1];

const getChargingSessionProgress = (session, task) => {
  const startBattery = Number(session.startBatteryPercent ?? session.currentBatteryPercent ?? 0);
  const targetBattery = Number(session.targetBatteryPercent ?? 100);
  const apiCurrentBattery = Number(session.currentBatteryPercent ?? 0);
  if (Number(task?.status) === STAFF_TASK_STATUSES.Done) {
    const currentBatteryPercent = apiCurrentBattery >= MIN_CHARGING_COMPLETION_PERCENT
      ? apiCurrentBattery
      : targetBattery;
    const currentRangeKm = Math.round(currentBatteryPercent * RANGE_KM_PER_BATTERY_PERCENT);
    return {
      currentBatteryPercent,
      currentRangeKm,
      minutesRemaining: Math.max(0, Math.ceil((targetBattery - currentBatteryPercent) / CHARGING_PERCENT_PER_MINUTE)),
    };
  }

  if (Number(task?.status) !== STAFF_TASK_STATUSES.InProgress) {
    const currentBatteryPercent = Math.max(apiCurrentBattery, startBattery);
    const currentRangeKm = Math.round(currentBatteryPercent * RANGE_KM_PER_BATTERY_PERCENT);
    return {
      currentBatteryPercent,
      currentRangeKm,
      minutesRemaining: Math.max(0, Math.ceil((targetBattery - currentBatteryPercent) / CHARGING_PERCENT_PER_MINUTE)),
    };
  }

  const chargingStartedAtMs = parseApiDateMs(task.updatedAt);
  const elapsedMinutes = Number.isFinite(chargingStartedAtMs)
    ? Math.max(0, (Date.now() - chargingStartedAtMs) / 60000)
    : 0;
  const currentBatteryPercent = Math.min(
    targetBattery,
    Math.max(apiCurrentBattery, Math.round(startBattery + elapsedMinutes * CHARGING_PERCENT_PER_MINUTE))
  );
  const minutesRemaining = Math.max(
    0,
    Math.ceil((targetBattery - currentBatteryPercent) / CHARGING_PERCENT_PER_MINUTE)
  );
  const currentRangeKm = Math.round(currentBatteryPercent * RANGE_KM_PER_BATTERY_PERCENT);

  return { currentBatteryPercent, currentRangeKm, minutesRemaining };
};

const makeLiveVehicle = (vehicle, index) => ({
  ...vehicle,
  liveStatus: statusFromVehicle(vehicle),
  speedKmh: vehicle.status === VEHICLE_STATUSES.IN_USE ? 38 : 0,
  activeSeconds: vehicle.status === VEHICLE_STATUSES.IN_USE ? 740 : index * 64,
  location: vehicle.location,
});

const createVehicleIcon = (vehicle, isSelected) => {
  const meta = STATUS_META[vehicle.liveStatus] || STATUS_META.available;
  const timer = vehicle.liveStatus === "in_use"
    ? formatDuration(vehicle.activeSeconds)
    : vehicle.chargingProgress
      ? `${vehicle.chargingProgress.currentBatteryPercent}%`
      : meta.short;
  const image = vehicle.image || "";

  return L.divIcon({
    className: "admin-car-marker",
    html: `
      <div class="admin-car-marker__wrap ${isSelected ? "is-selected" : ""}" data-admin-vehicle-id="${vehicle.id}" style="--status:${meta.color};">
        <span class="admin-car-marker__pulse"></span>
        <span class="admin-car-marker__core" data-admin-vehicle-id="${vehicle.id}">
          <img src="${image}" alt="" />
          <b>${timer}</b>
        </span>
      </div>
    `,
    iconSize: [74, 74],
    iconAnchor: [37, 37],
    popupAnchor: [0, -34],
  });
};

const createTechnicianIcon = (technician) =>
  L.divIcon({
    className: "admin-tech-marker",
    html: `
      <div class="admin-tech-marker__core">
        <span>STAFF</span>
        <b>${technician.status}</b>
      </div>
    `,
    iconSize: [54, 54],
    iconAnchor: [27, 27],
  });

const createChargingStationIcon = (station) => {
  const meta = STATION_STATUS_META[station.status] || STATION_STATUS_META[CHARGING_STATION_STATUSES.ONLINE];

  return L.divIcon({
    className: "admin-station-marker",
    html: `
      <div class="admin-station-marker__core" data-admin-station-id="${station.id}" style="--station:${meta.color};">
        <span>⚡</span>
        <b>${station.availablePorts}/${station.totalPorts}</b>
      </div>
    `,
    iconSize: [48, 58],
    iconAnchor: [24, 52],
    popupAnchor: [0, -48],
  });
};

const createServicePointIcon = (point) =>
  L.divIcon({
    className: "admin-service-point-marker",
    html: `
      <div class="admin-service-point-marker__core" data-admin-service-point-id="${point?.id || ""}">
        <span>+</span>
        <b>SVC</b>
      </div>
    `,
    iconSize: [48, 58],
    iconAnchor: [24, 52],
    popupAnchor: [0, -48],
  });

const makeEvent = (vehicle) => {
  const actions = {
    available: "Available for booking",
    in_use: "Active ride in progress",
    low_charge: "Low battery vehicle",
    service: "Vehicle is in service mode",
  };

  return {
    id: `feed-${Date.now()}-${vehicle.id}`,
    vehicleId: vehicle.id,
    title: `${vehicle.brand} ${vehicle.model || ""}`.trim(),
    detail: actions[vehicle.liveStatus] || "Vehicle status updated",
    plate: vehicle.plateNumber,
    time: "just now",
    status: vehicle.liveStatus,
  };
};
const MapFocus = ({ focusTarget }) => {
  const map = useMap();

  useEffect(() => {
    if (!focusTarget) return;
    const target = isBakuMapPoint(focusTarget)
      ? [Number(focusTarget.lat), Number(focusTarget.lng)]
      : BAKU_CENTER;

    map.flyTo(target, 14, {
      animate: true,
      duration: 0.65,
    });
  }, [map, focusTarget]);

  return null;
};

const MapSectionFocus = ({ activeSection }) => {
  const map = useMap();

  useEffect(() => {
    if (activeSection !== "tasks" && activeSection !== "chargers") return;

    map.setView(BAKU_CENTER, 13, { animate: false });
    map.invalidateSize({ animate: false });
  }, [activeSection, map]);

  return null;
};

const LeafletLayoutFix = ({ refreshKey }) => {
  const map = useMap();
  const frameRef = useRef(null);

  useEffect(() => {
    const container = map.getContainer();
    const invalidate = () => {
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current);
      }

      frameRef.current = window.requestAnimationFrame(() => {
        map.invalidateSize({ animate: false });
        frameRef.current = null;
      });
    };

    invalidate();
    const timers = [120, 360, 900].map((delay) => window.setTimeout(invalidate, delay));
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(invalidate) : null;
    observer?.observe(container);

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      observer?.disconnect();
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [map, refreshKey]);

  return null;
};

const MarkerDomClickFallback = ({ onVehicleClick, onStationClick, onServicePointClick }) => {
  useMapEvents({
    click(event) {
      const target = event.originalEvent?.target;
      if (!(target instanceof HTMLElement)) return;

      const vehicleNode = target.closest("[data-admin-vehicle-id]");
      if (vehicleNode?.dataset.adminVehicleId) {
        onVehicleClick(vehicleNode.dataset.adminVehicleId);
        return;
      }

      const stationNode = target.closest("[data-admin-station-id]");
      if (stationNode?.dataset.adminStationId) {
        onStationClick(stationNode.dataset.adminStationId);
        return;
      }

      const servicePointNode = target.closest("[data-admin-service-point-id]");
      if (servicePointNode?.dataset.adminServicePointId) {
        onServicePointClick(servicePointNode.dataset.adminServicePointId);
      }
    },
  });

  return null;
};

const ZoneDrawEvents = ({ enabled, onAddPoint }) => {
  useMapEvents({
    click(event) {
      if (!enabled) return;
      onAddPoint([event.latlng.lat, event.latlng.lng]);
    },
  });

  return null;
};

const VehicleLocationPickerEvents = ({ enabled, onPick }) => {
  useMapEvents({
    click(event) {
      if (!enabled) return;
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
};

const VehicleLocationPicker = ({ enabled, latitude, longitude, onPick }) => {
  const lat = Number(latitude);
  const lng = Number(longitude);
  const center = Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : BAKU_CENTER;

  return (
    <div className={`overflow-hidden rounded-2xl border ${enabled ? "border-emerald-400/40" : "border-white/10"} bg-[#08111f]`}>
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <div>
          <p className="text-xs font-black text-white">Vehicle location</p>
          <p className="text-[10px] font-bold text-slate-500">
            {enabled ? "Click on the map to place the vehicle." : "Enable map picking to move the point."}
          </p>
        </div>
        <span className={`rounded-lg px-2 py-1 text-[10px] font-black ${enabled ? "bg-emerald-500 text-white" : "bg-white/[0.06] text-slate-300"}`}>
          {enabled ? "Picking" : "Locked"}
        </span>
      </div>
      <div className="h-56">
        <MapContainer
          center={center}
          zoom={13}
          minZoom={10}
          maxBounds={BAKU_MAP_BOUNDS}
          className="h-full w-full"
          scrollWheelZoom={enabled}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap contributors &copy; CARTO'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          <Circle
            center={center}
            radius={140}
            pathOptions={{ color: "#ef4444", fillColor: "#ef4444", fillOpacity: 0.32, weight: 2 }}
          />
          <VehicleLocationPickerEvents enabled={enabled} onPick={onPick} />
          <LeafletLayoutFix refreshKey={`${enabled}:${center[0]}:${center[1]}`} />
        </MapContainer>
      </div>
    </div>
  );
};

const AdminLogin = ({ onLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const user = await authApi.login(email.trim(), password);
      if (!isAdminUser(user)) {
        await authApi.logout();
        setError("This account does not have access to the admin panel.");
        return;
      }

      const session = createAdminSession(user);
      localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify(session));
      onLogin(session);
    } catch (nextError) {
      setError(
        nextError.status === 401
          ? "Invalid email or password."
          : "Service is not connected. Please start the server and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <main className="flex min-h-screen items-center justify-center bg-[#08111f] px-4 py-8 text-slate-100">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-7 shadow-2xl shadow-black/30"
      >
        <div className="mb-7">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-red-300">ElectroStreet Admin</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-white">Situation Center</h1>
          <p className="mt-2 text-sm font-semibold text-slate-400">
            Enter the dedicated administrator login and password.
          </p>
        </div>

        <label className="grid gap-2 text-sm font-bold text-slate-300">
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setError("");
            }}
            className="rounded-xl border border-white/10 bg-[#0f1a2b] px-4 py-3 font-semibold text-white outline-none transition placeholder:text-slate-600 focus:border-red-400"
            placeholder="Enter admin email"
            autoComplete="username"
          />
        </label>

        <label className="mt-4 grid gap-2 text-sm font-bold text-slate-300">
          Password
          <span className="flex items-center rounded-xl border border-white/10 bg-[#0f1a2b] pr-3 transition focus-within:border-red-400">
            <input
              type={isPasswordVisible ? "text" : "password"}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError("");
              }}
              className="min-w-0 flex-1 rounded-xl bg-transparent px-4 py-3 font-semibold text-white outline-none placeholder:text-slate-600"
              placeholder="Enter password"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setIsPasswordVisible((value) => !value)}
              className="rounded-lg p-2 text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
              aria-label={isPasswordVisible ? "Hide password" : "Show password"}
            >
              {isPasswordVisible ? <FiEyeOff /> : <FiEye />}
            </button>
          </span>
        </label>

        {error && (
          <div className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-6 w-full rounded-xl bg-red-500 px-5 py-3 text-sm font-black uppercase tracking-wide text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
};

const AdminControlRoom = () => {
  const [adminSession, setAdminSession] = useState(() => {
    try {
      const accessToken = localStorage.getItem("electroStreetAccessToken");
      if (!accessToken) return null;

      const storedSession = localStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
      const parsedSession = storedSession ? JSON.parse(storedSession) : null;
      if (parsedSession?.role === "admin" || parsedSession?.role === "super-admin") {
        return parsedSession;
      }

      const storedUser = localStorage.getItem("electroStreetUser");
      const user = storedUser ? JSON.parse(storedUser) : null;
      return isAdminUser(user) ? createAdminSession(user) : null;
    } catch {
      return null;
    }
  });
  const [liveVehicles, setLiveVehicles] = useState([]);
  const [managedChargingStations, setManagedChargingStations] = useState([]);
  const [managedServicePoints, setManagedServicePoints] = useState([]);
  const [managedZones, setManagedZones] = useState(getInitialParkingZones);
  const [parkingZonesError, setParkingZonesError] = useState("");
  const [isLoadingParkingZones, setIsLoadingParkingZones] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [focusTarget, setFocusTarget] = useState(null);
  const [selectedChargingStationId, setSelectedChargingStationId] = useState("");
  const vehicleMarkerRefs = useRef(new Map());
  const chargingStationMarkerRefs = useRef(new Map());
  const servicePointMarkerRefs = useRef(new Map());
  const adminRole = adminSession?.role || "admin";
  const isSuperAdmin = adminRole === "super-admin";
  const [activeSection, setActiveSection] = useState(() => {
    try {
      const storedSection = localStorage.getItem(ADMIN_ACTIVE_SECTION_STORAGE_KEY);
      return sidebarItems.some((item) => item.id === storedSection) ? storedSection : "control";
    } catch {
      return "control";
    }
  });
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [userTableSearchQuery, setUserTableSearchQuery] = useState("");
  const [userTableSort, setUserTableSort] = useState({ key: "registeredAt", direction: "desc" });
  const [kycProfiles] = useState(kycProfilesSeed);
  const [kycFilter, setKycFilter] = useState("all");
  const [selectedKycUserId, setSelectedKycUserId] = useState(null);
  const [isDrawingZone, setIsDrawingZone] = useState(false);
  const [draftZoneType, setDraftZoneType] = useState("allowed");
  const [draftZonePoints, setDraftZonePoints] = useState([]);
  const [pricingPolicy, setPricingPolicy] = useState(null);
  const [pricingPolicyError, setPricingPolicyError] = useState("");
  const [isLoadingPricingPolicy, setIsLoadingPricingPolicy] = useState(false);
  const [isUpdatingPricingMode, setIsUpdatingPricingMode] = useState(false);
  const [penaltySearchQuery, setPenaltySearchQuery] = useState("");
  const [penaltyTargetId, setPenaltyTargetId] = useState(null);
  const [penaltyReasonId, setPenaltyReasonId] = useState(penaltyReasons[0].id);
  const [penaltyPeriodStartMs] = useState(() => Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [penalties, setPenalties] = useState([]);
  const [billingInvoices, setBillingInvoices] = useState([]);
  const [billingInvoiceError, setBillingInvoiceError] = useState("");
  const [isLoadingBillingInvoices, setIsLoadingBillingInvoices] = useState(false);
  const [adminStatistics, setAdminStatistics] = useState(null);
  const [adminStatisticsError, setAdminStatisticsError] = useState("");
  const [isLoadingAdminStatistics, setIsLoadingAdminStatistics] = useState(false);
  const [adminStatisticsLoadedAt, setAdminStatisticsLoadedAt] = useState(null);
  const [superAdminFinance, setSuperAdminFinance] = useState(null);
  const [superAdminFinanceError, setSuperAdminFinanceError] = useState("");
  const [isLoadingSuperAdminFinance, setIsLoadingSuperAdminFinance] = useState(false);
  const [superAdminFinancePeriod, setSuperAdminFinancePeriod] = useState(getDefaultFinancePeriod);
  const [superAdminTab, setSuperAdminTab] = useState("finance");
  const [superAdminRoleSearchQuery, setSuperAdminRoleSearchQuery] = useState("");
  const [superAdminRoleFilter, setSuperAdminRoleFilter] = useState("all");
  const [chargingStationsError, setChargingStationsError] = useState("");
  const [isLoadingChargingStations, setIsLoadingChargingStations] = useState(false);
  const [backendUsers, setBackendUsers] = useState([]);
  const [isLoadingBackendUsers, setIsLoadingBackendUsers] = useState(false);
  const [backendUsersError, setBackendUsersError] = useState("");
  const [createUserDraft, setCreateUserDraft] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    driverLicenseNumber: "",
    role: USER_ROLES.Staff,
  });
  const [blockDraft, setBlockDraft] = useState({
    userId: "",
    reason: "",
    duration: USER_BLOCK_DURATIONS.FifteenMinutes,
  });
  const [staff, setStaff] = useState(emptyBackendStaffList);
  const [adminWorkRows, setAdminWorkRows] = useState([]);
  const [staffKpiSummary, setStaffKpiSummary] = useState(null);
  const [isLoadingStaffKpi, setIsLoadingStaffKpi] = useState(false);
  const [staffKpiError, setStaffKpiError] = useState("");
  const [selectedKpiDetail, setSelectedKpiDetail] = useState(null);
  const [kpiSort, setKpiSort] = useState({ key: "ordersCompleted", direction: "desc" });
  const [incidents, setIncidents] = useState(incidentSeed);
  const [technicians] = useState(techniciansSeed);
  const [serviceTasks, setServiceTasks] = useState(tasksSeed);
  const [staffTasks, setStaffTasks] = useState([]);
  const [isLoadingStaffTasks, setIsLoadingStaffTasks] = useState(false);
  const [staffTasksError, setStaffTasksError] = useState("");
  const [backendVehicles, setBackendVehicles] = useState([]);
  const [backendVehiclesError, setBackendVehiclesError] = useState("");
  const [isLoadingBackendVehicles, setIsLoadingBackendVehicles] = useState(false);
  const [vehicleDraft, setVehicleDraft] = useState(getEmptyVehicleDraft);
  const [vehiclePhotoDraft, setVehiclePhotoDraft] = useState(getEmptyVehiclePhotoDraft);
  const [editingVehicleId, setEditingVehicleId] = useState("");
  const [vehicleManagementBusyId, setVehicleManagementBusyId] = useState("");
  const [activeChargingSessions, setActiveChargingSessions] = useState([]);
  const [isLoadingChargingSessions, setIsLoadingChargingSessions] = useState(false);
  const [chargingSessionsError, setChargingSessionsError] = useState("");
  const [chargingProgressTick, setChargingProgressTick] = useState(() => Date.now());
  const [chargingAssignmentDraft, setChargingAssignmentDraft] = useState({});
  const [chargingAssignmentVehicleId, setChargingAssignmentVehicleId] = useState("");
  const [staffTaskDraft, setStaffTaskDraft] = useState({
    title: "",
    description: "",
    assigneeId: "",
    vehicleId: "",
    priority: STAFF_TASK_PRIORITIES.Medium,
    dueAt: "",
  });
  const [tickets, setTickets] = useState([]);
  const [activeTicketId, setActiveTicketId] = useState(null);
  const [ticketSearchQuery, setTicketSearchQuery] = useState("");
  const [ticketStatusFilter, setTicketStatusFilter] = useState("all");
  const [chatDraft, setChatDraft] = useState("");
  const [ticketAssigneeDrafts, setTicketAssigneeDrafts] = useState({});
  const [ticketsError, setTicketsError] = useState("");
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [adminNotice, setAdminNotice] = useState({ section: null, message: "", tone: "success" });
  const { confirm, dialog } = useConfirmDialog();
  const [riderNotifications] = useState([]);
  const [plannedMaintenance, setPlannedMaintenance] = useState([]);
  const [maintenanceFilter, setMaintenanceFilter] = useState("all");
  const [chargingDraft, setChargingDraft] = useState({
    name: "",
    address: "",
    chargerType: "CCS2",
    ports: 2,
    status: CHARGING_STATION_STATUSES.ONLINE,
    lat: "",
    lng: "",
    pickOnMap: false,
  });
  const [servicePointDraft, setServicePointDraft] = useState({
    name: "",
    address: "",
    lat: "",
    lng: "",
    pickOnMap: false,
  });
  const [events, setEvents] = useState([]);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  useEffect(() => {
    const handleSessionRefreshed = (event) => {
      const user = event.detail;
      if (!isAdminUser(user)) return;

      const session = createAdminSession(user);
      localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify(session));
      setAdminSession(session);
    };
    const handleSessionExpired = () => {
      localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
      setAdminSession(null);
    };

    window.addEventListener("electrostreet:session-refreshed", handleSessionRefreshed);
    window.addEventListener("electrostreet:session-expired", handleSessionExpired);
    return () => {
      window.removeEventListener("electrostreet:session-refreshed", handleSessionRefreshed);
      window.removeEventListener("electrostreet:session-expired", handleSessionExpired);
    };
  }, []);

  const staffMembers = useMemo(
    () => backendUsers
      .filter((user) =>
        user.email !== LEGACY_DEVELOPMENT_ADMIN_EMAIL &&
        user.role === USER_ROLES.Staff &&
        user.isActive &&
        !isCurrentlyBlockedUser(user)
      )
      .map((user) => ({
        id: user.id,
        name: `${user.firstName} ${user.lastName}`.trim() || user.email,
        email: user.email,
        role: "Staff",
      })),
    [backendUsers]
  );
  const activeStaffTaskCounts = useMemo(() => {
    const counts = {};
    staffTasks
      .filter((task) => Number(task.status) !== STAFF_TASK_STATUSES.Done)
      .forEach((task) => {
        counts[task.assigneeId] = (counts[task.assigneeId] || 0) + 1;
      });
    return counts;
  }, [staffTasks]);
  const visibleStaffTasks = useMemo(() => {
    return staffTasks.filter((task) =>
      isTaskManagerTask(task) &&
      Number(task.status) !== STAFF_TASK_STATUSES.Done
    );
  }, [staffTasks]);
  const completedStaffTaskCount = useMemo(
    () => staffTasks.filter((task) =>
      isTaskManagerTask(task) &&
      Number(task.status) === STAFF_TASK_STATUSES.Done
    ).length,
    [staffTasks]
  );
  const activeChargingVehicleIds = useMemo(
    () => new Set(activeChargingSessions.map((session) => session.vehicleId)),
    [activeChargingSessions]
  );
  const readyChargingVehicles = useMemo(
    () =>
      backendVehicles.filter((vehicle) =>
        vehicle.status === VEHICLE_STATUSES.CHARGING &&
        Number(vehicle.batteryPercent) >= MIN_CHARGING_COMPLETION_PERCENT &&
        !activeChargingVehicleIds.has(vehicle.id)
      ),
    [activeChargingVehicleIds, backendVehicles]
  );
  const chargingRecommendations = useMemo(
    () =>
      backendVehicles
        .filter((vehicle) =>
          Number(vehicle.batteryPercent) <= LOW_CHARGE_RECOMMENDATION_PERCENT &&
          [VEHICLE_STATUSES.AVAILABLE, VEHICLE_STATUSES.CHARGING].includes(vehicle.status) &&
          !activeChargingVehicleIds.has(vehicle.id)
        )
        .sort((first, second) => Number(first.batteryPercent) - Number(second.batteryPercent)),
    [activeChargingVehicleIds, backendVehicles]
  );
  const getCompatibleChargingStations = useCallback(
    (vehicle) =>
      managedChargingStations.filter((station) =>
        station.status === CHARGING_STATION_STATUSES.ONLINE &&
        Number(station.availablePorts) > 0 &&
        (!vehicle?.connectorType || station.connectorTypes.includes(vehicle.connectorType))
      ),
    [managedChargingStations]
  );
  const canManageUserAccount = useCallback((user) => {
    if (!user || user.id === adminSession?.id) return false;
    if (isSuperAdmin) return true;
    return user.role === USER_ROLES.Rider || user.role === USER_ROLES.Staff;
  }, [adminSession?.id, isSuperAdmin]);
  const blockableUsers = useMemo(
    () => backendUsers.filter((user) => user.email !== LEGACY_DEVELOPMENT_ADMIN_EMAIL && user.isActive && canManageUserAccount(user)),
    [backendUsers, canManageUserAccount]
  );

  useEffect(() => {
    if (!adminSession) return;

    if (
      adminSession.role === "admin" &&
      sidebarItems.find((item) => item.id === activeSection)?.superOnly
    ) {
      const adminSectionTimer = window.setTimeout(() => {
        setActiveSection("users");
        setStatusFilter("all");
      }, 0);

      return () => window.clearTimeout(adminSectionTimer);
    }

    return undefined;
  }, [activeSection, adminSession]);

  useEffect(() => {
    if (!adminSession) return;

    localStorage.setItem(ADMIN_ACTIVE_SECTION_STORAGE_KEY, activeSection);
  }, [activeSection, adminSession]);

  useEffect(() => {
    try {
      localStorage.setItem(PARKING_ZONES_STORAGE_KEY, JSON.stringify(managedZones));
    } catch {
      // Local storage can be unavailable in private or restricted browser modes.
    }
  }, [managedZones]);

  const loadAdminStatistics = useCallback(async () => {
    setIsLoadingAdminStatistics(true);
    setAdminStatisticsError("");

    try {
      const statistics = await adminStatisticsApi.getLiveStatistics();
      setAdminStatistics(statistics);
      setAdminStatisticsLoadedAt(new Date().toISOString());
    } catch (error) {
      setAdminStatistics(null);
      setAdminStatisticsError(
        error.status === 401 || error.status === 403
          ? "Admin session expired. Please log in again."
          : "Statistics are unavailable. Please check the service and refresh."
      );
    } finally {
      setIsLoadingAdminStatistics(false);
    }
  }, []);

  const loadPricingPolicy = useCallback(async (options = {}) => {
    const silent = options.silent === true;
    if (!silent) setIsLoadingPricingPolicy(true);
    setPricingPolicyError("");

    try {
      setPricingPolicy(await adminPricingApi.getCurrent());
    } catch (error) {
      setPricingPolicy(null);
      setPricingPolicyError(error.message || "Pricing policy is unavailable.");
    } finally {
      if (!silent) setIsLoadingPricingPolicy(false);
    }
  }, []);

  const loadSuperAdminFinance = useCallback(async (period = superAdminFinancePeriod) => {
    if (!isSuperAdmin) return;

    setIsLoadingSuperAdminFinance(true);
    setSuperAdminFinance(null);
    setSuperAdminFinanceError("");

    try {
      setSuperAdminFinance(await adminStatisticsApi.getFinanceStatistics(period));
    } catch (error) {
      setSuperAdminFinance(null);
      setSuperAdminFinanceError(
        error.status === 401 || error.status === 403
          ? "SuperAdmin access is required for finance statistics."
          : error.message || "Finance statistics are unavailable."
      );
    } finally {
      setIsLoadingSuperAdminFinance(false);
    }
  }, [isSuperAdmin, superAdminFinancePeriod]);

  const loadBackendUsers = useCallback(async () => {
    setIsLoadingBackendUsers(true);
    setBackendUsersError("");

    try {
      const users = await adminUsersApi.getUsers();
      setBackendUsers(users);
      const backendStaff = users
        .filter((user) => user.role === USER_ROLES.Staff)
        .map(mapBackendStaffUser);
      setStaffTaskDraft((draft) => ({
        ...draft,
        assigneeId: draft.assigneeId || backendStaff[0]?.id || "",
      }));
    } catch (error) {
      setBackendUsersError(error.message || "Users are unavailable.");
    } finally {
      setIsLoadingBackendUsers(false);
    }
  }, []);

  const loadStaffTasks = useCallback(async (options = {}) => {
    const silent = options.silent === true;
    if (!silent) setIsLoadingStaffTasks(true);
    setStaffTasksError("");

    try {
      setStaffTasks(await adminStaffTasksApi.getTasks());
    } catch (error) {
      setStaffTasksError(error.message || "Staff tasks are unavailable.");
    } finally {
      if (!silent) setIsLoadingStaffTasks(false);
    }
  }, []);

  const loadStaffKpi = useCallback(async (options = {}) => {
    const silent = options.silent === true;
    if (!silent) setIsLoadingStaffKpi(true);
    setStaffKpiError("");

    try {
      const summary = await adminStatisticsApi.getStaffKpi();
      setStaffKpiSummary(summary);
      setStaff(Array.isArray(summary?.staff) ? summary.staff.map(mapBackendStaffKpiRow) : []);
      setAdminWorkRows(Array.isArray(summary?.admins) ? summary.admins.map(mapBackendStaffKpiRow) : []);
    } catch (error) {
      setStaffKpiError(error.message || "Staff KPI is unavailable.");
      setAdminWorkRows([]);
    } finally {
      if (!silent) setIsLoadingStaffKpi(false);
    }
  }, []);

  const loadBackendVehicles = useCallback(async (options = {}) => {
    const silent = options.silent === true;
    if (!silent) setIsLoadingBackendVehicles(true);
    setBackendVehiclesError("");

    try {
      const vehiclesFromBackend = await vehicleApi.getVehicles();
      const nextVehicles = Array.isArray(vehiclesFromBackend) ? vehiclesFromBackend : [];
      const nextLiveVehicles = nextVehicles.map(makeLiveVehicle);

      setBackendVehicles(nextVehicles);
      setLiveVehicles(nextLiveVehicles);
      setSelectedVehicleId((currentId) =>
        nextLiveVehicles.some((vehicle) => vehicle.id === currentId)
          ? currentId
          : ""
      );
      setEvents(nextLiveVehicles.slice(0, 5).map((vehicle, index) => makeEvent(vehicle, index)));
    } catch (error) {
      setBackendVehicles([]);
      setLiveVehicles([]);
      setSelectedVehicleId("");
      setEvents([]);
      setBackendVehiclesError(error.message || "Vehicles are unavailable.");
    } finally {
      if (!silent) setIsLoadingBackendVehicles(false);
    }
  }, []);

  const loadChargingStations = useCallback(async (options = {}) => {
    const silent = options.silent === true;
    if (!silent) setIsLoadingChargingStations(true);
    setChargingStationsError("");

    try {
      setManagedChargingStations(await chargingApi.getStations());
    } catch (error) {
      setManagedChargingStations([]);
      setChargingStationsError(error.message || "Charging stations are unavailable.");
    } finally {
      if (!silent) setIsLoadingChargingStations(false);
    }
  }, []);

  const loadParkingZones = useCallback(async (options = {}) => {
    const silent = options.silent === true;
    if (!silent) setIsLoadingParkingZones(true);
    setParkingZonesError("");

    try {
      const zones = await parkingZoneApi.getZones();
      setManagedZones(zones);
    } catch (error) {
      setManagedZones((items) => items.length ? items : getInitialParkingZones());
      setParkingZonesError(error.message || "Parking zones are unavailable.");
    } finally {
      if (!silent) setIsLoadingParkingZones(false);
    }
  }, []);

  const loadChargingSessions = useCallback(async (options = {}) => {
    const silent = options.silent === true;
    if (!silent) setIsLoadingChargingSessions(true);
    setChargingSessionsError("");

    try {
      setActiveChargingSessions(await chargingApi.getActiveSessions());
    } catch (error) {
      setActiveChargingSessions([]);
      setChargingSessionsError(error.message || "Charging sessions are unavailable.");
    } finally {
      if (!silent) setIsLoadingChargingSessions(false);
    }
  }, []);

  useEffect(() => {
    if (!adminSession) return undefined;

    const progressTimer = window.setInterval(() => setChargingProgressTick(Date.now()), 5000);
    return () => window.clearInterval(progressTimer);
  }, [adminSession]);

  useEffect(() => {
    if (!adminSession) return undefined;

    const initialStatisticsTimer = window.setTimeout(loadAdminStatistics, 0);
    const initialUsersTimer = window.setTimeout(loadBackendUsers, 0);
    const initialTasksTimer = window.setTimeout(loadStaffTasks, 0);
    const initialStaffKpiTimer = window.setTimeout(loadStaffKpi, 0);
    const initialVehiclesTimer = window.setTimeout(loadBackendVehicles, 0);
    const initialChargingTimer = window.setTimeout(loadChargingStations, 0);
    const initialChargingSessionsTimer = window.setTimeout(loadChargingSessions, 0);
    const initialParkingZonesTimer = window.setTimeout(loadParkingZones, 0);
    const initialPricingTimer = window.setTimeout(loadPricingPolicy, 0);
    const initialBillingTimer = window.setTimeout(loadBillingInvoices, 0);
    const initialSupportTimer = window.setTimeout(loadSupportTickets, 0);
    const statisticsTimer = window.setInterval(loadAdminStatistics, 30000);
    const billingTimer = window.setInterval(async () => {
      try {
        const invoices = await invoiceApi.getAdminInvoices();
        setBillingInvoices(Array.isArray(invoices) ? invoices : []);
        setBillingInvoiceError("");
      } catch (error) {
        setBillingInvoiceError(error.status === 404 ? "" : error.message || "Receipts could not be loaded.");
      }
    }, 10000);
    const supportTimer = window.setInterval(loadSupportTickets, 10000);
    const vehiclesTimer = window.setInterval(() => loadBackendVehicles({ silent: true }), 5000);
    const chargingSessionsTimer = window.setInterval(() => {
      loadChargingSessions({ silent: true });
      loadChargingStations({ silent: true });
      loadStaffTasks({ silent: true });
      loadStaffKpi({ silent: true });
    }, 10000);
    return () => {
      window.clearTimeout(initialStatisticsTimer);
      window.clearTimeout(initialUsersTimer);
      window.clearTimeout(initialTasksTimer);
      window.clearTimeout(initialStaffKpiTimer);
      window.clearTimeout(initialVehiclesTimer);
      window.clearTimeout(initialChargingTimer);
      window.clearTimeout(initialChargingSessionsTimer);
      window.clearTimeout(initialParkingZonesTimer);
      window.clearTimeout(initialPricingTimer);
      window.clearTimeout(initialBillingTimer);
      window.clearTimeout(initialSupportTimer);
      window.clearInterval(statisticsTimer);
      window.clearInterval(billingTimer);
      window.clearInterval(supportTimer);
      window.clearInterval(vehiclesTimer);
      window.clearInterval(chargingSessionsTimer);
    };
  }, [adminSession, loadAdminStatistics, loadBackendUsers, loadStaffTasks, loadStaffKpi, loadBackendVehicles, loadChargingStations, loadChargingSessions, loadParkingZones, loadPricingPolicy]);

  useEffect(() => {
    if (activeSection !== "superadmin" || !isSuperAdmin) return undefined;

    const financeTimer = window.setTimeout(loadSuperAdminFinance, 0);
    return () => window.clearTimeout(financeTimer);
  }, [activeSection, isSuperAdmin, loadSuperAdminFinance]);

  useEffect(() => {
    if (!adminSession) return undefined;

    const connection = createOperationsConnection();
    const handleStaffTaskChange = (task) => {
      setStaffTasks((items) => upsertStaffTask(items, task));
      setStaffTasksError("");
    };
    const handleAdminUserChange = (user) => {
      setBackendUsers((items) => upsertAdminUser(items, user));
      setBackendUsersError("");
    };
    const handleAdminDataChange = (message) => {
      const refreshReceipts = async () => {
        try {
          const invoices = await invoiceApi.getAdminInvoices();
          setBillingInvoices(Array.isArray(invoices) ? invoices : []);
          setBillingInvoiceError("");
        } catch (error) {
          setBillingInvoiceError(error.status === 404 ? "" : error.message || "Receipts could not be loaded.");
        }
      };

      if (message?.scope === "staffTasks") {
        loadAdminStatistics();
        loadStaffKpi({ silent: true });
      } else if (message?.scope === "users") {
        loadBackendUsers();
        loadAdminStatistics();
        loadStaffKpi({ silent: true });
        refreshReceipts();
      } else if (["payments", "payment", "billing", "invoices", "receipts"].includes(message?.scope)) {
        refreshReceipts();
        loadAdminStatistics();
      } else if (message?.scope === "chargingStations") {
        loadChargingStations({ silent: true });
        loadAdminStatistics();
      } else if (message?.scope === "chargingSessions") {
        loadChargingSessions({ silent: true });
        loadChargingStations({ silent: true });
        loadBackendVehicles();
        loadStaffTasks();
        loadStaffKpi({ silent: true });
      } else if (message?.scope === "parkingZones") {
        loadParkingZones({ silent: true });
      } else if (message?.scope === "pricing") {
        loadPricingPolicy({ silent: true });
        loadBackendVehicles({ silent: true });
      } else {
        refreshReceipts();
        loadAdminStatistics();
      }
    };

    connection.on(REALTIME_EVENTS.StaffTaskCreated, handleStaffTaskChange);
    connection.on(REALTIME_EVENTS.StaffTaskUpdated, handleStaffTaskChange);
    connection.on(REALTIME_EVENTS.AdminUserChanged, handleAdminUserChange);
    connection.on(REALTIME_EVENTS.AdminDataChanged, handleAdminDataChange);
    connection.onreconnecting(() => setStaffTasksError("Live updates reconnecting. Manual refresh is still available."));
    connection.onreconnected(() => setStaffTasksError(""));
    connection.onclose(() => setStaffTasksError("Live updates paused. Manual refresh is still available."));

    startConnection(connection).catch(() => {
      setStaffTasksError("Live updates unavailable. Manual refresh is still available.");
    });

    return () => {
      connection.off(REALTIME_EVENTS.StaffTaskCreated, handleStaffTaskChange);
      connection.off(REALTIME_EVENTS.StaffTaskUpdated, handleStaffTaskChange);
      connection.off(REALTIME_EVENTS.AdminUserChanged, handleAdminUserChange);
      connection.off(REALTIME_EVENTS.AdminDataChanged, handleAdminDataChange);
      stopConnection(connection).catch(() => {});
    };
  }, [adminSession, loadAdminStatistics, loadBackendUsers, loadBackendVehicles, loadChargingSessions, loadChargingStations, loadParkingZones, loadPricingPolicy, loadStaffTasks, loadStaffKpi]);

  useEffect(() => {
    if (!adminSession) return undefined;

    const connection = createSupportConnection();
    const handleTicketUpdate = (ticket) => {
      setTickets((items) => upsertSupportTicket(items, ticket));
      setActiveTicketId((currentId) => currentId || ticket.id);
      setTicketsError("");
    };

    connection.on(SUPPORT_REALTIME_EVENTS.SupportTicketUpdated, handleTicketUpdate);
    connection.on(SUPPORT_REALTIME_EVENTS.SupportTicketEscalated, handleTicketUpdate);

    startSupportConnection(connection).catch(() => {
      setTicketsError("");
    });

    return () => {
      connection.off(SUPPORT_REALTIME_EVENTS.SupportTicketUpdated, handleTicketUpdate);
      connection.off(SUPPORT_REALTIME_EVENTS.SupportTicketEscalated, handleTicketUpdate);
      stopSupportConnection(connection).catch(() => {});
    };
  }, [adminSession]);

  useEffect(() => {
    if (activeSection === "billing" || activeSection === "control") {
      loadBillingInvoices();
    }
    // Receipts are also used by the Control Room snapshot.
  }, [activeSection]);

  useEffect(() => {
    if (activeSection !== "kpi") return undefined;

    const timer = window.setTimeout(loadStaffKpi, 0);
    return () => window.clearTimeout(timer);
  }, [activeSection, loadStaffKpi]);

  const handleAdminLogout = async () => {
    try {
      await authApi.logout();
    } finally {
      localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
      localStorage.removeItem(ADMIN_ACTIVE_SECTION_STORAGE_KEY);
    }
    setAdminSession(null);
    setActiveSection("control");
    setStatusFilter("all");
  };

  const chargingProgressByVehicleId = useMemo(() => {
    void chargingProgressTick;

    const tasksById = new Map(staffTasks.map((task) => [task.id, task]));
    const progressByVehicleId = new Map();

    activeChargingSessions.forEach((session) => {
      progressByVehicleId.set(
        session.vehicleId,
        getChargingSessionProgress(session, tasksById.get(session.staffTaskId))
      );
    });

    return progressByVehicleId;
  }, [activeChargingSessions, chargingProgressTick, staffTasks]);

  const liveVehiclesWithChargingProgress = useMemo(
    () =>
      liveVehicles.map((vehicle) => {
        const progress = chargingProgressByVehicleId.get(vehicle.id);
        if (!progress) return vehicle;

        return {
          ...vehicle,
          batteryPercent: progress.currentBatteryPercent,
          rangeKm: progress.currentRangeKm,
          chargingProgress: progress,
          liveStatus: "low_charge",
        };
      }),
    [chargingProgressByVehicleId, liveVehicles]
  );

  const filteredVehicles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return liveVehiclesWithChargingProgress.filter((vehicle) => {
      const matchesStatus = statusFilter === "all" || vehicle.liveStatus === statusFilter;
      const searchable = [
        vehicle.brand,
        vehicle.model,
        vehicle.plateNumber,
        vehicle.location?.label,
        vehicle.location?.zone,
        STATUS_LABELS[vehicle.liveStatus],
        STATUS_META[vehicle.liveStatus]?.short,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesStatus && (!query || searchable.includes(query));
    });
  }, [liveVehiclesWithChargingProgress, searchQuery, statusFilter]);

  const searchResults = useMemo(() => filteredVehicles.slice(0, 6), [filteredVehicles]);

  const taskVehicleIds = useMemo(
    () => new Set(visibleStaffTasks.map((task) => task.vehicleId).filter(Boolean)),
    [visibleStaffTasks]
  );

  const taskMapVehicles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return liveVehiclesWithChargingProgress.filter((vehicle) => {
      if (!taskVehicleIds.has(vehicle.id)) return false;
      if (!query) return true;

      const searchable = [
        vehicle.brand,
        vehicle.model,
        vehicle.plateNumber,
        vehicle.location?.label,
        vehicle.location?.zone,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [liveVehiclesWithChargingProgress, searchQuery, taskVehicleIds]);

  const mapVehicles = activeSection === "tasks" ? taskMapVehicles : filteredVehicles;

  const selectedVehicle = useMemo(
    () => mapVehicles.find((vehicle) => vehicle.id === selectedVehicleId)
      || liveVehiclesWithChargingProgress.find((vehicle) => vehicle.id === selectedVehicleId)
      || null,
    [liveVehiclesWithChargingProgress, mapVehicles, selectedVehicleId]
  );

  const selectedVehicleNotification = useMemo(
    () => riderNotifications.find((notice) => notice.vehicleId === selectedVehicle?.id),
    [riderNotifications, selectedVehicle?.id]
  );

  const currentAdminProfile = adminProfiles[adminRole] || adminProfiles.admin;

  const kycRows = useMemo(() => {
    const riderUsers = backendUsers.filter((user) => user.role === USER_ROLES.Rider);

    return riderUsers.map((user) => {
      const status = !user.isActive
        ? "blocked"
        : user.verificationStatus === USER_VERIFICATION_STATUSES.Verified
          ? "verified"
          : user.verificationStatus === USER_VERIFICATION_STATUSES.Rejected
            ? "rejected"
            : "pending";
      const profile = kycProfiles.find((item) => item.userId === user.id) || {
        userId: user.id,
        status,
        risk: "medium",
        account: user.email || "No email",
        documents: user.driverLicenseDocumentUrl && user.passportDocumentUrl
          ? "Driver license and passport uploaded"
          : user.driverLicenseNumber || "No driver license number",
        identity: user.phone || "No phone number",
        submittedAt: user.verificationSubmittedAt
          ? formatBakuDateTime(user.verificationSubmittedAt)
          : "Not submitted",
        notes: user.blockReason
          || (status === "verified"
            ? "Verification approved."
            : status === "blocked"
              ? "Account is blocked."
              : status === "rejected"
                ? "Verification rejected. Waiting for new documents."
              : "Awaiting admin verification decision."),
      };

      return {
        ...user,
        fullName: `${user.firstName} ${user.lastName}`.trim() || user.email,
        kyc: { ...profile, status },
      };
    });
  }, [backendUsers, kycProfiles]);

  const filteredKycRows = useMemo(() => {
    if (kycFilter === "all") return kycRows;
    return kycRows.filter((row) => row.kyc.status === kycFilter);
  }, [kycFilter, kycRows]);

  const selectedKycUser = useMemo(
    () => filteredKycRows.find((row) => row.id === selectedKycUserId) || null,
    [filteredKycRows, selectedKycUserId]
  );

  const userTableRows = useMemo(() => {
    const registeredAtSeed = [
      "2026-01-08",
      "2026-02-17",
      "2026-03-26",
      "2025-11-12",
    ];

    return backendUsers
      .filter((user) => user.email !== LEGACY_DEVELOPMENT_ADMIN_EMAIL)
      .map((user, index) => {
      const registeredAt = user.createdAt
        ? formatBakuDate(user.createdAt)
        : registeredAtSeed[index % registeredAtSeed.length];
      const accountStatus = !user.isActive
        ? "blocked"
        : user.verificationStatus === USER_VERIFICATION_STATUSES.Internal
          ? "internal"
          : user.verificationStatus === USER_VERIFICATION_STATUSES.Verified
            ? "verified"
            : user.verificationStatus === USER_VERIFICATION_STATUSES.Rejected
              ? "rejected"
              : "pending";

      return {
        id: user.id,
        username: `${user.firstName} ${user.lastName}`.trim() || user.email,
        email: user.email,
        phone: user.phone || "—",
        balanceAmount: user.balance ?? 0,
        balanceCurrency: "AZN",
        registeredAt,
        accountStatus,
        role: normalizeRole(user.role),
        raw: user,
      };
      });
  }, [backendUsers]);

  const visibleUserTableRows = useMemo(() => {
    const query = userTableSearchQuery.trim().toLowerCase();
    const sortedRows = [...userTableRows].sort((first, second) => {
      const firstValue = first[userTableSort.key];
      const secondValue = second[userTableSort.key];
      const direction = userTableSort.direction === "asc" ? 1 : -1;

      if (userTableSort.key === "balanceAmount") {
        return (Number(firstValue) - Number(secondValue)) * direction;
      }

      return String(firstValue || "").localeCompare(String(secondValue || "")) * direction;
    });

    if (!query) return sortedRows;

    return sortedRows.filter((row) =>
      [row.username, row.email, row.phone, row.balanceAmount, row.registeredAt, row.accountStatus, row.role]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [userTableRows, userTableSearchQuery, userTableSort]);

  const fleetStats = useMemo(() => {
    const statusCounts = liveVehiclesWithChargingProgress.reduce(
      (acc, vehicle) => {
        acc[vehicle.liveStatus] = (acc[vehicle.liveStatus] || 0) + 1;
        return acc;
      },
      { available: 0, in_use: 0, low_charge: 0, service: 0, reserved: 0 }
    );
    const averageBattery = Math.round(
      liveVehiclesWithChargingProgress.reduce((sum, vehicle) => sum + vehicle.batteryPercent, 0) / Math.max(liveVehiclesWithChargingProgress.length, 1)
    );

    if (adminStatistics?.vehicles) {
      const vehiclesSummary = adminStatistics.vehicles;
      const activeTrips = statusCounts.in_use || adminStatistics.rides?.active || vehiclesSummary.inUse || 0;
      const total = vehiclesSummary.total || liveVehiclesWithChargingProgress.length || 0;
      const utilization = total === 0
        ? 0
        : Math.round(((activeTrips + (vehiclesSummary.reserved || 0)) / total) * 100);

      return {
        available: statusCounts.available,
        in_use: statusCounts.in_use,
        low_charge: statusCounts.low_charge,
        service: statusCounts.service,
        reserved: vehiclesSummary.reserved ?? 0,
        charging: vehiclesSummary.charging ?? 0,
        maintenance: vehiclesSummary.maintenance ?? 0,
        activeTrips,
        utilization,
        averageBattery,
        total,
      };
    }

    const activeTrips = statusCounts.in_use;
    const utilization = Math.round((activeTrips / Math.max(liveVehiclesWithChargingProgress.length, 1)) * 100);

    return { ...statusCounts, activeTrips, utilization, averageBattery };
  }, [adminStatistics, liveVehiclesWithChargingProgress]);

  const receiptSummary = useMemo(() => {
    const orderedReceipts = [...billingInvoices].sort(
      (first, second) => parseApiDateMs(second.createdAt) - parseApiDateMs(first.createdAt)
    );
    const latestReceipt = orderedReceipts[0] || null;
    const totalAmount = billingInvoices.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
    const currency = latestReceipt?.currency || adminStatistics?.revenue?.currency || "AZN";

    return {
      count: billingInvoices.length,
      totalAmount,
      currency,
      latestLabel: latestReceipt ? formatBakuDateTime(latestReceipt.createdAt, "No receipts yet") : "No receipts yet",
      latestAmount: latestReceipt ? Number(latestReceipt.amount || 0) : 0,
      latestCustomer: latestReceipt?.userEmail || latestReceipt?.userName || "",
    };
  }, [adminStatistics?.revenue?.currency, billingInvoices]);

  const stationStats = useMemo(() => {
    const onlineStations = managedChargingStations.filter(
      (station) => station.status === CHARGING_STATION_STATUSES.ONLINE
    ).length;
    const availablePorts = managedChargingStations.reduce(
      (sum, station) => sum + station.availablePorts,
      0
    );
    const totalPorts = managedChargingStations.reduce((sum, station) => sum + station.totalPorts, 0);
    const maxPower = managedChargingStations.length
      ? Math.max(...managedChargingStations.map((station) => station.powerKw))
      : 0;

    return { onlineStations, availablePorts, totalPorts, maxPower };
  }, [managedChargingStations]);

  const zoneStats = useMemo(() => {
    const counts = managedZones.reduce(
      (acc, zone) => {
        acc[zone.type] = (acc[zone.type] || 0) + 1;
        return acc;
      },
      { allowed: 0, restricted: 0 }
    );

    return {
      total: managedZones.length,
      ...counts,
    };
  }, [managedZones]);

  const selectedChargingStation = useMemo(
    () =>
      managedChargingStations.find((station) => station.id === selectedChargingStationId) ||
      managedChargingStations[0] ||
      null,
    [managedChargingStations, selectedChargingStationId]
  );

  const selectedStationActiveSessions = useMemo(
    () =>
      selectedChargingStation
        ? activeChargingSessions.filter((session) => session.chargingStationId === selectedChargingStation.id)
        : [],
    [activeChargingSessions, selectedChargingStation]
  );




  const focusVehicle = (vehicleId) => {
    const vehicle = mapVehicles.find((item) => item.id === vehicleId)
      || liveVehiclesWithChargingProgress.find((item) => item.id === vehicleId);

    setSelectedVehicleId(vehicleId);
    if (vehicle?.location) {
      const target = isBakuMapPoint(vehicle.location)
        ? vehicle.location
        : { lat: BAKU_CENTER[0], lng: BAKU_CENTER[1] };
      setFocusTarget({
        id: vehicle.id,
        lat: target.lat,
        lng: target.lng,
      });
    }
  };

  const openVehicleDetailsById = (vehicleId) => {
    focusVehicle(vehicleId);
    window.setTimeout(() => {
      vehicleMarkerRefs.current.get(vehicleId)?.openPopup();
    }, 0);
  };

  const openChargingStationDetails = (station) => {
    if (!station) return;

    setSelectedChargingStationId(station.id);
    setFocusTarget({
      id: station.id,
      lat: station.location.lat,
      lng: station.location.lng,
    });
  };

  const openChargingStationDetailsById = (stationId) => {
    const station = managedChargingStations.find((item) => item.id === stationId);
    openChargingStationDetails(station);
    window.setTimeout(() => {
      chargingStationMarkerRefs.current.get(stationId)?.openPopup();
    }, 0);
  };

  const focusServicePointById = (pointId) => {
    const point = managedServicePoints.find((item) => item.id === pointId);
    if (!point?.location) return;

    setFocusTarget({
      id: point.id,
      lat: point.location.lat,
      lng: point.location.lng,
    });
    window.setTimeout(() => {
      servicePointMarkerRefs.current.get(pointId)?.openPopup();
    }, 0);
  };

  const visibleSidebarItems = sidebarItems.filter((item) => isSuperAdmin || !item.superOnly);

  const getVehicle = (vehicleId) => liveVehiclesWithChargingProgress.find((vehicle) => vehicle.id === vehicleId) || null;
  const activeTicket = tickets.find((ticket) => ticket.id === activeTicketId) || tickets[0];
  const showAdminNotice = (message, section = activeSection, tone = "success") => {
    setAdminNotice({ section, message, tone });
  };
  const getApiErrorMessage = (error, fallback) => {
    if (Array.isArray(error?.errors) && error.errors.length) {
      return error.errors.map((item) => item.message).filter(Boolean).join("\n") || fallback;
    }

    return error?.message || fallback;
  };
  const updatePricingMode = async (mode) => {
    setIsUpdatingPricingMode(true);
    setPricingPolicyError("");

    try {
      const nextPolicy = await adminPricingApi.updateMode(mode);
      setPricingPolicy(nextPolicy);
      showAdminNotice(`Pricing mode updated: ${normalizePricingMode(nextPolicy?.mode || mode)}.`, "pricing");
      await loadBackendVehicles({ silent: true });
    } catch (error) {
      const message = getApiErrorMessage(error, "Pricing mode could not be updated.");
      setPricingPolicyError(message);
      showAdminNotice(message, "pricing", "error");
    } finally {
      setIsUpdatingPricingMode(false);
    }
  };
  const updateVehicleDraft = (field, value) => {
    setVehicleDraft((draft) => ({ ...draft, [field]: value }));
  };
  const setVehicleDraftPoint = (lat, lng) => {
    setVehicleDraft((draft) => ({
      ...draft,
      latitude: Number(lat).toFixed(6),
      longitude: Number(lng).toFixed(6),
      locationLabel: draft.locationLabel || "Selected map point",
    }));
  };
  const updateVehiclePhotoDraft = (field, file) => {
    setVehiclePhotoDraft((draft) => ({ ...draft, [field]: file || null }));
  };
  const hasVehiclePhotos = Object.values(vehiclePhotoDraft).some(Boolean);
  const beginCreateVehicle = () => {
    setEditingVehicleId("");
    setVehicleDraft(getEmptyVehicleDraft());
    setVehiclePhotoDraft(getEmptyVehiclePhotoDraft());
  };
  const beginEditVehicle = (vehicle) => {
    setEditingVehicleId(vehicle.id);
    setVehicleDraft(vehicleToDraft(vehicle));
    setVehiclePhotoDraft(getEmptyVehiclePhotoDraft());
  };
  const saveSuperAdminVehicle = async () => {
    const payload = sanitizeVehicleDraft(vehicleDraft);
    if (!payload.brand || !payload.model || !payload.plateNumber || !payload.color || !payload.connectorType || !payload.locationLabel || !payload.zone || !Number.isFinite(payload.latitude) || !Number.isFinite(payload.longitude)) {
      showAdminNotice("Fill brand, model, plate, color, connector, location, zone, and map point.", "superadmin", "error");
      return;
    }
    if (!Number.isFinite(payload.pricePerMinute) || payload.pricePerMinute <= 0) {
      showAdminNotice("Price per minute must be greater than 0. Use AZN, for example 0.20.", "superadmin", "error");
      return;
    }
    if (!Number.isInteger(payload.year) || payload.year < 2010 || payload.year > new Date().getFullYear() + 1) {
      showAdminNotice("Year must be a valid vehicle model year.", "superadmin", "error");
      return;
    }
    if (!Number.isInteger(payload.seats) || payload.seats < 1 || payload.seats > 9) {
      showAdminNotice("Seats must be between 1 and 9.", "superadmin", "error");
      return;
    }
    if (!Number.isInteger(payload.batteryPercent) || payload.batteryPercent < 0 || payload.batteryPercent > 100) {
      showAdminNotice("Battery percent must be between 0 and 100.", "superadmin", "error");
      return;
    }

    try {
      setVehicleManagementBusyId(editingVehicleId || "__create");
      let savedVehicle;
      if (editingVehicleId) {
        savedVehicle = await vehicleApi.updateVehicle(editingVehicleId, payload);
        showAdminNotice("Vehicle updated.", "superadmin");
      } else {
        savedVehicle = await vehicleApi.createVehicle(payload);
        showAdminNotice("Vehicle created.", "superadmin");
      }
      if (hasVehiclePhotos && savedVehicle?.id) {
        try {
          await vehicleApi.uploadVehiclePhotos(savedVehicle.id, vehiclePhotoDraft);
          showAdminNotice("Vehicle saved and photos uploaded.", "superadmin");
        } catch (photoError) {
          showAdminNotice(getApiErrorMessage(photoError, "Vehicle saved, but photos could not be uploaded."), "superadmin", "error");
        }
      }
      beginCreateVehicle();
      await Promise.all([
        loadBackendVehicles(),
        loadAdminStatistics(),
        loadSuperAdminFinance(superAdminFinancePeriod),
      ]);
    } catch (error) {
      showAdminNotice(getApiErrorMessage(error, "Vehicle could not be saved."), "superadmin", "error");
    } finally {
      setVehicleManagementBusyId("");
    }
  };
  const deactivateSuperAdminVehicle = async (vehicle) => {
    const confirmed = await confirm({
      title: `Deactivate ${vehicle.brand} ${vehicle.model}?`,
      message: "The vehicle will move to Maintenance and disappear from available rider flows.",
      confirmLabel: "Deactivate",
      tone: "danger",
    });
    if (!confirmed) return;

    try {
      setVehicleManagementBusyId(vehicle.id);
      await vehicleApi.updateVehicleStatus(vehicle.id, MAINTENANCE_VEHICLE_STATUS);
      await Promise.all([
        loadBackendVehicles(),
        loadAdminStatistics(),
        loadSuperAdminFinance(superAdminFinancePeriod),
      ]);
      showAdminNotice("Vehicle deactivated.", "superadmin");
    } catch (error) {
      showAdminNotice(getApiErrorMessage(error, "Vehicle could not be deactivated."), "superadmin", "error");
    } finally {
      setVehicleManagementBusyId("");
    }
  };
  const applySuperAdminFinancePeriod = async () => {
    await loadSuperAdminFinance(superAdminFinancePeriod);
  };
  const updateSuperAdminUserRole = async (user, role) => {
    if (user.id === adminSession?.id) {
      showAdminNotice("You cannot change your own role.", "superadmin", "error");
      return;
    }

    try {
      await adminUsersApi.updateRole(user.id, Number(role));
      await loadBackendUsers();
      showAdminNotice("User role updated.", "superadmin");
    } catch (error) {
      showAdminNotice(getApiErrorMessage(error, "User role could not be updated."), "superadmin", "error");
    }
  };
  const updateSuperAdminUserStatus = async (user, isActive) => {
    if (user.id === adminSession?.id) {
      showAdminNotice("You cannot deactivate your own account.", "superadmin", "error");
      return;
    }

    const confirmed = isActive || await confirm({
      title: `Deactivate ${user.email}?`,
      message: "The account will be disabled without deleting trips, payments, receipts, or audit history.",
      confirmLabel: "Deactivate",
      tone: "danger",
    });
    if (!confirmed) return;

    try {
      await adminUsersApi.updateStatus(user.id, isActive);
      await loadBackendUsers();
      showAdminNotice(isActive ? "User activated." : "User deactivated.", "superadmin");
    } catch (error) {
      showAdminNotice(getApiErrorMessage(error, "User status could not be updated."), "superadmin", "error");
    }
  };
  const openVehicleNotification = (notice) => {
    if (notice.vehicleId) {
      focusVehicle(notice.vehicleId);
    }

    setNotificationsOpen(false);
    showAdminNotice(notice.title || "Notification opened", "control");
  };

  const saveParkingZoneDraft = async () => {
    if (!isSuperAdmin) {
      showAdminNotice("SuperAdmin access is required to manage parking zones.", activeSection, "error");
      return;
    }

    if (draftZonePoints.length < 3) {
      showAdminNotice("Add at least 3 points on the map to save a parking zone.", activeSection, "error");
      return;
    }

    const zoneMeta = getParkingZoneMeta(draftZoneType);
    const nextZone = {
      name: `${zoneMeta.label} custom zone`,
      type: zoneMeta.id,
      positions: draftZonePoints,
    };

    try {
      const savedZone = await parkingZoneApi.createZone(nextZone);
      setManagedZones((items) => [...items, savedZone].filter(Boolean));
      setDraftZonePoints([]);
      setIsDrawingZone(false);
      setParkingZonesError("");
      showAdminNotice(`Parking zone saved: ${savedZone.name}`, activeSection);
    } catch (error) {
      showAdminNotice(getApiErrorMessage(error, "Parking zone could not be saved."), activeSection, "error");
    }
  };

  const deleteParkingZone = async (zoneId) => {
    if (!isSuperAdmin) {
      showAdminNotice("SuperAdmin access is required to manage parking zones.", "control", "error");
      return;
    }

    try {
      await parkingZoneApi.deactivateZone(zoneId);
      setManagedZones((items) => items.filter((zone) => zone.id !== zoneId));
      setParkingZonesError("");
      showAdminNotice("Parking zone removed.", "control");
    } catch (error) {
      showAdminNotice(getApiErrorMessage(error, "Parking zone could not be removed."), "control", "error");
    }
  };

  const updateKycStatus = async (userId, status) => {
    try {
      if (status === "verified") {
        const updatedUser = await adminUsersApi.updateVerification(userId, USER_VERIFICATION_STATUSES.Verified);
        setBackendUsers((items) => upsertAdminUser(items, updatedUser));
        showAdminNotice("Rider verification approved", "users");
      } else if (status === "rejected") {
        setBlockDraft((draft) => ({ ...draft, userId, reason: draft.reason || "KYC rejected by administrator" }));
        const updatedUser = await adminUsersApi.updateVerification(userId, USER_VERIFICATION_STATUSES.Rejected);
        setBackendUsers((items) => upsertAdminUser(items, updatedUser));
        showAdminNotice("Rider verification rejected. The rider can upload new documents.", "users");
      } else if (status === "pending") {
        const updatedUser = await adminUsersApi.updateVerification(userId, USER_VERIFICATION_STATUSES.Pending);
        setBackendUsers((items) => upsertAdminUser(items, updatedUser));
        showAdminNotice("Rider verification was returned to moderation.", "users");
      } else {
        showAdminNotice("Unsupported verification status.", "users", "error");
      }
      await loadBackendUsers();
    } catch (error) {
      showAdminNotice(getApiErrorMessage(error, "User verification could not be updated."), "users", "error");
    }
  };

  const createBackendUser = async () => {
    try {
      const payload = {
        firstName: createUserDraft.firstName.trim(),
        lastName: createUserDraft.lastName.trim(),
        email: createUserDraft.email.trim(),
        phone: createUserDraft.phone.trim(),
        password: createUserDraft.password,
        driverLicenseNumber: createUserDraft.driverLicenseNumber.trim(),
      };

      if (Number(createUserDraft.role) === USER_ROLES.Staff) {
        await adminUsersApi.createStaff(payload);
      } else {
        await adminUsersApi.createAdmin({ ...payload, role: Number(createUserDraft.role) });
      }

      setCreateUserDraft({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        password: "",
        driverLicenseNumber: "",
        role: USER_ROLES.Staff,
      });
      await loadBackendUsers();
      showAdminNotice("Account created successfully", "users");
    } catch (error) {
      showAdminNotice(getApiErrorMessage(error, "Account could not be created."), "users", "error");
    }
  };

  const blockBackendUser = async (userId = blockDraft.userId) => {
    if (!userId) return;
    if (!blockDraft.reason.trim()) {
      showAdminNotice("Block reason is required.", "users", "error");
      return;
    }

    try {
      const updatedUser = await adminUsersApi.blockUser(userId, {
        reason: blockDraft.reason.trim(),
        duration: Number(blockDraft.duration),
      });
      setBackendUsers((items) => upsertAdminUser(items, updatedUser));
      setBlockDraft({ userId: "", reason: "", duration: USER_BLOCK_DURATIONS.FifteenMinutes });
      await loadBackendUsers();
      showAdminNotice("User blocked successfully", "users");
    } catch (error) {
      showAdminNotice(getApiErrorMessage(error, "User could not be blocked."), "users", "error");
    }
  };

  const unblockBackendUser = async (userId) => {
    try {
      const updatedUser = await adminUsersApi.unblockUser(userId);
      setBackendUsers((items) => upsertAdminUser(items, updatedUser));
      await loadBackendUsers();
      setSelectedKycUserId((current) => (current === userId ? null : current));
      showAdminNotice("User unblocked successfully", "users");
    } catch (error) {
      showAdminNotice(getApiErrorMessage(error, "User could not be unblocked."), "users", "error");
    }
  };

  const preparePenalty = () => {
    const reason = penaltyReasons.find((item) => item.id === penaltyReasonId) || penaltyReasons[0];
    const rider = backendUsers.find((user) => user.id === penaltyTargetId);

    if (!rider) {
      showAdminNotice("Сначала найдите пользователя по имени и фамилии");
      return;
    }

    setPenalties((items) => [
      {
        id: `penalty-${items.length + 1}`,
        user: rider.fullName,
        userEmail: rider.email,
        reason: reason.label,
        amount: reason.amount,
        status: "Списано с карты",
        createdAtIso: new Date().toISOString(),
        createdAt: formatBakuDateTime(new Date().toISOString()),
      },
      ...items,
    ]);
    showAdminNotice(`Списано ${reason.amount} AZN: ${rider.fullName}`);
  };

  async function loadBillingInvoices() {
    setIsLoadingBillingInvoices(true);
    setBillingInvoiceError("");

    try {
      const invoices = await invoiceApi.getAdminInvoices();
      setBillingInvoices(Array.isArray(invoices) ? invoices : []);
    } catch (error) {
      setBillingInvoices([]);
      setBillingInvoiceError(error.status === 404 ? "" : error.message || "Receipts could not be loaded.");
    } finally {
      setIsLoadingBillingInvoices(false);
    }
  }

  async function loadSupportTickets(options = {}) {
    const silent = options.silent === true;
    if (!silent) setIsLoadingTickets(true);
    setTicketsError("");

    try {
      const nextTickets = await adminSupportApi.getTickets();
      const normalizedTickets = Array.isArray(nextTickets) ? nextTickets : [];
      setTickets(normalizedTickets);
      setActiveTicketId((currentId) =>
        normalizedTickets.some((ticket) => ticket.id === currentId)
          ? currentId
          : normalizedTickets[0]?.id || null
      );
    } catch (error) {
      setTicketsError(error.message || "Support tickets could not be loaded.");
    } finally {
      if (!silent) setIsLoadingTickets(false);
    }
  }

  const downloadAdminReceipt = async (invoice) => {
    if (!invoice?.id) return;

    try {
      await invoiceApi.downloadAdminReceipt(invoice.id, invoice.invoiceNumber || "receipt");
    } catch (error) {
      setBillingInvoiceError(error.message || "Receipt could not be downloaded.");
    }
  };

  const createStaffTask = async () => {
    if (!staffTaskDraft.title.trim()) {
      showAdminNotice("Task title is required.", "tasks", "error");
      return;
    }

    if (!staffTaskDraft.description.trim()) {
      showAdminNotice("Task description is required.", "tasks", "error");
      return;
    }

    if (!staffTaskDraft.assigneeId) {
      showAdminNotice("Select an active staff assignee first.", "tasks", "error");
      return;
    }

    if (!staffTaskDraft.vehicleId) {
      showAdminNotice("Select the vehicle for this task.", "tasks", "error");
      return;
    }

    if (!staffTaskDraft.priority) {
      showAdminNotice("Select task priority.", "tasks", "error");
      return;
    }

    if (!staffTaskDraft.dueAt) {
      showAdminNotice("Task deadline is required.", "tasks", "error");
      return;
    }

    const dueAtTimeMs = parseBakuDateTimeLocalMs(staffTaskDraft.dueAt);
    const dueAtValue = toBakuDeadlineApiValue(staffTaskDraft.dueAt);

    if (!dueAtValue || !Number.isFinite(dueAtTimeMs)) {
      showAdminNotice("Task deadline is invalid.", "tasks", "error");
      return;
    }

    if (dueAtTimeMs < Date.now() - 60000) {
      showAdminNotice("Deadline cannot be in the past.", "tasks", "error");
      return;
    }

    const staff = staffMembers.find((item) => item.id === staffTaskDraft.assigneeId);

    try {
      const createdTask = await adminStaffTasksApi.createTask({
        title: staffTaskDraft.title.trim(),
        description: staffTaskDraft.description.trim(),
        assigneeId: staffTaskDraft.assigneeId,
        priority: Number(staffTaskDraft.priority),
        dueAt: dueAtValue,
        vehicleId: staffTaskDraft.vehicleId,
        type: STAFF_TASK_TYPES.General,
      });
      setStaffTasks((items) => upsertStaffTask(items, createdTask));
      setStaffTaskDraft({
        title: "",
        description: "",
        assigneeId: staffTaskDraft.assigneeId,
        vehicleId: "",
        priority: STAFF_TASK_PRIORITIES.Medium,
        dueAt: "",
      });
      showAdminNotice(`Task assigned: ${staff?.name || "staff"}`, "tasks");
    } catch (error) {
      showAdminNotice(error.message || "Staff task could not be created.", "tasks", "error");
    }
  };

  const updateStaffTaskStatus = async (taskId, status) => {
    try {
      const updatedTask = await adminStaffTasksApi.updateTaskStatus(taskId, Number(status));
      setStaffTasks((items) => items.map((task) => (task.id === taskId ? updatedTask : task)));
      showAdminNotice(`Status updated: ${STAFF_TASK_STATUS_LABELS[status]}`, "tasks");
    } catch (error) {
      showAdminNotice(error.message || "Task status could not be updated.", "tasks", "error");
    }
  };

  const reassignStaffTask = async (taskId, assigneeId, noticeSection = "tasks") => {
    if (!taskId || !assigneeId) {
      showAdminNotice("Select an active staff member first.", noticeSection, "error");
      return;
    }

    const staffMember = staffMembers.find((item) => item.id === assigneeId);

    try {
      const updatedTask = await adminStaffTasksApi.reassignTask(taskId, assigneeId);
      setStaffTasks((items) => upsertStaffTask(items, updatedTask));
      setActiveChargingSessions((items) =>
        items.map((session) =>
          session.staffTaskId === taskId ? { ...session, assignedStaffId: assigneeId } : session
        )
      );
      await Promise.all([
        loadStaffTasks({ silent: true }),
        loadChargingSessions({ silent: true }),
      ]);
      showAdminNotice(`Task reassigned to ${staffMember?.name || "staff"}.`, noticeSection);
    } catch (error) {
      showAdminNotice(error.message || "Task could not be reassigned.", noticeSection, "error");
    }
  };

  const updateChargingDraft = (field, value) => {
    setChargingDraft((draft) => ({ ...draft, [field]: value }));
  };

  const updateChargingAssignmentDraft = (vehicleId, field, value) => {
    setChargingAssignmentDraft((draft) => ({
      ...draft,
      [vehicleId]: {
        ...(draft[vehicleId] || {}),
        [field]: value,
      },
    }));
  };

  const assignChargingRecommendation = async (vehicle) => {
    const draft = chargingAssignmentDraft[vehicle.id] || {};
    const stationId = draft.stationId || getCompatibleChargingStations(vehicle)[0]?.id || "";
    const assigneeId = draft.assigneeId || staffMembers[0]?.id || "";
    const station = managedChargingStations.find((item) => item.id === stationId);
    const staffMember = staffMembers.find((item) => item.id === assigneeId);

    if (![VEHICLE_STATUSES.AVAILABLE, VEHICLE_STATUSES.CHARGING].includes(vehicle.status)) {
      showAdminNotice("Only parked vehicles can be assigned to charging. In-use or reserved cars are blocked.", "chargers", "error");
      return;
    }

    if (!stationId) {
      showAdminNotice("Select an online compatible charging station with free ports.", "chargers", "error");
      return;
    }

    if (!assigneeId) {
      showAdminNotice("Select an active staff member for this charging task.", "chargers", "error");
      return;
    }

    try {
      setChargingAssignmentVehicleId(vehicle.id);
      const details = await chargingApi.startSession({
        vehicleId: vehicle.id,
        chargingStationId: stationId,
        assignedStaffId: assigneeId,
      });

      if (details?.session) {
        setActiveChargingSessions((items) => [details.session, ...items.filter((item) => item.id !== details.session.id)]);
      }
      if (details?.staffTask) {
        setStaffTasks((items) => upsertStaffTask(items, details.staffTask));
      }
      if (details?.station) {
        setManagedChargingStations((items) => items.map((item) => (item.id === details.station.id ? details.station : item)));
      }
      setChargingAssignmentDraft((drafts) => {
        const next = { ...drafts };
        delete next[vehicle.id];
        return next;
      });
      await Promise.all([
        loadBackendVehicles(),
        loadChargingStations({ silent: true }),
        loadChargingSessions({ silent: true }),
        loadStaffTasks(),
      ]);
      showAdminNotice(`Charging task assigned: ${vehicle.brand} ${vehicle.model} to ${staffMember?.name || "staff"} at ${station?.name || "station"}.`, "chargers");
    } catch (error) {
      showAdminNotice(error.message || "Charging task could not be assigned.", "chargers", "error");
    } finally {
      setChargingAssignmentVehicleId("");
    }
  };

  const completeChargingSession = async (session) => {
    const task = staffTasks.find((item) => item.id === session.staffTaskId);
    const progress = getChargingSessionProgress(session, task);
    if (progress.currentBatteryPercent < MIN_CHARGING_COMPLETION_PERCENT) {
      showAdminNotice(`Charging can be completed only from ${MIN_CHARGING_COMPLETION_PERCENT}%. Current charge is ${progress.currentBatteryPercent}%.`, "chargers", "error");
      return;
    }

    if (progress.currentBatteryPercent < 100) {
      const confirmed = await confirm({
        title: `Finish charging at ${progress.currentBatteryPercent}%?`,
        message: "The vehicle is not fully charged yet. You can finish now and keep the current battery level, or continue charging to 100%.",
        confirmLabel: `Finish at ${progress.currentBatteryPercent}%`,
        cancelLabel: "Keep charging",
        tone: "warning",
      });      if (!confirmed) return;
    }

    try {
      const details = await chargingApi.completeSession(session.id, {
        finalBatteryPercent: progress.currentBatteryPercent,
        notes: "Charging completed by administrator.",
      });
      if (details?.staffTask) {
        setStaffTasks((items) => upsertStaffTask(items, details.staffTask));
      }
      setActiveChargingSessions((items) => items.filter((item) => item.id !== session.id));
      await Promise.all([
        loadBackendVehicles({ silent: true }),
        loadChargingStations({ silent: true }),
        loadChargingSessions({ silent: true }),
        loadStaffTasks({ silent: true }),
      ]);
      showAdminNotice(`Charging session completed at ${progress.currentBatteryPercent}%. Vehicle is ready for activation.`, "chargers");
    } catch (error) {
      showAdminNotice(error.message || "Charging session could not be completed.", "chargers", "error");
    }
  };

  const completeAndActivateChargingSession = async (session) => {
    const task = staffTasks.find((item) => item.id === session.staffTaskId);
    const vehicle = backendVehicles.find((item) => item.id === session.vehicleId);
    const progress = getChargingSessionProgress(session, task);
    if (progress.currentBatteryPercent < MIN_CHARGING_COMPLETION_PERCENT) {
      showAdminNotice(`Charging can be completed only from ${MIN_CHARGING_COMPLETION_PERCENT}%. Current charge is ${progress.currentBatteryPercent}%.`, "chargers", "error");
      return;
    }

    if (progress.currentBatteryPercent < 100) {
      const confirmed = await confirm({
        title: `Activate at ${progress.currentBatteryPercent}%?`,
        message: "The vehicle is not fully charged yet. You can activate it now, or keep charging to 100%.",
        confirmLabel: `Activate at ${progress.currentBatteryPercent}%`,
        cancelLabel: "Keep charging",
        tone: "warning",
      });
      if (!confirmed) return;
    }

    try {
      const details = await chargingApi.completeSession(session.id, {
        finalBatteryPercent: progress.currentBatteryPercent,
        notes: "Charging completed and vehicle activated by administrator.",
      });
      await chargingApi.activateVehicle(session.vehicleId);
      if (details?.staffTask) {
        setStaffTasks((items) => upsertStaffTask(items, details.staffTask));
      }
      setActiveChargingSessions((items) => items.filter((item) => item.id !== session.id));
      await Promise.all([
        loadBackendVehicles({ silent: true }),
        loadChargingStations({ silent: true }),
        loadChargingSessions({ silent: true }),
        loadStaffTasks({ silent: true }),
      ]);
      showAdminNotice(`Vehicle activated: ${vehicle ? `${vehicle.brand} ${vehicle.model}` : "Vehicle"}.`, "chargers");
    } catch (error) {
      showAdminNotice(error.message || "Vehicle could not be activated.", "chargers", "error");
    }
  };

  const activateReadyVehicle = async (vehicle) => {
    try {
      await chargingApi.activateVehicle(vehicle.id);
      await Promise.all([
        loadBackendVehicles({ silent: true }),
        loadChargingSessions({ silent: true }),
        loadChargingStations({ silent: true }),
      ]);
      showAdminNotice(`Vehicle activated: ${vehicle.brand} ${vehicle.model}`, "chargers");
    } catch (error) {
      showAdminNotice(error.message || "Vehicle could not be activated.", "chargers", "error");
    }
  };

  const setChargingDraftPoint = ([lat, lng]) => {
    setChargingDraft((draft) => ({
      ...draft,
      lat: lat.toFixed(5),
      lng: lng.toFixed(5),
      address: draft.address || "Новая точка на карте",
    }));
    showAdminNotice("Координаты точки зарядки выбраны на карте", "chargers");
  };

  const saveChargingPoint = async () => {
    const lat = Number(chargingDraft.lat);
    const lng = Number(chargingDraft.lng);
    const ports = Number(chargingDraft.ports);

    if (!chargingDraft.address.trim() || Number.isNaN(lat) || Number.isNaN(lng)) {
      showAdminNotice("Enter address and coordinates for the charging station.", "chargers", "error");
      return;
    }

    try {
      const station = await chargingApi.createStation({
        name: chargingDraft.name.trim() || chargingDraft.address.trim(),
        status: chargingDraft.status,
        locationLabel: chargingDraft.address.trim(),
        zone: "Custom",
        latitude: lat,
        longitude: lng,
        powerKw: chargingDraft.chargerType === "Type2" ? 22 : chargingDraft.chargerType === "CHAdeMO" ? 50 : 120,
        totalPorts: ports,
        availablePorts: chargingDraft.status === CHARGING_STATION_STATUSES.ONLINE ? ports : 0,
        connectorTypes: [chargingDraft.chargerType],
      });

      setManagedChargingStations((items) => [station, ...items.filter((item) => item.id !== station.id)]);
      loadChargingStations({ silent: true });
      setFocusTarget({ id: station.id, lat, lng });
      setChargingDraft({ name: "", address: "", chargerType: "CCS2", ports: 2, status: CHARGING_STATION_STATUSES.ONLINE, lat: "", lng: "", pickOnMap: false });
      showAdminNotice(`Charging station added: ${station.name}`, "chargers");
    } catch (error) {
      showAdminNotice(error.message || "Charging station could not be saved.", "chargers", "error");
    }
  };

  const updateChargingStationStatus = async (stationId, status) => {
    try {
      const station = await chargingApi.updateStationStatus(stationId, status);
      setManagedChargingStations((items) => items.map((item) => (item.id === station.id ? station : item)));
      loadChargingStations({ silent: true });
      showAdminNotice(`Station status updated: ${station.name}`, "chargers");
    } catch (error) {
      showAdminNotice(error.message || "Station status could not be updated.", "chargers", "error");
    }
  };

  const deleteChargingPoint = async (station) => {
    const confirmed = await confirm({
      title: "Delete charging station?",
      message: `Station "${station.name}" will be removed from operations. Active sessions or assigned vehicles can block deletion; completed charging history for this station will be removed with it.`,
      confirmLabel: "Delete",
      cancelLabel: "Keep",
      tone: "danger",
    });
    if (!confirmed) return;

    try {
      await chargingApi.deleteStation(station.id);
      setManagedChargingStations((items) => items.filter((item) => item.id !== station.id));
      setActiveChargingSessions((items) => items.filter((item) => item.chargingStationId !== station.id));
      setSelectedChargingStationId((id) => (id === station.id ? "" : id));
      loadChargingStations({ silent: true });
      loadChargingSessions({ silent: true });
      setServiceTasks((items) => items.map((task) => (task.chargingStationId === station.id ? { ...task, chargingStationId: null } : task)));
      showAdminNotice(`Charging station deleted: ${station.name}`, "chargers");
    } catch (error) {
      const message = error.message?.includes("DbUpdateException") || error.message?.includes("DELETE statement conflicted")
        ? "Charging station could not be deleted because the database still has linked charging records. Refresh and try again after active sessions are completed."
        : error.message || "Charging station could not be deleted.";
      showAdminNotice(message, "chargers", "error");
    }
  };

  const updateServicePointDraft = (field, value) => {
    setServicePointDraft((draft) => ({ ...draft, [field]: value }));
  };

  const setServicePointDraftPoint = ([lat, lng]) => {
    setServicePointDraft((draft) => ({
      ...draft,
      lat: lat.toFixed(5),
      lng: lng.toFixed(5),
      address: draft.address || "Новая сервисная точка на карте",
    }));
    showAdminNotice("Координаты сервисной точки выбраны на карте", "service-points");
  };

  const saveServicePoint = () => {
    const lat = Number(servicePointDraft.lat);
    const lng = Number(servicePointDraft.lng);

    if (!servicePointDraft.address.trim() || Number.isNaN(lat) || Number.isNaN(lng)) {
      showAdminNotice("Укажите адрес и координаты сервисной точки", "service-points");
      return;
    }

    const nextPoint = {
      id: `service-point-custom-${managedServicePoints.length + 1}`,
      name: servicePointDraft.name.trim() || servicePointDraft.address.trim(),
      location: {
        label: servicePointDraft.address.trim(),
        zone: "Service",
        lat,
        lng,
      },
    };

    setManagedServicePoints((items) => [nextPoint, ...items]);
    setFocusTarget({ id: nextPoint.id, lat, lng });
    setServicePointDraft({
      name: "",
      address: "",
      lat: "",
      lng: "",
      pickOnMap: false,
    });
    showAdminNotice(`Сервисная точка добавлена: ${nextPoint.name}`, "service-points");
  };

  const deleteServicePoint = async (point) => {
    const confirmed = await confirm({
      title: "Удалить сервисную точку?",
      message: `Сервисная точка "${point.name}" будет удалена из панели.`,
      confirmLabel: "Удалить",
      cancelLabel: "Оставить",
      tone: "danger",
    });
    if (!confirmed) return;

    setManagedServicePoints((items) => items.filter((item) => item.id !== point.id));
    showAdminNotice(`Сервисная точка удалена: ${point.name}`, "service-points");
  };

  const sendChatMessage = async () => {
    if (!chatDraft.trim() || !activeTicket) return;

    try {
      const ticket = await adminSupportApi.sendMessage(activeTicket.id, {
        body: chatDraft.trim(),
      });
      setTickets((items) => upsertSupportTicket(items, ticket));
      showAdminNotice("Support reply sent.", "helpdesk");
      setChatDraft("");
    } catch (error) {
      showAdminNotice(error.message || "Support reply could not be sent.", "helpdesk", "error");
    }
  };

  const closeActiveTicket = async () => {
    if (!activeTicket) return;

    try {
      const ticket = activeTicket.status === SUPPORT_TICKET_STATUSES.Closed
        ? await adminSupportApi.reopenTicket(activeTicket.id)
        : await adminSupportApi.closeTicket(activeTicket.id);
      setTickets((items) => upsertSupportTicket(items, ticket));
      showAdminNotice(activeTicket.status === SUPPORT_TICKET_STATUSES.Closed ? "Ticket reopened." : `Ticket closed: ${activeTicket.subject}`, "helpdesk");
    } catch (error) {
      showAdminNotice(error.message || "Ticket status could not be changed.", "helpdesk", "error");
    }
  };

  const assignTicketToStaff = async (staffId) => {
    if (!activeTicket || !staffId) return;

    try {
      const ticket = await adminSupportApi.assignStaff(activeTicket.id, staffId);
      setTickets((items) => upsertSupportTicket(items, ticket));
      setTicketAssigneeDrafts((items) => {
        const nextItems = { ...items };
        delete nextItems[activeTicket.id];
        return nextItems;
      });
      showAdminNotice("Ticket assigned to staff.", "helpdesk");
    } catch (error) {
      showAdminNotice(error.message || "Ticket could not be assigned.", "helpdesk", "error");
    }
  };

  const updateTicketPriority = async (priority) => {
    if (!activeTicket) return;

    try {
      const ticket = await adminSupportApi.updatePriority(activeTicket.id, Number(priority));
      setTickets((items) => upsertSupportTicket(items, ticket));
      showAdminNotice("Ticket priority updated.", "helpdesk");
    } catch (error) {
      showAdminNotice(error.message || "Ticket priority could not be updated.", "helpdesk", "error");
    }
  };
  const renderPanelHeader = (eyebrow, title, action = null) => {
    const visibleAdminNotice = adminNotice.section === activeSection ? adminNotice.message : "";
    const noticeClassName = adminNotice.tone === "error"
      ? "border-red-400/30 bg-red-500/15 text-red-100"
      : "border-emerald-400/25 bg-emerald-500/10 text-emerald-200";

    return (
      <div className="border-b border-white/10 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-red-300">{eyebrow}</p>
            <h2 className="mt-2 text-xl font-black text-white">{title}</h2>
          </div>
          {action}
        </div>
        {visibleAdminNotice && (
          <button
            type="button"
            onClick={() => setAdminNotice({ section: null, message: "", tone: "success" })}
            className={`mt-4 w-full whitespace-pre-line rounded-xl border px-3 py-2 text-left text-xs font-bold ${noticeClassName}`}
          >
            {visibleAdminNotice}
          </button>
        )}
      </div>
    );
  };

  const renderControlPanel = () => (
    <>
      {renderPanelHeader(
        "Live Feed",
        "Стрим событий",
        <div
          className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-right"
          title="Utilization is the percentage of fleet cars currently in an active ride or reservation."
        >
          <p className="text-[10px] font-black uppercase text-slate-500">Utilization</p>
          <p className="text-lg font-black text-white">{fleetStats.utilization}%</p>
        </div>
      )}

      <div className="border-b border-white/10 p-5">
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-red-300">
                {adminStatistics ? "Live data connected" : "Statistics unavailable"}
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-400">
                {adminStatisticsLoadedAt
                  ? `Last updated ${formatUpdatedTime(adminStatisticsLoadedAt)}`
                  : "Sign in with an administrator account to load real dashboard metrics."}
              </p>
            </div>
            <button
              type="button"
              onClick={loadAdminStatistics}
              disabled={isLoadingAdminStatistics}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/[0.08] px-4 py-3 text-xs font-black text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              <FiActivity />
              {isLoadingAdminStatistics ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {adminStatisticsError && (
            <p className="mt-3 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-100">
              {adminStatisticsError}
            </p>
          )}

          {adminStatistics && (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-white/[0.05] p-3">
                <p className="text-[10px] font-black uppercase text-slate-500">Today revenue</p>
                <p className="mt-1 text-lg font-black text-emerald-200">
                  {Number(adminStatistics.revenue?.today || 0).toFixed(2)} {adminStatistics.revenue?.currency || "AZN"}
                </p>
              </div>
              <div className="rounded-xl bg-white/[0.05] p-3">
                <p className="text-[10px] font-black uppercase text-slate-500">Week revenue</p>
                <p className="mt-1 text-lg font-black text-white">
                  {Number(adminStatistics.revenue?.thisWeek || 0).toFixed(2)} {adminStatistics.revenue?.currency || "AZN"}
                </p>
              </div>
              <div className="rounded-xl bg-white/[0.05] p-3">
                <p className="text-[10px] font-black uppercase text-slate-500">Payments</p>
                <p className="mt-1 text-lg font-black text-white">
                  {adminStatistics.payments?.completed || 0}/{adminStatistics.payments?.pending || 0}/{adminStatistics.payments?.failed || 0}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 border-b border-white/10 p-5">
        {Object.entries(STATUS_META).map(([status, meta]) => (
          <button
            key={status}
            type="button"
            onClick={() => {
              setStatusFilter((current) => (current === status ? "all" : status));
              setActiveSection("control");
            }}
            className={`rounded-2xl border p-3 text-left ring-1 transition hover:bg-white/[0.07] ${
              statusFilter === status ? "bg-white/[0.09]" : "bg-white/[0.035]"
            } ${meta.border} ${meta.ring}`}
          >
            <span className="flex items-center gap-2 text-xs font-black uppercase text-slate-400">
              <span className={`h-2.5 w-2.5 rounded-full ${meta.bg}`} />
              {meta.short}
            </span>
            <span className="mt-2 block text-2xl font-black text-white">{fleetStats[status] || 0}</span>
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-black text-slate-300">Операции сейчас</p>
          <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-200">
            {adminStatistics ? "Live data" : "Demo feed"}
          </span>
        </div>

        <div className="grid gap-3">
          {events.map((event) => {
            const meta = STATUS_META[event.status] || STATUS_META.available;
            return (
              <button
                key={event.id}
                type="button"
                onClick={() => focusVehicle(event.vehicleId)}
                className={`group rounded-2xl border bg-white/[0.035] p-4 text-left transition hover:bg-white/[0.07] ${selectedVehicleId === event.vehicleId ? meta.border : "border-white/10"}`}
              >
                <div className="flex items-start gap-3">
                  <span className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${meta.bg} text-white shadow-lg`}>
                    {event.status === "service" ? <FiAlertTriangle /> : <FiClock />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black text-white group-hover:text-red-100">{event.title}</span>
                    <span className="mt-1 block text-xs font-semibold leading-5 text-slate-400">{event.detail}</span>
                    <span className="mt-3 flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-wide text-slate-500">
                      <span>{event.plate}</span>
                      <span>{event.time}</span>
                    </span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );

  const renderControlPanelV2 = () => {
    const activeZoneMeta = getParkingZoneMeta(draftZoneType);
    const canManageParkingZones = isSuperAdmin;

    return (
      <>
        {renderPanelHeader(
          "Control Room",
          "Fleet and parking zones",
          <button
            type="button"
            onClick={() => {
              loadAdminStatistics();
              loadBillingInvoices();
              loadBackendVehicles({ silent: true });
              loadParkingZones({ silent: true });
            }}
            disabled={isLoadingAdminStatistics || isLoadingBillingInvoices || isLoadingParkingZones}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/[0.08] px-4 py-3 text-xs font-black text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            <FiActivity />
            {isLoadingAdminStatistics || isLoadingBillingInvoices ? "Refreshing..." : "Refresh"}
          </button>
        )}

        <div className="border-b border-white/10 p-5">
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-red-300">Dashboard data</p>
                <p className="mt-1 text-xs font-semibold text-slate-400">
                  {adminStatisticsLoadedAt
                    ? `Updated ${formatUpdatedTime(adminStatisticsLoadedAt)} Baku time`
                    : "Waiting for the latest dashboard data."}
                </p>
              </div>
              <span className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-200">
                Connected
              </span>
            </div>

            {adminStatisticsError && (
              <p className="mt-3 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-100">
                {adminStatisticsError}
              </p>
            )}

            {billingInvoiceError && (
              <p className="mt-3 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-100">
                {billingInvoiceError}
              </p>
            )}

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-white/[0.05] p-3">
                <p className="text-[10px] font-black uppercase text-slate-500">Today revenue</p>
                <p className="mt-1 text-lg font-black text-emerald-200">
                  {Number(adminStatistics?.revenue?.today || 0).toFixed(2)} {adminStatistics?.revenue?.currency || receiptSummary.currency}
                </p>
              </div>
              <div className="rounded-xl bg-white/[0.05] p-3">
                <p className="text-[10px] font-black uppercase text-slate-500">Receipts</p>
                <p className="mt-1 text-lg font-black text-white">{receiptSummary.count}</p>
                <p className="mt-1 text-[11px] font-semibold text-slate-500">
                  {receiptSummary.totalAmount.toFixed(2)} {receiptSummary.currency} total
                </p>
              </div>
              <div className="rounded-xl bg-white/[0.05] p-3">
                <p className="text-[10px] font-black uppercase text-slate-500">Latest receipt</p>
                <p className="mt-1 text-sm font-black text-white">
                  {receiptSummary.latestAmount > 0
                    ? `${receiptSummary.latestAmount.toFixed(2)} ${receiptSummary.currency}`
                    : "No receipts"}
                </p>
                <p className="mt-1 truncate text-[11px] font-semibold text-slate-500">{receiptSummary.latestLabel}</p>
                {receiptSummary.latestCustomer && (
                  <p className="mt-1 truncate text-[11px] font-semibold text-slate-500">{receiptSummary.latestCustomer}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-b border-white/10 p-5">
          {Object.entries(STATUS_META).map(([status, meta]) => (
            <button
              key={status}
              type="button"
              onClick={() => {
                setStatusFilter((current) => (current === status ? "all" : status));
                setActiveSection("control");
              }}
              className={`rounded-2xl border p-3 text-left ring-1 transition hover:bg-white/[0.07] ${
                statusFilter === status ? "bg-white/[0.09]" : "bg-white/[0.035]"
              } ${meta.border} ${meta.ring}`}
            >
              <span className="flex items-center gap-2 text-xs font-black uppercase text-slate-400">
                <span className={`h-2.5 w-2.5 rounded-full ${meta.bg}`} />
                {meta.short}
              </span>
              <span className="mt-2 block text-2xl font-black text-white">{fleetStats[status] || 0}</span>
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black text-white">Parking zones</p>
                <p className="mt-1 text-xs font-semibold text-slate-400">
                  Green zones allow parking. Red zones block parking.
                </p>
              </div>
              <span className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-black text-slate-200">
                {zoneStats.allowed} green / {zoneStats.restricted} red
              </span>
            </div>

            {parkingZonesError && (
              <p className="mt-3 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-100">
                {parkingZonesError}
              </p>
            )}

            {canManageParkingZones && (
              <>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {PARKING_ZONE_TYPES.map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setDraftZoneType(type.id)}
                      className={`rounded-xl border px-3 py-2 text-xs font-black transition ${
                        draftZoneType === type.id
                          ? type.activeClassName
                          : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.07]"
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>

                <div className="mt-4 rounded-xl border border-white/10 bg-[#111a2b] p-3">
                  <p className="text-xs font-black text-white">{activeZoneMeta.title}</p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-slate-400">{activeZoneMeta.description}</p>
                  <p className="mt-2 text-[11px] font-bold text-slate-500">
                    Points: {draftZonePoints.length}. Minimum 3 points to save.
                  </p>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsDrawingZone((value) => !value)}
                    className={`rounded-xl px-3 py-2 text-xs font-black transition ${
                      isDrawingZone ? "bg-red-500 text-white" : "bg-white/[0.06] text-slate-200 hover:bg-white/[0.1]"
                    }`}
                  >
                    <FiEdit3 className="inline" /> {isDrawingZone ? "Stop drawing" : "Draw zone"}
                  </button>
                  <button
                    type="button"
                    onClick={saveParkingZoneDraft}
                    className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-black text-white transition hover:bg-emerald-600"
                  >
                    Save zone
                  </button>
                  <button
                    type="button"
                    onClick={() => setDraftZonePoints([])}
                    className="rounded-xl bg-white/[0.06] px-3 py-2 text-xs font-black text-slate-200 transition hover:bg-white/[0.1]"
                  >
                    Clear points
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="mt-4 grid gap-2">
            {managedZones.map((zone) => {
              const zoneMeta = getParkingZoneMeta(zone.type);
              return (
                <div key={zone.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-white">{zone.name}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{zone.positions.length} map points</p>
                    </div>
                    <span className={`shrink-0 rounded-lg border px-2 py-1 text-[10px] font-black ${zoneMeta.badgeClassName}`}>
                      {zoneMeta.title}
                    </span>
                  </div>
                  {canManageParkingZones && (
                    <button
                      type="button"
                      onClick={() => deleteParkingZone(zone.id)}
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-xs font-black text-red-100 transition hover:bg-red-500 hover:text-white"
                    >
                      <FiTrash2 />
                      Delete zone
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </>
    );
  };

  const renderUsersKycPanel = () => {
    const statusMeta = {
      pending: {
        label: "Pending",
        dot: "bg-amber-400",
        badge: "border-amber-400/35 bg-amber-500/12 text-amber-100",
        active: "border-amber-400/60 bg-amber-500/15 text-amber-100",
      },
      rejected: {
        label: "Rejected",
        dot: "bg-orange-400",
        badge: "border-orange-400/35 bg-orange-500/12 text-orange-100",
        active: "border-orange-400/60 bg-orange-500/15 text-orange-100",
      },
      verified: {
        label: "Verified",
        dot: "bg-emerald-400",
        badge: "border-emerald-400/35 bg-emerald-500/12 text-emerald-100",
        active: "border-emerald-400/60 bg-emerald-500/15 text-emerald-100",
      },
      blocked: {
        label: "Blocked",
        dot: "bg-red-400",
        badge: "border-red-400/35 bg-red-500/12 text-red-100",
        active: "border-red-400/60 bg-red-500/15 text-red-100",
      },
    };
    const statusCounts = kycRows.reduce(
      (acc, row) => {
        acc[row.kyc.status] = (acc[row.kyc.status] || 0) + 1;
        return acc;
      },
      { all: kycRows.length, pending: 0, rejected: 0, verified: 0, blocked: 0 }
    );
    const tabItems = [
      { id: "all", label: "All", count: statusCounts.all },
      ...Object.entries(statusMeta).map(([id, meta]) => ({
        id,
        label: meta.label,
        count: statusCounts[id] || 0,
      })),
    ];
    const getStatusMeta = (status) => statusMeta[status] || {
      label: status,
      dot: "bg-slate-400",
      badge: "border-white/10 bg-white/[0.06] text-slate-300",
      active: "border-white/20 bg-white/[0.08] text-white",
    };
    const userStatusMeta = {
      verified: { label: "Verified", className: "bg-emerald-500/15 text-emerald-200" },
      pending: { label: "Pending", className: "bg-amber-500/15 text-amber-200" },
      rejected: { label: "Rejected", className: "bg-orange-500/15 text-orange-200" },
      blocked: { label: "Blocked", className: "bg-red-500/15 text-red-200" },
      internal: { label: "Internal", className: "bg-blue-500/15 text-blue-200" },
      active_trip: { label: "In trip", className: "bg-cyan-500/15 text-cyan-200" },
      reserved: { label: "Reserved", className: "bg-violet-500/15 text-violet-200" },
    };
    const userTableColumns = [
      ["username", "Username"],
      ["email", "Email"],
      ["phone", "Phone"],
      ["balanceAmount", "Balance"],
      ["registeredAt", "Registered"],
      ["role", "Role"],
      ["accountStatus", "Status"],
    ];
    const toggleUserTableSort = (key) => {
      setUserTableSort((current) => ({
        key,
        direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
      }));
    };

    return (
      <>
        {renderPanelHeader(
          "Users & KYC",
          "Users and identity documents",
          <span className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black text-slate-300">
            {filteredKycRows.length}/{kycRows.length}
          </span>
        )}

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
          <div className="grid gap-2 rounded-2xl border border-white/10 bg-white/[0.035] p-2 md:grid-cols-5">
            {tabItems.map((item) => {
              const meta = getStatusMeta(item.id);
              const isActive = kycFilter === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setKycFilter(item.id);
                    setSelectedKycUserId(null);
                  }}
                  className={`inline-flex min-h-12 items-center justify-between gap-3 rounded-xl px-4 py-3 text-left text-xs font-black transition ${
                    isActive
                      ? "bg-red-500 text-white shadow-lg shadow-red-950/20"
                      : "bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-white"
                  }`}
                >
                  <span className="inline-flex min-w-0 items-center gap-2">
                    {item.id !== "all" && <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${meta.dot}`} />}
                    <span className="truncate">{item.label}</span>
                  </span>
                  <span className={`shrink-0 rounded-lg px-2 py-1 text-xs font-black ${isActive ? "bg-white/20 text-white" : "bg-white/[0.08] text-slate-200"}`}>
                    {item.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-black text-white">Create account</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">Admin can create Staff. SuperAdmin can create Admin and SuperAdmin.</p>
              </div>
              <button type="button" onClick={loadBackendUsers} className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-black text-slate-200">
                Refresh users
              </button>
            </div>
            <div className="grid gap-2 md:grid-cols-4">
              {[
                ["firstName", "First name"],
                ["lastName", "Last name"],
                ["email", "Email"],
                ["phone", "+994501234567"],
                ["password", "Password"],
                ["driverLicenseNumber", "License number"],
              ].map(([key, placeholder]) => (
                <input
                  key={key}
                  type={key === "password" ? "password" : key === "email" ? "email" : "text"}
                  value={createUserDraft[key]}
                  onChange={(event) => setCreateUserDraft((draft) => ({ ...draft, [key]: event.target.value }))}
                  placeholder={placeholder}
                  className="rounded-xl border border-white/10 bg-[#111a2b] px-3 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-500"
                />
              ))}
              <select
                value={createUserDraft.role}
                onChange={(event) => setCreateUserDraft((draft) => ({ ...draft, role: Number(event.target.value) }))}
                className="rounded-xl border border-white/10 bg-[#111a2b] px-3 py-3 text-sm font-bold text-white outline-none"
              >
                <option value={USER_ROLES.Staff}>Staff</option>
                {isSuperAdmin && <option value={USER_ROLES.Admin}>Admin</option>}
                {isSuperAdmin && <option value={USER_ROLES.SuperAdmin}>SuperAdmin</option>}
              </select>
              <button type="button" onClick={createBackendUser} className="rounded-xl bg-red-500 px-3 py-3 text-xs font-black uppercase tracking-wide text-white transition hover:bg-red-600">
                Create account
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <p className="text-sm font-black text-white">Block selected user</p>
            <div className="mt-3 grid gap-2 md:grid-cols-[1fr_2fr_180px_140px]">
              <select
                value={blockDraft.userId}
                onChange={(event) => setBlockDraft((draft) => ({ ...draft, userId: event.target.value }))}
                className="rounded-xl border border-white/10 bg-[#111a2b] px-3 py-3 text-sm font-bold text-white outline-none"
              >
                <option value="">Select user</option>
                {blockableUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {`${user.firstName} ${user.lastName}`.trim() || user.email} - {normalizeRole(user.role)}
                  </option>
                ))}
              </select>
              <input
                value={blockDraft.reason}
                onChange={(event) => setBlockDraft((draft) => ({ ...draft, reason: event.target.value }))}
                placeholder="Block reason"
                className="rounded-xl border border-white/10 bg-[#111a2b] px-3 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-500"
              />
              <select
                value={blockDraft.duration}
                onChange={(event) => setBlockDraft((draft) => ({ ...draft, duration: Number(event.target.value) }))}
                className="rounded-xl border border-white/10 bg-[#111a2b] px-3 py-3 text-sm font-bold text-white outline-none"
              >
                <option value={USER_BLOCK_DURATIONS.FifteenMinutes}>15 minutes</option>
                <option value={USER_BLOCK_DURATIONS.OneDay}>1 day</option>
                <option value={USER_BLOCK_DURATIONS.Forever}>Forever</option>
              </select>
              <button type="button" onClick={() => blockBackendUser()} className="rounded-xl bg-red-500 px-3 py-3 text-xs font-black uppercase tracking-wide text-white transition hover:bg-red-600">
                Block
              </button>
            </div>
          </div>

          {(backendUsersError || isLoadingBackendUsers) && (
            <p className={`rounded-xl border px-4 py-3 text-sm font-bold ${backendUsersError ? "border-red-400/30 bg-red-500/10 text-red-100" : "border-blue-400/30 bg-blue-500/10 text-blue-100"}`}>
              {backendUsersError || "Loading users..."}
            </p>
          )}

          {kycFilter === "all" && (
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035]">
              <div className="flex flex-col gap-3 border-b border-white/10 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-black text-white">All registered users</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {visibleUserTableRows.length}/{userTableRows.length} users across all time
                  </p>
                </div>
                <label className="flex min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-[#111a2b] px-3 py-2 text-sm text-slate-400 md:w-[320px]">
                  <FiSearch className="shrink-0 text-slate-500" />
                  <input
                    value={userTableSearchQuery}
                    onChange={(event) => setUserTableSearchQuery(event.target.value)}
                    placeholder="Search users"
                    className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none placeholder:text-slate-500"
                  />
                </label>
              </div>
              <div className="max-h-[420px] min-h-[220px] overflow-auto">
                <table className="w-full min-w-[860px] text-left text-sm">
                  <thead className="sticky top-0 z-10 bg-[#10192a] text-[10px] font-black uppercase tracking-wide text-slate-500">
                    <tr>
                      {userTableColumns.map(([key, label]) => (
                        <th key={key} className="px-4 py-3">
                          <button type="button" onClick={() => toggleUserTableSort(key)} className="flex items-center gap-1 hover:text-white">
                            {label}
                            {userTableSort.key === key && <span>{userTableSort.direction === "asc" ? "^" : "v"}</span>}
                          </button>
                        </th>
                      ))}
                      <th className="px-4 py-3">Block</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {visibleUserTableRows.map((row) => {
                      const status = userStatusMeta[row.accountStatus] || userStatusMeta.pending;

                      return (
                        <tr key={row.id} className="hover:bg-white/[0.04]">
                          <td className="px-4 py-3 font-black text-white">{row.username}</td>
                          <td className="px-4 py-3 font-semibold text-slate-300">{row.email}</td>
                          <td className="px-4 py-3 font-semibold text-slate-300">{row.phone}</td>
                          <td className="px-4 py-3 font-black text-white">
                            {row.balanceAmount.toFixed(2)} {row.balanceCurrency}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-300">{row.registeredAt}</td>
                          <td className="px-4 py-3 font-black text-slate-200">{row.role}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-lg px-2 py-1 text-[10px] font-black uppercase ${status.className}`}>
                              {status.label}
                            </span>
                            {row.raw?.blockReason && (
                              <p className="mt-1 max-w-[220px] text-[10px] font-bold leading-4 text-red-200">
                                {row.raw.blockReason}
                                {row.raw.blockedUntil ? ` - until ${formatBakuDateTime(row.raw.blockedUntil)}` : " - forever"}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {canManageUserAccount(row.raw) ? row.raw?.isActive ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setBlockDraft((draft) => ({ ...draft, userId: row.id }));
                                  showAdminNotice("User selected. Add a block reason and press Block.", "users");
                                }}
                                className="rounded-lg bg-red-500/15 px-3 py-2 text-[10px] font-black uppercase text-red-100"
                              >
                                Select
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => unblockBackendUser(row.id)}
                                className="rounded-lg bg-emerald-500/15 px-3 py-2 text-[10px] font-black uppercase text-emerald-100"
                              >
                                Unblock
                              </button>
                            ) : (
                              <span className="rounded-lg bg-white/[0.06] px-3 py-2 text-[10px] font-black uppercase text-slate-500">
                                Protected
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className={`grid gap-4 ${selectedKycUser ? "xl:grid-cols-[360px_minmax(0,1fr)]" : ""}`}>
            <div className={`grid max-h-[520px] content-start gap-3 overflow-y-auto ${selectedKycUser ? "" : "md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"}`}>
              {filteredKycRows.map((row) => (
                (() => {
                  const meta = getStatusMeta(row.kyc.status);

                  return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setSelectedKycUserId(row.id)}
                  className={`rounded-2xl border p-4 text-left transition hover:bg-white/[0.06] ${
                    selectedKycUser?.id === row.id ? "border-red-400/60 bg-red-500/10" : "border-white/10 bg-white/[0.035]"
                  }`}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black text-white">{row.fullName}</span>
                      <span className="mt-1 block truncate text-xs font-bold text-slate-500">{row.email}</span>
                    </span>
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${meta.badge}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                      {meta.label}
                    </span>
                  </span>
                </button>
                  );
                })()
              ))}
            </div>

            {selectedKycUser && (
              <div className="max-h-[520px] overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-black text-white">{selectedKycUser.fullName}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">{selectedKycUser.phone} - {selectedKycUser.email}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase ${getStatusMeta(selectedKycUser.kyc.status).badge}`}>
                    {getStatusMeta(selectedKycUser.kyc.status).label} - {selectedKycUser.kyc.risk} risk
                  </span>
                </div>

                <div className="mt-4 grid gap-3">
                  <div className="rounded-2xl border border-white/10 bg-[#111a2b] p-4">
                    <p className="mb-3 flex items-center gap-2 text-sm font-black text-white">
                      <FiUserCheck /> Verification details
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl bg-white/[0.05] p-3">
                        <p className="text-[10px] font-black uppercase text-slate-500">Account details</p>
                        <p className="mt-2 text-sm font-bold text-white">{selectedKycUser.kyc.account || selectedKycUser.email}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-400">{selectedKycUser.kyc.submittedAt}</p>
                      </div>
                      <div className="rounded-xl bg-white/[0.05] p-3">
                        <p className="text-[10px] font-black uppercase text-slate-500">Passport and license</p>
                        <p className="mt-2 text-sm font-bold text-white">{selectedKycUser.kyc.documents || selectedKycUser.driverLicenseNumber || "No driver license number"}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-400">{selectedKycUser.kyc.identity || selectedKycUser.phone || "No phone number"}</p>
                      </div>
                    </div>
                    <p className="mt-3 rounded-xl bg-white/[0.04] px-3 py-2 text-xs font-semibold leading-5 text-slate-400">
                      {selectedKycUser.kyc.notes}
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <a
                        href={selectedKycUser.driverLicenseDocumentUrl || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className={`rounded-xl border px-3 py-3 text-center text-xs font-black transition ${
                          selectedKycUser.driverLicenseDocumentUrl
                            ? "border-white/10 bg-white/[0.06] text-slate-100 hover:bg-white/[0.1]"
                            : "pointer-events-none border-white/5 bg-white/[0.02] text-slate-600"
                        }`}
                      >
                        Open driver license
                      </a>
                      <a
                        href={selectedKycUser.passportDocumentUrl || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className={`rounded-xl border px-3 py-3 text-center text-xs font-black transition ${
                          selectedKycUser.passportDocumentUrl
                            ? "border-white/10 bg-white/[0.06] text-slate-100 hover:bg-white/[0.1]"
                            : "pointer-events-none border-white/5 bg-white/[0.02] text-slate-600"
                        }`}
                      >
                        Open passport
                      </a>
                    </div>
                  </div>

                  {selectedKycUser.isActive ? (
                    <div className="grid gap-2 sm:grid-cols-3">
                      <button
                        type="button"
                        onClick={() => updateKycStatus(selectedKycUser.id, "verified")}
                        disabled={selectedKycUser.verificationStatus === USER_VERIFICATION_STATUSES.Verified}
                        className="rounded-xl bg-emerald-500 px-3 py-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => updateKycStatus(selectedKycUser.id, "rejected")}
                        className="rounded-xl bg-amber-500 px-3 py-3 text-xs font-black text-amber-950 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        Reject KYC
                      </button>
                      <button
                        type="button"
                        onClick={() => updateKycStatus(selectedKycUser.id, "pending")}
                        disabled={selectedKycUser.verificationStatus === USER_VERIFICATION_STATUSES.Pending}
                        className="rounded-xl bg-slate-700 px-3 py-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        Reset
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => unblockBackendUser(selectedKycUser.id)}
                      className="rounded-xl bg-emerald-500 px-3 py-3 text-xs font-black text-white"
                    >
                      Unblock account
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </>
    );
  };

  const renderSuperAdminPanel = () => {
    const finance = superAdminFinance;
    const currency = finance?.currency || adminStatistics?.revenue?.currency || "AZN";
    const money = (value) => `${Number(value || 0).toFixed(2)} ${currency}`;
    const selectedVehicle = backendVehicles.find((vehicle) => vehicle.id === editingVehicleId);
    const internalUsers = backendUsers
      .filter((user) => [USER_ROLES.Staff, USER_ROLES.Admin, USER_ROLES.SuperAdmin].includes(user.role))
      .sort((first, second) => {
        const roleOrder = second.role - first.role;
        if (roleOrder !== 0) return roleOrder;
        return String(first.email || "").localeCompare(String(second.email || ""));
      });
    const roleSearch = superAdminRoleSearchQuery.trim().toLowerCase();
    const roleCounts = internalUsers.reduce(
      (acc, user) => {
        if (user.role === USER_ROLES.Staff) acc.staff += 1;
        if (user.role === USER_ROLES.Admin) acc.admin += 1;
        if (user.role === USER_ROLES.SuperAdmin) acc.superAdmin += 1;
        if (!user.isActive || isCurrentlyBlockedUser(user)) acc.inactive += 1;
        return acc;
      },
      { all: internalUsers.length, staff: 0, admin: 0, superAdmin: 0, inactive: 0 }
    );
    const roleFilterItems = [
      { id: "all", label: "All", count: roleCounts.all, dot: "bg-slate-300" },
      { id: "superAdmin", label: "SuperAdmin", count: roleCounts.superAdmin, dot: "bg-red-400" },
      { id: "admin", label: "Admin", count: roleCounts.admin, dot: "bg-sky-400" },
      { id: "staff", label: "Staff", count: roleCounts.staff, dot: "bg-emerald-400" },
      { id: "inactive", label: "Inactive", count: roleCounts.inactive, dot: "bg-amber-400" },
    ];
    const visibleInternalUsers = internalUsers.filter((user) => {
      const matchesFilter =
        superAdminRoleFilter === "all" ||
        (superAdminRoleFilter === "superAdmin" && user.role === USER_ROLES.SuperAdmin) ||
        (superAdminRoleFilter === "admin" && user.role === USER_ROLES.Admin) ||
        (superAdminRoleFilter === "staff" && user.role === USER_ROLES.Staff) ||
        (superAdminRoleFilter === "inactive" && (!user.isActive || isCurrentlyBlockedUser(user)));

      if (!matchesFilter) return false;
      if (!roleSearch) return true;

      return [
        user.firstName,
        user.lastName,
        user.email,
        user.phone,
        roleLabel(user.role),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(roleSearch);
    });
    const statusLabel = (status) => {
      if (status === VEHICLE_STATUSES.AVAILABLE) return "Available";
      if (status === VEHICLE_STATUSES.RESERVED) return "Reserved";
      if (status === VEHICLE_STATUSES.IN_USE) return "In use";
      if (status === VEHICLE_STATUSES.CHARGING) return "Charging";
      if (status === MAINTENANCE_VEHICLE_STATUS) return "Maintenance";
      return status || "Unknown";
    };
    function roleLabel(role) {
      if (role === USER_ROLES.SuperAdmin) return "SuperAdmin";
      if (role === USER_ROLES.Admin) return "Admin";
      if (role === USER_ROLES.Staff) return "Staff";
      return "Rider";
    }

    return (
      <>
        {renderPanelHeader(
          "SuperAdmin",
          "Fleet and finance controls",
          <button
            type="button"
            onClick={() => Promise.all([loadBackendVehicles(), loadSuperAdminFinance(superAdminFinancePeriod)])}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-xs font-black text-white transition hover:bg-red-500"
          >
            <FiActivity />
            Refresh
          </button>
        )}

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
          <div className="sticky top-0 z-20 grid gap-2 rounded-2xl border border-white/10 bg-[#0b1422]/95 p-2 shadow-xl shadow-black/20 backdrop-blur md:grid-cols-3">
            {[
              ["finance", "Finance", FiDollarSign],
              ["fleet", "Fleet", FaCarSide],
              ["roles", "Roles", FiUsers],
            ].map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                aria-pressed={superAdminTab === id}
                onClick={() => setSuperAdminTab(id)}
                className={`inline-flex min-h-14 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition ${
                  superAdminTab === id
                    ? "bg-red-500 text-white shadow-lg shadow-red-950/20"
                    : "bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-white"
                }`}
              >
                <Icon />
                {label}
              </button>
            ))}
          </div>

          {superAdminTab === "finance" && (
            <>
          <div className="grid gap-3 md:grid-cols-4">
            {[
              ["Today revenue", money(adminStatistics?.revenue?.today), FiDollarSign, "text-emerald-200"],
              ["Week revenue", money(adminStatistics?.revenue?.thisWeek), FiTrendingUp, "text-cyan-200"],
              ["Month revenue", money(adminStatistics?.revenue?.thisMonth), FiActivity, "text-blue-200"],
              ["Fleet utilization", `${finance?.utilizationPercent ?? fleetStats.utilization}%`, FiZap, "text-amber-200"],
            ].map(([label, value, Icon, tone]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <Icon className={`text-xl ${tone}`} />
                <p className="mt-3 text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-2 text-2xl font-black text-white">{value}</p>
              </div>
            ))}
          </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-sm font-black text-white">Custom finance period</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    Revenue, payments, trips, and top earning vehicles. End date is included.
                  </p>
                  {finance && (
                    <p className="mt-1 text-[11px] font-black uppercase tracking-wide text-emerald-200">
                      Showing {finance.from} to {finance.to}
                    </p>
                  )}
                </div>
                <div className="grid gap-2 sm:grid-cols-[150px_150px_120px]">
                  <input
                    type="date"
                    value={superAdminFinancePeriod.from}
                    onChange={(event) => setSuperAdminFinancePeriod((period) => ({ ...period, from: event.target.value }))}
                    className="rounded-xl border border-white/10 bg-[#111a2b] px-3 py-3 text-sm font-bold text-white outline-none"
                  />
                  <input
                    type="date"
                    value={superAdminFinancePeriod.to}
                    onChange={(event) => setSuperAdminFinancePeriod((period) => ({ ...period, to: event.target.value }))}
                    className="rounded-xl border border-white/10 bg-[#111a2b] px-3 py-3 text-sm font-bold text-white outline-none"
                  />
                  <button
                    type="button"
                    onClick={applySuperAdminFinancePeriod}
                    className="rounded-xl bg-red-500 px-3 py-3 text-xs font-black uppercase tracking-wide text-white transition hover:bg-red-600"
                  >
                    Apply
                  </button>
                </div>
              </div>

              {(superAdminFinanceError || isLoadingSuperAdminFinance) && (
                <p className={`mt-3 rounded-xl border px-3 py-2 text-xs font-bold ${superAdminFinanceError ? "border-red-400/30 bg-red-500/10 text-red-100" : "border-blue-400/30 bg-blue-500/10 text-blue-100"}`}>
                  {superAdminFinanceError || "Loading finance statistics..."}
                </p>
              )}

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  ["Period revenue", money(finance?.revenue)],
                  ["Completed trips", finance?.completedTrips ?? 0],
                  ["Completed payments", finance?.completedPayments ?? 0],
                  ["Pending payments", finance?.pendingPayments ?? 0],
                  ["Failed payments", finance?.failedPayments ?? 0],
                  ["Fleet performance", `${finance?.activeOrReservedVehicles ?? 0}/${finance?.fleetSize ?? fleetStats.total ?? 0} active or reserved`],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-white/10 bg-[#111a2b] p-3">
                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</p>
                    <p className="mt-2 text-lg font-black text-white">{value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
                <div className="border-b border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-black uppercase text-slate-500">
                  Top earning vehicles
                </div>
                {(finance?.topVehicles || adminStatistics?.topVehicles || []).length === 0 ? (
                  <div className="bg-[#111a2b] px-4 py-5 text-sm font-semibold text-slate-400">No vehicle revenue in this period.</div>
                ) : (
                  <div className="divide-y divide-white/10">
                    {(finance?.topVehicles || adminStatistics?.topVehicles || []).map((vehicle) => (
                      <div key={vehicle.vehicleId} className="grid gap-2 bg-white/[0.02] px-4 py-3 sm:grid-cols-[1fr_120px_120px] sm:items-center">
                        <div>
                          <p className="font-black text-white">{vehicle.label}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">{vehicle.plateNumber}</p>
                        </div>
                        <p className="text-sm font-black text-slate-200">{vehicle.completedTrips} trips</p>
                        <p className="text-sm font-black text-emerald-200">{money(vehicle.revenue)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            </>
          )}

          {superAdminTab === "fleet" && (
            <>
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-white">{editingVehicleId ? "Edit vehicle" : "Add vehicle"}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{selectedVehicle ? `${selectedVehicle.brand} ${selectedVehicle.model}` : "Create a vehicle profile."}</p>
                </div>
                <button type="button" onClick={beginCreateVehicle} className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-black text-slate-200">
                  New
                </button>
              </div>
              <div className="mb-4 rounded-2xl border border-white/10 bg-[#111a2b] p-3">
                <div className="grid gap-2 md:grid-cols-[1fr_140px_160px] md:items-end">
                  <label className="block">
                    <span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">Edit existing vehicle</span>
                    <select
                      value={editingVehicleId}
                      onChange={(event) => {
                        const vehicle = backendVehicles.find((item) => item.id === event.target.value);
                        if (vehicle) {
                          beginEditVehicle(vehicle);
                        } else {
                          beginCreateVehicle();
                        }
                      }}
                      className="w-full rounded-xl border border-white/10 bg-[#0d1728] px-3 py-3 text-sm font-bold text-white outline-none"
                    >
                      <option value="">Create new vehicle</option>
                      {backendVehicles.map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {vehicle.brand} {vehicle.model} - {vehicle.plateNumber}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className={`rounded-xl px-3 py-3 text-center text-xs font-black uppercase tracking-wide ${editingVehicleId ? "bg-emerald-500/15 text-emerald-100" : "bg-white/[0.06] text-slate-400"}`}>
                    {editingVehicleId ? "Editing" : "Creating"}
                  </div>
                  <button
                    type="button"
                    onClick={saveSuperAdminVehicle}
                    disabled={!editingVehicleId || vehicleManagementBusyId === editingVehicleId}
                    className="rounded-xl bg-red-500 px-3 py-3 text-xs font-black uppercase tracking-wide text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Save changes
                  </button>
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-3">
                {[
                  ["brand", "Brand", "text"],
                  ["model", "Model", "text"],
                  ["year", "Year", "number"],
                  ["plateNumber", "Plate number", "text"],
                  ["mileageKm", "Mileage km", "number"],
                  ["batteryPercent", "Battery %", "number"],
                  ["rangeKm", "Range km", "number"],
                  ["pricePerMinute", "Price/min", "number"],
                  ["currency", "Currency", "text"],
                  ["seats", "Seats", "number"],
                  ["color", "Color", "text"],
                  ["connectorType", "Connector", "text"],
                  ["status", "Status", "select"],
                  ["locationLabel", "Location", "text"],
                  ["zone", "Zone", "text"],
                ]
                  .filter(([key]) => editingVehicleId || key !== "status")
                  .map(([key, placeholder, type]) => (
                  key === "currency" ? (
                    <select
                      key={key}
                      value="AZN"
                      onChange={(event) => updateVehicleDraft(key, event.target.value)}
                      className="rounded-xl border border-white/10 bg-[#111a2b] px-3 py-3 text-sm font-bold text-white outline-none"
                    >
                      <option value="AZN">AZN</option>
                    </select>
                  ) : key === "connectorType" ? (
                    <select
                      key={key}
                      value={vehicleDraft.connectorType}
                      onChange={(event) => updateVehicleDraft(key, event.target.value)}
                      className="rounded-xl border border-white/10 bg-[#111a2b] px-3 py-3 text-sm font-bold text-white outline-none"
                    >
                      {VEHICLE_CONNECTOR_OPTIONS.map((connector) => (
                        <option key={connector} value={connector}>{connector}</option>
                      ))}
                    </select>
                  ) : key === "status" ? (
                    <select
                      key={key}
                      value={vehicleDraft.status}
                      onChange={(event) => updateVehicleDraft(key, event.target.value)}
                      className="rounded-xl border border-white/10 bg-[#111a2b] px-3 py-3 text-sm font-bold text-white outline-none"
                    >
                      {SUPERADMIN_VEHICLE_STATUS_OPTIONS.map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      key={key}
                      type={type}
                      step={key === "pricePerMinute" || key === "mileageKm" ? "0.01" : "1"}
                      value={vehicleDraft[key]}
                      onChange={(event) => updateVehicleDraft(key, event.target.value)}
                      placeholder={placeholder}
                      className="rounded-xl border border-white/10 bg-[#111a2b] px-3 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-500"
                    />
                  )
                ))}
                <div className="md:col-span-3">
                  <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wide text-slate-500">Map point</p>
                      <p className="mt-1 text-xs font-semibold text-slate-400">
                        {Number(vehicleDraft.latitude).toFixed(5)}, {Number(vehicleDraft.longitude).toFixed(5)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateVehicleDraft("pickOnMap", !vehicleDraft.pickOnMap)}
                      className={`rounded-xl px-3 py-2 text-xs font-black ${vehicleDraft.pickOnMap ? "bg-emerald-500 text-white" : "bg-white/[0.06] text-slate-200"}`}
                    >
                      {vehicleDraft.pickOnMap ? "Picking on map" : "Pick on map"}
                    </button>
                  </div>
                  <VehicleLocationPicker
                    enabled={vehicleDraft.pickOnMap}
                    latitude={vehicleDraft.latitude}
                    longitude={vehicleDraft.longitude}
                    onPick={setVehicleDraftPoint}
                  />
                </div>
                <div className="md:col-span-3">
                  <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Vehicle photos</p>
                  <div className="grid gap-2 md:grid-cols-4">
                    {[
                      ["mainImage", "Main photo"],
                      ["galleryImage1", "Gallery 1"],
                      ["galleryImage2", "Gallery 2"],
                      ["galleryImage3", "Gallery 3"],
                    ].map(([key, label]) => (
                      <label key={key} className="rounded-xl border border-white/10 bg-[#111a2b] px-3 py-3 text-xs font-bold text-slate-300">
                        <span className="block text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</span>
                        <span className="mt-2 block truncate text-white">{vehiclePhotoDraft[key]?.name || "Choose image"}</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={(event) => updateVehiclePhotoDraft(key, event.target.files?.[0])}
                          className="sr-only"
                        />
                      </label>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] font-semibold text-slate-500">
                    Photos upload after the vehicle record is saved.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={saveSuperAdminVehicle}
                  disabled={vehicleManagementBusyId === "__create" || Boolean(editingVehicleId && vehicleManagementBusyId === editingVehicleId)}
                  className="rounded-xl bg-red-500 px-3 py-3 text-xs font-black uppercase tracking-wide text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50 md:col-span-3"
                >
                  {editingVehicleId ? "Save vehicle" : "Create vehicle"}
                </button>
              </div>
            </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035]">
            <div className="flex flex-col gap-3 border-b border-white/10 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-black text-white">Fleet management</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">Create, edit, or deactivate vehicles. Rider map marker behavior is untouched.</p>
              </div>
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">{backendVehicles.length} vehicles</p>
            </div>
            {backendVehiclesError && (
              <p className="m-4 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-100">{backendVehiclesError}</p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="bg-white/[0.04] text-[10px] font-black uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Vehicle</th>
                    <th className="px-4 py-3">Plate</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Battery</th>
                    <th className="px-4 py-3">Price</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {backendVehicles.map((vehicle) => (
                    <tr key={vehicle.id} className="bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <p className="font-black text-white">{vehicle.brand} {vehicle.model}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">{vehicle.year} · {vehicle.color} · {vehicle.connectorType}</p>
                      </td>
                      <td className="px-4 py-3 font-black text-slate-200">{vehicle.plateNumber}</td>
                      <td className="px-4 py-3">
                        <select
                          value={vehicle.status}
                          onChange={async (event) => {
                            setVehicleManagementBusyId(vehicle.id);
                            try {
                              await vehicleApi.updateVehicleStatus(vehicle.id, event.target.value);
                              await loadBackendVehicles();
                              showAdminNotice("Vehicle status updated.", "superadmin");
                            } catch (error) {
                              showAdminNotice(getApiErrorMessage(error, "Vehicle status could not be updated."), "superadmin", "error");
                            } finally {
                              setVehicleManagementBusyId("");
                            }
                          }}
                          disabled={vehicleManagementBusyId === vehicle.id}
                          className="rounded-lg border border-white/10 bg-[#111a2b] px-3 py-2 text-xs font-black text-white outline-none"
                        >
                          {!SUPERADMIN_VEHICLE_STATUS_OPTIONS.some(([value]) => value === vehicle.status) && (
                            <option value={vehicle.status}>{statusLabel(vehicle.status)}</option>
                          )}
                          {SUPERADMIN_VEHICLE_STATUS_OPTIONS.map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                        <p className="mt-1 text-[10px] font-bold text-slate-500">{statusLabel(vehicle.status)}</p>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-300">{vehicle.batteryPercent}% · {vehicle.rangeKm} km</td>
                      <td className="px-4 py-3 font-semibold text-slate-300">{Number(vehicle.pricePerMinute || 0).toFixed(2)} {vehicle.currency}/min</td>
                      <td className="px-4 py-3 font-semibold text-slate-300">{vehicle.locationLabel || vehicle.location?.label || "Baku"}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button type="button" onClick={() => beginEditVehicle(vehicle)} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-black text-white transition hover:border-red-300 hover:text-red-200">
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deactivateSuperAdminVehicle(vehicle)}
                            disabled={vehicle.status === MAINTENANCE_VEHICLE_STATUS || vehicleManagementBusyId === vehicle.id}
                            className="rounded-lg bg-red-500 px-3 py-2 text-xs font-black text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            Deactivate
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
            </>
          )}

          {superAdminTab === "roles" && (
            <div className="grid gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-black text-white">Create internal account</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">Create Staff, Admin, or SuperAdmin accounts.</p>
                  </div>
                  <span className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-red-100">
                    SuperAdmin only
                  </span>
                </div>
                <div className="grid gap-2 md:grid-cols-4">
                  {[
                    ["firstName", "First name"],
                    ["lastName", "Last name"],
                    ["email", "Email"],
                    ["phone", "+994501234567"],
                    ["password", "Password"],
                    ["driverLicenseNumber", "License number"],
                  ].map(([key, placeholder]) => (
                    <input
                      key={key}
                      type={key === "password" ? "password" : key === "email" ? "email" : "text"}
                      value={createUserDraft[key]}
                      onChange={(event) => setCreateUserDraft((draft) => ({ ...draft, [key]: event.target.value }))}
                      placeholder={placeholder}
                      className="rounded-xl border border-white/10 bg-[#111a2b] px-3 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-500"
                    />
                  ))}
                  <select
                    value={createUserDraft.role}
                    onChange={(event) => setCreateUserDraft((draft) => ({ ...draft, role: Number(event.target.value) }))}
                    className="rounded-xl border border-white/10 bg-[#111a2b] px-3 py-3 text-sm font-bold text-white outline-none"
                  >
                    <option value={USER_ROLES.Staff}>Staff</option>
                    <option value={USER_ROLES.Admin}>Admin</option>
                    <option value={USER_ROLES.SuperAdmin}>SuperAdmin</option>
                  </select>
                  <button
                    type="button"
                    onClick={createBackendUser}
                    className="rounded-xl bg-red-500 px-3 py-3 text-xs font-black uppercase tracking-wide text-white transition hover:bg-red-600"
                  >
                    Create account
                  </button>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035]">
                <div className="flex flex-col gap-3 border-b border-white/10 p-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-black text-white">Role management</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {visibleInternalUsers.length}/{internalUsers.length} internal accounts
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 md:flex-row md:items-center">
                    <label className="flex min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-[#111a2b] px-3 py-2 text-sm text-slate-400 md:w-[320px]">
                      <FiSearch className="shrink-0 text-slate-500" />
                      <input
                        value={superAdminRoleSearchQuery}
                        onChange={(event) => setSuperAdminRoleSearchQuery(event.target.value)}
                        placeholder="Search internal users"
                        className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none placeholder:text-slate-500"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={loadBackendUsers}
                      className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-black text-slate-200"
                    >
                      Refresh users
                    </button>
                  </div>
                </div>
                {backendUsersError && (
                  <p className="m-4 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-100">{backendUsersError}</p>
                )}
                <div className="grid gap-2 border-b border-white/10 p-4 md:grid-cols-5">
                  {roleFilterItems.map((item) => {
                    const active = superAdminRoleFilter === item.id;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSuperAdminRoleFilter(item.id)}
                        className={`flex min-h-14 items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                          active
                            ? "border-red-400/50 bg-red-500/15 text-white"
                            : "border-white/10 bg-[#111a2b] text-slate-300 hover:border-white/20 hover:bg-white/[0.06]"
                        }`}
                      >
                        <span className="flex items-center gap-2 text-sm font-black">
                          <span className={`h-2.5 w-2.5 rounded-full ${item.dot}`} />
                          {item.label}
                        </span>
                        <span className="rounded-lg bg-white/[0.08] px-2 py-1 text-xs font-black">{item.count}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-left text-sm">
                    <thead className="bg-white/[0.04] text-[10px] font-black uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-3">User</th>
                        <th className="px-4 py-3">Role</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Phone</th>
                        <th className="px-4 py-3">Created</th>
                        <th className="px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {visibleInternalUsers.map((user) => {
                        const isCurrentUser = user.id === adminSession?.id;
                        const isBlocked = isCurrentlyBlockedUser(user);

                        return (
                          <tr key={user.id} className="bg-white/[0.02]">
                            <td className="px-4 py-3">
                              <p className="font-black text-white">{`${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email}</p>
                              <p className="mt-1 text-xs font-semibold text-slate-500">{user.email}</p>
                            </td>
                            <td className="px-4 py-3">
                              <select
                                value={user.role}
                                onChange={(event) => updateSuperAdminUserRole(user, event.target.value)}
                                disabled={isCurrentUser}
                                className="rounded-lg border border-white/10 bg-[#111a2b] px-3 py-2 text-xs font-black text-white outline-none disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <option value={USER_ROLES.Staff}>Staff</option>
                                <option value={USER_ROLES.Admin}>Admin</option>
                                <option value={USER_ROLES.SuperAdmin}>SuperAdmin</option>
                              </select>
                              {isCurrentUser && <p className="mt-1 text-[10px] font-bold text-slate-500">Current session</p>}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${user.isActive && !isBlocked ? "bg-emerald-500/15 text-emerald-200" : "bg-red-500/15 text-red-100"}`}>
                                {user.isActive && !isBlocked ? "Active" : "Inactive"}
                              </span>
                              <p className="mt-1 text-[10px] font-semibold text-slate-500">{isBlocked ? user.blockReason || "Blocked" : roleLabel(user.role)}</p>
                            </td>
                            <td className="px-4 py-3 font-semibold text-slate-300">{user.phone}</td>
                            <td className="px-4 py-3 font-semibold text-slate-300">{formatBakuDate(user.createdAt, "Unknown")}</td>
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                onClick={() => updateSuperAdminUserStatus(user, !user.isActive)}
                                disabled={isCurrentUser}
                                className={`rounded-lg px-3 py-2 text-xs font-black text-white transition disabled:cursor-not-allowed disabled:opacity-45 ${user.isActive ? "bg-red-500 hover:bg-red-600" : "bg-emerald-500 hover:bg-emerald-600"}`}
                              >
                                {user.isActive ? "Deactivate" : "Activate"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {visibleInternalUsers.length === 0 && (
                    <div className="bg-[#111a2b] px-4 py-6 text-sm font-semibold text-slate-400">
                      No internal users match this filter.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </>
    );
  };

  const renderPricingPanel = () => {
    const currentMode = normalizePricingMode(pricingPolicy?.mode || PRICING_MODES.Standard);
    const currentOption = PRICING_MODE_OPTIONS.find((option) => normalizePricingMode(option.mode) === currentMode) || PRICING_MODE_OPTIONS[1];

    return (
      <>
        {renderPanelHeader(
          "Pricing",
          "Tariffs and zones",
          <button
            type="button"
            onClick={() => loadPricingPolicy()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/[0.08] px-4 py-3 text-xs font-black text-white transition hover:bg-red-500"
          >
            <FiActivity />
            {isLoadingPricingPolicy ? "Loading..." : "Refresh"}
          </button>
        )}
        <div className="grid gap-4 overflow-y-auto p-5">
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black text-white">Manual pricing mode</p>
                <p className="mt-2 text-xs font-semibold leading-5 text-slate-400">
                  Vehicle cards and ride estimates use this backend rate.
                </p>
              </div>
              <span className="rounded-xl border border-red-300/30 bg-red-500/15 px-3 py-2 text-xs font-black text-red-100">
                {currentOption.label}
              </span>
            </div>

            {pricingPolicyError && (
              <p className="mt-3 rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-100">
                {pricingPolicyError}
              </p>
            )}

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {PRICING_MODE_OPTIONS.map((option) => {
                const isActive = normalizePricingMode(option.mode) === currentMode;

                return (
                  <button
                    key={option.mode}
                    type="button"
                    onClick={() => updatePricingMode(option.mode)}
                    disabled={isUpdatingPricingMode || isLoadingPricingPolicy}
                    className={`rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      isActive ? option.className : "border-white/10 bg-[#111a2b] text-slate-300 hover:border-white/20 hover:bg-white/[0.06]"
                    }`}
                  >
                    <span className="block text-base font-black text-white">
                      {option.label}
                      <span className="block text-sm text-slate-200">({option.short})</span>
                    </span>
                    <span className="mt-3 block text-xs font-semibold leading-5 text-slate-400">
                      {option.detail}
                    </span>
                    {isActive && (
                      <span className="mt-3 inline-flex rounded-lg bg-emerald-500/15 px-2 py-1 text-[10px] font-black uppercase text-emerald-200">
                        Active
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl bg-white/[0.06] p-3">
                <p className="text-[10px] font-black uppercase text-slate-500">Adjustment</p>
                <p className="mt-1 text-sm font-black text-white">
                  {Number(pricingPolicy?.adjustmentAmount ?? currentOption.adjustment ?? 0).toFixed(2)} AZN/min
                </p>
              </div>
              <div className="rounded-xl bg-white/[0.06] p-3">
                <p className="text-[10px] font-black uppercase text-slate-500">Active mode</p>
                <p className="mt-1 text-sm font-black text-white">{currentOption.label}</p>
              </div>
              <div className="rounded-xl bg-white/[0.06] p-3">
                <p className="text-[10px] font-black uppercase text-slate-500">Updated</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-200">
                  {pricingPolicy?.updatedAt ? formatBakuDate(pricingPolicy.updatedAt) : "Not loaded"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  };

  const renderBillingPanel = () => {
    const riders = backendUsers.filter((user) => user.role === USER_ROLES.Rider);
    const reason = penaltyReasons.find((item) => item.id === penaltyReasonId) || penaltyReasons[0];
    const penaltySearch = penaltySearchQuery.trim().toLowerCase();
    const foundPenaltyRiders = penaltySearch
      ? riders.filter((rider) =>
          [
            rider.fullName,
            rider.email,
            rider.phone,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(penaltySearch)
        )
      : [];
    const selectedPenaltyRider = riders.find((rider) => rider.id === penaltyTargetId);
    const recentPenalties = penalties.filter((penalty) => {
      const penaltyTime = penalty.createdAtIso ? new Date(penalty.createdAtIso).getTime() : penaltyPeriodStartMs;
      return penaltyTime >= penaltyPeriodStartMs;
    });
    const totalPenaltyAmount = recentPenalties.reduce((sum, penalty) => sum + penalty.amount, 0);
    const selectedReasonCount = penalties.filter((penalty) => penalty.reason === reason.label).length;

    return (
      <>
        {renderPanelHeader(
          "Billing",
          "Receipts and invoice delivery",
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-right">
            <p className="text-[10px] font-black uppercase text-slate-500">Receipts</p>
            <p className="text-lg font-black text-white">{billingInvoices.length}</p>
          </div>
        )}
        <div className="grid gap-4 overflow-y-auto p-5">
          <div className="hidden gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <p className="text-[10px] font-black uppercase text-slate-500">Штрафов за 7 дней</p>
              <p className="mt-2 text-2xl font-black text-white">{recentPenalties.length}</p>
            </div>
            <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4">
              <p className="text-[10px] font-black uppercase text-red-200">Итого за 7 дней</p>
              <p className="mt-2 text-2xl font-black text-white">{totalPenaltyAmount} AZN</p>
            </div>
            <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
              <p className="text-[10px] font-black uppercase text-amber-200">Выбранная причина</p>
              <p className="mt-2 text-lg font-black text-white">{reason.amount} AZN</p>
              <p className="mt-1 text-xs font-semibold text-slate-300">{selectedReasonCount} списаний</p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-black text-white">Receipts</p>
                <p className="mt-1 text-xs font-semibold text-slate-400">
                  PDF receipts, delivery status, and admin pricing checks will appear here.
                </p>
              </div>
              <button
                type="button"
                onClick={loadBillingInvoices}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/[0.08] px-4 py-3 text-xs font-black text-white transition hover:bg-red-500"
              >
                <FiActivity />
                {isLoadingBillingInvoices ? "Loading..." : "Refresh"}
              </button>
            </div>

            {billingInvoiceError && (
              <p className="mt-3 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-100">
                {billingInvoiceError}
              </p>
            )}

            <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
              {billingInvoices.length === 0 ? (
                <div className="bg-[#111a2b] px-4 py-5 text-sm font-semibold text-slate-400">
                  No receipts yet. Completed top-ups and trip payments will generate PDF receipts automatically.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-white/[0.04] text-[10px] font-black uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Receipt</th>
                        <th className="px-4 py-3">Customer</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3">Delivery</th>
                        <th className="px-4 py-3">PDF</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {billingInvoices.map((invoice) => (
                        <tr key={invoice.id} className="bg-white/[0.02]">
                          <td className="px-4 py-3">
                            <p className="font-black text-white">{invoice.invoiceNumber || invoice.id}</p>
                            <p className="mt-1 text-xs font-semibold text-slate-500">
                              {formatBakuDateTime(invoice.createdAt)}
                            </p>
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-300">{invoice.userEmail || invoice.userName || invoice.userId}</td>
                          <td className="px-4 py-3 font-semibold text-slate-300">{invoice.type || "Payment"}</td>
                          <td className="px-4 py-3 font-black text-emerald-200">
                            {Number(invoice.amount || 0).toFixed(2)} {invoice.currency || "AZN"}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-300">{invoice.deliveryStatus || invoice.status || "Ready"}</td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => downloadAdminReceipt(invoice)}
                              className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-black text-white transition hover:border-red-300 hover:text-red-200"
                            >
                              <FiFileText />
                              Receipt
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="hidden gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(360px,1.05fr)]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <p className="text-sm font-black text-white">Выписать штраф</p>
            <p className="mt-4 text-[10px] font-black uppercase tracking-wide text-slate-500">Пользователь</p>
            <label className="mt-2 flex items-center gap-3 rounded-xl border border-white/10 bg-[#111a2b] px-3 py-3 text-sm text-slate-400">
              <FiSearch className="shrink-0 text-slate-500" />
              <input
                type="search"
                value={penaltySearchQuery}
                onChange={(event) => {
                  setPenaltySearchQuery(event.target.value);
                  setPenaltyTargetId(null);
                }}
                placeholder="Введите имя и фамилию"
                className="min-w-0 flex-1 bg-transparent font-semibold text-white outline-none placeholder:text-slate-500"
              />
            </label>

            <div className="mt-3 grid gap-2">
              {foundPenaltyRiders.map((rider) => (
                <button
                  key={rider.id}
                  type="button"
                  onClick={() => setPenaltyTargetId(rider.id)}
                  className={`rounded-xl border px-3 py-2 text-left text-xs font-bold transition ${
                    penaltyTargetId === rider.id
                      ? "border-red-400 bg-red-500/15 text-white"
                      : "border-white/10 bg-[#111a2b] text-slate-300 hover:bg-white/[0.06]"
                  }`}
                >
                  <span className="block text-sm text-white">{rider.fullName}</span>
                  <span className="mt-1 block text-[11px] text-slate-400">{rider.email} · {rider.phone}</span>
                </button>
              ))}
              {penaltySearch && foundPenaltyRiders.length === 0 && (
                <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-3 text-xs font-semibold text-amber-100">
                  Пользователь не найден. Уточните имя и фамилию.
                </div>
              )}
              {selectedPenaltyRider && (
                <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-3">
                  <p className="text-[10px] font-black uppercase tracking-wide text-emerald-200">Найденный пользователь</p>
                  <p className="mt-1 text-sm font-black text-white">{selectedPenaltyRider.fullName}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-300">
                    {selectedPenaltyRider.email} · {selectedPenaltyRider.phone}
                  </p>
                </div>
              )}
            </div>

            <p className="mt-4 text-[10px] font-black uppercase tracking-wide text-slate-500">Причина</p>
            <div className="mt-2 grid gap-2">
              {penaltyReasons.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPenaltyReasonId(item.id)}
                  className={`rounded-xl border px-3 py-2 text-left text-xs font-bold transition ${
                    penaltyReasonId === item.id
                      ? "border-red-400 bg-red-500/15 text-white"
                      : "border-white/10 bg-[#111a2b] text-slate-300 hover:bg-white/[0.06]"
                  }`}
                >
                  {item.label} · {item.amount} AZN
                </button>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-3">
              <p className="text-[10px] font-black uppercase tracking-wide text-red-200">Сумма</p>
              <p className="mt-1 text-2xl font-black text-white">{reason.amount} AZN</p>
            </div>

            <button
              type="button"
              onClick={preparePenalty}
              disabled={!selectedPenaltyRider}
              className="mt-3 w-full rounded-xl bg-red-500 px-3 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              Выписать штраф
            </button>
          </div>

          <div className="grid content-start gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-white">Штрафы за последние 7 дней</p>
                <p className="mt-1 text-xs font-semibold text-slate-400">Имя, причина, сумма и дата списания</p>
              </div>
              <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-right">
                <p className="text-[10px] font-black uppercase text-red-200">Итого</p>
                <p className="text-lg font-black text-white">{totalPenaltyAmount} AZN</p>
              </div>
            </div>
            <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
              {recentPenalties.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-[#111a2b] px-3 py-4 text-sm font-semibold text-slate-400">
                  За последние 7 дней штрафов нет. Найдите пользователя, выберите причину и нажмите “Выписать штраф”.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] text-left text-sm">
                    <thead className="bg-white/[0.04] text-[10px] font-black uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Имя Фамилия</th>
                        <th className="px-4 py-3">Причина</th>
                        <th className="px-4 py-3">Сумма</th>
                        <th className="px-4 py-3">Дата</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {recentPenalties.map((penalty) => (
                        <tr key={penalty.id} className="bg-white/[0.02]">
                          <td className="px-4 py-3">
                            <p className="font-black text-white">{penalty.user}</p>
                            <p className="mt-1 text-xs font-semibold text-slate-500">{penalty.userEmail}</p>
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-300">{penalty.reason}</td>
                          <td className="px-4 py-3 font-black text-red-200">{penalty.amount} AZN</td>
                          <td className="px-4 py-3 font-semibold text-slate-400">{penalty.createdAt}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
          </div>
          </div>
        </div>
      </>
    );
  };

  const renderKpiPanel = () => {
    const detailConfig = {
      applications: {
        title: "Обработанные заявки за смену",
        itemKey: "applicationsProcessed",
        icon: FiFileText,
      },
      tickets: {
        title: "Закрытые обращения поддержки",
        itemKey: "supportTicketsClosed",
        icon: FiMessageSquare,
      },
    };
    const selectedManager = staff.find((manager) => manager.id === selectedKpiDetail?.staffId);
    const selectedDetail = detailConfig[selectedKpiDetail?.type];
    const selectedItems = selectedManager && selectedDetail ? selectedManager[selectedDetail.itemKey] || [] : [];
    const activeStaff = staff.filter((manager) => manager.active);
    const kpiTotals = {
      orders: Number(staffKpiSummary?.ordersCompleted ?? staff.reduce((sum, manager) => sum + manager.ordersCompleted, 0)),
      avgTime: Number(staffKpiSummary?.averageCompletionMinutes ?? Math.round(staff.reduce((sum, manager) => sum + manager.avgCompletionMinutes, 0) / Math.max(staff.length, 1))),
      rating: Number(staffKpiSummary?.averageRating ?? (staff.reduce((sum, manager) => sum + manager.rating, 0) / Math.max(staff.length, 1))).toFixed(1),
      weekly: Number(staffKpiSummary?.weeklyChangePercent ?? Math.round(staff.reduce((sum, manager) => sum + manager.weeklyChange, 0) / Math.max(staff.length, 1))),
      activeStaff: Number(staffKpiSummary?.activeStaff ?? staff.filter((manager) => manager.active).length),
      totalStaff: Number(staffKpiSummary?.totalStaff ?? staff.length),
    };
    const sortedStaff = [...staff].sort((first, second) => {
      const firstValue = first[kpiSort.key];
      const secondValue = second[kpiSort.key];
      const direction = kpiSort.direction === "asc" ? 1 : -1;

      if (typeof firstValue === "string") {
        return firstValue.localeCompare(secondValue) * direction;
      }

      return (firstValue - secondValue) * direction;
    });
    const sortColumns = [
      ["name", "Сотрудник"],
      ["ordersCompleted", "Заказы"],
      ["avgCompletionMinutes", "Среднее время"],
      ["rating", "Rating"],
      ["complaints", "Жалобы"],
      ["praises", "Похвалы"],
      ["activeShiftHours", "Активное время"],
      ["weeklyChange", "К прошлой неделе"],
    ];
    const toggleKpiSort = (key) => {
      setKpiSort((current) => ({
        key,
        direction: current.key === key && current.direction === "desc" ? "asc" : "desc",
      }));
    };

    return (
      <>
        {renderPanelHeader(
          "Manager KPI",
          "Эффективность персонала",
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-right">
            <p className="text-[10px] font-black uppercase text-slate-500">Активны</p>
            <p className="text-lg font-black text-white">{activeStaff.length}/{staff.length}</p>
          </div>
        )}
        <div className="grid gap-4 overflow-y-auto p-5">
          <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 p-4 text-xs font-semibold leading-5 text-slate-300">
            <b className="text-blue-200">KPI персонала</b> показывает выполненные заказы, среднее время выполнения, рейтинг, жалобы, похвалы, активное время за смену и динамику относительно прошлой недели.
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <p className="text-[10px] font-black uppercase text-slate-500">Выполнено заказов</p>
              <p className="mt-2 text-2xl font-black text-white">{kpiTotals.orders}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <p className="text-[10px] font-black uppercase text-slate-500">Среднее время</p>
              <p className="mt-2 text-2xl font-black text-white">{kpiTotals.avgTime} мин</p>
            </div>
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
              <p className="text-[10px] font-black uppercase text-emerald-200">Средний рейтинг</p>
              <p className="mt-2 text-2xl font-black text-white">{kpiTotals.rating}/10</p>
            </div>
            <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 p-4">
              <p className="text-[10px] font-black uppercase text-blue-200">К прошлой неделе</p>
              <p className={`mt-2 text-2xl font-black ${kpiTotals.weekly >= 0 ? "text-emerald-200" : "text-red-200"}`}>
                {kpiTotals.weekly >= 0 ? "+" : ""}{kpiTotals.weekly}%
              </p>
            </div>
          </div>

          {selectedManager && selectedDetail && (
            <div className="rounded-2xl border border-blue-400/25 bg-blue-500/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase text-blue-200">{selectedDetail.title}</p>
                  <p className="mt-1 text-sm font-black text-white">{selectedManager.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedKpiDetail(null)}
                  className="rounded-xl bg-white/[0.08] px-3 py-2 text-xs font-black text-slate-200"
                >
                  Закрыть
                </button>
              </div>
              <div className="mt-4 grid gap-2">
                {selectedItems.map((item) => (
                  <div key={item.id} className="rounded-xl border border-white/10 bg-white/[0.05] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-black text-white">{item.title}</p>
                      <span className="shrink-0 text-[10px] font-black text-slate-500">{item.time}</span>
                    </div>
                    <p className="mt-1 text-xs font-semibold leading-5 text-slate-300">{item.result}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-black text-white">Таблица KPI</p>
              <p className="text-xs font-semibold text-slate-500">Клик по заголовку сортирует таблицу</p>
            </div>
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-white/[0.04] text-[10px] font-black uppercase text-slate-500">
                  <tr>
                    {sortColumns.map(([key, label]) => (
                      <th key={key} className="px-4 py-3">
                        <button type="button" onClick={() => toggleKpiSort(key)} className="flex items-center gap-1 hover:text-white">
                          {label}
                          {kpiSort.key === key && <span>{kpiSort.direction === "desc" ? "↓" : "↑"}</span>}
                        </button>
                      </th>
                    ))}
                    <th className="px-4 py-3">Детали</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {sortedStaff.map((manager) => (
                    <tr key={manager.id} className={manager.active ? "bg-white/[0.02]" : "bg-red-500/5 opacity-75"}>
                      <td className="px-4 py-3">
                        <p className="font-black text-white">{manager.name}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">{manager.role}</p>
                      </td>
                      <td className="px-4 py-3 font-black text-white">{manager.ordersCompleted}</td>
                      <td className="px-4 py-3 font-semibold text-slate-300">{manager.avgCompletionMinutes} мин</td>
                      <td className="px-4 py-3 font-black text-emerald-200">{manager.rating}/10</td>
                      <td className="px-4 py-3 font-black text-red-200">{manager.complaints}</td>
                      <td className="px-4 py-3 font-black text-blue-200">{manager.praises}</td>
                      <td className="px-4 py-3 font-semibold text-slate-300">{manager.activeShiftHours} ч</td>
                      <td className={`px-4 py-3 font-black ${manager.weeklyChange >= 0 ? "text-emerald-200" : "text-red-200"}`}>
                        {manager.weeklyChange >= 0 ? "+" : ""}{manager.weeklyChange}%
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setSelectedKpiDetail({ staffId: manager.id, type: "applications" })}
                          className="rounded-lg bg-blue-500/15 px-3 py-2 text-xs font-black text-blue-200"
                        >
                          Открыть
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            {staff.map((manager) => {
              const applicationsCount = manager.applicationsProcessed?.length || 0;
              const ticketsCount = manager.supportTicketsClosed?.length || 0;
              const applicationsSelected =
                selectedKpiDetail?.staffId === manager.id && selectedKpiDetail?.type === "applications";
              const ticketsSelected =
                selectedKpiDetail?.staffId === manager.id && selectedKpiDetail?.type === "tickets";

              return (
                <div key={manager.id} className={`rounded-2xl border p-4 ${manager.active ? "border-white/10 bg-white/[0.035]" : "border-red-400/25 bg-red-500/10 opacity-70"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-white">{manager.name}</p>
                      <p className="text-xs font-bold text-slate-500">{manager.role}</p>
                      {manager.specialty && (
                        <p className="mt-1 text-xs font-semibold leading-5 text-slate-300">{manager.specialty}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setStaff((items) => items.map((item) => (item.id === manager.id ? { ...item, active: !item.active } : item)))}
                      className={`rounded-xl p-2 ${manager.active ? "bg-red-500/15 text-red-200" : "bg-emerald-500/15 text-emerald-200"}`}
                      title={manager.active ? "Deactivate staff" : "Activate staff"}
                    >
                      {manager.active ? <FiUserX /> : <FiUserCheck />}
                    </button>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
                    <div className="rounded-xl bg-white/[0.05] p-3"><p className="text-[10px] font-black text-slate-500">Заказы</p><p className="font-black text-white">{manager.ordersCompleted}</p></div>
                    <div className="rounded-xl bg-white/[0.05] p-3"><p className="text-[10px] font-black text-slate-500">Среднее</p><p className="font-black text-white">{manager.avgCompletionMinutes} мин</p></div>
                    <div className="rounded-xl bg-white/[0.05] p-3"><p className="text-[10px] font-black text-slate-500">Rating</p><p className="font-black text-emerald-200">{manager.rating}/10</p></div>
                    <div className="rounded-xl bg-white/[0.05] p-3"><p className="text-[10px] font-black text-slate-500">Смена</p><p className="font-black text-white">{manager.activeShiftHours} ч</p></div>
                    <div className="rounded-xl bg-white/[0.05] p-3"><p className="text-[10px] font-black text-slate-500">Жалобы</p><p className="font-black text-red-200">{manager.complaints}</p></div>
                    <div className="rounded-xl bg-white/[0.05] p-3"><p className="text-[10px] font-black text-slate-500">Похвалы</p><p className="font-black text-blue-200">{manager.praises}</p></div>
                    <div className="rounded-xl bg-white/[0.05] p-3"><p className="text-[10px] font-black text-slate-500">Неделя</p><p className={`font-black ${manager.weeklyChange >= 0 ? "text-emerald-200" : "text-red-200"}`}>{manager.weeklyChange >= 0 ? "+" : ""}{manager.weeklyChange}%</p></div>
                    <div className="rounded-xl bg-white/[0.05] p-3"><p className="text-[10px] font-black text-slate-500">KYC</p><p className="font-black text-white">{manager.kycRating}/10</p></div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedKpiDetail({ staffId: manager.id, type: "applications" })}
                      className={`rounded-xl p-3 text-left transition hover:bg-blue-500/10 ${applicationsSelected ? "bg-blue-500/15 ring-1 ring-blue-300/30" : "bg-white/[0.05]"}`}
                    >
                      <p className="text-[10px] font-black text-slate-500">Заявки</p>
                      <p className="font-black text-white">{applicationsCount}</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedKpiDetail({ staffId: manager.id, type: "tickets" })}
                      className={`rounded-xl p-3 text-left transition hover:bg-blue-500/10 ${ticketsSelected ? "bg-blue-500/15 ring-1 ring-blue-300/30" : "bg-white/[0.05]"}`}
                    >
                      <p className="text-[10px] font-black text-slate-500">Тикеты</p>
                      <p className="font-black text-white">{ticketsCount}</p>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </>
    );
  };

  const renderKpiPanelV2 = () => {
    const selectedManager = staff.find((manager) => manager.id === selectedKpiDetail?.staffId);
    const selectedItems = selectedManager?.applicationsProcessed || [];
    const kpiTotals = {
      orders: Number(staffKpiSummary?.ordersCompleted || 0),
      avgTime: Number(staffKpiSummary?.averageCompletionMinutes || 0),
      rating: Number(staffKpiSummary?.averageRating || 0).toFixed(1),
      weekly: Number(staffKpiSummary?.weeklyChangePercent || 0),
      activeStaff: Number(staffKpiSummary?.activeStaff || 0),
      totalStaff: Number(staffKpiSummary?.totalStaff || 0),
    };
    const sortedStaff = [...staff].sort((first, second) => {
      const firstValue = first[kpiSort.key];
      const secondValue = second[kpiSort.key];
      const direction = kpiSort.direction === "asc" ? 1 : -1;

      if (typeof firstValue === "string") {
        return firstValue.localeCompare(secondValue) * direction;
      }

      return (Number(firstValue || 0) - Number(secondValue || 0)) * direction;
    });
    const sortColumns = [
      "name",
      "ordersCompleted",
      "avgCompletionMinutes",
      "rating",
      "complaints",
      "praises",
      "activeShiftHours",
      "weeklyChange",
    ];
    const toggleKpiSort = (key) => {
      setKpiSort((current) => ({
        key,
        direction: current.key === key && current.direction === "desc" ? "asc" : "desc",
      }));
    };

    return (
      <>
        {renderPanelHeader(
          "Manager KPI",
          "Staff performance",
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-right">
            <p className="text-[10px] font-black uppercase text-slate-500">Active</p>
            <p className="text-lg font-black text-white">{kpiTotals.activeStaff}/{kpiTotals.totalStaff}</p>
          </div>
        )}
        <div className="grid gap-4 overflow-y-auto p-5">
          {(staffKpiError || isLoadingStaffKpi) && (
            <p className={`rounded-xl border px-4 py-3 text-sm font-bold ${staffKpiError ? "border-red-400/30 bg-red-500/10 text-red-100" : "border-blue-400/30 bg-blue-500/10 text-blue-100"}`}>
              {staffKpiError || "Loading KPI..."}
            </p>
          )}

          <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 p-4 text-xs font-semibold leading-5 text-slate-300">
            <b className="text-blue-200">Manager KPI</b> is calculated from staff accounts and completed service tasks stored in the database.
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <p className="text-[10px] font-black uppercase text-slate-500">Completed tasks</p>
              <p className="mt-2 text-2xl font-black text-white">{kpiTotals.orders}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <p className="text-[10px] font-black uppercase text-slate-500">Average time</p>
              <p className="mt-2 text-2xl font-black text-white">{kpiTotals.avgTime} min</p>
            </div>
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
              <p className="text-[10px] font-black uppercase text-emerald-200">Average rating</p>
              <p className="mt-2 text-2xl font-black text-white">{kpiTotals.rating}/10</p>
            </div>
            <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 p-4">
              <p className="text-[10px] font-black uppercase text-blue-200">Vs last week</p>
              <p className={`mt-2 text-2xl font-black ${kpiTotals.weekly >= 0 ? "text-emerald-200" : "text-red-200"}`}>
                {kpiTotals.weekly >= 0 ? "+" : ""}{kpiTotals.weekly}%
              </p>
            </div>
          </div>

          {selectedManager && (
            <div className="rounded-2xl border border-blue-400/25 bg-blue-500/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase text-blue-200">Completed service tasks</p>
                  <p className="mt-1 text-sm font-black text-white">{selectedManager.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedKpiDetail(null)}
                  className="rounded-xl bg-white/[0.08] px-3 py-2 text-xs font-black text-slate-200"
                >
                  Close
                </button>
              </div>
              <div className="mt-4 grid gap-2">
                {selectedItems.length ? selectedItems.map((item) => (
                  <div key={item.id} className="rounded-xl border border-white/10 bg-white/[0.05] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-black text-white">{item.title}</p>
                      <span className="shrink-0 text-[10px] font-black text-slate-500">{item.time}</span>
                    </div>
                    <p className="mt-1 text-xs font-semibold leading-5 text-slate-300">{item.result}</p>
                  </div>
                )) : (
                  <p className="rounded-xl border border-white/10 bg-white/[0.05] p-3 text-xs font-semibold text-slate-400">
                    No completed service tasks for this staff member yet.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-black text-white">KPI table</p>
              <p className="text-xs font-semibold text-slate-500">Click a header to sort.</p>
            </div>
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-white/[0.04] text-[10px] font-black uppercase text-slate-500">
                  <tr>
                    {sortColumns.map((key) => (
                      <th key={key} className="px-4 py-3">
                        <button type="button" onClick={() => toggleKpiSort(key)} className="flex items-center gap-1 hover:text-white">
                          {KPI_COLUMN_LABELS[key] || key}
                          {kpiSort.key === key && <span>{kpiSort.direction === "desc" ? "v" : "^"}</span>}
                        </button>
                      </th>
                    ))}
                    <th className="px-4 py-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {sortedStaff.map((manager) => (
                    <tr key={manager.id} className={manager.active ? "bg-white/[0.02]" : "bg-red-500/5 opacity-75"}>
                      <td className="px-4 py-3">
                        <p className="font-black text-white">{manager.name}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">{manager.specialty || manager.role}</p>
                      </td>
                      <td className="px-4 py-3 font-black text-white">{manager.ordersCompleted}</td>
                      <td className="px-4 py-3 font-semibold text-slate-300">{manager.avgCompletionMinutes} min</td>
                      <td className="px-4 py-3 font-black text-emerald-200">{manager.rating}/10</td>
                      <td className="px-4 py-3 font-black text-red-200">{manager.complaints}</td>
                      <td className="px-4 py-3 font-black text-blue-200">{manager.praises}</td>
                      <td className="px-4 py-3 font-semibold text-slate-300">{manager.activeShiftHours} h</td>
                      <td className={`px-4 py-3 font-black ${manager.weeklyChange >= 0 ? "text-emerald-200" : "text-red-200"}`}>
                        {manager.weeklyChange >= 0 ? "+" : ""}{manager.weeklyChange}%
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setSelectedKpiDetail({ staffId: manager.id, type: "applications" })}
                          className="rounded-lg bg-blue-500/15 px-3 py-2 text-xs font-black text-blue-200"
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            {staff.map((manager) => (
              <div key={manager.id} className={`rounded-2xl border p-4 ${manager.active ? "border-white/10 bg-white/[0.035]" : "border-red-400/25 bg-red-500/10 opacity-70"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-white">{manager.name}</p>
                    <p className="text-xs font-bold text-slate-500">{manager.specialty || manager.role}</p>
                  </div>
                  <span className={`rounded-xl px-3 py-2 text-xs font-black ${manager.active ? "bg-emerald-500/15 text-emerald-200" : "bg-red-500/15 text-red-200"}`}>
                    {manager.active ? "Active" : "Blocked"}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
                  <div className="rounded-xl bg-white/[0.05] p-3"><p className="text-[10px] font-black text-slate-500">Completed</p><p className="font-black text-white">{manager.ordersCompleted}</p></div>
                  <div className="rounded-xl bg-white/[0.05] p-3"><p className="text-[10px] font-black text-slate-500">Average</p><p className="font-black text-white">{manager.avgCompletionMinutes} min</p></div>
                  <div className="rounded-xl bg-white/[0.05] p-3"><p className="text-[10px] font-black text-slate-500">Rating</p><p className="font-black text-emerald-200">{manager.rating}/10</p></div>
                  <div className="rounded-xl bg-white/[0.05] p-3"><p className="text-[10px] font-black text-slate-500">Shift</p><p className="font-black text-white">{manager.activeShiftHours} h</p></div>
                  <div className="rounded-xl bg-white/[0.05] p-3"><p className="text-[10px] font-black text-slate-500">Complaints</p><p className="font-black text-red-200">{manager.complaints}</p></div>
                  <div className="rounded-xl bg-white/[0.05] p-3"><p className="text-[10px] font-black text-slate-500">Praises</p><p className="font-black text-blue-200">{manager.praises}</p></div>
                  <div className="rounded-xl bg-white/[0.05] p-3"><p className="text-[10px] font-black text-slate-500">Week</p><p className={`font-black ${manager.weeklyChange >= 0 ? "text-emerald-200" : "text-red-200"}`}>{manager.weeklyChange >= 0 ? "+" : ""}{manager.weeklyChange}%</p></div>
                  <div className="rounded-xl bg-white/[0.05] p-3"><p className="text-[10px] font-black text-slate-500">KYC</p><p className="font-black text-white">{manager.kycRating}/10</p></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </>
    );
  };

  const renderStaffWorkPanel = () => {
    const sortedStaff = [...staff].sort((first, second) => second.ordersCompleted - first.ordersCompleted);
    const sortedAdmins = [...adminWorkRows].sort((first, second) => second.ordersCompleted - first.ordersCompleted);
    const workRows = [...sortedStaff, ...sortedAdmins];
    const selectedManager = workRows.find((manager) => manager.id === selectedKpiDetail?.staffId);
    const completedItems = selectedManager?.applicationsProcessed || [];
    const completedTotal = workRows.reduce((total, manager) => total + Number(manager.ordersCompleted || 0), 0);

    return (
      <>
        {renderPanelHeader(
          "Staff Work",
          "Completed service tasks",
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-right">
            <p className="text-[10px] font-black uppercase text-slate-500">Completed</p>
            <p className="text-lg font-black text-white">{completedTotal}</p>
          </div>
        )}

        <div className="grid gap-4 overflow-y-auto p-5">
          {(staffKpiError || isLoadingStaffKpi) && (
            <p className={`rounded-xl border px-4 py-3 text-sm font-bold ${staffKpiError ? "border-red-400/30 bg-red-500/10 text-red-100" : "border-blue-400/30 bg-blue-500/10 text-blue-100"}`}>
              {staffKpiError || "Loading staff work..."}
            </p>
          )}

          {selectedManager && (
            <div className="rounded-2xl border border-blue-400/25 bg-blue-500/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase text-blue-200">Completed tasks</p>
                  <p className="mt-1 text-sm font-black text-white">{selectedManager.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedKpiDetail(null)}
                  className="rounded-xl bg-white/[0.08] px-3 py-2 text-xs font-black text-slate-200"
                >
                  Close
                </button>
              </div>
              <div className="mt-4 grid gap-2">
                {completedItems.length ? completedItems.map((item) => (
                  <div key={item.id} className="rounded-xl border border-white/10 bg-white/[0.05] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-black text-white">{item.title}</p>
                      <span className="shrink-0 text-[10px] font-black text-slate-500">{item.time}</span>
                    </div>
                    <p className="mt-1 text-xs font-semibold leading-5 text-slate-300">{item.result}</p>
                  </div>
                )) : (
                  <p className="rounded-xl border border-white/10 bg-white/[0.05] p-3 text-xs font-semibold text-slate-400">
                    No completed work for this account yet.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035]">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 p-4">
              <div>
                <p className="text-sm font-black text-white">System staff</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{sortedStaff.length} staff members</p>
              </div>
              <button
                type="button"
                onClick={() => loadStaffKpi()}
                disabled={isLoadingStaffKpi}
                className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-black text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Refresh
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-white/[0.04] text-[10px] font-black uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Staff member</th>
                    <th className="px-4 py-3">Completed tasks</th>
                    <th className="px-4 py-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {sortedStaff.map((manager) => (
                    <tr key={manager.id} className="bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <p className="font-black text-white">{manager.name}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">{manager.specialty || manager.role}</p>
                      </td>
                      <td className="px-4 py-3 text-2xl font-black text-white">{manager.ordersCompleted}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setSelectedKpiDetail({ staffId: manager.id, type: "applications" })}
                          className="rounded-lg bg-blue-500/15 px-3 py-2 text-xs font-black text-blue-200 transition hover:bg-blue-500 hover:text-white"
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {sortedStaff.length === 0 && (
                <div className="bg-[#111a2b] px-4 py-6 text-sm font-semibold text-slate-400">
                  No staff work data yet.
                </div>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035]">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 p-4">
              <div>
                <p className="text-sm font-black text-white">System admins</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{sortedAdmins.length} admin accounts</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-white/[0.04] text-[10px] font-black uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Admin</th>
                    <th className="px-4 py-3">Completed work</th>
                    <th className="px-4 py-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {sortedAdmins.map((manager) => (
                    <tr key={manager.id} className="bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <p className="font-black text-white">{manager.name}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">{manager.specialty || manager.role}</p>
                      </td>
                      <td className="px-4 py-3 text-2xl font-black text-white">{manager.ordersCompleted}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setSelectedKpiDetail({ staffId: manager.id, type: "applications" })}
                          className="rounded-lg bg-blue-500/15 px-3 py-2 text-xs font-black text-blue-200 transition hover:bg-blue-500 hover:text-white"
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {sortedAdmins.length === 0 && (
                <div className="bg-[#111a2b] px-4 py-6 text-sm font-semibold text-slate-400">
                  No admin work data yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    );
  };

  const renderIncidentPanel = () => (
    <>
      {renderPanelHeader("Incidents", "Критические уведомления")}
      <div className="grid gap-3 overflow-y-auto p-5">
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-xs font-semibold leading-5 text-slate-300">
          Телематика — это связь машины с сервером: GPS, заряд, скорость, замки, датчики и состояние аренды.
        </div>
        {incidents.map((incident) => {
          const vehicle = getVehicle(incident.vehicleId);
          const critical = incident.severity === "critical";
          return (
            <button
              key={incident.id}
              type="button"
              onClick={() => {
                setStatusFilter("all");
                focusVehicle(incident.vehicleId);
              }}
              className={`rounded-2xl border p-4 text-left ${critical ? "border-red-400/40 bg-red-500/10" : "border-amber-400/35 bg-amber-500/10"}`}
            >
              <span className="flex items-start gap-3">
                <FiAlertTriangle className={critical ? "mt-1 text-red-300" : "mt-1 text-amber-300"} />
                <span>
                  <span className="block text-sm font-black text-white">{incident.title}</span>
                  <span className="mt-1 block text-xs font-semibold leading-5 text-slate-400">{incident.detail}</span>
                  <span className="mt-3 flex gap-2">
                    <span className="rounded-full bg-white/[0.06] px-3 py-1 text-[10px] font-black text-slate-300">{vehicle?.plateNumber}</span>
                    <span className="rounded-full bg-blue-500/10 px-3 py-1 text-[10px] font-black text-blue-200">Открыть на карте</span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        event.stopPropagation();
                        setIncidents((items) => items.filter((item) => item.id !== incident.id));
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.stopPropagation();
                          setIncidents((items) => items.filter((item) => item.id !== incident.id));
                        }
                      }}
                      className="rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-black text-emerald-200"
                    >
                      Закрыть
                    </span>
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </>
  );

  const renderTasksPanel = () => (
    <>
      {renderPanelHeader("Task Manager", "Technicians and service")}
      <div className="grid gap-4 overflow-y-auto p-5">
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 shadow-2xl shadow-black/10">
          <div className="mb-4 flex flex-col gap-1">
            <p className="text-sm font-black text-white">Create service task</p>
            <p className="text-xs font-semibold text-slate-500">Assign a staff member, choose the exact vehicle by plate number, and set a future deadline.</p>
          </div>
          <div className="grid gap-3">
            <div className="grid gap-3">
              <div className="grid gap-3">
                <input
                  value={staffTaskDraft.title}
                  onChange={(event) => setStaffTaskDraft((draft) => ({ ...draft, title: event.target.value }))}
                  placeholder="Task title"
                  className="rounded-xl border border-white/10 bg-[#111a2b] px-4 py-3 text-sm font-bold text-white outline-none transition placeholder:text-slate-500 focus:border-red-400/70"
                />
                <textarea
                  value={staffTaskDraft.description}
                  onChange={(event) => setStaffTaskDraft((draft) => ({ ...draft, description: event.target.value }))}
                  placeholder="Task description"
                  rows={4}
                  className="resize-none rounded-xl border border-white/10 bg-[#111a2b] px-4 py-3 text-sm font-bold leading-6 text-white outline-none transition placeholder:text-slate-500 focus:border-red-400/70"
                />
              </div>
              <label className="rounded-xl border border-red-400/20 bg-red-500/10 p-3">
                <span className="text-[10px] font-black uppercase tracking-wide text-red-200">Deadline</span>
                <input
                  type="datetime-local"
                  value={staffTaskDraft.dueAt}
                  min={toDateTimeLocalValue()}
                  onChange={(event) => setStaffTaskDraft((draft) => ({ ...draft, dueAt: event.target.value }))}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-[#0f1728] px-3 py-3 text-sm font-black text-white outline-none [color-scheme:dark] focus:border-red-300"
                />
                <span className="mt-2 block text-[11px] font-bold leading-4 text-red-100/80">Choose a future date and time.</span>
              </label>
            </div>
            <div className="grid gap-2">
              <select
                value={staffTaskDraft.assigneeId}
                onChange={(event) => setStaffTaskDraft((draft) => ({ ...draft, assigneeId: event.target.value }))}
                className="rounded-xl border border-white/10 bg-[#111a2b] px-3 py-3 text-sm font-bold text-white outline-none focus:border-red-400/70"
              >
                <option value="">Select active staff</option>
                {staffMembers.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.name} {staff.email ? `- ${staff.email}` : ""}
                  </option>
                ))}
              </select>
              <select
                value={staffTaskDraft.vehicleId}
                onChange={(event) => setStaffTaskDraft((draft) => ({ ...draft, vehicleId: event.target.value }))}
                className="rounded-xl border border-white/10 bg-[#111a2b] px-3 py-3 text-sm font-bold text-white outline-none focus:border-red-400/70"
              >
                <option value="">No vehicle</option>
                {isLoadingBackendVehicles && <option value="">Loading vehicles...</option>}
                {backendVehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.plateNumber} - {vehicle.brand} {vehicle.model}
                  </option>
                ))}
              </select>
              <select
                value={staffTaskDraft.priority}
                onChange={(event) => setStaffTaskDraft((draft) => ({ ...draft, priority: event.target.value }))}
                className="rounded-xl border border-white/10 bg-[#111a2b] px-3 py-3 text-sm font-bold text-white outline-none focus:border-red-400/70"
              >
                <option value={STAFF_TASK_PRIORITIES.High}>High</option>
                <option value={STAFF_TASK_PRIORITIES.Medium}>Medium</option>
                <option value={STAFF_TASK_PRIORITIES.Low}>Low</option>
              </select>
            </div>
            <button type="button" onClick={createStaffTask} className="rounded-xl bg-red-500 px-3 py-3 text-xs font-black uppercase tracking-wide text-white transition hover:bg-red-600">
              Assign task
            </button>
            {backendVehiclesError && (
              <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-100">
                {backendVehiclesError}
              </p>
            )}
          </div>
        </div>
        <div className="grid gap-3">
          {(staffTasksError || isLoadingStaffTasks) && (
            <p className={`rounded-xl border px-4 py-3 text-sm font-bold ${staffTasksError ? "border-red-400/30 bg-red-500/10 text-red-100" : "border-blue-400/30 bg-blue-500/10 text-blue-100"}`}>
              {staffTasksError || "Loading staff tasks..."}
            </p>
          )}
          {visibleStaffTasks.map((task) => {
            const taskAssigneeIsActive = staffMembers.some((item) => item.id === task.assigneeId);
            const taskVehicle = backendVehicles.find((vehicle) => vehicle.id === task.vehicleId);
            const taskStatus = Number(task.status);
            const taskPriority = Number(task.priority);
            const priorityStyle =
              STAFF_TASK_PRIORITY_STYLES[taskPriority] || "border-slate-400/25 bg-slate-500/10 text-slate-200";
            const statusStyle =
              STAFF_TASK_STATUS_STYLES[taskStatus] || "border-slate-400/25 bg-slate-500/10 text-slate-200";
            const deadlineLabel = formatBakuDeadline(task.dueAt);
            const vehicleLabel = taskVehicle
              ? `${taskVehicle.plateNumber} - ${taskVehicle.brand} ${taskVehicle.model}`
              : "No vehicle";

            return (
              <article key={task.id} className="rounded-2xl border border-white/10 bg-[#10192a] p-4 shadow-lg shadow-black/10">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="min-w-0 text-base font-black leading-6 text-white">{task.title}</h3>
                      <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wide ${statusStyle}`}>
                        {STAFF_TASK_STATUS_LABELS[taskStatus]}
                      </span>
                      <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wide ${priorityStyle}`}>
                        {STAFF_TASK_PRIORITY_LABELS[taskPriority] || task.priority}
                      </span>
                    </div>
                    <p className="mt-2 max-w-3xl text-xs font-semibold leading-5 text-slate-400">{task.description}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 md:grid-cols-3">
                  <div className="min-w-0 rounded-xl border border-white/5 bg-white/[0.045] p-3">
                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Assignee</p>
                    <select
                      value={task.assigneeId}
                      onChange={(event) => reassignStaffTask(task.id, event.target.value, "tasks")}
                      className="mt-1 min-h-9 w-full rounded-lg border border-white/10 bg-[#0f1828] px-3 py-2 text-xs font-bold text-white outline-none"
                    >
                      {!taskAssigneeIsActive && task.assigneeId && (
                        <option value={task.assigneeId}>
                          Inactive or removed staff - reassign
                        </option>
                      )}
                      {staffMembers.length === 0 && <option value="">No active staff</option>}
                      {staffMembers.map((member) => {
                        const taskCount = activeStaffTaskCounts[member.id] || 0;
                        return (
                          <option key={member.id} value={member.id}>
                            {member.name} - {taskCount} active tasks
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div className="min-w-0 rounded-xl border border-white/5 bg-white/[0.045] p-3">
                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Vehicle</p>
                    <p className="mt-1 break-words text-sm font-black text-white">{vehicleLabel}</p>
                  </div>
                  <div className="min-w-0 rounded-xl border border-white/5 bg-white/[0.045] p-3">
                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Deadline</p>
                    <p className="mt-1 text-sm font-black text-white">{deadlineLabel}</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  {Object.entries(STAFF_TASK_STATUS_LABELS).map(([status, label]) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => updateStaffTaskStatus(task.id, status)}
                      className={`rounded-xl px-3 py-3 text-[11px] font-black transition ${
                        Number(task.status) === Number(status)
                          ? "bg-red-500 text-white shadow-lg shadow-red-950/20"
                          : "bg-white/[0.06] text-slate-300 hover:bg-white/[0.1]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </article>
            );
          })}
          {!isLoadingStaffTasks && !staffTasksError && visibleStaffTasks.length === 0 && (
            <p className="rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm font-bold text-slate-300">
              No active staff tasks.
            </p>
          )}
          {completedStaffTaskCount > 0 && (
            <p className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-xs font-bold text-emerald-100">
              {completedStaffTaskCount} completed {completedStaffTaskCount === 1 ? "task is" : "tasks are"} hidden from this work queue.
            </p>
          )}
        </div>

      </div>
    </>
  );

  const renderStationStatusControls = () => managedChargingStations.length > 0 ? (
    <div className="pointer-events-auto rounded-2xl border border-white/10 bg-[#0b1424]/88 p-4 shadow-2xl shadow-black/30 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-black text-white">Station status</p>
        <span className="rounded-lg bg-white/[0.06] px-2 py-1 text-[10px] font-black text-slate-300">
          {managedChargingStations.length}
        </span>
      </div>
      <div className="mt-3 grid max-h-[220px] gap-3 overflow-y-auto pr-1 md:grid-cols-2 xl:grid-cols-3">
        {managedChargingStations.map((station) => (
          <div key={`${station.id}-status`} className="rounded-xl bg-white/[0.04] p-3">
            <p className="truncate text-xs font-black text-white">{station.name}</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {CHARGING_STATUS_OPTIONS.map((option) => (
                <button
                  key={option.status}
                  type="button"
                  onClick={() => updateChargingStationStatus(station.id, option.status)}
                  className={`min-h-9 rounded-lg border px-3 py-2 text-[10px] font-black leading-none transition-colors ${
                    station.status === option.status
                      ? "border-red-500 bg-red-500 text-white"
                      : "border-white/10 bg-white/[0.06] text-slate-300 hover:bg-white/[0.1]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => deleteChargingPoint(station)}
              className="mt-2 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-lg border border-red-400/25 bg-red-500/10 px-3 py-2 text-[10px] font-black text-red-100 transition hover:bg-red-500 hover:text-white"
            >
              <FiTrash2 />
              Delete station
            </button>
          </div>
        ))}
      </div>
    </div>
  ) : null;

  const renderSelectedChargingStationDetails = () => {
    if (!selectedChargingStationId || !selectedChargingStation) return null;

    const meta =
      STATION_STATUS_META[selectedChargingStation.status] ||
      STATION_STATUS_META[CHARGING_STATION_STATUSES.ONLINE];

    return (
      <div className="pointer-events-auto absolute left-4 top-32 z-[505] w-[min(380px,calc(100%-2rem))] rounded-2xl border border-white/10 bg-[#0b1424]/92 p-4 shadow-2xl shadow-black/40 backdrop-blur-xl md:left-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-300">Charging station</p>
            <h3 className="mt-2 truncate text-lg font-black text-white">{selectedChargingStation.name}</h3>
            <p className="mt-1 text-xs font-semibold text-slate-400">
              {selectedChargingStation.location.label} - {selectedChargingStation.location.zone}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSelectedChargingStationId("")}
            className="rounded-lg border border-white/10 bg-white/[0.06] px-2 py-1 text-[10px] font-black text-slate-300 transition hover:bg-white/[0.1] hover:text-white"
          >
            Close
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-white/[0.05] p-3">
            <p className="text-[10px] font-black uppercase text-slate-500">Status</p>
            <p className="mt-1 text-sm font-black" style={{ color: meta.color }}>{meta.label}</p>
          </div>
          <div className="rounded-xl bg-white/[0.05] p-3">
            <p className="text-[10px] font-black uppercase text-slate-500">Ports</p>
            <p className="mt-1 text-sm font-black text-white">
              {selectedChargingStation.availablePorts} / {selectedChargingStation.totalPorts}
            </p>
          </div>
          <div className="rounded-xl bg-white/[0.05] p-3">
            <p className="text-[10px] font-black uppercase text-slate-500">Power</p>
            <p className="mt-1 text-sm font-black text-white">{selectedChargingStation.powerKw} kW</p>
          </div>
          <div className="rounded-xl bg-white/[0.05] p-3">
            <p className="text-[10px] font-black uppercase text-slate-500">Active sessions</p>
            <p className="mt-1 text-sm font-black text-white">{selectedStationActiveSessions.length}</p>
          </div>
        </div>
        <div className="mt-2 rounded-xl bg-white/[0.05] p-3">
          <p className="text-[10px] font-black uppercase text-slate-500">Connectors</p>
          <p className="mt-1 text-xs font-black text-white">
            {selectedChargingStation.connectorTypes.join(", ") || "Unknown"}
          </p>
          <p className="mt-2 text-[11px] font-semibold text-slate-500">
            {Number(selectedChargingStation.location.lat).toFixed(5)}, {Number(selectedChargingStation.location.lng).toFixed(5)}
          </p>
        </div>
        <div className="mt-3">
          <button
            type="button"
            onClick={() => deleteChargingPoint(selectedChargingStation)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-3 text-[10px] font-black text-red-100 transition hover:bg-red-500 hover:text-white"
          >
            <FiTrash2 />
            Delete station
          </button>
        </div>
      </div>
    );
  };

  const renderChargersPanel = () => (
    <>
      {void chargingProgressTick}
      {renderPanelHeader(
        "Charging Map",
        "Charging stations",
        <button type="button" onClick={() => updateChargingDraft("pickOnMap", !chargingDraft.pickOnMap)} className={`rounded-xl px-3 py-2 text-xs font-black ${chargingDraft.pickOnMap ? "bg-emerald-500 text-white" : "bg-red-500 text-white"}`}>
          <FiPlus className="inline" /> Add charging station
        </button>
      )}
      <div className="grid gap-3 overflow-y-auto p-5">
        {(chargingStationsError || isLoadingChargingStations) && (
          <p className={`rounded-xl border px-4 py-3 text-sm font-bold ${chargingStationsError ? "border-red-400/30 bg-red-500/10 text-red-100" : "border-blue-400/30 bg-blue-500/10 text-blue-100"}`}>
            {chargingStationsError || "Loading charging stations..."}
          </p>
        )}
        {(chargingSessionsError || isLoadingChargingSessions) && (
          <p className={`rounded-xl border px-4 py-3 text-sm font-bold ${chargingSessionsError ? "border-red-400/30 bg-red-500/10 text-red-100" : "border-blue-400/30 bg-blue-500/10 text-blue-100"}`}>
            {chargingSessionsError || "Loading charging sessions..."}
          </p>
        )}
        <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black text-white">Charging recommendations</p>
            </div>
            <span className="rounded-lg bg-amber-400/15 px-2 py-1 text-[10px] font-black text-amber-100">{chargingRecommendations.length}</span>
          </div>
          <div className="mt-3 grid gap-3">
            {chargingRecommendations.length === 0 && (
              <p className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-3 text-xs font-bold text-slate-300">No low-battery vehicles need charging right now.</p>
            )}
            {chargingRecommendations.map((vehicle) => {
              const draft = chargingAssignmentDraft[vehicle.id] || {};
              const compatibleStations = getCompatibleChargingStations(vehicle);
              const selectedStationId = draft.stationId || compatibleStations[0]?.id || "";
              const selectedAssigneeId = draft.assigneeId || staffMembers[0]?.id || "";
              const isAssigning = chargingAssignmentVehicleId === vehicle.id;
              const canAssign = Boolean(selectedStationId && selectedAssigneeId && !isAssigning);
              const rangeKm = Math.round(Number(vehicle.rangeKm ?? vehicle.batteryPercent * RANGE_KM_PER_BATTERY_PERCENT));

              return (
                <article key={vehicle.id} className="rounded-xl border border-white/10 bg-[#111a2b] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-white">{vehicle.brand} {vehicle.model}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-400">{vehicle.plateNumber} - {vehicle.connectorType || "Connector unknown"}</p>
                    </div>
                    <span className="rounded-lg bg-amber-400/15 px-2 py-1 text-xs font-black text-amber-100">{vehicle.batteryPercent}% · {rangeKm} km</span>
                  </div>
                  <div className="mt-3 grid gap-2">
                    <select
                      value={selectedStationId}
                      onChange={(event) => updateChargingAssignmentDraft(vehicle.id, "stationId", event.target.value)}
                      className="min-h-11 rounded-xl border border-white/10 bg-[#0f1828] px-3 py-2 text-xs font-bold text-white outline-none"
                    >
                      {compatibleStations.length === 0 && <option value="">No compatible free station</option>}
                      {compatibleStations.map((station) => (
                        <option key={station.id} value={station.id}>
                          {station.name} - {station.availablePorts}/{station.totalPorts} free
                        </option>
                      ))}
                    </select>
                    <select
                      value={selectedAssigneeId}
                      onChange={(event) => updateChargingAssignmentDraft(vehicle.id, "assigneeId", event.target.value)}
                      className="min-h-11 rounded-xl border border-white/10 bg-[#0f1828] px-3 py-2 text-xs font-bold text-white outline-none"
                    >
                      {staffMembers.length === 0 && <option value="">No active staff</option>}
                      {staffMembers.map((member) => {
                        const taskCount = activeStaffTaskCounts[member.id] || 0;
                        return (
                          <option key={member.id} value={member.id}>
                            {member.name} - {taskCount} active tasks
                          </option>
                        );
                      })}
                    </select>
                    <button
                      type="button"
                      onClick={() => assignChargingRecommendation(vehicle)}
                      disabled={!canAssign}
                      className="min-h-11 rounded-xl bg-red-500 px-3 py-3 text-xs font-black text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                    >
                      {isAssigning ? "Assigning..." : "Assign charging task"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
        {activeChargingSessions.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <p className="text-sm font-black text-white">Active charging sessions</p>
            <div className="mt-3 grid gap-2">
              {activeChargingSessions.map((session) => {
                const vehicle = backendVehicles.find((item) => item.id === session.vehicleId);
                const station = managedChargingStations.find((item) => item.id === session.chargingStationId);
                const assignee = staffMembers.find((item) => item.id === session.assignedStaffId);
                const task = staffTasks.find((item) => item.id === session.staffTaskId);
                const selectedAssigneeId = task?.assigneeId || session.assignedStaffId || "";
                const selectedAssigneeIsActive = staffMembers.some((item) => item.id === selectedAssigneeId);
                const progress = getChargingSessionProgress(session, task);
                const canComplete = progress.currentBatteryPercent >= MIN_CHARGING_COMPLETION_PERCENT;

                return (
                  <div key={session.id} className="rounded-xl bg-white/[0.04] p-3">
                    <p className="truncate text-xs font-black text-white">{vehicle ? `${vehicle.brand} ${vehicle.model}` : "Vehicle"} - {progress.currentBatteryPercent}% · {progress.currentRangeKm} km / {session.targetBatteryPercent}%</p>
                    <p className="mt-1 text-[11px] font-semibold text-slate-400">
                      {station?.name || "Station"} - {assignee?.name || "Inactive or removed staff"}
                    </p>
                    <p className="mt-1 text-[11px] font-black text-emerald-200">
                      {progress.currentBatteryPercent >= 100 ? "Fully charged" : `${progress.minutesRemaining} min to full`}
                      {task ? ` - ${STAFF_TASK_STATUS_LABELS[task.status] || "Task active"}` : ""}
                    </p>
                    <label className="mt-3 grid gap-1">
                      <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">Assignee</span>
                      <select
                        value={selectedAssigneeId}
                        onChange={(event) => reassignStaffTask(session.staffTaskId, event.target.value, "chargers")}
                        className="min-h-9 rounded-lg border border-white/10 bg-[#0f1828] px-3 py-2 text-[11px] font-bold text-white outline-none"
                      >
                        {!selectedAssigneeIsActive && selectedAssigneeId && (
                          <option value={selectedAssigneeId}>
                            Inactive or removed staff - reassign
                          </option>
                        )}
                        {staffMembers.length === 0 && <option value="">No active staff</option>}
                        {staffMembers.map((member) => {
                          const taskCount = activeStaffTaskCounts[member.id] || 0;
                          return (
                            <option key={member.id} value={member.id}>
                              {member.name} - {taskCount} active tasks
                            </option>
                          );
                        })}
                      </select>
                    </label>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => completeChargingSession(session)}
                        disabled={!canComplete}
                        className="inline-flex min-h-9 w-full items-center justify-center rounded-lg bg-emerald-500 px-3 py-2 text-[10px] font-black text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                      >
                        Complete session
                      </button>
                      <button
                        type="button"
                        onClick={() => completeAndActivateChargingSession(session)}
                        disabled={!canComplete}
                        className="inline-flex min-h-9 w-full items-center justify-center rounded-lg bg-red-500 px-3 py-2 text-[10px] font-black text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                      >
                        Complete & activate
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {readyChargingVehicles.length > 0 && (
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
            <p className="text-sm font-black text-white">Ready to activate</p>
            <div className="mt-3 grid gap-2">
              {readyChargingVehicles.map((vehicle) => {
                const rangeKm = Math.round(Number(vehicle.rangeKm ?? vehicle.batteryPercent * RANGE_KM_PER_BATTERY_PERCENT));

                return (
                <div key={vehicle.id} className="rounded-xl bg-white/[0.04] p-3">
                  <p className="truncate text-xs font-black text-white">{vehicle.brand} {vehicle.model} - {vehicle.batteryPercent}% · {rangeKm} km</p>
                  <p className="mt-1 text-[11px] font-semibold text-slate-400">{vehicle.plateNumber} - charging complete</p>
                  <button
                    type="button"
                    onClick={() => activateReadyVehicle(vehicle)}
                    className="mt-3 inline-flex min-h-9 w-full items-center justify-center rounded-lg bg-red-500 px-3 py-2 text-[10px] font-black text-white transition hover:bg-red-600"
                  >
                    Activate vehicle
                  </button>
                </div>
                );
              })}
            </div>
          </div>
        )}
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-black text-white">New charging station</p><span className="rounded-lg bg-white/[0.06] px-2 py-1 text-[10px] font-black text-slate-300">{chargingDraft.pickOnMap ? "Click on the map" : "Form"}</span></div><div className="mt-3 grid gap-2"><input value={chargingDraft.name} onChange={(event) => updateChargingDraft("name", event.target.value)} placeholder="Station name" className="rounded-xl border border-white/10 bg-[#111a2b] px-3 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-500" /><input value={chargingDraft.address} onChange={(event) => updateChargingDraft("address", event.target.value)} placeholder="Address" className="rounded-xl border border-white/10 bg-[#111a2b] px-3 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-500" /><div className="grid grid-cols-2 gap-2"><input value={chargingDraft.lat} onChange={(event) => updateChargingDraft("lat", event.target.value)} placeholder="Lat or click map" className="rounded-xl border border-white/10 bg-[#111a2b] px-3 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-500" /><input value={chargingDraft.lng} onChange={(event) => updateChargingDraft("lng", event.target.value)} placeholder="Lng or click map" className="rounded-xl border border-white/10 bg-[#111a2b] px-3 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-500" /></div><div className="grid grid-cols-2 gap-2"><select value={chargingDraft.chargerType} onChange={(event) => updateChargingDraft("chargerType", event.target.value)} className="rounded-xl border border-white/10 bg-[#111a2b] px-3 py-3 text-sm font-bold text-white outline-none"><option value="CCS2">CCS2 fast</option><option value="Type2">Type2 city</option><option value="CHAdeMO">CHAdeMO</option></select><select value={chargingDraft.status} onChange={(event) => updateChargingDraft("status", event.target.value)} className="rounded-xl border border-white/10 bg-[#111a2b] px-3 py-3 text-sm font-bold text-white outline-none"><option value={CHARGING_STATION_STATUSES.ONLINE}>Online</option><option value={CHARGING_STATION_STATUSES.BUSY}>Busy</option><option value={CHARGING_STATION_STATUSES.MAINTENANCE}>Maintenance</option><option value={CHARGING_STATION_STATUSES.OFFLINE}>Offline</option></select></div><label className="grid gap-1"><span className="text-[10px] font-black uppercase tracking-wide text-slate-500">Port count</span><select value={chargingDraft.ports} onChange={(event) => updateChargingDraft("ports", Number(event.target.value))} className="rounded-xl border border-white/10 bg-[#111a2b] px-3 py-3 text-sm font-bold text-white outline-none">{CHARGING_PORT_OPTIONS.map((ports) => (<option key={ports} value={ports}>{ports}</option>))}</select></label><button type="button" onClick={saveChargingPoint} className="rounded-xl bg-red-500 px-3 py-3 text-sm font-black text-white">Save charging station</button></div></div>
        {managedChargingStations.map((station) => {
          const meta = STATION_STATUS_META[station.status] || STATION_STATUS_META[CHARGING_STATION_STATUSES.ONLINE];

          return (
            <div key={station.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <button
                type="button"
                onClick={() => openChargingStationDetails(station)}
                className="flex w-full items-start justify-between gap-3 text-left"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-white">{station.name}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-400">
                    {station.location.label} - {station.location.zone}
                  </p>
                </div>
                <span className="rounded-xl px-2 py-1 text-[10px] font-black text-white" style={{ backgroundColor: meta.color }}>
                  {meta.label}
                </span>
              </button>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-white/[0.05] p-2">
                  <p className="text-[10px] font-black text-slate-500">Free</p>
                  <p className="font-black text-white">{station.availablePorts} / {station.totalPorts}</p>
                </div>
                <div className="rounded-xl bg-white/[0.05] p-2">
                  <p className="text-[10px] font-black text-slate-500">Power</p>
                  <p className="font-black text-white">{station.powerKw} kW</p>
                </div>
                <div className="rounded-xl bg-white/[0.05] p-2">
                  <p className="text-[10px] font-black text-slate-500">Types</p>
                  <p className="truncate font-black text-white">{station.connectorTypes.join(", ")}</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => openChargingStationDetails(station)}
                  className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-[10px] font-black text-slate-200 transition hover:bg-white/[0.1]"
                >
                  Details
                </button>
                <button
                  type="button"
                  onClick={() => deleteChargingPoint(station)}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-[10px] font-black text-red-100 transition hover:bg-red-500 hover:text-white"
                >
                  <FiTrash2 />
                  Delete station
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );

  const renderServicePointsPanel = () => (
    <>
      {renderPanelHeader(
        "Service Points",
        "Карта сервисов",
        <button
          type="button"
          onClick={() => updateServicePointDraft("pickOnMap", !servicePointDraft.pickOnMap)}
          className={`rounded-xl px-3 py-2 text-xs font-black ${servicePointDraft.pickOnMap ? "bg-emerald-500 text-white" : "bg-red-500 text-white"}`}
        >
          <FiPlus className="inline" /> Добавить сервис
        </button>
      )}
      <div className="grid gap-3 overflow-y-auto p-5">
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-xs font-semibold leading-5 text-slate-300">
          Здесь отображаются сервисные точки: гаражи, диагностические боксы и места обслуживания автопарка. Точку можно добавить вручную или выбрать координаты кликом по карте.
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-black text-white">Новая сервисная точка</p>
            <span className="rounded-lg bg-white/[0.06] px-2 py-1 text-[10px] font-black text-slate-300">
              {servicePointDraft.pickOnMap ? "Кликните по карте" : "Форма"}
            </span>
          </div>
          <div className="mt-3 grid gap-2">
            <input
              value={servicePointDraft.name}
              onChange={(event) => updateServicePointDraft("name", event.target.value)}
              placeholder="Название сервиса"
              className="rounded-xl border border-white/10 bg-[#111a2b] px-3 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-500"
            />
            <input
              value={servicePointDraft.address}
              onChange={(event) => updateServicePointDraft("address", event.target.value)}
              placeholder="Адрес"
              className="rounded-xl border border-white/10 bg-[#111a2b] px-3 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-500"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                value={servicePointDraft.lat}
                onChange={(event) => updateServicePointDraft("lat", event.target.value)}
                placeholder="Lat или клик по карте"
                className="rounded-xl border border-white/10 bg-[#111a2b] px-3 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-500"
              />
              <input
                value={servicePointDraft.lng}
                onChange={(event) => updateServicePointDraft("lng", event.target.value)}
                placeholder="Lng или клик по карте"
                className="rounded-xl border border-white/10 bg-[#111a2b] px-3 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-500"
              />
            </div>
            <button type="button" onClick={saveServicePoint} className="rounded-xl bg-red-500 px-3 py-3 text-sm font-black text-white">
              Сохранить сервис
            </button>
          </div>
        </div>
        {managedServicePoints.map((point) => (
          <button
            key={point.id}
            type="button"
            onClick={() =>
              setFocusTarget({
                id: point.id,
                lat: point.location.lat,
                lng: point.location.lng,
              })
            }
            className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-left transition hover:bg-white/[0.07]"
          >
            <span className="flex items-start justify-between gap-3">
              <span>
                <span className="block text-sm font-black text-white">{point.name}</span>
                <span className="mt-1 block text-xs font-semibold text-slate-400">
                  {point.location.label} · {point.location.zone}
                </span>
              </span>
              <span className="rounded-xl bg-cyan-500/15 px-2 py-1 text-[10px] font-black text-cyan-200">
                Service
              </span>
            </span>
          </button>
        ))}
      </div>
    </>
  );

  const renderHelpdeskPanel = () => {
    const ticketStatusMeta = {
      [SUPPORT_TICKET_STATUSES.Open]: { label: "Active", className: "bg-emerald-500/15 text-emerald-200" },
      [SUPPORT_TICKET_STATUSES.WaitingForStaff]: { label: "Waiting staff", className: "bg-amber-500/15 text-amber-200" },
      [SUPPORT_TICKET_STATUSES.WaitingForRider]: { label: "Waiting rider", className: "bg-blue-500/15 text-blue-200" },
      [SUPPORT_TICKET_STATUSES.EscalatedToAdmin]: { label: "Admin review", className: "bg-red-500/15 text-red-200" },
      [SUPPORT_TICKET_STATUSES.Resolved]: { label: "Resolved", className: "bg-slate-500/20 text-slate-300" },
      [SUPPORT_TICKET_STATUSES.Closed]: { label: "Closed", className: "bg-slate-500/20 text-slate-300" },
    };
    const statusFilters = [
      ["all", "All"],
      [SUPPORT_TICKET_STATUSES.WaitingForStaff, "Waiting"],
      [SUPPORT_TICKET_STATUSES.EscalatedToAdmin, "Admin"],
      [SUPPORT_TICKET_STATUSES.Closed, "Closed"],
    ];
    const staffUsers = backendUsers.filter((user) => user.role === USER_ROLES.Staff && user.isActive);
    const activeTicketAssigneeDraft = activeTicket
      ? ticketAssigneeDrafts[activeTicket.id] ?? activeTicket.assignedStaffId ?? ""
      : "";
    const canAssignActiveTicket = Boolean(
      activeTicket &&
      activeTicketAssigneeDraft &&
      activeTicketAssigneeDraft !== (activeTicket.assignedStaffId || "")
    );
    const sortedTickets = [...tickets]
      .filter((ticket) => {
        const searchable = [
          ticket.subject,
          SUPPORT_STATUS_LABELS[ticket.status],
          ticket.riderName,
          ticket.riderEmail,
          ticket.assignedStaffName,
          ...ticket.messages.map((message) => message.body),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        const matchesSearch = !ticketSearchQuery.trim() || searchable.includes(ticketSearchQuery.trim().toLowerCase());
        const matchesStatus = ticketStatusFilter === "all" || Number(ticketStatusFilter) === ticket.status;

        return matchesSearch && matchesStatus;
      })
      .sort((first, second) => new Date(second.lastMessageAt || 0) - new Date(first.lastMessageAt || 0));

    return (
    <>
      {renderPanelHeader("Helpdesk", "Support chats")}
      <div className="grid min-h-0 flex-1 gap-0 overflow-hidden p-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="min-h-0 overflow-y-auto rounded-l-2xl border border-white/10 bg-white/[0.035]">
          <div className="border-b border-white/10 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-white">Conversations</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">Sorted by latest activity</p>
              </div>
              <button type="button" onClick={() => loadSupportTickets()} className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-black text-slate-200">
                Refresh
              </button>
            </div>
            <label className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-[#111a2b] px-3 py-2 text-sm text-slate-400">
              <FiSearch className="shrink-0 text-slate-500" />
              <input
                value={ticketSearchQuery}
                onChange={(event) => setTicketSearchQuery(event.target.value)}
                placeholder="Search chats"
                className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none placeholder:text-slate-500"
              />
            </label>
            <div className="mt-3 grid grid-cols-4 gap-1">
              {statusFilters.map(([status, label]) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setTicketStatusFilter(status)}
                  className={`rounded-lg px-2 py-2 text-[10px] font-black ${
                    String(ticketStatusFilter) === String(status) ? "bg-red-500 text-white" : "bg-white/[0.06] text-slate-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {(ticketsError || isLoadingTickets) && (
              <p className={`mt-3 rounded-xl border px-3 py-2 text-xs font-bold ${ticketsError ? "border-red-400/30 bg-red-500/10 text-red-100" : "border-blue-400/30 bg-blue-500/10 text-blue-100"}`}>
                {ticketsError || "Loading support tickets..."}
              </p>
            )}
          </div>
          {sortedTickets.map((ticket) => {
            const active = activeTicketId === ticket.id;
            const lastMessage = ticket.messages[ticket.messages.length - 1];
            const status = ticketStatusMeta[ticket.status] || ticketStatusMeta[SUPPORT_TICKET_STATUSES.Open];

            return (
              <button
                key={ticket.id}
                type="button"
                onClick={() => setActiveTicketId(ticket.id)}
                className={`w-full border-b border-white/10 p-4 text-left transition last:border-b-0 ${active ? "bg-red-500/15" : "hover:bg-white/[0.06]"}`}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black text-white">{ticket.subject}</span>
                    <span className="mt-1 block truncate text-xs font-semibold text-slate-400">
                      {ticket.riderName} - {ticket.riderEmail || "no email"}
                    </span>
                  </span>
                  <span className={`rounded-lg px-2 py-1 text-[10px] font-black ${status.className}`}>
                    {status.label}
                  </span>
                </span>
                <span className="mt-3 block truncate text-xs font-semibold text-slate-500">{lastMessage?.body}</span>
              </button>
            );
          })}
          {!sortedTickets.length && (
            <div className="p-5 text-sm font-bold text-slate-500">No support chats match this view.</div>
          )}
        </div>

        <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] rounded-r-2xl border border-l-0 border-white/10 bg-white/[0.025]">
          <div className="border-b border-white/10 p-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p className="text-sm font-black text-white">{activeTicket?.subject || "Select a support chat"}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {activeTicket ? `${activeTicket.riderName} - ${activeTicket.assignedStaffName || "unassigned"}` : "Rider, staff assignment, and admin actions appear here."}
                </p>
              </div>
              {activeTicket && (
                <div className="flex flex-wrap gap-2">
                  <select
                    value={activeTicketAssigneeDraft}
                    onChange={(event) => {
                      const staffId = event.target.value;
                      setTicketAssigneeDrafts((items) => ({
                        ...items,
                        [activeTicket.id]: staffId,
                      }));
                    }}
                    className="rounded-xl border border-white/10 bg-[#111a2b] px-3 py-2 text-xs font-black text-white outline-none"
                  >
                    <option value="">Assign staff</option>
                    {staffUsers.map((staff) => (
                      <option key={staff.id} value={staff.id}>{`${staff.firstName} ${staff.lastName}`.trim() || staff.email}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => assignTicketToStaff(activeTicketAssigneeDraft)}
                    disabled={!canAssignActiveTicket}
                    className="rounded-xl bg-white/[0.08] px-3 py-2 text-xs font-black text-slate-200 transition hover:bg-white/[0.14] disabled:cursor-not-allowed disabled:bg-white/[0.03] disabled:text-slate-600"
                  >
                    Assign
                  </button>
                  <select
                    value={activeTicket.priority}
                    onChange={(event) => updateTicketPriority(event.target.value)}
                    className="rounded-xl border border-white/10 bg-[#111a2b] px-3 py-2 text-xs font-black text-white outline-none"
                  >
                    {Object.entries(SUPPORT_PRIORITY_LABELS).map(([priority, label]) => (
                      <option key={priority} value={priority}>{label}</option>
                    ))}
                  </select>
                  <button type="button" onClick={closeActiveTicket} className="rounded-xl bg-red-500/15 px-3 py-2 text-xs font-black text-red-200">
                    {activeTicket.status === SUPPORT_TICKET_STATUSES.Closed ? "Reopen" : "Close"}
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="min-h-0 overflow-y-auto p-4">
            {activeTicket?.messages.map((message) => {
              const fromRider = message.senderType === SUPPORT_MESSAGE_SENDER_TYPES.Rider;
              const fromSystem = message.senderType === SUPPORT_MESSAGE_SENDER_TYPES.System;

              return (
                <article
                  key={message.id}
                  className={`mb-3 max-w-[78%] rounded-2xl px-4 py-3 ${fromRider ? "bg-white/[0.06]" : fromSystem ? "mx-auto bg-blue-500/10" : "ml-auto bg-red-500/15"}`}
                >
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-red-200">
                    {message.isInternalNote ? "Internal note - " : ""}{message.senderName}
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-5 text-slate-200">{message.body}</p>
                </article>
              );
            })}
          </div>
          <div className="border-t border-white/10 p-4">
            <div className="flex gap-2">
              <input
                value={chatDraft}
                onChange={(event) => setChatDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendChatMessage();
                  }
                }}
                placeholder="Reply to rider"
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#111a2b] px-3 py-3 text-sm font-bold text-white outline-none"
              />
              <button type="button" onClick={sendChatMessage} disabled={!chatDraft.trim() || !activeTicket} className="rounded-xl bg-red-500 px-4 text-white disabled:bg-slate-700"><FiSend /></button>
            </div>
          </div>
        </div>
      </div>
    </>
    );
  };
  const renderAnalyticsPanel = () => {
    const plannedMaintenanceVehicles = plannedMaintenance
      .map((vehicleId) => getVehicle(vehicleId))
      .filter(Boolean);
    const maintenanceStatusMeta = {
      healthy: { label: "Исправен", color: "bg-emerald-500", row: "border-emerald-400/25 bg-emerald-500/10" },
      in_service: { label: "На ТО", color: "bg-blue-500", row: "border-blue-400/25 bg-blue-500/10" },
      needs_service: { label: "Требует ТО", color: "bg-amber-600", row: "border-amber-500/30 bg-amber-600/10" },
    };
    const filteredMaintenanceRows = maintenanceSeed.filter((row) =>
      maintenanceFilter === "all" ? true : row.maintenanceStatus === maintenanceFilter
    );

    return (
    <>
      {renderPanelHeader(
        "Resource Analytics",
        "ТО и эффективность",
        plannedMaintenanceVehicles.length > 0 ? (
          <div className="max-w-[210px] text-right">
            <p className="text-[10px] font-black uppercase text-slate-500">Запланировано</p>
            <div className="mt-2 flex flex-wrap justify-end gap-1.5">
              {plannedMaintenanceVehicles.map((vehicle) => (
                <span
                  key={vehicle.id}
                  className="rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-2 py-1 text-[10px] font-black text-emerald-200"
                >
                  {vehicle.brand} {vehicle.model}
                </span>
              ))}
            </div>
          </div>
        ) : null
      )}
      <div className="grid gap-3 overflow-y-auto p-5">
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-xs font-semibold leading-5 text-slate-300">
          Этот блок показывает, какие машины скоро уйдут на обслуживание, где падает battery health, какие авто много расходуют и какие реально окупаются.
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <p className="text-sm font-black text-white">Легенда цветов машин</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(maintenanceStatusMeta).map(([status, meta]) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setMaintenanceFilter(status)}
                  className={`rounded-xl border px-3 py-2 text-xs font-black ${maintenanceFilter === status ? "border-red-400 bg-red-500/15 text-white" : "border-white/10 bg-white/[0.04] text-slate-300"}`}
                >
                  <span className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${meta.color}`} />
                  {meta.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setMaintenanceFilter("all")}
                className={`rounded-xl border px-3 py-2 text-xs font-black ${maintenanceFilter === "all" ? "border-red-400 bg-red-500/15 text-white" : "border-white/10 bg-white/[0.04] text-slate-300"}`}
              >
                Все
              </button>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <p className="text-[10px] font-black uppercase text-slate-500">В фильтре</p>
            <p className="mt-2 text-2xl font-black text-white">{filteredMaintenanceRows.length}</p>
          </div>
        </div>
        {plannedMaintenanceVehicles.length > 0 && (
          <div className="grid gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-4">
            <p className="text-xs font-black uppercase text-emerald-200">Запланированные ТО</p>
            {plannedMaintenanceVehicles.map((vehicle) => (
              <div key={vehicle.id} className="flex items-center justify-between gap-3 text-xs font-bold text-slate-200">
                <span>{vehicle.brand} {vehicle.model}</span>
                <span className="shrink-0 text-slate-400">{vehicle.plateNumber}</span>
              </div>
            ))}
          </div>
        )}
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-white/[0.04] text-[10px] font-black uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Машина</th>
                  <th className="px-4 py-3">Статус</th>
                  <th className="px-4 py-3">Последнее ТО</th>
                  <th className="px-4 py-3">Следующее ТО</th>
                  <th className="px-4 py-3">Пробег</th>
                  <th className="px-4 py-3">SOH</th>
                  <th className="px-4 py-3">Действие</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredMaintenanceRows.map((row) => {
                  const vehicle = getVehicle(row.vehicleId);
                  const meta = maintenanceStatusMeta[row.maintenanceStatus] || maintenanceStatusMeta.healthy;

                  return (
                    <tr key={row.vehicleId} className={meta.row}>
                      <td className="px-4 py-3">
                        <p className="font-black text-white">{vehicle?.brand} {vehicle?.model}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">{vehicle?.plateNumber}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full bg-white/[0.08] px-3 py-1 text-xs font-black text-slate-200">
                          <span className={`mr-2 h-2.5 w-2.5 rounded-full ${meta.color}`} />
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-300">{row.lastService}</td>
                      <td className="px-4 py-3 font-semibold text-slate-300">{row.nextService}</td>
                      <td className="px-4 py-3 font-black text-white">{row.odometerKm.toLocaleString("ru-RU")} км</td>
                      <td className="px-4 py-3 font-black text-emerald-200">{row.batteryHealth}%</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => {
                            setPlannedMaintenance((items) =>
                              items.includes(row.vehicleId) ? items : [...items, row.vehicleId]
                            );
                            showAdminNotice(`ТО запланировано: ${vehicle?.brand} ${vehicle?.model}`);
                          }}
                          className={`rounded-xl px-3 py-2 text-xs font-black ${
                            plannedMaintenance.includes(row.vehicleId)
                              ? "bg-emerald-500/15 text-emerald-200"
                              : "bg-white/[0.06] text-slate-200"
                          }`}
                        >
                          {plannedMaintenance.includes(row.vehicleId) ? "ТО запланировано" : "Запланировать ТО"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div className="grid gap-3 xl:grid-cols-2">
        {filteredMaintenanceRows.map((row) => {
          const vehicle = getVehicle(row.vehicleId);
          const risk = row.serviceInKm < 500 || row.batteryHealth < 85;
          return (
            <div key={row.vehicleId} className={`rounded-2xl border p-4 ${risk ? "border-amber-400/35 bg-amber-500/10" : "border-white/10 bg-white/[0.035]"}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-white">{vehicle?.brand} {vehicle?.model}</p>
                  <p className="text-xs font-bold text-slate-500">{vehicle?.plateNumber}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPlannedMaintenance((items) =>
                      items.includes(row.vehicleId) ? items : [...items, row.vehicleId]
                    );
                    showAdminNotice(`ТО запланировано: ${vehicle?.brand} ${vehicle?.model}`);
                  }}
                  className={`rounded-xl px-3 py-2 text-xs font-black ${
                    plannedMaintenance.includes(row.vehicleId)
                      ? "bg-emerald-500/15 text-emerald-200"
                      : "bg-white/[0.06] text-slate-200"
                  }`}
                >
                  {plannedMaintenance.includes(row.vehicleId) ? "ТО запланировано" : "Запланировать ТО"}
                </button>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2">
                <div className="rounded-xl bg-white/[0.05] p-2"><p className="text-[10px] font-black text-slate-500">Service</p><p className="font-black">{row.serviceInKm} км</p></div>
                <div className="rounded-xl bg-white/[0.05] p-2"><p className="text-[10px] font-black text-slate-500">SOH</p><p className="font-black">{row.batteryHealth}%</p></div>
                <div className="rounded-xl bg-white/[0.05] p-2"><p className="text-[10px] font-black text-slate-500">kWh</p><p className="font-black">{row.consumption}</p></div>
                <div className="rounded-xl bg-white/[0.05] p-2"><p className="text-[10px] font-black text-slate-500">Profit</p><p className="font-black">{row.profitability}%</p></div>
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </>
    );
  };

  const renderRightPanel = () => {
    const panels = {
      control: renderControlPanelV2,
      __legacy_control: renderControlPanel,
      users: renderUsersKycPanel,
      pricing: renderPricingPanel,
      billing: renderBillingPanel,
      kpi: renderStaffWorkPanel,
      __legacy_kpi: renderKpiPanel,
      __legacy_kpi_v2: renderKpiPanelV2,
      incidents: renderIncidentPanel,
      tasks: renderTasksPanel,
      chargers: renderChargersPanel,
      "service-points": renderServicePointsPanel,
      helpdesk: renderHelpdeskPanel,
      analytics: renderAnalyticsPanel,
      superadmin: renderSuperAdminPanel,
    };

    const Panel = panels[activeSection] || renderControlPanel;
    return Panel();
  };

  const isChargingMap = activeSection === "chargers";
  const isServicePointsMap = activeSection === "service-points";
  const isZoneMap = activeSection === "control" || activeSection === "__legacy_geofence";
  const isOperationsMap = isChargingMap || isServicePointsMap;
  const mapSummaryCards = isChargingMap
    ? [["Stations", managedChargingStations.length, FiZap, "text-cyan-200"], ["Online", stationStats.onlineStations, FiActivity, "text-emerald-200"], ["Ports", `${stationStats.availablePorts}/${stationStats.totalPorts}`, FiMap, "text-blue-200"], ["Max kW", stationStats.maxPower, FiTool, "text-amber-200"]]
    : isServicePointsMap
      ? [["Service points", managedServicePoints.length, FiTool, "text-cyan-200"], ["Active", managedServicePoints.length, FiActivity, "text-emerald-200"], ["Map", "Service", FiMap, "text-blue-200"], ["Tasks", serviceTasks.length, FiShield, "text-amber-200"]]
      : [["Online", fleetStats.total || liveVehiclesWithChargingProgress.length, FiZap, "text-cyan-200"], ["Available", fleetStats.available, FiMap, "text-emerald-200"], ["In use", fleetStats.activeTrips, FiNavigation, "text-blue-200"], ["Need charge", fleetStats.low_charge, FiActivity, "text-amber-200"]];
  const isFullWidthPanel =
    activeSection === "users" ||
    activeSection === "billing" ||
    activeSection === "kpi" ||
    activeSection === "helpdesk" ||
    activeSection === "analytics" ||
    activeSection === "superadmin";

  if (!adminSession) {
    return <AdminLogin onLogin={setAdminSession} />;
  }

  return (
    <main className="h-screen min-h-screen overflow-hidden bg-[#08111f] text-slate-100">
      <style>
        {`
          .admin-map .leaflet-container {
            background: #08111f;
            font-family: inherit;
          }

          .admin-map,
          .admin-map .leaflet-container,
          .admin-map .leaflet-pane,
          .admin-map .leaflet-map-pane {
            height: 100%;
            width: 100%;
          }

          .admin-map .leaflet-control-attribution {
            background: rgba(8, 17, 31, 0.72);
            color: rgba(226, 232, 240, 0.62);
            font-size: 10px;
          }

          .admin-map .leaflet-control-attribution a {
            color: rgba(125, 211, 252, 0.8);
          }

          .admin-map .leaflet-marker-pane {
            pointer-events: auto !important;
            z-index: 820 !important;
          }

          .admin-map .leaflet-popup-pane {
            pointer-events: auto !important;
            z-index: 900 !important;
          }

          .admin-car-marker {
            background: transparent;
            border: 0;
            pointer-events: auto;
          }

          .leaflet-marker-icon.admin-car-marker,
          .leaflet-marker-icon.admin-station-marker,
          .leaflet-marker-icon.admin-service-point-marker {
            cursor: pointer;
            pointer-events: auto !important;
          }

          .admin-tech-marker {
            background: transparent;
            border: 0;
          }

          .admin-station-marker {
            background: transparent;
            border: 0;
          }

          .admin-service-point-marker {
            background: transparent;
            border: 0;
          }

          .admin-station-marker__core {
            align-items: center;
            background: rgba(8, 17, 31, 0.94);
            border: 2px solid var(--station);
            border-radius: 16px 16px 16px 4px;
            box-shadow: 0 0 24px color-mix(in srgb, var(--station) 42%, transparent), 0 12px 26px rgba(0, 0, 0, 0.4);
            color: #ffffff;
            display: grid;
            height: 48px;
            justify-items: center;
            padding: 5px;
            position: relative;
            transform: rotate(-45deg);
            width: 48px;
          }

          .admin-station-marker__core span,
          .admin-station-marker__core b {
            transform: rotate(45deg);
          }

          .admin-station-marker__core span {
            color: var(--station);
            font-size: 18px;
            font-weight: 900;
            line-height: 1;
          }

          .admin-station-marker__core b {
            color: #e2e8f0;
            font-size: 9px;
            font-weight: 900;
            line-height: 1;
          }

          .admin-service-point-marker__core {
            align-items: center;
            background: rgba(8, 17, 31, 0.94);
            border: 2px solid #22d3ee;
            border-radius: 16px 16px 16px 4px;
            box-shadow: 0 0 24px rgba(34, 211, 238, 0.38), 0 12px 26px rgba(0, 0, 0, 0.4);
            color: #ffffff;
            display: grid;
            height: 48px;
            justify-items: center;
            padding: 5px;
            position: relative;
            transform: rotate(-45deg);
            width: 48px;
          }

          .admin-service-point-marker__core span,
          .admin-service-point-marker__core b {
            transform: rotate(45deg);
          }

          .admin-service-point-marker__core span {
            color: #67e8f9;
            font-size: 18px;
            font-weight: 900;
            line-height: 1;
          }

          .admin-service-point-marker__core b {
            color: #e2e8f0;
            font-size: 9px;
            font-weight: 900;
            line-height: 1;
          }

          .admin-tech-marker__core {
            align-items: center;
            background: rgba(15, 23, 42, 0.95);
            border: 2px solid #38bdf8;
            border-radius: 999px;
            box-shadow: 0 0 22px rgba(56, 189, 248, 0.35);
            color: #fff;
            display: grid;
            height: 54px;
            justify-items: center;
            padding: 7px;
            width: 54px;
          }

          .admin-tech-marker__core span {
            font-size: 9px;
            font-weight: 900;
            letter-spacing: 0.02em;
            line-height: 1;
          }

          .admin-tech-marker__core b {
            color: #7dd3fc;
            font-size: 8px;
            line-height: 1;
            text-transform: uppercase;
          }

          .admin-car-marker__wrap {
            align-items: center;
            cursor: pointer;
            display: flex;
            height: 74px;
            justify-content: center;
            pointer-events: auto;
            position: relative;
            width: 74px;
          }

          .admin-car-marker__pulse {
            animation: adminPulse 1.9s ease-out infinite;
            background: var(--status);
            border-radius: 999px;
            filter: blur(0.2px);
            height: 58px;
            opacity: 0.34;
            position: absolute;
            width: 58px;
            pointer-events: none;
          }

          .admin-car-marker__core {
            align-items: center;
            background: rgba(8, 17, 31, 0.92);
            border: 2px solid var(--status);
            border-radius: 18px;
            box-shadow: 0 0 24px color-mix(in srgb, var(--status) 42%, transparent), 0 18px 32px rgba(0, 0, 0, 0.42);
            display: grid;
            height: 54px;
            justify-items: center;
            overflow: hidden;
            padding: 5px;
            position: relative;
            width: 62px;
            z-index: 1;
            pointer-events: auto;
          }

          .admin-car-marker__core img {
            height: 28px;
            object-fit: contain;
            width: 50px;
          }

          .admin-car-marker__core b {
            color: #ffffff;
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            font-size: 9px;
            line-height: 1;
            margin-top: 1px;
          }

          .admin-car-marker__wrap.is-selected .admin-car-marker__core {
            transform: scale(1.12);
          }

          .admin-control-grid {
            background-image:
              linear-gradient(rgba(148, 163, 184, 0.08) 1px, transparent 1px),
              linear-gradient(90deg, rgba(148, 163, 184, 0.08) 1px, transparent 1px);
            background-size: 42px 42px;
          }

          @keyframes adminPulse {
            0% {
              opacity: 0.38;
              transform: scale(0.72);
            }
            78% {
              opacity: 0;
              transform: scale(1.62);
            }
            100% {
              opacity: 0;
              transform: scale(1.62);
            }
          }

          @keyframes warningBlink {
            0%, 100% { opacity: 0.28; }
            50% { opacity: 0.72; }
          }
        `}
      </style>

      <div className="grid h-screen min-h-0 lg:grid-cols-[84px_minmax(0,1fr)]">
        <aside className="hidden h-screen border-r border-white/10 bg-[#0b1424]/95 px-3 py-5 lg:block">
          <a href="/" className="mb-8 flex h-12 w-12 items-center justify-center rounded-xl bg-white text-[#08111f]">
            <FaCarSide className="text-xl" />
          </a>

          <nav className="grid gap-3">
            {visibleSidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    setActiveSection(item.id);
                    setStatusFilter(item.filter);
                    setSearchQuery("");
                    if (item.id === "tasks" || item.id === "chargers") {
                      setFocusTarget({
                        id: `${item.id}-baku`,
                        lat: BAKU_CENTER[0],
                        lng: BAKU_CENTER[1],
                      });
                    }
                  }}
                  className={`group flex h-12 w-12 items-center justify-center rounded-xl border text-lg transition ${
                    isActive
                      ? "border-red-400/60 bg-red-500 text-white shadow-lg shadow-red-500/20"
                      : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-white"
                  }`}
                  title={item.label}
                >
                  <Icon />
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="flex h-screen min-h-0 min-w-0 flex-col">
          <header className="z-[600] shrink-0 border-b border-white/10 bg-[#08111f]/92 px-4 py-4 backdrop-blur-xl lg:px-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 lg:hidden"
                  aria-label="Open admin menu"
                >
                  <FiMenu />
                </button>
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-red-300">ElectroStreet Admin</p>
                  <h1 className="truncate text-xl font-black tracking-tight text-white sm:text-2xl">
                    Situation Center
                  </h1>
                </div>
              </div>

              <div className="flex flex-1 items-center justify-end gap-3">
                <div className="hidden items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 md:flex">
                  <span className="rounded-lg bg-red-500 px-3 py-2 text-xs font-black text-white">
                    {currentAdminProfile.roleLabel}
                  </span>
                  <button
                    type="button"
                    onClick={handleAdminLogout}
                    className="rounded-lg px-3 py-2 text-xs font-black text-slate-400 transition hover:text-white"
                  >
                    Sign out</button>
                </div>
                <label className="hidden min-w-[280px] items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-400 md:flex">
                  <FiSearch className="text-slate-500" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search by plate, vehicle, zone"
                    className="w-full bg-transparent font-semibold outline-none placeholder:text-slate-500"
                  />
                </label>
                {searchQuery.trim() && (
                  <div className="absolute right-[204px] top-[72px] z-[900] hidden w-[330px] overflow-hidden rounded-xl border border-white/10 bg-[#111a2b] shadow-2xl shadow-black/30 md:block">
                    {searchResults.length ? (
                      searchResults.map((vehicle) => (
                        <button
                          key={vehicle.id}
                          type="button"
                          onClick={() => {
                            focusVehicle(vehicle.id);
                            setSearchQuery(`${vehicle.brand} ${vehicle.model}`.trim());
                          }}
                          className="flex w-full items-center gap-3 border-b border-white/5 px-3 py-3 text-left last:border-b-0 hover:bg-white/[0.06]"
                        >
                          <img src={vehicle.image} alt="" className="h-8 w-12 object-contain" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-black text-white">
                              {vehicle.brand} {vehicle.model}
                            </span>
                            <span className="block text-xs font-bold text-slate-500">
                              {vehicle.plateNumber} · {vehicle.location.label}
                            </span>
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm font-bold text-slate-400">No results found</div>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setAlertsEnabled((value) => !value)}
                  className={`flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-black transition ${
                    alertsEnabled
                      ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
                      : "border-white/10 bg-white/[0.04] text-slate-400"
                  }`}
                >
                  <FiRadio className={alertsEnabled ? "animate-pulse" : ""} />
                  Live
                </button>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setNotificationsOpen((value) => !value)}
                    className={`relative flex h-11 w-11 items-center justify-center rounded-xl border transition ${
                      notificationsOpen
                        ? "border-red-300/35 bg-red-500/15 text-red-100"
                        : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/20 hover:text-white"
                    }`}
                    aria-label="Notifications"
                    aria-expanded={notificationsOpen}
                  >
                    <FiBell />
                    {riderNotifications.length > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white">
                        {Math.min(riderNotifications.length, 9)}
                      </span>
                    )}
                  </button>

                  {notificationsOpen && (
                    <div className="absolute right-0 top-12 z-[900] w-[320px] overflow-hidden rounded-2xl border border-white/10 bg-[#0b1424] shadow-2xl shadow-black/40">
                      <div className="border-b border-white/10 px-4 py-3">
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-red-300">Notifications</p>
                        <p className="mt-1 text-xs font-bold text-slate-500">New fleet and rider events</p>
                      </div>
                      <div className="max-h-[360px] overflow-y-auto">
                        {riderNotifications.length ? (
                          riderNotifications.slice(0, 6).map((notice) => {
                            const vehicle = getVehicle(notice.vehicleId);

                            return (
                              <button
                                key={notice.id}
                                type="button"
                                onClick={() => openVehicleNotification(notice)}
                                className="block w-full border-b border-white/5 px-4 py-3 text-left last:border-b-0 hover:bg-white/[0.06]"
                              >
                                <span className="block text-sm font-black leading-5 text-white">{notice.title}</span>
                                <span className="mt-1 block text-xs font-semibold leading-5 text-slate-400">{notice.body}</span>
                                <span className="mt-2 flex items-center justify-between gap-3 text-[11px] font-black uppercase tracking-wide text-slate-500">
                                  <span className="truncate">{vehicle ? `${vehicle.brand} ${vehicle.model}` : "Fleet event"}</span>
                                  <span>{notice.time}</span>
                                </span>
                              </button>
                            );
                          })
                        ) : (
                          <div className="px-4 py-5 text-sm font-bold text-slate-400">
                            No new notifications. Critical rider and fleet alerts will appear here.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </header>

          <div className={`admin-control-grid grid min-h-0 flex-1 min-w-0 overflow-hidden gap-0 ${isFullWidthPanel ? "xl:grid-cols-1" : "xl:grid-cols-[minmax(0,1fr)_390px]"}`}>
            {!isFullWidthPanel && (
            <section className="relative min-h-0 min-w-0">
              <div className="admin-map absolute inset-0">
                <MapContainer
                  key={`admin-map-${activeSection}`}
                  center={BAKU_CENTER}
                  zoom={13}
                  minZoom={10}
                  maxBounds={BAKU_MAP_BOUNDS}
                  maxBoundsViscosity={0.85}
                  scrollWheelZoom
                  className="h-full w-full"
                >
                  <LeafletLayoutFix refreshKey={`${activeSection}:${mapVehicles.length}:${managedChargingStations.length}:${managedZones.length}:${draftZonePoints.length}`} />
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  />
                  <MarkerDomClickFallback
                    onVehicleClick={openVehicleDetailsById}
                    onStationClick={openChargingStationDetailsById}
                    onServicePointClick={focusServicePointById}
                  />

                  {isZoneMap && managedZones.map((zone) => {
                    const zoneMeta = getParkingZoneMeta(zone.type);
                    const restricted = zone.type === "restricted";
                    const zoneColor = zoneMeta.color;
                    return (
                      <Polygon
                        key={zone.id}
                        interactive={false}
                        positions={zone.positions}
                        pathOptions={{
                          color: zoneColor,
                          fillColor: zoneColor,
                          fillOpacity: restricted ? 0.16 : 0.12,
                          weight: restricted ? 2 : 1.5,
                          dashArray: restricted ? "8 8" : "0",
                        }}
                      >
                        <Popup>
                          <div className="min-w-[180px]">
                            <p className="text-sm font-black text-slate-950">{zone.name}</p>
                            <p className="mt-1 text-xs font-bold text-slate-500">{zoneMeta.title}</p>
                          </div>
                        </Popup>
                      </Polygon>
                    );
                  })}

                  {!isOperationsMap && selectedVehicle?.liveStatus === "service" && (
                    <Circle
                      center={[selectedVehicle.location.lat, selectedVehicle.location.lng]}
                      radius={420}
                      pathOptions={{ color: "#ef4444", fillColor: "#ef4444", fillOpacity: 0.14, weight: 2 }}
                    />
                  )}

                  {isZoneMap && draftZonePoints.length > 1 && (
                    <Polygon
                      interactive={false}
                      positions={draftZonePoints}
                      pathOptions={{
                        color: getParkingZoneMeta(draftZoneType).color,
                        fillColor: getParkingZoneMeta(draftZoneType).color,
                        fillOpacity: 0.18,
                        weight: 2,
                        dashArray: "4 6",
                      }}
                    />
                  )}

                  {isChargingMap && managedChargingStations.map((station) => {
                    const meta = STATION_STATUS_META[station.status] || STATION_STATUS_META[CHARGING_STATION_STATUSES.ONLINE];

                    return (
                      <Marker
                        key={station.id}
                        ref={(marker) => {
                          if (marker) chargingStationMarkerRefs.current.set(station.id, marker);
                          else chargingStationMarkerRefs.current.delete(station.id);
                        }}
                        position={[station.location.lat, station.location.lng]}
                        icon={createChargingStationIcon(station)}
                        eventHandlers={{
                          click: (event) => {
                            openChargingStationDetailsById(station.id);
                            event.target.openPopup();
                          },
                        }}
                      >
                        <Popup>
                          <div className="min-w-[250px]">
                            <p className="text-sm font-black text-slate-950">{station.name}</p>
                            <p className="mt-1 text-xs font-bold text-slate-500">
                              {station.location.label} · {station.location.zone}
                            </p>
                            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                              <span className="rounded-lg px-2 py-1 font-black text-white" style={{ backgroundColor: meta.color }}>
                                {meta.label}
                              </span>
                              <span className="rounded-lg bg-slate-100 px-2 py-1 font-black text-slate-700">
                                {station.powerKw} kW
                              </span>
                              <span className="rounded-lg bg-emerald-50 px-2 py-1 font-black text-emerald-700">
                                {station.availablePorts}/{station.totalPorts} ports
                              </span>
                              <span className="rounded-lg bg-slate-100 px-2 py-1 font-black text-slate-700">
                                {station.connectorTypes.join(", ")}
                              </span>
                            </div>
                            <div className="mt-3 rounded-lg bg-slate-100 px-2 py-2 text-xs font-bold text-slate-600">
                              <p>
                                Active sessions: {activeChargingSessions.filter((session) => session.chargingStationId === station.id).length}
                              </p>
                              <p className="mt-1">
                                {Number(station.location.lat).toFixed(5)}, {Number(station.location.lng).toFixed(5)}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => deleteChargingPoint(station)}
                              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-red-500 px-3 py-2 text-xs font-black text-white transition hover:bg-red-600"
                            >
                              <FiTrash2 />
                              Delete
                            </button>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}

                  {isServicePointsMap && managedServicePoints.map((point) => (
                    <Marker
                      key={point.id}
                      ref={(marker) => {
                        if (marker) servicePointMarkerRefs.current.set(point.id, marker);
                        else servicePointMarkerRefs.current.delete(point.id);
                      }}
                      position={[point.location.lat, point.location.lng]}
                      icon={createServicePointIcon(point)}
                      eventHandlers={{
                        click: (event) => {
                          event.target.openPopup();
                        },
                      }}
                    >
                      <Popup>
                        <div className="min-w-[220px]">
                          <p className="text-sm font-black text-slate-950">{point.name}</p>
                          <p className="mt-1 text-xs font-bold text-slate-500">
                            {point.location.label} · {point.location.zone}
                          </p>
                          <button
                            type="button"
                            onClick={() => deleteServicePoint(point)}
                            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-red-500 px-3 py-2 text-xs font-black text-white transition hover:bg-red-600"
                          >
                            <FiTrash2 />
                            Delete
                          </button>
                        </div>
                      </Popup>
                    </Marker>
                  ))}

                  {!isOperationsMap && mapVehicles.map((vehicle) => {
                    const meta = STATUS_META[vehicle.liveStatus] || STATUS_META.available;
                    const active = selectedVehicleId === vehicle.id;

                    return (
                      <Marker
                        key={vehicle.id}
                        ref={(marker) => {
                          if (marker) vehicleMarkerRefs.current.set(vehicle.id, marker);
                          else vehicleMarkerRefs.current.delete(vehicle.id);
                        }}
                        position={[vehicle.location.lat, vehicle.location.lng]}
                        icon={createVehicleIcon(vehicle, active)}
                        eventHandlers={{
                          click: (event) => {
                            openVehicleDetailsById(vehicle.id);
                            event.target.openPopup();
                          },
                        }}
                        keyboard
                        riseOnHover
                        zIndexOffset={active ? 1000 : 500}
                      >
                        <Popup>
                          <div className="min-w-[220px]" onClick={() => focusVehicle(vehicle.id)}>
                            <p className="text-sm font-black text-slate-950">
                              {vehicle.brand} {vehicle.model}
                            </p>
                            <p className="mt-1 text-xs font-bold text-slate-500">{vehicle.plateNumber}</p>
                            <div className="mt-3 flex items-center justify-between gap-3">
                              <span className="rounded-full px-3 py-1 text-xs font-black text-white" style={{ backgroundColor: meta.color }}>
                                {STATUS_LABELS[vehicle.liveStatus] || meta.short}
                              </span>
                              <span className="text-xs font-black text-slate-700">{Math.round(vehicle.batteryPercent)}% - {Math.round(vehicle.rangeKm)} km</span>
                            </div>
                            {vehicle.chargingProgress && (
                              <p className="mt-2 text-xs font-black text-emerald-700">
                                {vehicle.chargingProgress.minutesRemaining > 0 ? `${vehicle.chargingProgress.minutesRemaining} min to full` : "Fully charged"}
                              </p>
                            )}
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}

                  {!isOperationsMap && activeSection === "tasks" &&
                    technicians.map((technician) => (
                      <Marker
                        key={technician.id}
                        position={[technician.lat, technician.lng]}
                        icon={createTechnicianIcon(technician)}
                      >
                        <Popup>
                          <div className="min-w-[150px]">
                            <p className="text-sm font-black text-slate-950">{technician.name}</p>
                            <p className="mt-1 text-xs font-bold text-slate-500">{technician.status}</p>
                          </div>
                        </Popup>
                      </Marker>
                    ))}

                  <MapFocus focusTarget={focusTarget} />
                  <MapSectionFocus activeSection={activeSection} />
                  <ZoneDrawEvents
                    enabled={
                      (isZoneMap && isDrawingZone) ||
                      (isChargingMap && chargingDraft.pickOnMap) ||
                      activeSection === "__legacy_service_points"
                    }
                    onAddPoint={(point) =>
                      isChargingMap
                        ? setChargingDraftPoint(point)
                        : isServicePointsMap
                          ? setServicePointDraftPoint(point)
                          : setDraftZonePoints((points) => [...points, point])
                    }
                  />
                </MapContainer>
              </div>

              {!isOperationsMap && (isLoadingBackendVehicles || backendVehiclesError || !liveVehiclesWithChargingProgress.length) && (
                <div className="pointer-events-none absolute left-1/2 top-1/2 z-[505] w-[min(420px,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-[#0b1424]/90 p-5 text-center shadow-2xl shadow-black/30 backdrop-blur-xl">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-red-300">Fleet data</p>
                  <p className="mt-2 text-lg font-black text-white">
                    {isLoadingBackendVehicles
                      ? "Loading vehicles..."
                      : backendVehiclesError || "No vehicles available."}
                  </p>
                </div>
              )}

              <div className="pointer-events-none absolute left-4 right-4 top-4 z-[500] grid gap-3 md:left-6 md:right-auto md:grid-cols-4">
                {mapSummaryCards.map(([label, value, Icon, color]) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-[#0b1424]/82 px-4 py-3 shadow-2xl shadow-black/20 backdrop-blur-xl">
                    <div className={`mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wide ${color}`}>
                      <Icon />
                      {label}
                    </div>
                    <p className="text-2xl font-black text-white">{value}</p>
                  </div>
                ))}
              </div>

              {isChargingMap && renderSelectedChargingStationDetails()}

              {isChargingMap && (
                <div className="absolute bottom-5 left-4 right-4 z-[500] md:left-6 md:right-6">
                  {renderStationStatusControls()}
                </div>
              )}

              {!isOperationsMap && activeSection !== "tasks" && selectedVehicle && (
              <div className="pointer-events-none absolute bottom-5 left-4 z-[500] w-[calc(100%-2rem)] rounded-2xl border border-white/10 bg-[#0b1424]/86 p-4 shadow-2xl shadow-black/30 backdrop-blur-xl md:left-6 md:w-[410px]">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-red-300">Selected Vehicle</p>
                    <h2 className="mt-2 truncate text-2xl font-black text-white">
                      {selectedVehicle.brand} {selectedVehicle.model}
                    </h2>
                    <p className="mt-1 text-sm font-bold text-slate-400">
                      {selectedVehicle.plateNumber} - {selectedVehicle.location.label}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-black ${STATUS_META[selectedVehicle.liveStatus].border} ${STATUS_META[selectedVehicle.liveStatus].text}`}>
                    {STATUS_LABELS[selectedVehicle.liveStatus] || STATUS_META[selectedVehicle.liveStatus].short}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-white/[0.05] p-3">
                    <p className="text-[10px] font-black uppercase text-slate-500">Battery</p>
                    <p className="mt-1 text-lg font-black text-white">{Math.round(selectedVehicle.batteryPercent)}%</p>
                  </div>
                  <div className="rounded-xl bg-white/[0.05] p-3">
                    <p className="text-[10px] font-black uppercase text-slate-500">Range</p>
                    <p className="mt-1 text-lg font-black text-white">{Math.round(selectedVehicle.rangeKm)} km</p>
                  </div>
                  <div className="rounded-xl bg-white/[0.05] p-3">
                    <p className="text-[10px] font-black uppercase text-slate-500">Speed</p>
                    <p className="mt-1 text-lg font-black text-white">{selectedVehicle.speedKmh} km/h</p>
                  </div>
                </div>

                {selectedVehicle.chargingProgress && (
                  <p className="mt-3 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-100">
                    Charging: {selectedVehicle.chargingProgress.minutesRemaining > 0 ? `${selectedVehicle.chargingProgress.minutesRemaining} min to full` : "ready"}
                  </p>
                )}

                {selectedVehicleNotification && (
                  <div className="mt-3 rounded-xl border border-amber-400/25 bg-amber-500/10 p-3">
                    <p className="text-[10px] font-black uppercase text-amber-200">User notification</p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-slate-200">{selectedVehicleNotification.body}</p>
                  </div>
                )}
              </div>
              )}
            </section>
            )}

            <aside className={`z-[520] flex min-h-0 flex-col overflow-y-auto bg-[#0b1424]/96 shadow-2xl shadow-black/30 backdrop-blur-xl ${isFullWidthPanel ? "" : "border-l border-white/10"}`}>
              {renderRightPanel()}
              {activeSection === "__legacy_control" && (
                <>
              <div className="border-b border-white/10 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-red-300">Live Feed</p>
                    <h2 className="mt-2 text-xl font-black text-white">Event stream</h2>
                  </div>
                  <div
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-right"
                    title="Utilization is the percentage of fleet cars currently in an active ride or reservation."
                  >
                    <p className="text-[10px] font-black uppercase text-slate-500">Utilization</p>
                    <p className="text-lg font-black text-white">{fleetStats.utilization}%</p>
                  </div>
                </div>
              </div>

              <div className="border-b border-white/10 p-5">
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-red-300">
                        {adminStatistics ? "Live data connected" : "Statistics unavailable"}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-400">
                        {adminStatisticsLoadedAt
                          ? `Last updated ${formatUpdatedTime(adminStatisticsLoadedAt)}`
                          : "Sign in with an administrator account to load real dashboard metrics."}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={loadAdminStatistics}
                      disabled={isLoadingAdminStatistics}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/[0.08] px-4 py-3 text-xs font-black text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                    >
                      <FiActivity />
                      {isLoadingAdminStatistics ? "Refreshing..." : "Refresh"}
                    </button>
                  </div>

                  {adminStatisticsError && (
                    <p className="mt-3 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-100">
                      {adminStatisticsError}
                    </p>
                  )}

                  {adminStatistics && (
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl bg-white/[0.05] p-3">
                        <p className="text-[10px] font-black uppercase text-slate-500">Today revenue</p>
                        <p className="mt-1 text-lg font-black text-emerald-200">
                          {Number(adminStatistics.revenue?.today || 0).toFixed(2)} {adminStatistics.revenue?.currency || "AZN"}
                        </p>
                      </div>
                      <div className="rounded-xl bg-white/[0.05] p-3">
                        <p className="text-[10px] font-black uppercase text-slate-500">Week revenue</p>
                        <p className="mt-1 text-lg font-black text-white">
                          {Number(adminStatistics.revenue?.thisWeek || 0).toFixed(2)} {adminStatistics.revenue?.currency || "AZN"}
                        </p>
                      </div>
                      <div className="rounded-xl bg-white/[0.05] p-3">
                        <p className="text-[10px] font-black uppercase text-slate-500">Payments</p>
                        <p className="mt-1 text-lg font-black text-white">
                          {adminStatistics.payments?.completed || 0}/{adminStatistics.payments?.pending || 0}/{adminStatistics.payments?.failed || 0}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 border-b border-white/10 p-5">
                {Object.entries(STATUS_META).map(([status, meta]) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => {
                      setStatusFilter((current) => (current === status ? "all" : status));
                      setActiveSection("control");
                    }}
                    className={`rounded-2xl border p-3 text-left ring-1 transition hover:bg-white/[0.07] ${
                      statusFilter === status ? "bg-white/[0.09]" : "bg-white/[0.035]"
                    } ${meta.border} ${meta.ring}`}
                  >
                    <span className="flex items-center gap-2 text-xs font-black uppercase text-slate-400">
                      <span className={`h-2.5 w-2.5 rounded-full ${meta.bg}`} />
                      {meta.short}
                    </span>
                    <span className="mt-2 block text-2xl font-black text-white">{fleetStats[status] || 0}</span>
                  </button>
                ))}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm font-black text-slate-300">Current operations</p>
                  <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-200">
                    {adminStatistics ? "Live data" : "Demo feed"}
                  </span>
                </div>

                <div className="grid gap-3">
                  {events.map((event) => {
                    const meta = STATUS_META[event.status] || STATUS_META.available;
                    return (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() => focusVehicle(event.vehicleId)}
                        className={`group rounded-2xl border bg-white/[0.035] p-4 text-left transition hover:bg-white/[0.07] ${selectedVehicleId === event.vehicleId ? meta.border : "border-white/10"}`}
                      >
                        <div className="flex items-start gap-3">
                          <span className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${meta.bg} text-white shadow-lg`}>
                            {event.status === "service" ? <FiAlertTriangle /> : <FiClock />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-black text-white group-hover:text-red-100">
                              {event.title}
                            </span>
                            <span className="mt-1 block text-xs font-semibold leading-5 text-slate-400">
                              {event.detail}
                            </span>
                            <span className="mt-3 flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-wide text-slate-500">
                              <span>{event.plate}</span>
                              <span>{event.time}</span>
                            </span>
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-white/10 p-5">
                <div className="rounded-2xl border border-red-400/25 bg-red-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <FiAlertTriangle className="mt-1 shrink-0 text-red-300" />
                    <div>
                      <p className="text-sm font-black text-white">GeoFence Watch</p>
                      <p className="mt-1 text-xs font-semibold leading-5 text-slate-400">
                        Red zones warn riders when they try to finish a ride outside allowed parking.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
                </>
              )}
            </aside>
          </div>
        </section>
      </div>
      {dialog}
    </main>
  );
};

export default AdminControlRoom;

