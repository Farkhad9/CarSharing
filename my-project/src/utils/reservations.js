export const RESERVATION_SECONDS = 15 * 60;
export const RESERVATIONS_STORAGE_KEY = "reservedVehicles";
export const LEGACY_RESERVATION_STORAGE_KEY = "reservedVehicle";
export const RESERVATIONS_UPDATED_EVENT = "electrostreet:reservations-updated";

export const readJson = (key, fallback = null) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

export const getReservationId = (reservation) => reservation?.id || reservation?.vehicleId;

export const isReservationExpired = (reservation, now = Date.now()) => {
  if (!reservation?.reservedAt || reservation?.unlockedAt || reservation?.tripStartedAt) {
    return false;
  }

  return now - new Date(reservation.reservedAt).getTime() >= RESERVATION_SECONDS * 1000;
};

export const readReservations = () => {
  const storedReservations = readJson(RESERVATIONS_STORAGE_KEY);

  if (Array.isArray(storedReservations)) {
    return storedReservations;
  }

  const legacyReservation = readJson(LEGACY_RESERVATION_STORAGE_KEY);
  return legacyReservation ? [legacyReservation] : [];
};

export const saveReservations = (reservations) => {
  localStorage.removeItem(LEGACY_RESERVATION_STORAGE_KEY);
  localStorage.setItem(RESERVATIONS_STORAGE_KEY, JSON.stringify(reservations));
  window.dispatchEvent(new CustomEvent(RESERVATIONS_UPDATED_EVENT));
};

export const cleanupExpiredReservations = (now = Date.now()) => {
  const reservations = readReservations();
  const activeReservations = reservations.filter((reservation) => !isReservationExpired(reservation, now));

  if (activeReservations.length !== reservations.length) {
    saveReservations(activeReservations);
  }

  return activeReservations;
};
