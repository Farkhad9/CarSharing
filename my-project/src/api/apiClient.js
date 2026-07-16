export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5019";

export const getAccessToken = () => localStorage.getItem("electroStreetAccessToken");

const getAuthHeaders = () => {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const parseJson = (text) => {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
};

export const apiRequest = async (path, options = {}) => {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...getAuthHeaders(),
      ...options.headers,
    },
  });

  if (response.status === 204) return null;
  const responseText = await response.text();
  const data = parseJson(responseText);
  if (!response.ok) {
    const messages = Array.isArray(data?.errors)
      ? data.errors.map((item) => item.message).filter(Boolean)
      : [];
    const fallbackMessage = response.status === 401
      ? "You are not logged in or your session expired. Please sign in again."
      : response.status === 403
        ? "Access denied for this action."
        : `API request failed (${response.status}).`;
    const error = new Error(messages.length ? messages.join("\n") : data?.error || responseText || fallbackMessage);
    error.code = data?.errors?.[0]?.code;
    error.errors = data?.errors || [];
    error.status = response.status;
    throw error;
  }
  return data;
};

export const apiDownload = async (path, fileName = "download.pdf") => {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const error = new Error(data?.errors?.[0]?.message || data?.error || "File download failed.");
    error.code = data?.errors?.[0]?.code;
    error.status = response.status;
    throw error;
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
