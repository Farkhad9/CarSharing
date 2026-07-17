import { apiRequest } from "./apiClient";
import { normalizeRole } from "./adminUsersApi";

const persistSession = (response) => {
  localStorage.setItem("electroStreetAccessToken", response.accessToken);
  return persistUser(response.user);
};

const persistUser = (sourceUser) => {
  const user = {
    ...sourceUser,
    roleKey: normalizeRole(sourceUser.role),
    name: `${sourceUser.firstName} ${sourceUser.lastName}`.trim(),
    avatarInitial: sourceUser.firstName?.charAt(0)?.toUpperCase() || "U",
  };
  localStorage.setItem("electroStreetUser", JSON.stringify(user));
  return user;
};

export const authApi = {
  register: (request) => apiRequest("/api/auth/register", { method: "POST", body: JSON.stringify(request) }),
  verifyEmail: async (id) => persistUser(await apiRequest(`/api/auth/verify-email/${id}`, { method: "POST" })),
  login: async (email, password) => persistSession(await apiRequest("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  })),
  logout: async () => {
    try { await apiRequest("/api/auth/logout", { method: "POST" }); } finally {
      localStorage.removeItem("electroStreetAccessToken");
      localStorage.removeItem("electroStreetUser");
      localStorage.removeItem("electroStreetAdminSession");
      localStorage.removeItem("electroStreetStaffSession");
    }
  },
};
