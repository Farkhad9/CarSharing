import { VEHICLE_STATUSES } from "../data/statuses";

export const CHARGING_INTERVAL_MS = 30_000;
export const CHARGING_READY_PERCENT = 80;
export const MIN_AVAILABLE_BATTERY_PERCENT = 40;

export const resolveStatusAfterTrip = (vehicle) => {
  const batteryPercent = Number(vehicle?.batteryPercent ?? 0);

  return batteryPercent >= MIN_AVAILABLE_BATTERY_PERCENT
    ? VEHICLE_STATUSES.AVAILABLE
    : VEHICLE_STATUSES.CHARGING;
};

export const simulateCharging = (vehicle, onUpdate) => {
  if (
    !vehicle ||
    vehicle.status !== VEHICLE_STATUSES.CHARGING ||
    typeof onUpdate !== "function"
  ) {
    return null;
  }

  let currentBatteryPercent = Number(vehicle.batteryPercent ?? 0);

  const emitUpdate = (batteryPercent, status) => {
    onUpdate({
      ...vehicle,
      batteryPercent,
      status,
    });
  };

  if (currentBatteryPercent >= CHARGING_READY_PERCENT) {
    emitUpdate(currentBatteryPercent, VEHICLE_STATUSES.AVAILABLE);
    return null;
  }

  const intervalId = setInterval(() => {
    currentBatteryPercent = Math.min(currentBatteryPercent + 1, 100);
    const nextStatus =
      currentBatteryPercent >= CHARGING_READY_PERCENT
        ? VEHICLE_STATUSES.AVAILABLE
        : VEHICLE_STATUSES.CHARGING;

    emitUpdate(currentBatteryPercent, nextStatus);

    if (nextStatus === VEHICLE_STATUSES.AVAILABLE) {
      clearInterval(intervalId);
    }
  }, CHARGING_INTERVAL_MS);

  return intervalId;
};
