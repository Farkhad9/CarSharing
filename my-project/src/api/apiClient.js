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

const isBlockedError = (error) =>
  error?.code === "User.Blocked" || error?.errors?.some((item) => item.code === "User.Blocked");

const notifyBlockedSession = (error) => {
  if (!isBlockedError(error)) return;

  localStorage.removeItem("electroStreetAccessToken");
  localStorage.removeItem("electroStreetUser");
  window.dispatchEvent(new CustomEvent("electrostreet:account-blocked", {
    detail: error.message || "Your account is blocked. Contact support for details.",
  }));
};

export const apiRequest = async (path, options = {}) => {
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body && !isFormData ? { "Content-Type": "application/json" } : {}),
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
    notifyBlockedSession(error);
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
    error.errors = data?.errors || [];
    error.status = response.status;
    notifyBlockedSession(error);
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

export const apiOpenPdf = async (path) => {
  const popup = window.open("", "_blank", "noopener,noreferrer");

  try {
    const response = await fetch(`${API_URL}${path}`, {
      credentials: "include",
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      const error = new Error(data?.errors?.[0]?.message || data?.error || "PDF could not be opened.");
      error.code = data?.errors?.[0]?.code;
      error.errors = data?.errors || [];
      error.status = response.status;
      notifyBlockedSession(error);
      throw error;
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);

    if (popup) {
      popup.location.href = url;
      window.setTimeout(() => window.URL.revokeObjectURL(url), 60000);
      return;
    }

    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 60000);
  } catch (error) {
    if (popup) popup.close();
    throw error;
  }
};
