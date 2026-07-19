import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiAlertTriangle, FiCamera, FiCheckCircle, FiClock, FiLogOut, FiRefreshCw, FiTool, FiX } from "react-icons/fi";
import { authApi } from "../../api/authApi";
import { API_URL } from "../../api/apiClient";
import { createOperationsConnection, REALTIME_EVENTS, startConnection, stopConnection } from "../../api/realtimeClient";
import { chargingApi } from "../../api/chargingApi";
import { STAFF_TASK_STATUSES, staffTasksApi } from "../../api/staffTasksApi";
import { TRIP_COMPLETION_STATUSES, tripCompletionRequestsApi } from "../../api/tripCompletionRequestsApi";
import { vehicleApi } from "../../api/vehicleApi";
import { useConfirmDialog } from "../ui/useConfirmDialog";

const SESSION_STORAGE_KEY = "electroStreetStaffSession";
const MIN_CHARGING_COMPLETION_PERCENT = 80;
const CHARGING_PERCENT_PER_MINUTE = 10;
const BAKU_TIME_ZONE = "Asia/Baku";
const BAKU_UTC_OFFSET = "+04:00";

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

const completionDecisionLabels = {
  [TRIP_COMPLETION_STATUSES.Approved]: "Approved",
  [TRIP_COMPLETION_STATUSES.Rejected]: "Rejected",
};

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

const areListsEqual = (first, second) => JSON.stringify(first) === JSON.stringify(second);

const resolveFileUrl = (fileUrl) => {
  if (!fileUrl) return "#";
  if (/^https?:\/\//i.test(fileUrl)) return fileUrl;
  return `${API_URL}${fileUrl.startsWith("/") ? "" : "/"}${fileUrl}`;
};

const parseApiDate = (value) => {
  if (!value) return null;
  const text = String(value);
  const hasTimeZone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(text);
  return new Date(hasTimeZone ? text : `${text}Z`);
};

const formatDate = (value) => {
  const date = parseApiDate(value);
  if (!date || Number.isNaN(date.getTime())) return "No deadline";

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: BAKU_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
    hour12: false,
  }).format(date);
};

const parseBakuDeadlineDate = (value) => {
  if (!value) return null;
  const text = String(value);
  const hasTimeZone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(text);
  const normalized = hasTimeZone ? text : `${text}${text.includes("T") ? "" : "T00:00:00"}${BAKU_UTC_OFFSET}`;
  return new Date(normalized);
};

const formatBakuDeadline = (value) => {
  const date = parseBakuDeadlineDate(value);
  if (!date || Number.isNaN(date.getTime())) return "No deadline";

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: BAKU_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
    hour12: false,
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
  status: request.status || STAFF_TASK_STATUSES.Waiting,
  createdAt: request.reviewedAt || request.requestedAt,
});

const getRemainingMs = (task, now) => {
  const dueDate = parseBakuDeadlineDate(task.dueAt);
  if (!dueDate || Number.isNaN(dueDate.getTime())) return Number.POSITIVE_INFINITY;
  if (task.status === STAFF_TASK_STATUSES.Done) return Number.POSITIVE_INFINITY;
  return dueDate.getTime() - now;
};

const parseApiDateMs = (value) => {
  if (!value) return Number.NaN;
  const text = String(value);
  const normalized = /(?:z|[+-]\d{2}:?\d{2})$/i.test(text) ? text : `${text}Z`;
  return new Date(normalized).getTime();
};

const getChargingSessionProgress = (session, task, now) => {
  if (!session) return null;
  const startBattery = Number(session.startBatteryPercent || session.currentBatteryPercent || 0);
  const targetBattery = Number(session.targetBatteryPercent || 100);
  if (task?.status !== STAFF_TASK_STATUSES.InProgress) {
    return {
      currentBatteryPercent: startBattery,
      minutesRemaining: Math.max(0, Math.ceil((targetBattery - startBattery) / CHARGING_PERCENT_PER_MINUTE)),
    };
  }

  const chargingStartedAtMs = parseApiDateMs(task.updatedAt);
  const elapsedMinutes = Number.isFinite(chargingStartedAtMs)
    ? Math.max(0, (now - chargingStartedAtMs) / 60000)
    : 0;
  const currentBatteryPercent = Math.min(
    targetBattery,
    Math.round(startBattery + elapsedMinutes * CHARGING_PERCENT_PER_MINUTE)
  );
  const minutesRemaining = Math.max(
    0,
    Math.ceil((targetBattery - currentBatteryPercent) / CHARGING_PERCENT_PER_MINUTE)
  );

  return { currentBatteryPercent, minutesRemaining };
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
  const [activeChargingSessions, setActiveChargingSessions] = useState([]);
  const [completionRequests, setCompletionRequests] = useState([]);
  const [reviewedCompletionRequests, setReviewedCompletionRequests] = useState([]);
  const [backendVehicles, setBackendVehicles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [refreshNotice, setRefreshNotice] = useState("");
  const [hasLoadedTasks, setHasLoadedTasks] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");
  const [completionError, setCompletionError] = useState("");
  const [rejectDraft, setRejectDraft] = useState({ requestId: null, reason: "Photos need to be retaken." });
  const [now, setNow] = useState(() => Date.now());
  const hasLoadedTasksRef = useRef(false);
  const { confirm, dialog } = useConfirmDialog();

  const loadTasks = useCallback(async (options = {}) => {
    if (!session) return;
    const silent = options.silent === true;
    if (!silent) setIsLoading(true);
    setRefreshNotice("");
    if (!hasLoadedTasksRef.current) {
      setActionError("");
    }
    try {
      const [nextTasks, nextVehicles, nextCompletionRequests, nextReviewedCompletionRequests] = await Promise.all([
        staffTasksApi.getMyTasks(),
        vehicleApi.getVehicles(),
        tripCompletionRequestsApi.getPending(),
        tripCompletionRequestsApi.getMyReviewed(),
      ]);
      const nextChargingSessions = await chargingApi.getActiveSessions().catch(() => []);
      setTasks((current) => {
        const normalized = Array.isArray(nextTasks) ? nextTasks : [];
        return areListsEqual(current, normalized) ? current : normalized;
      });
      setActiveChargingSessions((current) => {
        const normalized = Array.isArray(nextChargingSessions) ? nextChargingSessions : [];
        return areListsEqual(current, normalized) ? current : normalized;
      });
      setBackendVehicles((current) => {
        const normalized = Array.isArray(nextVehicles) ? nextVehicles : [];
        return areListsEqual(current, normalized) ? current : normalized;
      });
      setCompletionRequests((current) => {
        const normalized = Array.isArray(nextCompletionRequests) ? nextCompletionRequests : [];
        return areListsEqual(current, normalized) ? current : normalized;
      });
      setReviewedCompletionRequests((current) => {
        const normalized = Array.isArray(nextReviewedCompletionRequests) ? nextReviewedCompletionRequests : [];
        return areListsEqual(current, normalized) ? current : normalized;
      });
      hasLoadedTasksRef.current = true;
      setHasLoadedTasks(true);
    } catch (error) {
      if (hasLoadedTasksRef.current) {
        setRefreshNotice("Refresh failed. Showing current tasks.");
      } else {
        setActionError(error.message || "Tasks are unavailable. Please try again.");
      }
    } finally {
      if (!silent) setIsLoading(false);
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
    if (!session) return undefined;

    const timer = window.setInterval(() => loadTasks({ silent: true }), 10000);
    return () => window.clearInterval(timer);
  }, [loadTasks, session]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!session) return undefined;

    const connection = createOperationsConnection();
    const handleTaskChange = (task) => {
      if (task.assigneeId && task.assigneeId !== session.id) {
        setTasks((items) => items.filter((item) => item.id !== task.id));
        return;
      }

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

  const completionReviewItems = useMemo(
    () => {
      const pendingIds = new Set(completionRequests.map((request) => request.id));
      const pendingItems = completionRequests.map((request) => ({
        ...request,
        backendCompletionStatus: request.status,
        status: STAFF_TASK_STATUSES.Waiting,
      }));
      const reviewedItems = reviewedCompletionRequests
        .filter((request) => !pendingIds.has(request.id))
        .map((request) => ({
          ...request,
          backendCompletionStatus: request.status,
          status: STAFF_TASK_STATUSES.Done,
        }));

      return [...pendingItems, ...reviewedItems];
    },
    [completionRequests, reviewedCompletionRequests]
  );

  const reviewTasksForStats = useMemo(
    () =>
      completionReviewItems.map((request) => {
        const vehicle = backendVehicles.find((item) => item.id === request.vehicleId);
        const vehicleLabel = vehicle ? `${vehicle.brand} ${vehicle.model}` : "EV";
        return toCompletionTask(request, vehicleLabel);
      }),
    [backendVehicles, completionReviewItems]
  );

  const allFilterItems = useMemo(() => [...reviewTasksForStats, ...tasks], [reviewTasksForStats, tasks]);

  const stats = useMemo(
    () => ({
      all: allFilterItems.length,
      [STAFF_TASK_STATUSES.Done]: allFilterItems.filter((task) => task.status === STAFF_TASK_STATUSES.Done).length,
      [STAFF_TASK_STATUSES.InProgress]: allFilterItems.filter((task) => task.status === STAFF_TASK_STATUSES.InProgress).length,
      [STAFF_TASK_STATUSES.Waiting]: allFilterItems.filter((task) => task.status === STAFF_TASK_STATUSES.Waiting).length,
    }),
    [allFilterItems]
  );

  const pendingCompletionCount = useMemo(
    () => completionReviewItems.filter((request) => request.status !== STAFF_TASK_STATUSES.Done).length,
    [completionReviewItems]
  );

  const visibleCompletionReviews = useMemo(() => {
    const filtered = activeFilter === "all"
      ? completionReviewItems
      : completionReviewItems.filter((request) => request.status === activeFilter);

    return [...filtered].sort((first, second) => {
      if (first.status === STAFF_TASK_STATUSES.Done && second.status !== STAFF_TASK_STATUSES.Done) return 1;
      if (first.status !== STAFF_TASK_STATUSES.Done && second.status === STAFF_TASK_STATUSES.Done) return -1;
      return new Date(second.requestedAt || 0).getTime() - new Date(first.requestedAt || 0).getTime();
    });
  }, [activeFilter, completionReviewItems]);

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
  }, [activeFilter, tasks, now]);

  const updateStatus = async (taskId, status) => {
    setActionError("");
    try {
      const chargingSession = activeChargingSessions.find((session) => session.staffTaskId === taskId);
      if (status === STAFF_TASK_STATUSES.Done && chargingSession) {
        const task = tasks.find((item) => item.id === taskId);
        const progress = getChargingSessionProgress(chargingSession, task, now);
        if (!progress || progress.currentBatteryPercent < MIN_CHARGING_COMPLETION_PERCENT) {
          setActionError(`Charging can be completed only from ${MIN_CHARGING_COMPLETION_PERCENT}%.`);
          return;
        }

        if (progress.currentBatteryPercent < 100) {
          const confirmed = await confirm({
            title: `Finish charging at ${progress.currentBatteryPercent}%?`,
            message: "The vehicle is not fully charged yet. You can finish now and keep the current battery level, or continue charging to 100%.",
            confirmLabel: `Finish at ${progress.currentBatteryPercent}%`,
            cancelLabel: "Keep charging",
            tone: "warning",
          });          if (!confirmed) return;
        }

        const details = await chargingApi.completeSession(chargingSession.id, {
          finalBatteryPercent: progress.currentBatteryPercent,
          notes: "Charging completed by staff.",
        });
        if (details?.staffTask) {
          setTasks((items) => items.map((task) => (task.id === taskId ? details.staffTask : task)));
        }
        setActiveChargingSessions((items) => items.filter((session) => session.id !== chargingSession.id));
        await loadTasks({ silent: true });
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
        const reviewedRequest = await tripCompletionRequestsApi.approve(requestId);
        setReviewedCompletionRequests((items) => upsertTask(items, reviewedRequest));
      } else {
        const reviewedRequest = await tripCompletionRequestsApi.reject(requestId, rejectionReason || "Photos need to be retaken.");
        setReviewedCompletionRequests((items) => upsertTask(items, reviewedRequest));
      }
      setCompletionRequests((items) => items.filter((item) => item.id !== requestId));
      await loadTasks({ silent: true });
    } catch (error) {
      setCompletionError(error.message || "Completion request could not be reviewed.");
    }
  };

  const rejectCompletionRequest = async (requestId) => {
    setCompletionError("");
    setRejectDraft({ requestId, reason: "Photos need to be retaken." });
  };

  const submitRejectCompletionRequest = async () => {
    const reason = rejectDraft.reason.trim();
    if (!reason) {
      setCompletionError("Write a short rejection reason.");
      return;
    }

    const requestId = rejectDraft.requestId;
    setRejectDraft({ requestId: null, reason: "Photos need to be retaken." });
    await reviewCompletionRequest(requestId, "reject", reason);
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
                  Customer photo submissions waiting for review.
                </p>
              </div>
              <span className="rounded-lg bg-red-50 px-3 py-2 text-xs font-black text-red-600">
                {pendingCompletionCount} pending
              </span>
            </div>

            {completionError && (
              <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                {completionError}
              </p>
            )}

            <div className="mt-4 grid gap-3">
              {visibleCompletionReviews.length ? visibleCompletionReviews.map((request) => (
                <article key={request.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-black">{getVehicleName(request.vehicleId)}</h3>
                        <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusStyles[request.status]}`}>
                          {statusLabels[request.status] || "Unknown"}
                        </span>
                        {request.status === STAFF_TASK_STATUSES.Done && request.backendCompletionStatus && (
                          <span className="rounded-full border border-emerald-300 bg-white px-3 py-1 text-xs font-black text-emerald-700">
                            {completionDecisionLabels[request.backendCompletionStatus] || "Reviewed"}
                          </span>
                        )}
                        <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">
                          Attempt {request.attemptNumber}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-zinc-500">
                        Requested {formatDate(request.requestedAt)} · Fare {Number(request.finalRideCost || 0).toFixed(2)} {request.currency || "AZN"}
                      </p>
                      {request.reviewedAt && (
                        <p className="mt-1 text-xs font-bold text-zinc-400">
                          Reviewed {formatDate(request.reviewedAt)}
                        </p>
                      )}
                      {request.rejectionReason && (
                        <p className="mt-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700">
                          Rejection reason: {request.rejectionReason}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(request.photos || []).map((photo) => (
                          <a
                            key={photo.id || `${request.id}-${photo.angle}`}
                            href={resolveFileUrl(photo.fileUrl)}
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

                    <div className="grid shrink-0 gap-2 sm:w-80">
                      <div className="grid grid-cols-2 gap-2">
                        {request.status === STAFF_TASK_STATUSES.Done ? (
                          <div className="col-span-2 inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-white px-4 py-3 text-xs font-black text-emerald-700">
                            <FiCheckCircle />
                            Review completed
                          </div>
                        ) : (
                          <>
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
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              )) : (
                <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center">
                  <p className="text-sm font-black text-zinc-500">No trip completion requests in this view.</p>
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
                const chargingSession = activeChargingSessions.find((session) => session.staffTaskId === task.id);
                const chargingProgress = getChargingSessionProgress(chargingSession, task, now);

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
                          <span className="rounded-lg bg-zinc-100 px-3 py-2">Due: {formatBakuDeadline(task.dueAt)}</span>
                          {task.vehicleId && (
                            <span className="rounded-lg bg-zinc-100 px-3 py-2">Vehicle: {getVehicleLabel(task.vehicleId)}</span>
                          )}
                          {chargingProgress && (
                            <span className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-700">
                              Charging: {chargingProgress.currentBatteryPercent}% - {chargingProgress.minutesRemaining > 0 ? `${chargingProgress.minutesRemaining} min to full` : "ready"}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid shrink-0 grid-cols-1 gap-2 sm:grid-cols-3 lg:w-[360px]">
                        {statusOptions.map((status) => {
                          const doneBlocked = status === STAFF_TASK_STATUSES.Done &&
                            chargingProgress &&
                            chargingProgress.currentBatteryPercent < MIN_CHARGING_COMPLETION_PERCENT;

                          return (
                            <button
                              key={status}
                              type="button"
                              onClick={() => updateStatus(task.id, status)}
                              disabled={doneBlocked}
                              title={doneBlocked ? `Charging can be completed from ${MIN_CHARGING_COMPLETION_PERCENT}%` : undefined}
                              className={`rounded-lg border px-3 py-3 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                task.status === status
                                  ? statusStyles[status]
                                  : "border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50"
                              }`}
                            >
                              {statusLabels[status]}
                            </button>
                          );
                        })}
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

      {rejectDraft.requestId && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-zinc-950/55 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-2xl">
            <div className="flex items-start gap-4 p-5">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-red-50 text-red-600 ring-1 ring-red-100">
                <FiAlertTriangle className="text-xl" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-black tracking-tight text-zinc-950">Reject trip photos?</h2>
                  <button
                    type="button"
                    onClick={() => setRejectDraft({ requestId: null, reason: "Photos need to be retaken." })}
                    className="rounded-full p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
                    aria-label="Close reject dialog"
                  >
                    <FiX />
                  </button>
                </div>
                <p className="mt-2 text-sm font-semibold leading-6 text-zinc-600">
                  Add a clear message for the customer before sending the request back.
                </p>
                <textarea
                  value={rejectDraft.reason}
                  onChange={(event) => setRejectDraft((draft) => ({ ...draft, reason: event.target.value }))}
                  rows={4}
                  className="mt-4 w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-900 outline-none transition focus:border-red-300 focus:bg-white"
                  placeholder="Explain what needs to be fixed"
                />
              </div>
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-zinc-100 bg-zinc-50 px-5 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setRejectDraft({ requestId: null, reason: "Photos need to be retaken." })}
                className="rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-black text-zinc-700 transition hover:bg-zinc-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitRejectCompletionRequest}
                className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-red-700"
              >
                Reject request
              </button>
            </div>
          </div>
        </div>
      )}
      {dialog}
    </main>
  );
};

export default StaffDashboard;
