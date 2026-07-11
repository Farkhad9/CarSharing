import { staffAccounts, staffTasksSeed, STAFF_TASK_STATUSES } from "../data/staff";

const TASKS_STORAGE_KEY = "electroStreetStaffTasks";
const SESSION_STORAGE_KEY = "electroStreetStaffSession";
export const STAFF_TASKS_UPDATED_EVENT = "electrostreet:staff-tasks-updated";

const nowIso = () => new Date().toISOString();

const emitTasksUpdated = (tasks) => {
  window.dispatchEvent(new CustomEvent(STAFF_TASKS_UPDATED_EVENT, { detail: tasks }));
};

const readTasks = () => {
  try {
    const storedTasks = localStorage.getItem(TASKS_STORAGE_KEY);
    const parsedTasks = storedTasks ? JSON.parse(storedTasks) : null;
    return Array.isArray(parsedTasks) ? parsedTasks : staffTasksSeed;
  } catch {
    return staffTasksSeed;
  }
};

const writeTasks = (tasks) => {
  localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
  emitTasksUpdated(tasks);
  return tasks;
};

export const staffApi = {
  login(login, password) {
    const normalizedLogin = login.trim().toLowerCase();
    const account = staffAccounts.find(
      (item) => item.login.toLowerCase() === normalizedLogin && item.password === password
    );

    if (!account) {
      throw new Error("Неверный логин или пароль сотрудника.");
    }

    const session = {
      id: account.id,
      name: account.name,
      login: account.login,
      role: account.role,
      signedInAt: nowIso(),
    };

    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    return session;
  },

  getSession() {
    try {
      const storedSession = localStorage.getItem(SESSION_STORAGE_KEY);
      const session = storedSession ? JSON.parse(storedSession) : null;
      return staffAccounts.some((account) => account.id === session?.id) ? session : null;
    } catch {
      return null;
    }
  },

  logout() {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  },

  getStaff() {
    return staffAccounts.map((account) => ({
      id: account.id,
      name: account.name,
      login: account.login,
      role: account.role,
    }));
  },

  getTasks() {
    return readTasks();
  },

  getTasksForStaff(staffId) {
    return readTasks().filter((task) => task.assigneeId === staffId);
  },

  createTask(task) {
    const tasks = readTasks();
    const nextTask = {
      id: `staff-task-${Date.now()}`,
      status: STAFF_TASK_STATUSES.WAITING,
      priority: "Средний",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      ...task,
    };

    return writeTasks([nextTask, ...tasks]);
  },

  updateTaskStatus(taskId, status) {
    const tasks = readTasks().map((task) =>
      task.id === taskId ? { ...task, status, updatedAt: nowIso() } : task
    );

    return writeTasks(tasks);
  },

  subscribe(listener) {
    const handleCustomUpdate = (event) => listener(event.detail || readTasks());
    const handleStorageUpdate = (event) => {
      if (event.key === TASKS_STORAGE_KEY) listener(readTasks());
    };

    window.addEventListener(STAFF_TASKS_UPDATED_EVENT, handleCustomUpdate);
    window.addEventListener("storage", handleStorageUpdate);

    return () => {
      window.removeEventListener(STAFF_TASKS_UPDATED_EVENT, handleCustomUpdate);
      window.removeEventListener("storage", handleStorageUpdate);
    };
  },
};
