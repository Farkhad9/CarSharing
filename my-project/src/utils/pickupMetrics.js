export const DEFAULT_PICKUP_USER_LOCATION = [40.3772, 49.8475];
export const WALKING_SPEED_METERS_PER_MINUTE = 80;

const toRadians = (degrees) => degrees * (Math.PI / 180);

export const getDistanceMeters = ([fromLat, fromLng], [toLat, toLng]) => {
  if (![fromLat, fromLng, toLat, toLng].every(Number.isFinite)) {
    return Number.POSITIVE_INFINITY;
  }

  const earthRadiusMeters = 6371000;
  const deltaLat = toRadians(toLat - fromLat);
  const deltaLng = toRadians(toLng - fromLng);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(toRadians(fromLat)) *
      Math.cos(toRadians(toLat)) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const formatPickupDistance = (meters) => {
  if (!Number.isFinite(meters)) return "";
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
};

export const getWalkMinutes = (meters) => {
  if (!Number.isFinite(meters)) return 1;
  return Math.max(1, Math.round(meters / WALKING_SPEED_METERS_PER_MINUTE));
};

export const getWalkingRouteUrl = ([fromLat, fromLng], [toLat, toLng]) =>
  `https://router.project-osrm.org/route/v1/foot/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson&steps=false`;
