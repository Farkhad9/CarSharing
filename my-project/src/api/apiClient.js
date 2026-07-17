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
  let response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        ...(options.body && !isFormData ? { "Content-Type": "application/json" } : {}),
        ...getAuthHeaders(),
        ...options.headers,
      },
    });
  } catch (networkError) {
    const error = new Error("Backend is offline. Start the API server and refresh the page.");
    error.code = "Network.BackendOffline";
    error.cause = networkError;
    throw error;
  }

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
  const popup = window.open("about:blank", "_blank");
  if (popup) {
    popup.document.title = "Opening receipt...";
    popup.document.body.innerHTML = "<p style=\"font-family: system-ui, sans-serif; padding: 24px;\">Opening receipt...</p>";
  }

  const writePopupMessage = (title, message) => {
    if (!popup) return;
    popup.document.title = title;
    popup.document.body.innerHTML = `
      <main style="font-family: system-ui, sans-serif; max-width: 560px; margin: 80px auto; padding: 28px; border: 1px solid #fecaca; border-radius: 18px; color: #18181b;">
        <p style="margin: 0 0 8px; color: #ef4444; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; font-size: 12px;">ElectroStreet receipt</p>
        <h1 style="margin: 0 0 14px; font-size: 28px;">${title}</h1>
        <p style="margin: 0; color: #71717a; line-height: 1.6;">${message}</p>
      </main>
    `;
  };

  try {
    const response = await fetch(`${API_URL}${path}`, {
      credentials: "include",
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const responseText = await response.text();
      const data = parseJson(responseText);
      const error = new Error(data?.errors?.[0]?.message || data?.error || responseText || "PDF could not be opened.");
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
    writePopupMessage("Receipt could not be opened", error.message || "Please refresh the dashboard and try again.");
    throw error;
  }
};
