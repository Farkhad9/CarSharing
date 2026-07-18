import { useEffect, useState } from "react";
import { vehicleApi } from "../api/vehicleApi";

export const useVehicles = () => {
  const [vehicles, setVehicles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadVehicles = async (options = {}) => {
      const silent = options.silent === true;
      if (!silent) setIsLoading(true);
      setError("");

      try {
        const items = await vehicleApi.getVehicles();
        if (isMounted) {
          setVehicles(Array.isArray(items) ? items : []);
        }
      } catch (loadError) {
        if (isMounted) {
          setVehicles([]);
          setError(loadError.message || "Vehicles could not be loaded.");
        }
      } finally {
        if (isMounted) {
          if (!silent) setIsLoading(false);
        }
      }
    };

    loadVehicles();
    const interval = window.setInterval(() => loadVehicles({ silent: true }), 5000);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, []);

  return { vehicles, isLoading, error };
};
