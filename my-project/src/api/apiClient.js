const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5019";

const getAuthHeaders = () => {
  const token = localStorage.getItem("electroStreetAccessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const apiRequest = async (path, options = {}) => {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...getAuthHeaders(),
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

export const apiDownload = async (path, fileName = "download.pdf") => {
  const response = await fetch(`${API_URL}${path}`, {
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
