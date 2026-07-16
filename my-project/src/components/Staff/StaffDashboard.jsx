import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiCamera, FiCheckCircle, FiClock, FiLogOut, FiRefreshCw, FiTool, FiX } from "react-icons/fi";
import { authApi } from "../../api/authApi";
import { API_URL } from "../../api/apiClient";
import { createOperationsConnection, REALTIME_EVENTS, startConnection, stopConnection } from "../../api/realtimeClient";
import { STAFF_TASK_STATUSES, staffTasksApi } from "../../api/staffTasksApi";
import { tripCompletionRequestsApi } from "../../api/tripCompletionRequestsApi";
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

const toCompletionTask = (request, vehicleLabel) => ({
  id: `completion-${request.id}`,
  completionRequestId: request.id,
  title: `Review trip photos: ${vehicleLabel}`,
  description: `Customer submitted trip completion photos. Duration: ${request.durationMinutes || "n/a"} min. Fare: ${Number(request.finalRideCost || 0).toFixed(2)} ${request.currency || "AZN"}.`,
  vehicleId: request.vehicleId,
  priority: 3,
  dueAt: request.requestedAt,
  status: request.localStatus || STAFF_TASK_STATUSES.Waiting,
  createdAt: request.requestedAt,
});

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
  const [completionRequests, setCompletionRequests] = useState([]);
  const [backendVehicles, setBackendVehicles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [refreshNotice, setRefreshNotice] = useState("");
  const [hasLoadedTasks, setHasLoadedTasks] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");
  const [completionError, setCompletionError] = useState("");
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
      const [nextTasks, nextVehicles, nextCompletionRequests] = await Promise.all([
        staffTasksApi.getMyTasks(),
        vehicleApi.getVehicles(),
        tripCompletionRequestsApi.getPending(),
      ]);
      setTasks(Array.isArray(nextTasks) ? nextTasks : []);
      setBackendVehicles(Array.isArray(nextVehicles) ? nextVehicles : []);
      setCompletionRequests(Array.isArray(nextCompletionRequests) ? nextCompletionRequests : []);
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

  const completionTasks = useMemo(
    () =>
      completionRequests.map((request) => {
        const vehicle = backendVehicles.find((item) => item.id === request.vehicleId);
        const vehicleLabel = vehicle ? `${vehicle.brand} ${vehicle.model}` : "EV";
        return toCompletionTask(request, vehicleLabel);
      }),
    [backendVehicles, completionRequests]
  );

  const allTasks = useMemo(() => [...completionTasks, ...tasks], [completionTasks, tasks]);

  const stats = useMemo(
    () => ({
      all: allTasks.length,
      [STAFF_TASK_STATUSES.Done]: allTasks.filter((task) => task.status === STAFF_TASK_STATUSES.Done).length,
      [STAFF_TASK_STATUSES.InProgress]: allTasks.filter((task) => task.status === STAFF_TASK_STATUSES.InProgress).length,
      [STAFF_TASK_STATUSES.Waiting]: allTasks.filter((task) => task.status === STAFF_TASK_STATUSES.Waiting).length,
    }),
    [allTasks]
  );

  const visibleTasks = useMemo(() => {
    const filtered = activeFilter === "all"
      ? allTasks
      : allTasks.filter((task) => task.status === activeFilter);

    return [...filtered].sort((first, second) => {
      const firstRemaining = getRemainingMs(first, now);
      const secondRemaining = getRemainingMs(second, now);

      if (firstRemaining !== secondRemaining) return firstRemaining - secondRemaining;
      return new Date(second.createdAt || 0).getTime() - new Date(first.createdAt || 0).getTime();
    });
  }, [activeFilter, allTasks, now]);

  const updateStatus = async (taskId, status) => {
    setActionError("");
    try {
      if (String(taskId).startsWith("completion-")) {
        const requestId = taskId.replace("completion-", "");
        if (status === STAFF_TASK_STATUSES.Done) {
          await reviewCompletionRequest(requestId, "approve");
        } else {
          setCompletionRequests((items) =>
            items.map((item) =>
              item.id === requestId ? { ...item, localStatus: status } : item
            )
          );
        }
        return;
      }

      const updatedTask = await staffTasksApi.updateMyTaskStatus(taskId, status);
      setTasks((items) => items.map((task) => (task.id === taskId ? updatedTask : task)));
    } catch (error) {
      setActionError(error.message || "Task status could not be updated.");
    }
  };

  const reviewCompletionRequest = async (requestId, action, rejectionReason = "") => {
    setCompletionError("");
    try {
      if (action === "approve") {
        await tripCompletionRequestsApi.approve(requestId);
      } else {
        await tripCompletionRequestsApi.reject(requestId, rejectionReason || "Photos need to be retaken.");
      }
      setCompletionRequests((items) => items.filter((item) => item.id !== requestId));
      await loadTasks();
    } catch (error) {
      setCompletionError(error.message || "Completion request could not be reviewed.");
    }
  };

  const rejectCompletionRequest = async (requestId) => {
    const reason = window.prompt("Reason for rejection", "Photos need to be retaken.");
    if (!reason?.trim()) return;
    await reviewCompletionRequest(requestId, "reject", reason.trim());
  };

  const getVehicleLabel = (vehicleId) => {
    const vehicle = backendVehicles.find((item) => item.id === vehicleId);
    return vehicle
      ? `${vehicle.plateNumber} · ${vehicle.brand} ${vehicle.model}`
      : vehicleId;
  };

  function getVehicleName(vehicleId) {
    const vehicle = backendVehicles.find((item) => item.id === vehicleId);
    return vehicle ? `${vehicle.brand} ${vehicle.model}` : "EV";
  }

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
          <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-black">Trip completion reviews</h2>
                <p className="text-sm font-semibold text-zinc-500">
                  Customer photo submissions waiting for staff approval.
                </p>
              </div>
              <span className="rounded-lg bg-red-50 px-3 py-2 text-xs font-black text-red-600">
                {completionRequests.length} pending
              </span>
            </div>

            {completionError && (
              <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                {completionError}
              </p>
            )}

            <div className="mt-4 grid gap-3">
              {completionRequests.length ? completionRequests.map((request) => (
                <article key={request.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-black">{getVehicleName(request.vehicleId)}</h3>
                        <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">
                          Attempt {request.attemptNumber}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-zinc-500">
                        Requested {formatDate(request.requestedAt)} · Fare {Number(request.finalRideCost || 0).toFixed(2)} {request.currency || "AZN"}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(request.photos || []).map((photo) => (
                          <a
                            key={photo.id || `${request.id}-${photo.angle}`}
                            href={`${API_URL}${photo.fileUrl}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-black text-zinc-600 transition hover:border-red-200 hover:text-red-600"
                          >
                            <FiCamera />
                            {photo.angle}
                          </a>
                        ))}
                      </div>
                    </div>

                    <div className="grid shrink-0 grid-cols-2 gap-2 sm:w-72">
                      <button
                        type="button"
                        onClick={() => rejectCompletionRequest(request.id)}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-3 text-xs font-black text-red-600 transition hover:bg-red-50"
                      >
                        <FiX />
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => reviewCompletionRequest(request.id, "approve")}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-xs font-black text-white transition hover:bg-emerald-700"
                      >
                        <FiCheckCircle />
                        Approve
                      </button>
                    </div>
                  </div>
                </article>
              )) : (
                <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center">
                  <p className="text-sm font-black text-zinc-500">No trip completion requests waiting.</p>
                </div>
              )}
            </div>
          </div>

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
