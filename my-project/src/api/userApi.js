import { apiRequest } from "./apiClient";
import { normalizeRole } from "./adminUsersApi";

const normalizeUser = (user) => ({
  ...user,
  roleKey: normalizeRole(user.role),
  name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
  avatarInitial: user.firstName?.charAt(0)?.toUpperCase() || "U",
});

export const userApi = {
  getMe: async () => normalizeUser(await apiRequest("/api/users/me")),
  submitIdentityDocuments: async ({ driverLicense, passport }) => {
    const body = new FormData();
    body.append("driverLicense", driverLicense);
    body.append("passport", passport);
    return normalizeUser(await apiRequest("/api/users/me/identity-documents", {
      method: "POST",
      body,
    }));
  },
};
