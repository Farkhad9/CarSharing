export const VEHICLE_STATUSES = Object.freeze({
  AVAILABLE: "available",
  RESERVED: "reserved",
  IN_USE: "in_use",
  CHARGING: "charging",
  COMPLETED: "completed",
});

export const VEHICLE_STATUS_DETAILS = Object.freeze({
  [VEHICLE_STATUSES.AVAILABLE]: {
    label: "Доступно",
    labelEn: "Available",
    tone: "emerald",
  },
  [VEHICLE_STATUSES.RESERVED]: {
    label: "Зарезервировано",
    labelEn: "Reserved",
    tone: "teal",
  },
  [VEHICLE_STATUSES.IN_USE]: {
    label: "Используется",
    labelEn: "In use",
    tone: "violet",
  },
  [VEHICLE_STATUSES.CHARGING]: {
    label: "Заряжается",
    labelEn: "Charging",
    tone: "amber",
  },
  [VEHICLE_STATUSES.COMPLETED]: {
    label: "Завершено",
    labelEn: "Completed",
    tone: "slate",
  },
});

export const USER_ROLES = Object.freeze({
  RIDER: "rider",
  ADMIN: "admin",
  STAFF: "staff",
});

export const TRIP_STATUSES = Object.freeze({
  RESERVED: "reserved",
  ACTIVE: "active",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
});

export const CHARGING_STATION_STATUSES = Object.freeze({
  ONLINE: "online",
  BUSY: "busy",
  MAINTENANCE: "maintenance",
  OFFLINE: "offline",
});
