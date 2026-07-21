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

export const STAFF_TASK_TYPES = {
  General: 0,
  Charging: 1,
  Cleaning: 2,
  PhotoVerification: 3,
  Kyc: 4,
  Support: 5,
  Incident: 6,
  Maintenance: 7,
};

const statusByValue = {
  1: STAFF_TASK_STATUSES.Waiting,
  2: STAFF_TASK_STATUSES.InProgress,
  3: STAFF_TASK_STATUSES.Done,
  Waiting: STAFF_TASK_STATUSES.Waiting,
  InProgress: STAFF_TASK_STATUSES.InProgress,
  Done: STAFF_TASK_STATUSES.Done,
};

const typeByValue = {
  0: STAFF_TASK_TYPES.General,
  1: STAFF_TASK_TYPES.Charging,
  2: STAFF_TASK_TYPES.Cleaning,
  3: STAFF_TASK_TYPES.PhotoVerification,
  4: STAFF_TASK_TYPES.Kyc,
  5: STAFF_TASK_TYPES.Support,
  6: STAFF_TASK_TYPES.Incident,
  7: STAFF_TASK_TYPES.Maintenance,
  General: STAFF_TASK_TYPES.General,
  Charging: STAFF_TASK_TYPES.Charging,
  Cleaning: STAFF_TASK_TYPES.Cleaning,
  PhotoVerification: STAFF_TASK_TYPES.PhotoVerification,
  Kyc: STAFF_TASK_TYPES.Kyc,
  Support: STAFF_TASK_TYPES.Support,
  Incident: STAFF_TASK_TYPES.Incident,
  Maintenance: STAFF_TASK_TYPES.Maintenance,
};

export const normalizeStaffTask = (task) => task
  ? {
    ...task,
    status: statusByValue[task.status] || Number(task.status) || task.status,
    priority: Number(task.priority || 0),
    type: typeByValue[task.type] ?? Number(task.type || 0),
  }
  : null;

const normalizeTasks = (tasks) =>
  Array.isArray(tasks) ? tasks.map(normalizeStaffTask).filter(Boolean) : [];

export const staffTasksApi = {
  getMyTasks: async () => normalizeTasks(await apiRequest("/api/staff/tasks/my")),
  updateMyTaskStatus: async (id, status) => normalizeStaffTask(await apiRequest(`/api/staff/tasks/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  })),
};

export const adminStaffTasksApi = {
  getTasks: async () => normalizeTasks(await apiRequest("/api/admin/staff/tasks")),
  createTask: async (payload) => normalizeStaffTask(await apiRequest("/api/admin/staff/tasks", {
    method: "POST",
    body: JSON.stringify(payload),
  })),
  updateTaskStatus: async (id, status) => normalizeStaffTask(await apiRequest(`/api/admin/staff/tasks/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  })),
  reassignTask: async (id, assigneeId) => {
    const result = await apiRequest(`/api/admin/staff/tasks/${id}/assignee`, {
      method: "PATCH",
      body: JSON.stringify({ assigneeId }),
    });

    return result?.task ? { ...result, task: normalizeStaffTask(result.task) } : normalizeStaffTask(result);
  },
};
