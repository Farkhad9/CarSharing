import { apiRequest } from "./apiClient";

export const PRICING_MODES = {
  Standard: 1,
  High: 2,
  Low: 3,
};

export const normalizePricingMode = (mode) => {
  const normalized = String(mode ?? "").toLowerCase();
  if (mode === PRICING_MODES.High || normalized === "2" || normalized === "high") return "High";
  if (mode === PRICING_MODES.Low || normalized === "3" || normalized === "low") return "Low";
  return "Standard";
};

export const adminPricingApi = {
  getCurrent: () => apiRequest("/api/admin/pricing/current"),
  updateMode: (mode) => apiRequest("/api/admin/pricing/mode", {
    method: "PATCH",
    body: JSON.stringify({ mode }),
  }),
};
