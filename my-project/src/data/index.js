export {
  CHARGING_STATION_STATUSES,
  TRIP_STATUSES,
  USER_ROLES,
  VEHICLE_STATUSES,
  VEHICLE_STATUS_DETAILS,
} from "./statuses";
export { vehicles } from "./vehicles";
export { chargingStations } from "./chargingStations";

import { chargingStations } from "./chargingStations";
import { vehicles } from "./vehicles";

export const electroStreetData = {
  vehicles,
  chargingStations,
};
