import { useEffect, useMemo, useState } from "react";
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
  FiUserCheck,
  FiUserX,
  FiUsers,
  FiZap,
} from "react-icons/fi";
import { FaCarSide } from "react-icons/fa";
import { vehicles } from "../../data/vehicles";
import { trips } from "../../data/trips";
import { users } from "../../data/users";
import { chargingStations } from "../../data/chargingStations";
import { CHARGING_STATION_STATUSES, TRIP_STATUSES, VEHICLE_STATUSES } from "../../data/statuses";

const BAKU_CENTER = [40.3777, 49.8499];
const CRITICAL_BATTERY_PERCENT = 10;
const CHARGING_TECHNICIAN_ID = "tech-003";

const STATUS_META = {
  available: {
    label: "Свободна",
    short: "Free",
    color: "#22c55e",
    bg: "bg-emerald-500",
    text: "text-emerald-300",
    ring: "ring-emerald-400/30",
    border: "border-emerald-400/35",
  },
  in_use: {
    label: "В пути",
    short: "Ride",
    color: "#3b82f6",
    bg: "bg-blue-500",
    text: "text-blue-300",
    ring: "ring-blue-400/30",
    border: "border-blue-400/35",
  },
  low_charge: {
    label: "Нужна зарядка",
    short: "Low",
    color: "#f59e0b",
    bg: "bg-amber-500",
    text: "text-amber-300",
    ring: "ring-amber-400/30",
    border: "border-amber-400/35",
  },
  service: {
    label: "Сервис",
    short: "Stop",
    color: "#ef4444",
    bg: "bg-red-500",
    text: "text-red-300",
    ring: "ring-red-400/30",
    border: "border-red-400/35",
  },
};

const STATION_STATUS_META = {
  [CHARGING_STATION_STATUSES.ONLINE]: {
    label: "Онлайн",
    color: "#22c55e",
    tone: "emerald",
  },
  [CHARGING_STATION_STATUSES.BUSY]: {
    label: "Занята",
    color: "#f59e0b",
    tone: "amber",
  },
  [CHARGING_STATION_STATUSES.MAINTENANCE]: {
    label: "ТО станции",
    color: "#ef4444",
    tone: "red",
  },
};

const statusFromVehicle = (vehicle) => {
  if (vehicle.status === VEHICLE_STATUSES.IN_USE) return "in_use";
  if (vehicle.status === VEHICLE_STATUSES.CHARGING || vehicle.batteryPercent < 30) return "low_charge";
  if (vehicle.status === VEHICLE_STATUSES.COMPLETED) return "service";
  return "available";
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
];

const pricingRulesSeed = [
  {
    id: "rule-friday-center",
    name: "Friday rush in Center",
    zone: "Central",
    condition: "Fri 18:00-21:00, fewer than 3 available cars",
    multiplier: 1.25,
    enabled: true,
  },
  {
    id: "rule-low-supply",
    name: "Low supply near Boulevard",
    zone: "Seaside",
    condition: "Available fleet below 20%",
    multiplier: 1.15,
    enabled: true,
  },
  {
    id: "rule-night",
    name: "Night comfort tariff",
    zone: "All zones",
    condition: "00:00-06:00",
    multiplier: 0.92,
    enabled: false,
  },
];

const penaltyReasons = [
  { id: "dirty", label: "Грязный салон", amount: 25 },
  { id: "bad-parking", label: "Парковка в неположенном месте", amount: 40 },
  { id: "third-party", label: "Передача руля третьему лицу", amount: 120 },
  { id: "smoking", label: "Курение в салоне", amount: 60 },
];

const staffSeed = [
  {
    id: "mgr-001",
    name: "Ayan Karimova",
    role: "KYC Lead",
    kycRating: 9.4,
    applicationsProcessed: [
      { id: "kyc-101", title: "Leyla Mammadova", result: "Паспорт и права подтверждены", time: "09:18" },
      { id: "kyc-102", title: "Rashad Aliyev", result: "Запрошено повторное фото паспорта", time: "10:05" },
      { id: "kyc-103", title: "Nigar Huseynli", result: "Анкета заблокирована из-за риска дубля", time: "11:42" },
      { id: "kyc-104", title: "Farid Hasanov", result: "Права категории B подтверждены", time: "13:20" },
    ],
    supportTicketsClosed: [
      { id: "sup-101", title: "Не открывается багажник", result: "Проведена удаленная разблокировка", time: "10:28" },
      { id: "sup-102", title: "Ошибка селфи при KYC", result: "Клиенту отправлена инструкция по повторной загрузке", time: "14:12" },
    ],
    active: true,
  },
  {
    id: "mgr-002",
    name: "Murad Aliyev",
    role: "Dispatcher",
    kycRating: 8.1,
    applicationsProcessed: [
      { id: "kyc-201", title: "Gunel Rzayeva", result: "Анкета одобрена после проверки адреса", time: "09:35" },
      { id: "kyc-202", title: "Emin Safarov", result: "Проверка перенесена на ручную модерацию", time: "12:10" },
      { id: "kyc-203", title: "Aysel Hajiyeva", result: "Документы подтверждены", time: "15:04" },
    ],
    supportTicketsClosed: [
      { id: "sup-201", title: "Клиент не завершил аренду", result: "Аренда закрыта удаленно без штрафа", time: "11:55" },
      { id: "sup-202", title: "Авто стоит вне зоны", result: "Построен маршрут до разрешенной парковки", time: "13:44" },
      { id: "sup-203", title: "Низкий заряд перед поездкой", result: "Бронь перенесена на ближайший доступный EV", time: "16:25" },
    ],
    active: true,
  },
  {
    id: "mgr-003",
    name: "Sabina Rustamli",
    role: "Support",
    kycRating: 8.8,
    applicationsProcessed: [
      { id: "kyc-301", title: "Kamran Nabiyev", result: "Фото прав принято, профиль активирован", time: "10:16" },
      { id: "kyc-302", title: "Laman Aliyeva", result: "Отклонено из-за просроченных прав", time: "12:58" },
    ],
    supportTicketsClosed: [
      { id: "sup-301", title: "Не списался бонус", result: "Начислено 5 бесплатных минут", time: "09:50" },
      { id: "sup-302", title: "Кабель зарядки заблокирован", result: "Создана сервисная задача для Нихата", time: "14:33" },
      { id: "sup-303", title: "Шум в салоне после поездки", result: "Машина отправлена на осмотр", time: "17:08" },
    ],
    active: true,
  },
  {
    id: "field-001",
    name: "Tural",
    role: "Полевой сотрудник",
    specialty: "Мойка автомобилей",
    kycRating: 7.6,
    applicationsProcessed: [
      { id: "kyc-401", title: "Осмотр Tesla Model 3", result: "Фото салона добавлены к карточке авто", time: "09:40" },
      { id: "kyc-402", title: "Осмотр Chevrolet Cruze", result: "Отмечена готовность после мойки", time: "13:05" },
    ],
    supportTicketsClosed: [
      { id: "sup-401", title: "Грязный салон после аренды", result: "Авто вымыто и возвращено в парк", time: "12:30" },
      { id: "sup-402", title: "Запах в салоне", result: "Проведена уборка и проветривание", time: "15:45" },
    ],
    active: true,
  },
  {
    id: "field-002",
    name: "Elvin",
    role: "Полевой сотрудник",
    specialty: "Ремонт и отвоз сломанных автомобилей в сервис",
    kycRating: 7.9,
    applicationsProcessed: [
      { id: "kyc-501", title: "Осмотр Kia EV6", result: "Зафиксирована техническая проблема замка", time: "10:22" },
      { id: "kyc-502", title: "Осмотр RR", result: "Проверена телематика и сигнал GPS", time: "14:05" },
    ],
    supportTicketsClosed: [
      { id: "sup-501", title: "Не реагирует багажник", result: "Авто отвезено в сервис на диагностику", time: "11:20" },
      { id: "sup-502", title: "Потеря телематики", result: "Модуль связи перезапущен в сервисе", time: "16:10" },
    ],
    active: true,
  },
  {
    id: "field-003",
    name: "Nihad",
    role: "Полевой сотрудник",
    specialty: "Отвоз автомобилей на зарядку",
    kycRating: 8.3,
    applicationsProcessed: [
      { id: "kyc-601", title: "Проверка Volkswagen ID.4", result: "Подтвержден низкий заряд перед перегоном", time: "09:55" },
      { id: "kyc-602", title: "Проверка Tesla Model 3", result: "Запланирован перегон к станции CCS2", time: "15:18" },
    ],
    supportTicketsClosed: [
      { id: "sup-601", title: "Авто с зарядом ниже 20%", result: "Машина доставлена на станцию Ganjlik Mall", time: "10:35" },
      { id: "sup-602", title: "Клиент сообщил о низком запасе хода", result: "Авто заменено и отправлено на зарядку", time: "13:15" },
      { id: "sup-603", title: "Зарядка завершена", result: "Машина возвращена в доступный парк", time: "17:30" },
    ],
    active: true,
  },
];

const adminProfiles = {
  admin: {
    roleLabel: "Администратор",
    name: users.find((user) => user.role === "admin")?.fullName || "Operations",
  },
  "super-admin": {
    roleLabel: "Суперадмин",
    name: "Ayan Karimova",
  },
};

const formatSenderTitle = ({ senderRole, senderName }) => {
  const profile = adminProfiles[senderRole];

  if (profile) {
    return `${profile.roleLabel} ${senderName || profile.name}`;
  }

  if (senderRole === "system") return senderName || "System";
  if (senderRole === "rider") return `Клиент ${senderName || ""}`.trim();

  return senderName || "Unknown";
};

const createTicketMessage = (body, senderRole, senderName) => ({
  id: `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  body,
  senderRole,
  senderName,
});

const normalizeTicketMessage = (message, ticket) => {
  if (typeof message !== "string") return message;

  if (message.startsWith("Admin: ")) {
    return {
      body: message.replace("Admin: ", ""),
      senderRole: "admin",
      senderName: adminProfiles.admin.name,
    };
  }

  if (message.startsWith("System: ")) {
    return {
      body: message.replace("System: ", ""),
      senderRole: "system",
      senderName: "System",
    };
  }

  const rider = users.find((user) => user.id === ticket.userId);

  return {
    body: message,
    senderRole: "rider",
    senderName: rider?.fullName || "Customer",
  };
};

const incidentSeed = [
  {
    id: "inc-telemetry",
    severity: "critical",
    vehicleId: "ev-006",
    title: "Mercedes S-Class потеряла телематику",
    detail: "Связь пропала 2 минуты назад. Требуется проверка.",
  },
  {
    id: "inc-low-battery",
    severity: "warning",
    vehicleId: "ev-001",
    title: "Tesla Model 3: заряд 7%",
    detail: "Машина заблокирована для новых бронирований.",
  },
  {
    id: "inc-speed",
    severity: "critical",
    vehicleId: "ev-003",
    userId: "user-003",
    title: "Превышение скорости 140 км/ч",
    detail: "Проспект Гейдара Алиева. Доступен экстренный звонок.",
  },
];

const techniciansSeed = [
  { id: "tech-001", name: "Tural", specialty: "Мойка", status: "free", lat: 40.384, lng: 49.842 },
  { id: "tech-002", name: "Elvin", specialty: "Технические проблемы", status: "free", lat: 40.372, lng: 49.858 },
  { id: "tech-003", name: "Nihad", specialty: "Зарядка", status: "busy", lat: 40.392, lng: 49.851 },
];

const taskAssignments = {
  washing: {
    type: "Мойка",
    technicianId: "tech-001",
  },
  technical: {
    type: "Техническая проблема",
    technicianId: "tech-002",
  },
  charging: {
    type: "Зарядка",
    technicianId: "tech-003",
  },
};

const includesAny = (value, keywords) => keywords.some((keyword) => value.includes(keyword));

const getTaskContext = (vehicle, incidents = [], tickets = []) =>
  [
    vehicle?.status,
    vehicle?.liveStatus,
    vehicle?.brand,
    vehicle?.model,
    vehicle?.location?.label,
    ...incidents
      .filter((incident) => incident.vehicleId === vehicle?.id)
      .flatMap((incident) => [incident.title, incident.detail, incident.severity]),
    ...tickets
      .filter((ticket) => ticket.vehicleId === vehicle?.id)
      .flatMap((ticket) => [
        ticket.subject,
        ...ticket.messages.map((message) => (typeof message === "string" ? message : message.body)),
      ]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

const resolveTaskAssignment = (vehicle, incidents = [], tickets = []) => {
  const context = getTaskContext(vehicle, incidents, tickets);

  if (
    vehicle?.liveStatus === "low_charge" ||
    vehicle?.status === VEHICLE_STATUSES.CHARGING ||
    vehicle?.batteryPercent < 30 ||
    includesAny(context, ["заряд", "battery", "charge", "charging", "кабель"])
  ) {
    return taskAssignments.charging;
  }

  if (includesAny(context, ["мойк", "уборк", "clean", "wash"])) {
    return taskAssignments.washing;
  }

  if (
    (vehicle?.liveStatus === "service" && vehicle?.status !== VEHICLE_STATUSES.COMPLETED) ||
    includesAny(context, ["полом", "техничес", "ремонт", "сервис", "телемет", "не откры", "не реаг", "ошиб", "повреж"])
  ) {
    return taskAssignments.technical;
  }

  if (vehicle?.status === VEHICLE_STATUSES.COMPLETED) {
    return taskAssignments.washing;
  }

  return taskAssignments.washing;
};

const tasksSeed = [
  { id: "task-001", vehicleId: "ev-004", technicianId: "tech-003", chargingStationId: "station-004", type: "Зарядка", status: "Техник в пути" },
  { id: "task-002", vehicleId: "ev-005", technicianId: "tech-001", type: "Мойка", status: "Машина обслуживается" },
];

const ticketsSeed = [
  {
    id: "ticket-001",
    userId: "user-002",
    vehicleId: "ev-002",
    subject: "Не открывается багажник",
    messages: ["Пробую открыть из приложения, но багажник не реагирует.", "Проверьте, пожалуйста, удаленно."],
  },
  {
    id: "ticket-002",
    userId: "user-003",
    vehicleId: "ev-003",
    subject: "Не вставляется зарядный кабель",
    messages: ["Кабель заблокирован в станции, аренда активна."],
  },
];

const maintenanceSeed = [
  { vehicleId: "ev-001", serviceInKm: 480, batteryHealth: 91, profitability: 78, consumption: 16.8 },
  { vehicleId: "ev-002", serviceInKm: 820, batteryHealth: 88, profitability: 63, consumption: 18.2 },
  { vehicleId: "ev-003", serviceInKm: 310, batteryHealth: 84, profitability: 82, consumption: 20.6 },
  { vehicleId: "ev-004", serviceInKm: 150, batteryHealth: 79, profitability: 41, consumption: 22.1 },
  { vehicleId: "ev-005", serviceInKm: 610, batteryHealth: 93, profitability: 58, consumption: 7.9 },
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

const getDistanceKm = (from, to) => {
  if (!from || !to) return Number.POSITIVE_INFINITY;

  const earthRadiusKm = 6371;
  const latDelta = ((to.lat - from.lat) * Math.PI) / 180;
  const lngDelta = ((to.lng - from.lng) * Math.PI) / 180;
  const fromLat = (from.lat * Math.PI) / 180;
  const toLat = (to.lat * Math.PI) / 180;
  const haversine =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(lngDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

const getNearestChargingStation = (vehicle) =>
  chargingStations
    .filter(
      (station) =>
        station.status === CHARGING_STATION_STATUSES.ONLINE && station.availablePorts > 0
    )
    .map((station) => ({
      ...station,
      distanceKm: getDistanceKm(vehicle?.location, station.location),
    }))
    .sort((first, second) => first.distanceKm - second.distanceKm)[0] || null;

const makeLiveVehicle = (vehicle, index) => ({
  ...vehicle,
  liveStatus: statusFromVehicle(vehicle),
  speedKmh: vehicle.status === VEHICLE_STATUSES.IN_USE ? 38 : 0,
  activeSeconds: vehicle.status === VEHICLE_STATUSES.IN_USE ? 740 : index * 64,
  signal: 94 - index * 3,
  location: {
    ...vehicle.location,
    lat: vehicle.location.lat + index * 0.00035,
    lng: vehicle.location.lng - index * 0.00018,
  },
});

const createVehicleIcon = (vehicle, isSelected) => {
  const meta = STATUS_META[vehicle.liveStatus] || STATUS_META.available;
  const timer = vehicle.liveStatus === "in_use" ? formatDuration(vehicle.activeSeconds) : meta.short;
  const image = vehicle.image || "";

  return L.divIcon({
    className: "admin-car-marker",
    html: `
      <div class="admin-car-marker__wrap ${isSelected ? "is-selected" : ""}" style="--status:${meta.color};">
        <span class="admin-car-marker__pulse"></span>
        <span class="admin-car-marker__core">
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
        <span>${technician.name.slice(0, 1)}</span>
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
      <div class="admin-station-marker__core" style="--station:${meta.color};">
        <span>⚡</span>
        <b>${station.availablePorts}/${station.totalPorts}</b>
      </div>
    `,
    iconSize: [48, 58],
    iconAnchor: [24, 52],
    popupAnchor: [0, -48],
  });
};

const makeEvent = (vehicle, index) => {
  const rider = users[index % users.length] || users[0];
  const actions = {
    available: "стал доступен для бронирования",
    in_use: `едет по маршруту ${trips[index % trips.length]?.currentLocation || "Fountain Square"}`,
    low_charge: "получил низкий заряд, назначена зарядка",
    service: "переведён в сервисный режим",
  };

  return {
    id: `feed-${Date.now()}-${vehicle.id}`,
    vehicleId: vehicle.id,
    title: `${vehicle.brand} ${vehicle.model || ""}`.trim(),
    detail: `${rider.fullName.split(" ")[0]}: ${actions[vehicle.liveStatus]}`,
    plate: vehicle.plateNumber,
    time: "только что",
    status: vehicle.liveStatus,
  };
};

const MapFocus = ({ focusTarget }) => {
  const map = useMap();

  useEffect(() => {
    if (!focusTarget) return;
    map.flyTo([focusTarget.lat, focusTarget.lng], 14, {
      animate: true,
      duration: 0.65,
    });
  }, [map, focusTarget]);

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

const AdminControlRoom = () => {
  const [liveVehicles, setLiveVehicles] = useState(() => vehicles.map(makeLiveVehicle));
  const [managedZones, setManagedZones] = useState(parkingZones);
  const [selectedVehicleId, setSelectedVehicleId] = useState(vehicles[2]?.id || vehicles[0]?.id);
  const [focusTarget, setFocusTarget] = useState(null);
  const [adminRole, setAdminRole] = useState("super-admin");
  const [activeSection, setActiveSection] = useState("control");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [kycProfiles, setKycProfiles] = useState(kycProfilesSeed);
  const [kycFilter, setKycFilter] = useState("all");
  const [selectedKycUserId, setSelectedKycUserId] = useState(kycProfilesSeed[1]?.userId || kycProfilesSeed[0]?.userId);
  const [isDrawingZone, setIsDrawingZone] = useState(false);
  const [draftZoneType, setDraftZoneType] = useState("allowed");
  const [draftZonePoints, setDraftZonePoints] = useState([]);
  const [pricingRules, setPricingRules] = useState(pricingRulesSeed);
  const [penaltySearchQuery, setPenaltySearchQuery] = useState("");
  const [penaltyTargetId, setPenaltyTargetId] = useState(null);
  const [penaltyReasonId, setPenaltyReasonId] = useState(penaltyReasons[0].id);
  const [pendingPenalty, setPendingPenalty] = useState(null);
  const [penalties, setPenalties] = useState([]);
  const [staff, setStaff] = useState(staffSeed);
  const [selectedKpiDetail, setSelectedKpiDetail] = useState(null);
  const [incidents, setIncidents] = useState(incidentSeed);
  const [technicians, setTechnicians] = useState(techniciansSeed);
  const [serviceTasks, setServiceTasks] = useState(tasksSeed);
  const [tickets, setTickets] = useState(ticketsSeed);
  const [activeTicketId, setActiveTicketId] = useState(ticketsSeed[0].id);
  const [chatDraft, setChatDraft] = useState("");
  const [adminNotice, setAdminNotice] = useState({ section: null, message: "" });
  const [riderNotifications, setRiderNotifications] = useState([]);
  const [plannedMaintenance, setPlannedMaintenance] = useState([]);
  const [events, setEvents] = useState(() =>
    vehicles.slice(0, 5).map((vehicle, index) => makeEvent(makeLiveVehicle(vehicle, index), index))
  );
  const [alertsEnabled, setAlertsEnabled] = useState(true);

  const selectedVehicle = useMemo(
    () => liveVehicles.find((vehicle) => vehicle.id === selectedVehicleId) || liveVehicles[0],
    [liveVehicles, selectedVehicleId]
  );

  const selectedVehicleNotification = useMemo(
    () => riderNotifications.find((notice) => notice.vehicleId === selectedVehicle?.id),
    [riderNotifications, selectedVehicle?.id]
  );

  const filteredVehicles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return liveVehicles.filter((vehicle) => {
      const matchesStatus = statusFilter === "all" || vehicle.liveStatus === statusFilter;
      const searchable = [
        vehicle.brand,
        vehicle.model,
        vehicle.plateNumber,
        vehicle.location?.label,
        vehicle.location?.zone,
        STATUS_META[vehicle.liveStatus]?.label,
        STATUS_META[vehicle.liveStatus]?.short,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesStatus && (!query || searchable.includes(query));
    });
  }, [liveVehicles, searchQuery, statusFilter]);

  const searchResults = useMemo(() => filteredVehicles.slice(0, 6), [filteredVehicles]);

  const isSuperAdmin = adminRole === "super-admin";
  const currentAdminProfile = adminProfiles[adminRole] || adminProfiles.admin;

  const kycRows = useMemo(() => {
    const riderUsers = users.filter((user) => user.role === "rider");

    return riderUsers.map((user) => {
      const profile = kycProfiles.find((item) => item.userId === user.id) || {
        userId: user.id,
        status: user.verificationStatus || "pending",
        risk: "medium",
        selfie: "Waiting for selfie",
        passport: "Waiting for passport",
        license: "Waiting for license",
        submittedAt: "Not submitted",
        notes: "No KYC package yet.",
      };

      return { ...user, kyc: profile };
    });
  }, [kycProfiles]);

  const filteredKycRows = useMemo(() => {
    if (kycFilter === "all") return kycRows;
    return kycRows.filter((row) => row.kyc.status === kycFilter);
  }, [kycFilter, kycRows]);

  const selectedKycUser = useMemo(
    () => kycRows.find((row) => row.id === selectedKycUserId) || kycRows[0],
    [kycRows, selectedKycUserId]
  );

  const fleetStats = useMemo(() => {
    const statusCounts = liveVehicles.reduce(
      (acc, vehicle) => {
        acc[vehicle.liveStatus] = (acc[vehicle.liveStatus] || 0) + 1;
        return acc;
      },
      { available: 0, in_use: 0, low_charge: 0, service: 0 }
    );

    const activeTrips = statusCounts.in_use;
    const utilization = Math.round((activeTrips / Math.max(liveVehicles.length, 1)) * 100);
    const averageBattery = Math.round(
      liveVehicles.reduce((sum, vehicle) => sum + vehicle.batteryPercent, 0) / Math.max(liveVehicles.length, 1)
    );

    return { ...statusCounts, activeTrips, utilization, averageBattery };
  }, [liveVehicles]);

  const stationStats = useMemo(() => {
    const onlineStations = chargingStations.filter(
      (station) => station.status === CHARGING_STATION_STATUSES.ONLINE
    ).length;
    const availablePorts = chargingStations.reduce(
      (sum, station) => sum + station.availablePorts,
      0
    );
    const totalPorts = chargingStations.reduce((sum, station) => sum + station.totalPorts, 0);
    const maxPower = Math.max(...chargingStations.map((station) => station.powerKw));

    return { onlineStations, availablePorts, totalPorts, maxPower };
  }, []);

  useEffect(() => {
    if (!alertsEnabled) return undefined;

    const movementTimer = window.setInterval(() => {
      setLiveVehicles((current) =>
        current.map((vehicle, index) => {
          if (vehicle.liveStatus !== "in_use") {
            return vehicle;
          }

          const phase = Date.now() / 1000 + index;
          return {
            ...vehicle,
            activeSeconds: vehicle.activeSeconds + 2,
            batteryPercent: Math.max(8, vehicle.batteryPercent - 0.08),
            speedKmh: Math.round(31 + Math.sin(phase) * 9),
            location: {
              ...vehicle.location,
              lat: vehicle.location.lat + Math.sin(phase) * 0.00042,
              lng: vehicle.location.lng + Math.cos(phase * 0.8) * 0.00052,
            },
          };
        })
      );
    }, 1800);

    return () => window.clearInterval(movementTimer);
  }, [alertsEnabled]);

  useEffect(() => {
    if (!alertsEnabled) return undefined;

    const feedTimer = window.setInterval(() => {
      setLiveVehicles((current) => {
        const next = [...current];
        const index = Math.floor(Math.random() * next.length);
        const vehicle = next[index];
        const lowCharge = vehicle.liveStatus !== "in_use" && vehicle.batteryPercent < 18;
        const nextStatus = lowCharge ? "low_charge" : vehicle.liveStatus;
        next[index] = { ...vehicle, liveStatus: nextStatus };

        const event = makeEvent(next[index], index);
        setEvents((items) => {
          const exists = items.some(
            (item) =>
              item.vehicleId === event.vehicleId &&
              item.status === event.status &&
              item.detail === event.detail
          );

          return exists ? items : [event, ...items].slice(0, 9);
        });
        return next;
      });
    }, 4200);

    return () => window.clearInterval(feedTimer);
  }, [alertsEnabled]);

  useEffect(() => {
    const criticalVehicles = liveVehicles.filter(
      (vehicle) =>
        vehicle.liveStatus === "in_use" && vehicle.batteryPercent <= CRITICAL_BATTERY_PERCENT
    );

    if (!criticalVehicles.length) return;

    criticalVehicles.forEach((vehicle) => {
      const activeTrip = trips.find(
        (trip) => trip.vehicleId === vehicle.id && trip.status === TRIP_STATUSES.ACTIVE
      );
      const rider = users.find((user) => user.id === activeTrip?.userId);
      const nearestStation = getNearestChargingStation(vehicle);
      const noticeBody = `Заряд автомобиля ${Math.round(vehicle.batteryPercent)}%. Аренда приостановлена, полевой сотрудник отвезет машину на зарядку.`;

      setServiceTasks((items) => {
        const alreadyAssigned = items.some(
          (task) =>
            task.vehicleId === vehicle.id &&
            task.type === "Зарядка" &&
            task.status !== "Готово"
        );

        if (alreadyAssigned) return items;

        return [
          {
            id: `task-critical-${vehicle.id}`,
            vehicleId: vehicle.id,
            technicianId: CHARGING_TECHNICIAN_ID,
            chargingStationId: nearestStation?.id,
            type: "Зарядка",
            status: "Назначено",
            autoCreated: true,
            userNotice: noticeBody,
          },
          ...items,
        ];
      });

      setTechnicians((items) =>
        items.map((tech) =>
          tech.id === CHARGING_TECHNICIAN_ID ? { ...tech, status: "busy" } : tech
        )
      );

      setLiveVehicles((items) =>
        items.map((item) =>
          item.id === vehicle.id
            ? { ...item, liveStatus: "low_charge", speedKmh: 0 }
            : item
        )
      );

      setRiderNotifications((items) => {
        const notificationId = `notice-critical-${vehicle.id}`;

        if (items.some((item) => item.id === notificationId)) return items;

        return [
          {
            id: notificationId,
            userId: rider?.id,
            vehicleId: vehicle.id,
            title: "Аренда приостановлена из-за низкого заряда",
            body: noticeBody,
            time: "только что",
          },
          ...items,
        ];
      });

      setEvents((items) => {
        const detail = `${rider?.fullName || "Клиент"}: аренда приостановлена, Нихату назначен отвоз на зарядку${nearestStation ? ` (${nearestStation.name})` : ""}.`;
        const exists = items.some(
          (item) => item.vehicleId === vehicle.id && item.detail === detail
        );

        if (exists) return items;

        return [
          {
            id: `feed-critical-${vehicle.id}`,
            vehicleId: vehicle.id,
            title: `${vehicle.brand} ${vehicle.model || ""}`.trim(),
            detail,
            plate: vehicle.plateNumber,
            time: "только что",
            status: "low_charge",
          },
          ...items,
        ].slice(0, 9);
      });
    });
  }, [liveVehicles, serviceTasks]);

  const focusVehicle = (vehicleId) => {
    const vehicle = liveVehicles.find((item) => item.id === vehicleId);

    setSelectedVehicleId(vehicleId);
    if (vehicle?.location) {
      setFocusTarget({
        id: vehicle.id,
        lat: vehicle.location.lat,
        lng: vehicle.location.lng,
      });
    }
  };

  const sidebarItems = useMemo(() => [
    { id: "control", label: "Control Room", icon: FiCommand, filter: "all" },
    { id: "users", label: "Users & KYC", icon: FiUserCheck, filter: "all" },
    { id: "pricing", label: "Geofencing & Pricing", icon: FiMap, filter: "all", superOnly: true },
    { id: "billing", label: "Billing & Penalties", icon: FiDollarSign, filter: "all", superOnly: true },
    { id: "kpi", label: "Manager KPI", icon: FiUsers, filter: "all", superOnly: true },
    { id: "incidents", label: "Incident Feed", icon: FiShield, filter: "service" },
    { id: "tasks", label: "Task Manager", icon: FiTool, filter: "low_charge" },
    { id: "chargers", label: "Charging Map", icon: FiZap, filter: "all" },
    { id: "helpdesk", label: "Helpdesk", icon: FiMessageSquare, filter: "in_use" },
    { id: "analytics", label: "Resource Analytics", icon: FiTrendingUp, filter: "all", superOnly: true },
  ], []);

  const visibleSidebarItems = sidebarItems.filter((item) => isSuperAdmin || !item.superOnly);

  const getVehicle = (vehicleId) => liveVehicles.find((vehicle) => vehicle.id === vehicleId) || vehicles.find((vehicle) => vehicle.id === vehicleId);
  const activeTicket = tickets.find((ticket) => ticket.id === activeTicketId) || tickets[0];
  const showAdminNotice = (message, section = activeSection) => {
    setAdminNotice({ section, message });
  };

  const saveDraftZone = () => {
    if (draftZonePoints.length < 3) {
      showAdminNotice("Для сохранения зоны включи Draw и поставь минимум 3 точки на карте");
      return;
    }

    const nextZone = {
      id: `zone-${managedZones.length + 1}`,
      name: `${draftZoneType === "allowed" ? "Green" : draftZoneType === "limited" ? "Yellow" : "Red"} custom zone`,
      type: draftZoneType,
      positions: draftZonePoints,
    };

    setManagedZones((items) => [...items, nextZone]);
    setDraftZonePoints([]);
    setIsDrawingZone(false);
    showAdminNotice(`Зона сохранена: ${nextZone.name}`);
  };

  const updateKycStatus = (userId, status) => {
    setKycProfiles((items) =>
      items.map((profile) =>
        profile.userId === userId
          ? {
              ...profile,
              status,
              notes:
                status === "verified"
                  ? "Approved by admin. Push notification sent."
                  : status === "blocked"
                    ? "Blocked by admin. Support review required."
                    : "Returned to manual moderation queue.",
            }
          : profile
      )
    );
  };

  const preparePenalty = () => {
    const reason = penaltyReasons.find((item) => item.id === penaltyReasonId) || penaltyReasons[0];
    const rider = users.find((user) => user.id === penaltyTargetId);

    if (!rider) {
      showAdminNotice("Сначала найдите пользователя по имени и фамилии");
      return;
    }

    setPendingPenalty({ rider, reason });
  };

  const confirmPenalty = () => {
    if (!pendingPenalty) return;

    setPenalties((items) => [
      {
        id: `penalty-${items.length + 1}`,
        user: pendingPenalty.rider.fullName,
        reason: pendingPenalty.reason.label,
        amount: pendingPenalty.reason.amount,
        status: "Списано с карты",
      },
      ...items,
    ]);
    showAdminNotice(`Списано ${pendingPenalty.reason.amount} AZN: ${pendingPenalty.rider.fullName}`);
    setPendingPenalty(null);
  };

  const createServiceTask = (vehicleId) => {
    const vehicle = getVehicle(vehicleId);
    const assignment = resolveTaskAssignment(vehicle, incidents, tickets);
    const assignedTech = technicians.find((tech) => tech.id === assignment.technicianId) || technicians[0];
    const nearestStation = assignment.type === "Зарядка" ? getNearestChargingStation(vehicle) : null;

    setServiceTasks((items) => [
      {
        id: `task-${items.length + 1}`,
        vehicleId,
        technicianId: assignedTech.id,
        chargingStationId: nearestStation?.id,
        type: assignment.type,
        status: "Назначено",
      },
      ...items,
    ]);
    setTechnicians((items) =>
      items.map((tech) => (tech.id === assignedTech.id ? { ...tech, status: "busy" } : tech))
    );
    showAdminNotice(`${assignment.type}: назначено ${assignedTech.name}`);
  };

  const advanceTask = (taskId) => {
    const flow = ["Назначено", "Техник в пути", "Техник на месте", "Машина обслуживается", "Готово"];
    setServiceTasks((items) =>
      items.map((task) => {
        if (task.id !== taskId) return task;
        const index = flow.indexOf(task.status);
        const nextStatus = flow[Math.min(index + 1, flow.length - 1)];

        if (nextStatus === "Готово") {
          setTechnicians((techs) =>
            techs.map((tech) => (tech.id === task.technicianId ? { ...tech, status: "free" } : tech))
          );
          showAdminNotice("Задача закрыта: машина возвращена в клиентский парк");
        }

        return { ...task, status: nextStatus };
      })
    );
  };

  const sendChatMessage = () => {
    if (!chatDraft.trim() || !activeTicket) return;

    const message = createTicketMessage(chatDraft.trim(), adminRole, currentAdminProfile.name);

    setTickets((items) =>
      items.map((ticket) =>
        ticket.id === activeTicket.id
          ? { ...ticket, messages: [...ticket.messages, message] }
          : ticket
      )
    );
    showAdminNotice("Сообщение отправлено пользователю");
    setChatDraft("");
  };

  const appendTicketMessage = (body) => {
    if (!activeTicket) return;

    const message = createTicketMessage(body, "system", "System");

    setTickets((items) =>
      items.map((ticket) =>
        ticket.id === activeTicket.id
          ? { ...ticket, messages: [...ticket.messages, message] }
        : ticket
      )
    );
    showAdminNotice(body);
  };

  const renderPanelHeader = (eyebrow, title, action = null) => {
    const visibleAdminNotice = adminNotice.section === activeSection ? adminNotice.message : "";

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
            onClick={() => setAdminNotice({ section: null, message: "" })}
            className="mt-4 w-full rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-left text-xs font-bold text-emerald-200"
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
        <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-right">
          <p className="text-[10px] font-black uppercase text-slate-500">Utilization</p>
          <p className="text-lg font-black text-white">{fleetStats.utilization}%</p>
        </div>
      )}

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
            WebSocket mock
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

  const renderUsersKycPanel = () => {
    const tabItems = [
      ["all", "Все"],
      ["pending", "На модерации"],
      ["verified", "Активные"],
      ["blocked", "Заблокированные"],
    ];

    const statusStyles = {
      pending: "border-amber-400/30 bg-amber-500/10 text-amber-200",
      verified: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
      blocked: "border-red-400/30 bg-red-500/10 text-red-200",
    };

    return (
      <>
        {renderPanelHeader(
          "Users & KYC",
          "Пользователи и документы",
          <span className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black text-slate-300">
            {filteredKycRows.length}/{kycRows.length}
          </span>
        )}

        <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-4 p-5">
          <div className="flex gap-2 overflow-x-auto">
            {tabItems.map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setKycFilter(id)}
                className={`shrink-0 rounded-xl px-3 py-2 text-xs font-black ${
                  kycFilter === id ? "bg-red-500 text-white" : "bg-white/[0.06] text-slate-300 hover:bg-white/[0.09]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid min-h-0 gap-4 xl:grid-rows-[210px_minmax(0,1fr)]">
            <div className="grid gap-3 overflow-y-auto">
              {filteredKycRows.map((row) => (
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
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${statusStyles[row.kyc.status] || "border-white/10 text-slate-300"}`}>
                      {row.kyc.status}
                    </span>
                  </span>
                </button>
              ))}
            </div>

            {selectedKycUser && (
              <div className="min-h-0 overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-black text-white">{selectedKycUser.fullName}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">{selectedKycUser.phone} · {selectedKycUser.email}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase ${statusStyles[selectedKycUser.kyc.status] || "border-white/10 text-slate-300"}`}>
                    {selectedKycUser.kyc.risk} risk
                  </span>
                </div>

                <div className="mt-4 grid gap-3">
                  <div className="rounded-2xl border border-white/10 bg-[#111a2b] p-4">
                    <p className="mb-3 flex items-center gap-2 text-sm font-black text-white">
                      <FiUserCheck /> Side-by-side verification
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl bg-white/[0.05] p-3">
                        <p className="text-[10px] font-black uppercase text-slate-500">Анкета + селфи</p>
                        <p className="mt-2 text-sm font-bold text-white">{selectedKycUser.kyc.selfie}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-400">{selectedKycUser.kyc.submittedAt}</p>
                      </div>
                      <div className="rounded-xl bg-white/[0.05] p-3">
                        <p className="text-[10px] font-black uppercase text-slate-500">Паспорт + права</p>
                        <p className="mt-2 text-sm font-bold text-white">{selectedKycUser.kyc.passport}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-400">{selectedKycUser.kyc.license}</p>
                      </div>
                    </div>
                    <p className="mt-3 rounded-xl bg-white/[0.04] px-3 py-2 text-xs font-semibold leading-5 text-slate-400">
                      {selectedKycUser.kyc.notes}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => updateKycStatus(selectedKycUser.id, "verified")}
                      className="rounded-xl bg-emerald-500 px-3 py-3 text-xs font-black text-white"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => updateKycStatus(selectedKycUser.id, "pending")}
                      className="rounded-xl bg-amber-500 px-3 py-3 text-xs font-black text-amber-950"
                    >
                      Review
                    </button>
                    <button
                      type="button"
                      onClick={() => updateKycStatus(selectedKycUser.id, "blocked")}
                      className="rounded-xl bg-red-500 px-3 py-3 text-xs font-black text-white"
                    >
                      Block
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setPenaltySearchQuery(selectedKycUser.fullName);
                      setPenaltyTargetId(selectedKycUser.id);
                      setActiveSection("billing");
                    }}
                    disabled={!isSuperAdmin}
                    className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-3 text-sm font-black text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <FiFileText className="inline" /> Выписать штраф
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </>
    );
  };

  const renderPricingPanel = () => (
    <>
      {renderPanelHeader(
        "Geofencing",
        "Тарифы и зоны",
        <button
          type="button"
          onClick={() => setIsDrawingZone((value) => !value)}
          className={`rounded-xl px-3 py-2 text-xs font-black ${isDrawingZone ? "bg-red-500 text-white" : "bg-white/[0.06] text-slate-200"}`}
        >
          <FiEdit3 className="inline" /> Draw
        </button>
      )}
      <div className="grid gap-4 overflow-y-auto p-5">
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <p className="text-sm font-black text-white">Редактор полигона</p>
          <p className="mt-2 text-xs font-semibold leading-5 text-slate-400">
            Цвет выбирает тип новой зоны. Потом нажми Draw, поставь точки на карте и сохрани зону.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              ["allowed", "Green"],
              ["limited", "Yellow"],
              ["restricted", "Red"],
            ].map(([type, label]) => (
              <button
                key={type}
                type="button"
                onClick={() => setDraftZoneType(type)}
                className={`rounded-xl border px-3 py-2 text-xs font-black ${
                  draftZoneType === type ? "border-red-300 bg-red-500 text-white" : "border-white/10 text-slate-300"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs font-semibold leading-5 text-slate-400">
            Включи Draw и кликай по карте. Точек: {draftZonePoints.length}. Минимум 3 для сохранения.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={saveDraftZone} className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-black text-white">
              Сохранить зону
            </button>
            <button type="button" onClick={() => setDraftZonePoints([])} className="rounded-xl bg-white/[0.06] px-3 py-2 text-xs font-black text-slate-200">
              Очистить
            </button>
          </div>
        </div>

        <div className="grid gap-3">
          {pricingRules.map((rule) => (
            <button
              key={rule.id}
              type="button"
              onClick={() =>
                setPricingRules((items) => {
                  const nextEnabled = !rule.enabled;
                  showAdminNotice(`${rule.name}: ${nextEnabled ? "активирован" : "выключен"} · тариф x${rule.multiplier}`);
                  return items.map((item) => (item.id === rule.id ? { ...item, enabled: nextEnabled } : item));
                })
              }
              className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-left hover:bg-white/[0.06]"
            >
              <span className="flex items-center justify-between gap-3">
                <span className="text-sm font-black text-white">{rule.name}</span>
                <span className={`h-6 w-11 rounded-full p-1 ${rule.enabled ? "bg-emerald-500" : "bg-slate-700"}`}>
                  <span className={`block h-4 w-4 rounded-full bg-white transition ${rule.enabled ? "translate-x-5" : ""}`} />
                </span>
              </span>
              <span className="mt-2 block text-xs font-semibold leading-5 text-slate-400">{rule.condition}</span>
              <span className="mt-3 inline-flex rounded-full bg-blue-500/10 px-3 py-1 text-xs font-black text-blue-200">
                {rule.zone} · x{rule.multiplier}
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  );

  const renderBillingPanel = () => {
    const riders = users.filter((user) => user.role === "rider");
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

    return (
      <>
        {renderPanelHeader("Billing", "Штрафы и списания")}
        <div className="grid gap-4 overflow-y-auto p-5">
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
                  setPendingPenalty(null);
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

            <button
              type="button"
              onClick={preparePenalty}
              disabled={!selectedPenaltyRider}
              className="mt-3 w-full rounded-xl bg-red-500 px-3 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              Подготовить списание {reason.amount} AZN
            </button>
          </div>

          {pendingPenalty && (
            <div className="rounded-2xl border border-amber-400/35 bg-amber-500/10 p-4">
              <p className="text-sm font-black text-white">Подтвердить списание?</p>
              <p className="mt-2 text-xs font-semibold leading-5 text-slate-300">
                {pendingPenalty.rider.fullName} · {pendingPenalty.reason.label} · {pendingPenalty.reason.amount} AZN. Пользователю будет отправлен push.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={confirmPenalty} className="rounded-xl bg-red-500 px-3 py-2 text-xs font-black text-white">
                  Да, списать
                </button>
                <button type="button" onClick={() => setPendingPenalty(null)} className="rounded-xl bg-white/[0.08] px-3 py-2 text-xs font-black text-slate-200">
                  Отмена
                </button>
              </div>
            </div>
          )}

          {penalties.map((penalty) => (
            <div key={penalty.id} className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4">
              <p className="text-sm font-black text-white">{penalty.user}</p>
              <p className="mt-1 text-xs font-semibold text-slate-400">{penalty.reason}</p>
              <p className="mt-3 text-lg font-black text-red-200">{penalty.amount} AZN · {penalty.status}</p>
            </div>
          ))}
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

    return (
      <>
        {renderPanelHeader("Manager KPI", "Эффективность персонала")}
        <div className="grid gap-3 overflow-y-auto p-5">
          <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 p-4 text-xs font-semibold leading-5 text-slate-300">
            <b className="text-blue-200">KYC рейтинг</b> — оценка скорости и качества проверки анкеты по шкале от 1 до 10, где 10 — лучший результат. <b className="text-blue-200">Заявки</b> — обработанные заявки за смену. <b className="text-blue-200">Тикеты</b> — закрытые обращения поддержки.
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
                    title={manager.active ? "Deactivate employee" : "Activate employee"}
                  >
                    {manager.active ? <FiUserX /> : <FiUserCheck />}
                  </button>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-white/[0.05] p-3"><p className="text-[10px] font-black text-slate-500">KYC рейтинг</p><p className="font-black">{manager.kycRating}/10</p></div>
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
      {renderPanelHeader("Task Manager", "Техники и сервис", <button type="button" onClick={() => createServiceTask(selectedVehicleId)} className="rounded-xl bg-red-500 px-3 py-2 text-xs font-black text-white"><FiPlus className="inline" /> Задача</button>)}
      <div className="grid gap-4 overflow-y-auto p-5">
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-xs font-semibold leading-5 text-slate-300">
          Техники — полевая команда: мойка, зарядка, осмотр, мелкий ремонт. “Следующий статус” двигает задачу по цепочке: назначено → в пути → на месте → обслуживается → готово.
        </div>
        <div className="grid grid-cols-3 gap-2">
          {technicians.map((tech) => (
            <div key={tech.id} className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
              <p className="text-xs font-black text-white">{tech.name}</p>
              <p className="mt-1 text-[10px] font-semibold text-slate-400">{tech.specialty}</p>
              <p className={`mt-1 text-[10px] font-black uppercase ${tech.status === "free" ? "text-emerald-300" : "text-amber-300"}`}>{tech.status}</p>
            </div>
          ))}
        </div>
        {serviceTasks.map((task) => {
          const vehicle = getVehicle(task.vehicleId);
          const tech = technicians.find((item) => item.id === task.technicianId);
          const station = chargingStations.find((item) => item.id === task.chargingStationId);
          return (
            <div key={task.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <p className="text-sm font-black text-white">
                {task.type}: {vehicle?.brand} {vehicle?.model}
                {task.autoCreated && <span className="ml-2 rounded-full bg-amber-500/15 px-2 py-1 text-[10px] text-amber-200">auto</span>}
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-400">{tech?.name} · {task.status}</p>
              {station && (
                <p className="mt-2 text-xs font-semibold text-emerald-200">
                  Станция: {station.name} · {station.availablePorts}/{station.totalPorts} портов
                </p>
              )}
              {task.userNotice && (
                <p className="mt-2 rounded-xl bg-white/[0.05] px-3 py-2 text-xs font-semibold leading-5 text-slate-300">
                  Push пользователю: {task.userNotice}
                </p>
              )}
              <button type="button" onClick={() => advanceTask(task.id)} className="mt-3 rounded-xl bg-white/[0.06] px-3 py-2 text-xs font-black text-slate-200">
                Следующий статус
              </button>
            </div>
          );
        })}
      </div>
    </>
  );

  const renderChargersPanel = () => (
    <>
      {renderPanelHeader(
        "Charging Map",
        "Карта зарядок",
        <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-right">
          <p className="text-[10px] font-black uppercase text-slate-500">Порты</p>
          <p className="text-lg font-black text-white">{stationStats.availablePorts}/{stationStats.totalPorts}</p>
        </div>
      )}
      <div className="grid gap-3 overflow-y-auto p-5">
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-xs font-semibold leading-5 text-slate-300">
          Отдельная карта зарядной инфраструктуры: здесь видны только станции, их статус, мощность и свободные порты для планирования перегонов.
        </div>
        {chargingStations.map((station) => {
          const meta = STATION_STATUS_META[station.status] || STATION_STATUS_META[CHARGING_STATION_STATUSES.ONLINE];

          return (
            <button
              key={station.id}
              type="button"
              onClick={() =>
                setFocusTarget({
                  id: station.id,
                  lat: station.location.lat,
                  lng: station.location.lng,
                })
              }
              className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-left transition hover:bg-white/[0.07]"
            >
              <span className="flex items-start justify-between gap-3">
                <span>
                  <span className="block text-sm font-black text-white">{station.name}</span>
                  <span className="mt-1 block text-xs font-semibold text-slate-400">
                    {station.location.label} · {station.location.zone}
                  </span>
                </span>
                <span className="rounded-xl px-2 py-1 text-[10px] font-black text-white" style={{ backgroundColor: meta.color }}>
                  {meta.label}
                </span>
              </span>
              <span className="mt-4 grid grid-cols-3 gap-2">
                <span className="rounded-xl bg-white/[0.05] p-2"><span className="block text-[10px] font-black text-slate-500">Порты</span><span className="font-black text-white">{station.availablePorts}/{station.totalPorts}</span></span>
                <span className="rounded-xl bg-white/[0.05] p-2"><span className="block text-[10px] font-black text-slate-500">Мощность</span><span className="font-black text-white">{station.powerKw} kW</span></span>
                <span className="rounded-xl bg-white/[0.05] p-2"><span className="block text-[10px] font-black text-slate-500">Типы</span><span className="font-black text-white">{station.connectorTypes.join(", ")}</span></span>
              </span>
            </button>
          );
        })}
      </div>
    </>
  );

  const renderHelpdeskPanel = () => (
    <>
      {renderPanelHeader("Helpdesk", "Чат поддержки")}
      <div className="grid min-h-0 flex-1 grid-rows-[auto_1fr_auto] gap-3 p-5">
        <div className="flex gap-2 overflow-x-auto">
          {tickets.map((ticket) => (
            <button key={ticket.id} type="button" onClick={() => setActiveTicketId(ticket.id)} className={`shrink-0 rounded-xl px-3 py-2 text-xs font-black ${activeTicketId === ticket.id ? "bg-red-500 text-white" : "bg-white/[0.06] text-slate-300"}`}>
              {ticket.subject}
            </button>
          ))}
        </div>
        <div className="overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          {activeTicket?.messages.map((message, index) => {
            const normalizedMessage = normalizeTicketMessage(message, activeTicket);

            return (
              <article key={normalizedMessage.id || `${activeTicket.id}-${index}`} className="mb-3 rounded-xl bg-white/[0.06] px-3 py-2">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-red-200">
                  {formatSenderTitle(normalizedMessage)}
                </p>
                <p className="mt-1 text-sm font-semibold leading-5 text-slate-200">
                  {normalizedMessage.body}
                </p>
              </article>
            );
          })}
        </div>
        <div className="grid gap-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => appendTicketMessage("добавлено +5 бесплатных минут компенсации.")}
              className="rounded-xl bg-blue-500/15 px-3 py-2 text-xs font-black text-blue-200"
            >
              +5 бесплатных минут
            </button>
            <button
              type="button"
              onClick={() => appendTicketMessage("аренда завершена удаленно без штрафа.")}
              className="rounded-xl bg-emerald-500/15 px-3 py-2 text-xs font-black text-emerald-200"
            >
              Завершить без штрафа
            </button>
          </div>
          <div className="flex gap-2">
            <input value={chatDraft} onChange={(event) => setChatDraft(event.target.value)} placeholder="Ответ админа..." className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#111a2b] px-3 py-3 text-sm font-bold text-white outline-none" />
            <button type="button" onClick={sendChatMessage} className="rounded-xl bg-red-500 px-4 text-white"><FiSend /></button>
          </div>
        </div>
      </div>
    </>
  );

  const renderAnalyticsPanel = () => {
    const plannedMaintenanceVehicles = plannedMaintenance
      .map((vehicleId) => getVehicle(vehicleId))
      .filter(Boolean);

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
        {maintenanceSeed.map((row) => {
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
    </>
    );
  };

  const renderRightPanel = () => {
    const panels = {
      control: renderControlPanel,
      users: renderUsersKycPanel,
      pricing: renderPricingPanel,
      billing: renderBillingPanel,
      kpi: renderKpiPanel,
      incidents: renderIncidentPanel,
      tasks: renderTasksPanel,
      chargers: renderChargersPanel,
      helpdesk: renderHelpdeskPanel,
      analytics: renderAnalyticsPanel,
    };

    const Panel = panels[activeSection] || renderControlPanel;
    return <Panel />;
  };

  const isChargingMap = activeSection === "chargers";

  return (
    <main className="min-h-screen overflow-hidden bg-[#08111f] text-slate-100">
      <style>
        {`
          .admin-map .leaflet-container {
            background: #08111f;
            font-family: inherit;
          }

          .admin-map .leaflet-control-attribution {
            background: rgba(8, 17, 31, 0.72);
            color: rgba(226, 232, 240, 0.62);
            font-size: 10px;
          }

          .admin-map .leaflet-control-attribution a {
            color: rgba(125, 211, 252, 0.8);
          }

          .admin-car-marker {
            background: transparent;
            border: 0;
          }

          .admin-tech-marker {
            background: transparent;
            border: 0;
          }

          .admin-station-marker {
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
            font-size: 15px;
            font-weight: 900;
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
            display: flex;
            height: 74px;
            justify-content: center;
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

      <div className="grid min-h-screen lg:grid-cols-[84px_minmax(0,1fr)]">
        <aside className="hidden border-r border-white/10 bg-[#0b1424]/95 px-3 py-5 lg:block">
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

        <section className="flex min-h-screen min-w-0 flex-col">
          <header className="z-[600] border-b border-white/10 bg-[#08111f]/92 px-4 py-4 backdrop-blur-xl lg:px-6">
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
                    Ситуационный Центр
                  </h1>
                </div>
              </div>

              <div className="flex flex-1 items-center justify-end gap-3">
                <div className="hidden rounded-xl border border-white/10 bg-white/[0.04] p-1 md:flex">
                  {[
                    ["admin", "Admin"],
                    ["super-admin", "Super"],
                  ].map(([role, label]) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => {
                        setAdminRole(role);
                        if (role === "admin" && sidebarItems.find((item) => item.id === activeSection)?.superOnly) {
                          setActiveSection("users");
                          setStatusFilter("all");
                        }
                      }}
                      className={`rounded-lg px-3 py-2 text-xs font-black transition ${
                        adminRole === role ? "bg-red-500 text-white" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <label className="hidden min-w-[280px] items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-400 md:flex">
                  <FiSearch className="text-slate-500" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Поиск по номеру, машине, зоне"
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
                      <div className="px-4 py-3 text-sm font-bold text-slate-400">Ничего не найдено</div>
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
                <button
                  type="button"
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300"
                  aria-label="Notifications"
                >
                  <FiBell />
                </button>
              </div>
            </div>
          </header>

          <div className="admin-control-grid grid flex-1 min-w-0 gap-0 xl:grid-cols-[minmax(0,1fr)_390px]">
            <section className="relative min-h-[620px] min-w-0">
              <div className="admin-map absolute inset-0">
                <MapContainer center={BAKU_CENTER} zoom={13} scrollWheelZoom className="h-full w-full">
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  />

                  {!isChargingMap && managedZones.map((zone) => {
                    const restricted = zone.type === "restricted";
                    const limited = zone.type === "limited";
                    const zoneColor = restricted ? "#ef4444" : limited ? "#f59e0b" : "#22c55e";
                    return (
                      <Polygon
                        key={zone.id}
                        positions={zone.positions}
                        pathOptions={{
                          color: zoneColor,
                          fillColor: zoneColor,
                          fillOpacity: restricted ? 0.16 : limited ? 0.14 : 0.12,
                          weight: restricted ? 2 : 1.5,
                          dashArray: restricted || limited ? "8 8" : "0",
                        }}
                      >
                        <Popup>{zone.name}</Popup>
                      </Polygon>
                    );
                  })}

                  {!isChargingMap && selectedVehicle?.liveStatus === "service" && (
                    <Circle
                      center={[selectedVehicle.location.lat, selectedVehicle.location.lng]}
                      radius={420}
                      pathOptions={{ color: "#ef4444", fillColor: "#ef4444", fillOpacity: 0.14, weight: 2 }}
                    />
                  )}

                  {!isChargingMap && draftZonePoints.length > 1 && (
                    <Polygon
                      positions={draftZonePoints}
                      pathOptions={{
                        color: draftZoneType === "restricted" ? "#ef4444" : draftZoneType === "limited" ? "#f59e0b" : "#22c55e",
                        fillColor: draftZoneType === "restricted" ? "#ef4444" : draftZoneType === "limited" ? "#f59e0b" : "#22c55e",
                        fillOpacity: 0.18,
                        weight: 2,
                        dashArray: "4 6",
                      }}
                    />
                  )}

                  {isChargingMap && chargingStations.map((station) => {
                    const meta = STATION_STATUS_META[station.status] || STATION_STATUS_META[CHARGING_STATION_STATUSES.ONLINE];

                    return (
                      <Marker
                        key={station.id}
                        position={[station.location.lat, station.location.lng]}
                        icon={createChargingStationIcon(station)}
                      >
                        <Popup>
                          <div className="min-w-[230px]">
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
                                {station.availablePorts}/{station.totalPorts} портов
                              </span>
                              <span className="rounded-lg bg-slate-100 px-2 py-1 font-black text-slate-700">
                                {station.connectorTypes.join(", ")}
                              </span>
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}

                  {!isChargingMap && filteredVehicles.map((vehicle) => {
                    const meta = STATUS_META[vehicle.liveStatus] || STATUS_META.available;
                    const active = selectedVehicleId === vehicle.id;

                    return (
                      <Marker
                        key={vehicle.id}
                        position={[vehicle.location.lat, vehicle.location.lng]}
                        icon={createVehicleIcon(vehicle, active)}
                        eventHandlers={{ click: () => focusVehicle(vehicle.id) }}
                      >
                        <Popup>
                          <div className="min-w-[220px]">
                            <p className="text-sm font-black text-slate-950">
                              {vehicle.brand} {vehicle.model}
                            </p>
                            <p className="mt-1 text-xs font-bold text-slate-500">{vehicle.plateNumber}</p>
                            <div className="mt-3 flex items-center justify-between gap-3">
                              <span className="rounded-full px-3 py-1 text-xs font-black text-white" style={{ backgroundColor: meta.color }}>
                                {meta.label}
                              </span>
                              <span className="text-xs font-black text-slate-700">{Math.round(vehicle.batteryPercent)}%</span>
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}

                  {!isChargingMap && activeSection === "tasks" &&
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
                  <ZoneDrawEvents
                    enabled={!isChargingMap && activeSection === "pricing" && isDrawingZone}
                    onAddPoint={(point) => setDraftZonePoints((points) => [...points, point])}
                  />
                </MapContainer>
              </div>

              <div className="pointer-events-none absolute left-4 right-4 top-4 z-[500] grid gap-3 md:left-6 md:right-auto md:grid-cols-4">
                {(isChargingMap
                  ? [
                      ["Станций", chargingStations.length, FiZap, "text-cyan-200"],
                      ["Онлайн", stationStats.onlineStations, FiActivity, "text-emerald-200"],
                      ["Порты", `${stationStats.availablePorts}/${stationStats.totalPorts}`, FiMap, "text-blue-200"],
                      ["Max kW", stationStats.maxPower, FiTool, "text-amber-200"],
                    ]
                  : [
                      ["Онлайн", liveVehicles.length, FiZap, "text-cyan-200"],
                      ["Свободны", fleetStats.available, FiMap, "text-emerald-200"],
                      ["В пути", fleetStats.activeTrips, FiNavigation, "text-blue-200"],
                      ["Заряд", `${fleetStats.averageBattery}%`, FiActivity, "text-amber-200"],
                    ]
                ).map(([label, value, Icon, color]) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-[#0b1424]/82 px-4 py-3 shadow-2xl shadow-black/20 backdrop-blur-xl">
                    <div className={`mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wide ${color}`}>
                      <Icon />
                      {label}
                    </div>
                    <p className="text-2xl font-black text-white">{value}</p>
                  </div>
                ))}
              </div>

              {!isChargingMap && (
              <div className="pointer-events-none absolute bottom-5 left-4 z-[500] w-[calc(100%-2rem)] rounded-2xl border border-white/10 bg-[#0b1424]/86 p-4 shadow-2xl shadow-black/30 backdrop-blur-xl md:left-6 md:w-[410px]">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-red-300">Selected Vehicle</p>
                    <h2 className="mt-2 truncate text-2xl font-black text-white">
                      {selectedVehicle.brand} {selectedVehicle.model}
                    </h2>
                    <p className="mt-1 text-sm font-bold text-slate-400">
                      {selectedVehicle.plateNumber} · {selectedVehicle.location.label}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-black ${STATUS_META[selectedVehicle.liveStatus].border} ${STATUS_META[selectedVehicle.liveStatus].text}`}>
                    {STATUS_META[selectedVehicle.liveStatus].label}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-white/[0.05] p-3">
                    <p className="text-[10px] font-black uppercase text-slate-500">Battery</p>
                    <p className="mt-1 text-lg font-black text-white">{Math.round(selectedVehicle.batteryPercent)}%</p>
                  </div>
                  <div className="rounded-xl bg-white/[0.05] p-3">
                    <p className="text-[10px] font-black uppercase text-slate-500">Speed</p>
                    <p className="mt-1 text-lg font-black text-white">{selectedVehicle.speedKmh}</p>
                  </div>
                  <div className="rounded-xl bg-white/[0.05] p-3">
                    <p className="text-[10px] font-black uppercase text-slate-500">Signal</p>
                    <p className="mt-1 text-lg font-black text-white">{selectedVehicle.signal}%</p>
                  </div>
                </div>

                {selectedVehicleNotification && (
                  <div className="mt-3 rounded-xl border border-amber-400/25 bg-amber-500/10 p-3">
                    <p className="text-[10px] font-black uppercase text-amber-200">Push пользователю</p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-slate-200">{selectedVehicleNotification.body}</p>
                  </div>
                )}
              </div>
              )}
            </section>

            <aside className="z-[520] flex min-h-[560px] flex-col border-l border-white/10 bg-[#0b1424]/96 shadow-2xl shadow-black/30 backdrop-blur-xl">
              {activeSection !== "control" ? (
                renderRightPanel()
              ) : (
                <>
              <div className="border-b border-white/10 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-red-300">Live Feed</p>
                    <h2 className="mt-2 text-xl font-black text-white">Стрим событий</h2>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-right">
                    <p className="text-[10px] font-black uppercase text-slate-500">Utilization</p>
                    <p className="text-lg font-black text-white">{fleetStats.utilization}%</p>
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
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm font-black text-slate-300">Операции сейчас</p>
                  <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-200">
                    WebSocket mock
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
                        Красные зоны мигают при попытке завершить аренду вне разрешённой парковки.
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
    </main>
  );
};

export default AdminControlRoom;
