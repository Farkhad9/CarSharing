import { apiRequest } from "./apiClient";

const persistSession = (response) => {
  localStorage.setItem("electroStreetAccessToken", response.accessToken);
  const user = {
    ...response.user,
    name: `${response.user.firstName} ${response.user.lastName}`.trim(),
    avatarInitial: response.user.firstName?.charAt(0)?.toUpperCase() || "U",
  };
  localStorage.setItem("electroStreetUser", JSON.stringify(user));
  return user;
};

export const authApi = {
  register: (request) => apiRequest("/api/auth/register", { method: "POST", body: JSON.stringify(request) }),
  login: async (email, password) => persistSession(await apiRequest("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  })),
  logout: async () => {
    try { await apiRequest("/api/auth/logout", { method: "POST" }); } finally {
      localStorage.removeItem("electroStreetAccessToken");
      localStorage.removeItem("electroStreetUser");
    }
  },
};
