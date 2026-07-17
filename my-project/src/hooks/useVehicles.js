import { useEffect, useState } from "react";
import { vehicleApi } from "../api/vehicleApi";

export const useVehicles = () => {
  const [vehicles, setVehicles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadVehicles = async () => {
      setIsLoading(true);
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
          setIsLoading(false);
        }
      }
    };

    loadVehicles();

    return () => {
      isMounted = false;
    };
  }, []);

  return { vehicles, isLoading, error };
};
