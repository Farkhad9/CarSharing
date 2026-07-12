const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5019";

export const apiRequest = async (path, options = {}) => {
  const token = localStorage.getItem("electroStreetAccessToken");
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.errors?.[0]?.message || data?.error || "API request failed.");
    error.code = data?.errors?.[0]?.code;
    error.status = response.status;
    throw error;
  }
  return data;
};
