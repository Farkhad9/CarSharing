import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiCheckCircle, FiClock, FiLogOut, FiRefreshCw, FiTool } from "react-icons/fi";
import { authApi } from "../../api/authApi";
import { createOperationsConnection, REALTIME_EVENTS, startConnection, stopConnection } from "../../api/realtimeClient";
import { STAFF_TASK_STATUSES, staffTasksApi } from "../../api/staffTasksApi";
import { vehicleApi } from "../../api/vehicleApi";

const SESSION_STORAGE_KEY = "electroStreetStaffSession";

const statusLabels = {
  [STAFF_TASK_STATUSES.Done]: "Done",
  [STAFF_TASK_STATUSES.InProgress]: "In progress",
  [STAFF_TASK_STATUSES.Waiting]: "Waiting",
};

const priorityLabels = {
  1: "Low",
  2: "Medium",
  3: "High",
};

const priorityStyles = {
  1: "border-sky-300 bg-sky-50 text-sky-700",
  2: "border-amber-300 bg-amber-50 text-amber-700",
  3: "border-red-300 bg-red-50 text-red-700",
};

const statusStyles = {
  [STAFF_TASK_STATUSES.Done]: "border-emerald-400/30 bg-emerald-500/10 text-emerald-700",
  [STAFF_TASK_STATUSES.InProgress]: "border-blue-400/30 bg-blue-500/10 text-blue-700",
  [STAFF_TASK_STATUSES.Waiting]: "border-amber-400/30 bg-amber-500/10 text-amber-700",
};

const statusOptions = [
  STAFF_TASK_STATUSES.Done,
  STAFF_TASK_STATUSES.InProgress,
  STAFF_TASK_STATUSES.Waiting,
];

const filterItems = [
  { id: "all", label: "All", icon: FiTool },
  { id: STAFF_TASK_STATUSES.Done, label: "Done", icon: FiCheckCircle },
  { id: STAFF_TASK_STATUSES.InProgress, label: "In progress", icon: FiRefreshCw },
  { id: STAFF_TASK_STATUSES.Waiting, label: "Waiting", icon: FiClock },
];

const readSession = () => {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) || "null");
    const token = localStorage.getItem("electroStreetAccessToken");
    return token && session?.id ? session : null;
  } catch {
    return null;
  }
};

const upsertTask = (items, nextTask) => {
  const exists = items.some((task) => task.id === nextTask.id);
  return exists
    ? items.map((task) => (task.id === nextTask.id ? nextTask : task))
    : [nextTask, ...items];
};

const parseLocalDate = (value) => {
  if (!value) return null;
  return new Date(value);
};

const formatDate = (value) => {
  const date = parseLocalDate(value);
  if (!date || Number.isNaN(date.getTime())) return "No deadline";

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const getRemainingMs = (task, now) => {
  const dueDate = parseLocalDate(task.dueAt);
  if (!dueDate || Number.isNaN(dueDate.getTime())) return Number.POSITIVE_INFINITY;
  if (task.status === STAFF_TASK_STATUSES.Done) return Number.POSITIVE_INFINITY;
  return dueDate.getTime() - now;
};

const formatCountdown = (task, now) => {
  const remainingMs = getRemainingMs(task, now);
  if (!Number.isFinite(remainingMs)) return "No countdown";
  if (remainingMs <= 0) return "Overdue";

  const totalMinutes = Math.ceil(remainingMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours ? `${hours}h ${minutes}m left` : `${minutes}m left`;
};

const StaffDashboard = () => {
  const [session, setSession] = useState(readSession);
  const [tasks, setTasks] = useState([]);
  const [backendVehicles, setBackendVehicles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [refreshNotice, setRefreshNotice] = useState("");
  const [hasLoadedTasks, setHasLoadedTasks] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");
  const [now, setNow] = useState(() => Date.now());
  const hasLoadedTasksRef = useRef(false);

  const loadTasks = useCallback(async () => {
    if (!session) return;
    setIsLoading(true);
    setRefreshNotice("");
    if (!hasLoadedTasksRef.current) {
      setActionError("");
    }
    try {
      const [nextTasks, nextVehicles] = await Promise.all([
        staffTasksApi.getMyTasks(),
        vehicleApi.getVehicles(),
      ]);
      setTasks(Array.isArray(nextTasks) ? nextTasks : []);
      setBackendVehicles(Array.isArray(nextVehicles) ? nextVehicles : []);
      hasLoadedTasksRef.current = true;
      setHasLoadedTasks(true);
    } catch (error) {
      if (hasLoadedTasksRef.current) {
        setRefreshNotice("Refresh failed. Showing current tasks.");
      } else {
        setActionError(error.message || "Tasks are unavailable. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (!session) {
      window.location.href = "/staff-login";
      return;
    }

    const timer = window.setTimeout(loadTasks, 0);
    return () => window.clearTimeout(timer);
  }, [loadTasks, session]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!session) return undefined;

    const connection = createOperationsConnection();
    const handleTaskChange = (task) => {
      setTasks((items) => upsertTask(items, task));
      hasLoadedTasksRef.current = true;
      setHasLoadedTasks(true);
      setRefreshNotice("");
      setActionError("");
    };

    connection.on(REALTIME_EVENTS.StaffTaskCreated, handleTaskChange);
    connection.on(REALTIME_EVENTS.StaffTaskUpdated, handleTaskChange);
    connection.onreconnecting(() => setRefreshNotice("Live updates reconnecting..."));
    connection.onreconnected(() => setRefreshNotice(""));
    connection.onclose(() => setRefreshNotice("Live updates paused. Refresh is still available."));

    startConnection(connection).catch(() => {
      setRefreshNotice("Live updates unavailable. Refresh is still available.");
    });

    return () => {
      connection.off(REALTIME_EVENTS.StaffTaskCreated, handleTaskChange);
      connection.off(REALTIME_EVENTS.StaffTaskUpdated, handleTaskChange);
      stopConnection(connection).catch(() => {});
    };
  }, [session]);

  const stats = useMemo(
    () => ({
      all: tasks.length,
      [STAFF_TASK_STATUSES.Done]: tasks.filter((task) => task.status === STAFF_TASK_STATUSES.Done).length,
      [STAFF_TASK_STATUSES.InProgress]: tasks.filter((task) => task.status === STAFF_TASK_STATUSES.InProgress).length,
      [STAFF_TASK_STATUSES.Waiting]: tasks.filter((task) => task.status === STAFF_TASK_STATUSES.Waiting).length,
    }),
    [tasks]
  );

  const visibleTasks = useMemo(() => {
    const filtered = activeFilter === "all"
      ? tasks
      : tasks.filter((task) => task.status === activeFilter);

    return [...filtered].sort((first, second) => {
      const firstRemaining = getRemainingMs(first, now);
      const secondRemaining = getRemainingMs(second, now);

      if (firstRemaining !== secondRemaining) return firstRemaining - secondRemaining;
      return new Date(second.createdAt || 0).getTime() - new Date(first.createdAt || 0).getTime();
    });
  }, [activeFilter, now, tasks]);

  const updateStatus = async (taskId, status) => {
    setActionError("");
    try {
      const updatedTask = await staffTasksApi.updateMyTaskStatus(taskId, status);
      setTasks((items) => items.map((task) => (task.id === taskId ? updatedTask : task)));
    } catch (error) {
      setActionError(error.message || "Task status could not be updated.");
    }
  };

  const getVehicleLabel = (vehicleId) => {
    const vehicle = backendVehicles.find((item) => item.id === vehicleId);
    return vehicle
      ? `${vehicle.plateNumber} · ${vehicle.brand} ${vehicle.model}`
      : vehicleId;
  };

  const handleLogout = async () => {
    await authApi.logout();
    setSession(null);
    window.location.href = "/staff-login";
  };

  if (!session) return null;

  return (
    <main className="min-h-screen bg-[#f4f6f8] text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <a href="/" className="text-xs font-black uppercase tracking-[0.25em] text-red-500">
              ElectroStreet Staff
            </a>
            <h1 className="mt-2 text-3xl font-black tracking-tight">Hello, {session.name}</h1>
            <p className="mt-1 text-sm font-semibold text-zinc-500">{session.email}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-200 px-4 py-3 text-sm font-black transition hover:bg-zinc-100"
            >
              <FiLogOut />
              Log out
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="grid gap-3 self-start rounded-lg border border-zinc-200 bg-white p-4">
          {filterItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveFilter(id)}
              className={`flex items-center justify-between rounded-lg p-4 text-left transition ${
                activeFilter === id ? "bg-red-50 ring-1 ring-red-200" : "bg-zinc-50 hover:bg-zinc-100"
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-black text-zinc-600">
                <Icon />
                {label}
              </span>
              <span className="text-xl font-black">{stats[id]}</span>
            </button>
          ))}
        </aside>

        <section className="min-w-0">
          <div className="mb-4">
            <h2 className="text-xl font-black">My tasks</h2>
            <p className="text-sm font-semibold text-zinc-500">
              Tasks assigned by an administrator. Closest deadlines are shown first.
            </p>
          </div>

          <div className="grid gap-3">
            {isLoading && hasLoadedTasks && (
              <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">
                <FiRefreshCw className="animate-spin" />
                Updating tasks...
              </div>
            )}

            {refreshNotice && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700">
                {refreshNotice}
              </p>
            )}

            {actionError && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                {actionError}
              </p>
            )}

            {isLoading && !tasks.length ? (
              <div className="rounded-lg border border-zinc-200 bg-white p-10 text-center">
                <p className="text-lg font-black">Loading tasks...</p>
              </div>
            ) : visibleTasks.length ? (
              visibleTasks.map((task) => {
                const countdown = formatCountdown(task, now);
                const overdue = countdown === "Overdue";

                return (
                  <article key={task.id} className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-black">{task.title}</h3>
                          <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusStyles[task.status]}`}>
                            {statusLabels[task.status] || "Unknown"}
                          </span>
                          <span className={`rounded-full border px-3 py-1 text-xs font-black ${priorityStyles[task.priority] || "border-zinc-200 bg-zinc-50 text-zinc-600"}`}>
                            {priorityLabels[task.priority] || task.priority}
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-semibold leading-6 text-zinc-600">{task.description}</p>
                        <div className="mt-4 flex flex-wrap gap-2 text-xs font-black text-zinc-500">
                          <span className={`rounded-lg px-3 py-2 ${overdue ? "bg-red-100 text-red-700" : "bg-zinc-100"}`}>
                            {countdown}
                          </span>
                          <span className="rounded-lg bg-zinc-100 px-3 py-2">Due: {formatDate(task.dueAt)}</span>
                          {task.vehicleId && (
                            <span className="rounded-lg bg-zinc-100 px-3 py-2">Vehicle: {getVehicleLabel(task.vehicleId)}</span>
                          )}
                        </div>
                      </div>

                      <div className="grid shrink-0 grid-cols-1 gap-2 sm:grid-cols-3 lg:w-[360px]">
                        {statusOptions.map((status) => (
                          <button
                            key={status}
                            type="button"
                            onClick={() => updateStatus(task.id, status)}
                            className={`rounded-lg border px-3 py-3 text-xs font-black transition ${
                              task.status === status
                                ? statusStyles[status]
                                : "border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50"
                            }`}
                          >
                            {statusLabels[status]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-10 text-center">
                <p className="text-lg font-black">No tasks in this view</p>
                <p className="mt-2 text-sm font-semibold text-zinc-500">
                  Try another status filter or refresh the page.
                </p>
              </div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
};

export default StaffDashboard;
