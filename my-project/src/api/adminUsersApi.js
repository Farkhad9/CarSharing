import { apiRequest } from "./apiClient";

const buildQuery = (filters = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, value);
    }
  });
  const query = params.toString();
  return query ? `?${query}` : "";
};

export const USER_ROLES = {
  Rider: 1,
  Staff: 2,
  Admin: 3,
  SuperAdmin: 4,
};

export const USER_VERIFICATION_STATUSES = {
  Pending: 1,
  Verified: 2,
  Rejected: 3,
  Internal: 4,
};

export const USER_BLOCK_DURATIONS = {
  FifteenMinutes: 1,
  OneDay: 2,
  Forever: 3,
};

export const normalizeRole = (role) => {
  if (role === USER_ROLES.SuperAdmin || role === "SuperAdmin" || role === "super-admin") return "super-admin";
  if (role === USER_ROLES.Admin || role === "Admin" || role === "admin") return "admin";
  if (role === USER_ROLES.Staff || role === "Staff" || role === "staff") return "staff";
  return "rider";
};

export const adminUsersApi = {
  getUsers: (filters) => apiRequest(`/api/admin/users${buildQuery(filters)}`),
  getUser: (id) => apiRequest(`/api/admin/users/${id}`),
  createStaff: (payload) => apiRequest("/api/admin/users/staff", {
    method: "POST",
    body: JSON.stringify(payload),
  }),
  createAdmin: (payload) => apiRequest("/api/admin/users/admin", {
    method: "POST",
    body: JSON.stringify(payload),
  }),
  updateRole: (id, role) => apiRequest(`/api/admin/users/${id}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  }),
  blockUser: (id, payload) => apiRequest(`/api/admin/users/${id}/block`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  }),
  unblockUser: (id) => apiRequest(`/api/admin/users/${id}/unblock`, {
    method: "PATCH",
  }),
  updateVerification: (id, status) => apiRequest(`/api/admin/users/${id}/verification`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  }),
};
