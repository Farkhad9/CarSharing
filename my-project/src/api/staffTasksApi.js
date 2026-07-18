import { apiRequest } from "./apiClient";

export const STAFF_TASK_STATUSES = {
  Waiting: 1,
  InProgress: 2,
  Done: 3,
};

export const STAFF_TASK_PRIORITIES = {
  Low: 1,
  Medium: 2,
  High: 3,
};

export const staffTasksApi = {
  getMyTasks: () => apiRequest("/api/staff/tasks/my"),
  updateMyTaskStatus: (id, status) => apiRequest(`/api/staff/tasks/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  }),
};

export const adminStaffTasksApi = {
  getTasks: () => apiRequest("/api/admin/staff/tasks"),
  createTask: (payload) => apiRequest("/api/admin/staff/tasks", {
    method: "POST",
    body: JSON.stringify(payload),
  }),
  updateTaskStatus: (id, status) => apiRequest(`/api/admin/staff/tasks/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  }),
  reassignTask: (id, assigneeId) => apiRequest(`/api/admin/staff/tasks/${id}/assignee`, {
    method: "PATCH",
    body: JSON.stringify({ assigneeId }),
  }),
};
