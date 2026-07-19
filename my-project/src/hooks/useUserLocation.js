import { useEffect, useState } from "react";
import { DEFAULT_PICKUP_USER_LOCATION } from "../utils/pickupMetrics";

export const useUserLocation = () => {
  const [userLocation, setUserLocation] = useState(DEFAULT_PICKUP_USER_LOCATION);
  const [hasResolvedUserLocation, setHasResolvedUserLocation] = useState(() => !("geolocation" in navigator));

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
        setUserLocation(DEFAULT_PICKUP_USER_LOCATION);
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

  return { userLocation, hasResolvedUserLocation };
};
