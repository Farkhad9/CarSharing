export {
  CHARGING_STATION_STATUSES,
  TRIP_STATUSES,
  USER_ROLES,
  VEHICLE_STATUSES,
  VEHICLE_STATUS_DETAILS,
} from "./statuses";
export { vehicles } from "./vehicles";
export { users } from "./users";
export { trips } from "./trips";
export { chargingStations } from "./chargingStations";

import { chargingStations } from "./chargingStations";
import { trips } from "./trips";
import { users } from "./users";
import { vehicles } from "./vehicles";

export const electroStreetData = {
  vehicles,
  users,
  trips,
  chargingStations,
};
