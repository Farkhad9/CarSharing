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
  changePassword: async ({ currentPassword, newPassword, confirmPassword }) => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 15000);
    try {
      return await apiRequest("/api/users/me/password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
        signal: controller.signal,
      });
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error("Password update timed out. Please check that the API server is running and try again.", { cause: error });
      }
      throw error;
    } finally {
      window.clearTimeout(timeoutId);
    }
  },
  setPassword: async ({ newPassword, confirmPassword }) => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 15000);
    try {
      return await apiRequest("/api/users/me/password/set", {
        method: "POST",
        body: JSON.stringify({ newPassword, confirmPassword }),
        signal: controller.signal,
      });
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error("Password update timed out. Please check that the API server is running and try again.", { cause: error });
      }
      throw error;
    } finally {
      window.clearTimeout(timeoutId);
    }
  },
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
