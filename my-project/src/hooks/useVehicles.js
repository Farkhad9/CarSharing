import { useEffect, useState } from "react";
import { vehicleApi } from "../api/vehicleApi";

const POLL_INTERVAL_MS = 5000;

let vehicleState = {
  vehicles: [],
  isLoading: true,
  error: "",
};
let subscribers = new Set();
let pollIntervalId = null;
let inFlightRequest = null;

const emit = () => {
  subscribers.forEach((subscriber) => subscriber(vehicleState));
};

const setVehicleState = (patch) => {
  vehicleState = { ...vehicleState, ...patch };
  emit();
};

const loadVehicles = async ({ silent = false } = {}) => {
  if (inFlightRequest) return inFlightRequest;

  if (!silent) {
    setVehicleState({ isLoading: true, error: "" });
  } else if (vehicleState.error) {
    setVehicleState({ error: "" });
  }

  inFlightRequest = vehicleApi.getVehicles()
    .then((items) => {
      setVehicleState({
        vehicles: Array.isArray(items) ? items : [],
        isLoading: false,
        error: "",
      });
      return items;
    })
    .catch((error) => {
      setVehicleState({
        vehicles: [],
        isLoading: false,
        error: error.message || "Vehicles could not be loaded.",
      });
      throw error;
    })
    .finally(() => {
      inFlightRequest = null;
    });

  return inFlightRequest;
};

const startPolling = () => {
  if (pollIntervalId) return;

  loadVehicles().catch(() => {});
  pollIntervalId = window.setInterval(() => {
    loadVehicles({ silent: true }).catch(() => {});
  }, POLL_INTERVAL_MS);
};

const stopPolling = () => {
  if (!pollIntervalId) return;

  window.clearInterval(pollIntervalId);
  pollIntervalId = null;
};

export const refreshVehicles = () => loadVehicles({ silent: true }).catch(() => {});

export const useVehicles = () => {
  const [state, setState] = useState(vehicleState);

  useEffect(() => {
    subscribers.add(setState);
    startPolling();

    return () => {
      subscribers.delete(setState);
      if (subscribers.size === 0) {
        stopPolling();
      }
    };
  }, []);

  return state;
};
