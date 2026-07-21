import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiAlertTriangle, FiCamera, FiCheckCircle, FiClock, FiHeadphones, FiLogOut, FiRefreshCw, FiSend, FiTool, FiX } from "react-icons/fi";
import { authApi } from "../../api/authApi";
import { API_URL } from "../../api/apiClient";
import { createOperationsConnection, REALTIME_EVENTS, startConnection, stopConnection } from "../../api/realtimeClient";
import { chargingApi } from "../../api/chargingApi";
import { STAFF_TASK_STATUSES, staffTasksApi } from "../../api/staffTasksApi";
import {
  SUPPORT_MESSAGE_SENDER_TYPES,
  SUPPORT_REALTIME_EVENTS,
  SUPPORT_TICKET_STATUSES,
  createSupportConnection,
  staffSupportApi,
  startSupportConnection,
  stopSupportConnection,
} from "../../api/supportApi";
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

const SUPPORT_QUEUE_FILTER = "support";

const filterItems = [
  { id: "all", label: "All", icon: FiTool },
  { id: STAFF_TASK_STATUSES.Done, label: "Done", icon: FiCheckCircle },
  { id: STAFF_TASK_STATUSES.InProgress, label: "In progress", icon: FiRefreshCw },
  { id: STAFF_TASK_STATUSES.Waiting, label: "Waiting", icon: FiClock },
];

const supportStatusLabels = {
  [SUPPORT_TICKET_STATUSES.Open]: "Active",
  [SUPPORT_TICKET_STATUSES.WaitingForStaff]: "Waiting for staff",
  [SUPPORT_TICKET_STATUSES.WaitingForRider]: "Waiting for rider",
  [SUPPORT_TICKET_STATUSES.EscalatedToAdmin]: "Admin review",
  [SUPPORT_TICKET_STATUSES.Resolved]: "Resolved",
  [SUPPORT_TICKET_STATUSES.Closed]: "Closed",
};

const supportStatusStyles = {
  [SUPPORT_TICKET_STATUSES.Open]: "border-emerald-300 bg-emerald-50 text-emerald-700",
  [SUPPORT_TICKET_STATUSES.WaitingForStaff]: "border-amber-300 bg-amber-50 text-amber-700",
  [SUPPORT_TICKET_STATUSES.WaitingForRider]: "border-blue-300 bg-blue-50 text-blue-700",
  [SUPPORT_TICKET_STATUSES.EscalatedToAdmin]: "border-red-300 bg-red-50 text-red-700",
  [SUPPORT_TICKET_STATUSES.Resolved]: "border-zinc-300 bg-zinc-50 text-zinc-600",
  [SUPPORT_TICKET_STATUSES.Closed]: "border-zinc-300 bg-zinc-50 text-zinc-600",
};

const upsertSupportTicket = (items, nextTicket) => {
  const exists = items.some((ticket) => ticket.id === nextTicket.id);
  const nextItems = exists
    ? items.map((ticket) => (ticket.id === nextTicket.id ? nextTicket : ticket))
    : [nextTicket, ...items];

  return [...nextItems].sort((first, second) => new Date(second.lastMessageAt || 0) - new Date(first.lastMessageAt || 0));
};

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

const toBakuDateKey = (value) => {
  const date = parseApiDate(value);
  if (!date || Number.isNaN(date.getTime())) return "";

  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: BAKU_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return `${parts.year}-${parts.month}-${parts.day}`;
};

const getBakuDateKeyByOffset = (offsetDays = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return toBakuDateKey(date.toISOString());
};

const getWorkDateValue = (item) => {
  if (!item) return "";
  if (item.supportTicketId) return item.closedAt || item.createdAt;
  if (item.completionRequestId) return item.status === STAFF_TASK_STATUSES.Done
    ? item.createdAt || item.dueAt
    : item.dueAt || item.createdAt;
  return item.status === STAFF_TASK_STATUSES.Done
    ? item.updatedAt || item.createdAt || item.dueAt
    : item.createdAt || item.updatedAt || item.dueAt;
};

const matchesWorkDate = (item, selectedDate) => {
  if (selectedDate === "all") return true;
  return toBakuDateKey(getWorkDateValue(item)) === selectedDate;
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
  const [supportTickets, setSupportTickets] = useState([]);
  const [activeSupportTicketId, setActiveSupportTicketId] = useState(null);
  const [supportDraft, setSupportDraft] = useState("");
  const [supportError, setSupportError] = useState("");
  const [supportNotice, setSupportNotice] = useState("");
  const [isLoadingSupport, setIsLoadingSupport] = useState(false);
  const [isSendingSupport, setIsSendingSupport] = useState(false);
  const [backendVehicles, setBackendVehicles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [refreshNotice, setRefreshNotice] = useState("");
  const [hasLoadedTasks, setHasLoadedTasks] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedWorkDate, setSelectedWorkDate] = useState(() => getBakuDateKeyByOffset(0));
  const [completionError, setCompletionError] = useState("");
  const [rejectDraft, setRejectDraft] = useState({ requestId: null, reason: "Photos need to be retaken." });
  const [now, setNow] = useState(() => Date.now());
  const hasLoadedTasksRef = useRef(false);
  const { confirm, dialog } = useConfirmDialog();

  useEffect(() => {
    const handleSessionRefreshed = (event) => {
      const user = event.detail;
      if (!user?.id || user.roleKey !== "staff") return;

      setSession({
        id: user.id,
        name: user.name,
        email: user.email,
        role: "staff",
        signedInAt: new Date().toISOString(),
      });
      setSupportError("");
      setActionError("");
    };
    const handleSessionExpired = () => {
      setSession(null);
      window.location.href = "/staff-login";
    };

    window.addEventListener("electrostreet:session-refreshed", handleSessionRefreshed);
    window.addEventListener("electrostreet:session-expired", handleSessionExpired);
    return () => {
      window.removeEventListener("electrostreet:session-refreshed", handleSessionRefreshed);
      window.removeEventListener("electrostreet:session-expired", handleSessionExpired);
    };
  }, []);

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

  const loadSupportTickets = useCallback(async (options = {}) => {
    if (!session) return;
    const silent = options.silent === true;
    if (!silent) setIsLoadingSupport(true);
    setSupportError("");

    try {
      const tickets = await staffSupportApi.getTickets();
      const normalizedTickets = Array.isArray(tickets) ? tickets : [];
      const nextVisibleTickets = normalizedTickets.filter((ticket) =>
        ticket.status !== SUPPORT_TICKET_STATUSES.Closed &&
        ticket.status !== SUPPORT_TICKET_STATUSES.Resolved &&
        ticket.status !== SUPPORT_TICKET_STATUSES.EscalatedToAdmin
      );
      setSupportTickets(normalizedTickets);
      setActiveSupportTicketId((currentId) =>
        nextVisibleTickets.some((ticket) => ticket.id === currentId)
          ? currentId
          : nextVisibleTickets[0]?.id || null
      );
      setSupportNotice("");
    } catch (error) {
      setSupportError(error.message || "Support queue is unavailable.");
    } finally {
      if (!silent) setIsLoadingSupport(false);
    }
  }, [session]);

  useEffect(() => {
    if (!session) {
      window.location.href = "/staff-login";
      return;
    }

    const timer = window.setTimeout(() => {
      loadTasks();
      loadSupportTickets();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadSupportTickets, loadTasks, session]);

  useEffect(() => {
    if (!session) return undefined;

    const timer = window.setInterval(() => {
      loadTasks({ silent: true });
      loadSupportTickets({ silent: true });
    }, 10000);
    return () => window.clearInterval(timer);
  }, [loadSupportTickets, loadTasks, session]);

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
    connection.onreconnecting(() => setRefreshNotice("Loading updates..."));
    connection.onreconnected(() => setRefreshNotice(""));
    connection.onclose(() => setRefreshNotice(""));

    startConnection(connection).catch(() => {
      setRefreshNotice("");
    });

    return () => {
      connection.off(REALTIME_EVENTS.StaffTaskCreated, handleTaskChange);
      connection.off(REALTIME_EVENTS.StaffTaskUpdated, handleTaskChange);
      stopConnection(connection).catch(() => {});
    };
  }, [session]);

  useEffect(() => {
    if (!session) return undefined;

    const connection = createSupportConnection();
    const handleTicketUpdate = (ticket) => {
      setSupportTickets((items) => {
        if (ticket.status === SUPPORT_TICKET_STATUSES.EscalatedToAdmin) {
          return items.filter((item) => item.id !== ticket.id);
        }

        return upsertSupportTicket(items, ticket);
      });
      setActiveSupportTicketId((currentId) => currentId || ticket.id);
      setSupportNotice("");
      setSupportError("");
    };

    connection.on(SUPPORT_REALTIME_EVENTS.SupportTicketUpdated, handleTicketUpdate);
    connection.onreconnecting(() => setSupportNotice("Loading support updates..."));
    connection.onreconnected(() => setSupportNotice(""));
    connection.onclose(() => setSupportNotice(""));

    startSupportConnection(connection).catch(() => {
      setSupportNotice("");
    });

    return () => {
      connection.off(SUPPORT_REALTIME_EVENTS.SupportTicketUpdated, handleTicketUpdate);
      stopSupportConnection(connection).catch(() => {});
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

  const supportTaskItems = useMemo(
    () =>
      supportTickets
        .filter((ticket) => ticket.status === SUPPORT_TICKET_STATUSES.Closed || ticket.status === SUPPORT_TICKET_STATUSES.Resolved)
        .map((ticket) => ({
          id: `support-${ticket.id}`,
          supportTicketId: ticket.id,
          title: `Support chat: ${ticket.subject}`,
          description: ticket.messages[ticket.messages.length - 1]?.body || "Support ticket was closed.",
          riderName: ticket.riderName,
          riderEmail: ticket.riderEmail,
          closedAt: ticket.closedAt || ticket.updatedAt || ticket.lastMessageAt,
          status: STAFF_TASK_STATUSES.Done,
          priority: ticket.priority,
          createdAt: ticket.closedAt || ticket.updatedAt || ticket.lastMessageAt,
        })),
    [supportTickets]
  );

  const activeSupportTicketsCount = useMemo(
    () =>
      supportTickets.filter((ticket) =>
        ticket.status !== SUPPORT_TICKET_STATUSES.Closed &&
        ticket.status !== SUPPORT_TICKET_STATUSES.Resolved &&
        ticket.status !== SUPPORT_TICKET_STATUSES.EscalatedToAdmin
      ).length,
    [supportTickets]
  );

  const allFilterItems = useMemo(
    () => [...reviewTasksForStats, ...tasks, ...supportTaskItems],
    [reviewTasksForStats, supportTaskItems, tasks]
  );

  const datedAllFilterItems = useMemo(
    () => allFilterItems.filter((item) => matchesWorkDate(item, selectedWorkDate)),
    [allFilterItems, selectedWorkDate]
  );

  const stats = useMemo(
    () => ({
      all: datedAllFilterItems.length,
      [STAFF_TASK_STATUSES.Done]: datedAllFilterItems.filter((task) => task.status === STAFF_TASK_STATUSES.Done).length,
      [STAFF_TASK_STATUSES.InProgress]: datedAllFilterItems.filter((task) => task.status === STAFF_TASK_STATUSES.InProgress).length,
      [STAFF_TASK_STATUSES.Waiting]: datedAllFilterItems.filter((task) => task.status === STAFF_TASK_STATUSES.Waiting).length,
    }),
    [datedAllFilterItems]
  );

  const pendingCompletionCount = useMemo(
    () => reviewTasksForStats.filter((request) =>
      request.status !== STAFF_TASK_STATUSES.Done && matchesWorkDate(request, selectedWorkDate)
    ).length,
    [reviewTasksForStats, selectedWorkDate]
  );

  const visibleCompletionReviews = useMemo(() => {
    const filtered = completionReviewItems.filter((request) =>
      (activeFilter === "all" || request.status === activeFilter) &&
      (selectedWorkDate === "all" || toBakuDateKey(request.status === STAFF_TASK_STATUSES.Done
        ? request.reviewedAt || request.requestedAt
        : request.requestedAt) === selectedWorkDate)
    );

    return [...filtered].sort((first, second) => {
      if (first.status === STAFF_TASK_STATUSES.Done && second.status !== STAFF_TASK_STATUSES.Done) return 1;
      if (first.status !== STAFF_TASK_STATUSES.Done && second.status === STAFF_TASK_STATUSES.Done) return -1;
      return new Date(second.requestedAt || 0).getTime() - new Date(first.requestedAt || 0).getTime();
    });
  }, [activeFilter, completionReviewItems, selectedWorkDate]);

  const visibleTasks = useMemo(() => {
    const filtered = tasks.filter((task) =>
      (activeFilter === "all" || task.status === activeFilter) && matchesWorkDate(task, selectedWorkDate)
    );

    return [...filtered].sort((first, second) => {
      const firstRemaining = getRemainingMs(first, now);
      const secondRemaining = getRemainingMs(second, now);

      if (firstRemaining !== secondRemaining) return firstRemaining - secondRemaining;
      return new Date(second.createdAt || 0).getTime() - new Date(first.createdAt || 0).getTime();
    });
  }, [activeFilter, tasks, now, selectedWorkDate]);

  const visibleSupportDoneTasks = useMemo(() => {
    if (activeFilter !== "all" && activeFilter !== STAFF_TASK_STATUSES.Done) return [];

    return supportTaskItems.filter((task) => matchesWorkDate(task, selectedWorkDate)).sort((first, second) =>
      new Date(second.createdAt || 0).getTime() - new Date(first.createdAt || 0).getTime()
    );
  }, [activeFilter, selectedWorkDate, supportTaskItems]);

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

  const visibleSupportTickets = supportTickets.filter((ticket) =>
    ticket.status !== SUPPORT_TICKET_STATUSES.Closed &&
    ticket.status !== SUPPORT_TICKET_STATUSES.Resolved &&
    ticket.status !== SUPPORT_TICKET_STATUSES.EscalatedToAdmin
  );
  const activeSupportTicket = visibleSupportTickets.find((ticket) => ticket.id === activeSupportTicketId) || visibleSupportTickets[0] || null;

  const refreshSupportTicket = (ticket) => {
    setSupportTickets((items) => upsertSupportTicket(items, ticket));
    setActiveSupportTicketId(ticket.id);
  };

  const assignSupportToMe = async (ticketId) => {
    setSupportError("");
    try {
      refreshSupportTicket(await staffSupportApi.assignToMe(ticketId));
    } catch (error) {
      setSupportError(error.message || "Support ticket could not be assigned.");
    }
  };

  const sendSupportReply = async () => {
    const body = supportDraft.trim();
    if (!body || !activeSupportTicket || isSendingSupport) return;

    setIsSendingSupport(true);
    setSupportError("");
    try {
      const ticket = await staffSupportApi.sendMessage(activeSupportTicket.id, { body });
      refreshSupportTicket(ticket);
      setSupportDraft("");
    } catch (error) {
      setSupportError(error.message || "Support reply could not be sent.");
    } finally {
      setIsSendingSupport(false);
    }
  };

  const escalateSupportTicket = async () => {
    if (!activeSupportTicket) return;
    setSupportError("");
    try {
      const ticket = await staffSupportApi.escalateToAdmin(activeSupportTicket.id);
      setSupportTickets((items) => items.filter((item) => item.id !== ticket.id));
      setActiveSupportTicketId(null);
      setSupportNotice("Ticket was transferred to an administrator.");
    } catch (error) {
      setSupportError(error.message || "Ticket could not be transferred to admin.");
    }
  };

  const closeSupportTicket = async () => {
    if (!activeSupportTicket) return;
    setSupportError("");
    try {
      const ticket = await staffSupportApi.closeTicket(activeSupportTicket.id);
      let nextActiveTicketId = null;
      setSupportTickets((items) => {
        const nextItems = upsertSupportTicket(items, ticket);
        const nextActiveTicket = nextItems.find((item) =>
          item.id !== ticket.id &&
          item.status !== SUPPORT_TICKET_STATUSES.Closed &&
          item.status !== SUPPORT_TICKET_STATUSES.Resolved
        );
        nextActiveTicketId = nextActiveTicket?.id || null;
        return nextItems;
      });
      setActiveSupportTicketId(nextActiveTicketId);
    } catch (error) {
      setSupportError(error.message || "Support ticket could not be closed.");
    }
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
          <button
            type="button"
            onClick={() => setActiveFilter(SUPPORT_QUEUE_FILTER)}
            className={`flex items-center justify-between rounded-lg p-4 text-left transition ${
              activeFilter === SUPPORT_QUEUE_FILTER ? "bg-red-50 ring-1 ring-red-200" : "bg-zinc-50 hover:bg-zinc-100"
            }`}
          >
            <span className="flex items-center gap-2 text-sm font-black text-zinc-600">
              <FiHeadphones />
              Support queue
            </span>
            <span className={`inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-lg font-black leading-none ${
              activeSupportTicketsCount > 0 ? "bg-red-600 text-white" : "bg-zinc-100 text-zinc-400"
            }`}>
              {activeSupportTicketsCount}
            </span>
          </button>
        </aside>

        <section className="min-w-0">
          {activeFilter !== SUPPORT_QUEUE_FILTER && (
          <div className="mb-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-black text-zinc-950">Work date</p>
                <p className="text-xs font-semibold text-zinc-500">Show staff work for one selected day.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedWorkDate(getBakuDateKeyByOffset(0))}
                  className={`rounded-lg px-3 py-2 text-xs font-black transition ${
                    selectedWorkDate === getBakuDateKeyByOffset(0) ? "bg-red-600 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedWorkDate(getBakuDateKeyByOffset(-1))}
                  className={`rounded-lg px-3 py-2 text-xs font-black transition ${
                    selectedWorkDate === getBakuDateKeyByOffset(-1) ? "bg-red-600 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  }`}
                >
                  Yesterday
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedWorkDate("all")}
                  className={`rounded-lg px-3 py-2 text-xs font-black transition ${
                    selectedWorkDate === "all" ? "bg-red-600 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  }`}
                >
                  All dates
                </button>
                <input
                  type="date"
                  value={selectedWorkDate === "all" ? "" : selectedWorkDate}
                  onChange={(event) => setSelectedWorkDate(event.target.value || getBakuDateKeyByOffset(0))}
                  className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-black text-zinc-700 outline-none focus:border-red-300"
                />
              </div>
            </div>
          </div>
          )}

          {activeFilter !== SUPPORT_QUEUE_FILTER && (
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
          )}

          {activeFilter === SUPPORT_QUEUE_FILTER && (
          <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-black">
                  <FiHeadphones />
                  Support queue
                </h2>
                <p className="text-sm font-semibold text-zinc-500">
                  Take rider chats, answer basic issues, or transfer serious cases to admin.
                </p>
              </div>
              <button
                type="button"
                onClick={() => loadSupportTickets()}
                className="rounded-lg border border-zinc-200 px-4 py-3 text-xs font-black transition hover:bg-zinc-50"
              >
                Refresh support
              </button>
            </div>

            {(supportError || supportNotice || isLoadingSupport) && (
              <p className={`mt-4 rounded-lg border px-4 py-3 text-sm font-bold ${
                supportError
                  ? "border-red-200 bg-red-50 text-red-700"
                  : supportNotice
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-blue-200 bg-blue-50 text-blue-700"
              }`}>
                {supportError || supportNotice || "Loading support queue..."}
              </p>
            )}

            <div className="mt-4 grid min-h-[420px] overflow-hidden rounded-lg border border-zinc-200 lg:grid-cols-[320px_minmax(0,1fr)]">
              <div className="border-b border-zinc-200 bg-zinc-50 lg:border-b-0 lg:border-r">
                {visibleSupportTickets.length ? visibleSupportTickets.map((ticket) => {
                  const active = activeSupportTicket?.id === ticket.id;
                  const lastMessage = ticket.messages[ticket.messages.length - 1];

                  return (
                    <button
                      key={ticket.id}
                      type="button"
                      onClick={() => setActiveSupportTicketId(ticket.id)}
                      className={`w-full border-b border-zinc-200 p-4 text-left transition last:border-b-0 ${
                        active ? "bg-red-50" : "hover:bg-white"
                      }`}
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-black text-zinc-950">{ticket.subject}</span>
                          <span className="mt-1 block truncate text-xs font-semibold text-zinc-500">
                            {ticket.riderName} - {ticket.riderEmail}
                          </span>
                        </span>
                        <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-black ${supportStatusStyles[ticket.status] || supportStatusStyles[SUPPORT_TICKET_STATUSES.Open]}`}>
                          {supportStatusLabels[ticket.status] || "Active"}
                        </span>
                      </span>
                      <span className="mt-3 block truncate text-xs font-semibold text-zinc-500">{lastMessage?.body}</span>
                    </button>
                  );
                }) : (
                  <div className="p-6 text-sm font-bold text-zinc-500">No support chats in your queue.</div>
                )}
              </div>

              <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto]">
                <div className="border-b border-zinc-200 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-lg font-black text-zinc-950">{activeSupportTicket?.subject || "Select a support chat"}</p>
                      {activeSupportTicket && (
                        <p className="mt-1 text-xs font-bold text-zinc-500">
                          {activeSupportTicket.assignedStaffName ? `Assigned to ${activeSupportTicket.assignedStaffName}` : "Unassigned"}
                        </p>
                      )}
                    </div>
                    {activeSupportTicket && (
                      <div className="flex flex-wrap gap-2">
                        {!activeSupportTicket.assignedStaffId && (
                          <button type="button" onClick={() => assignSupportToMe(activeSupportTicket.id)} className="rounded-lg bg-zinc-950 px-3 py-2 text-xs font-black text-white">
                            Take ticket
                          </button>
                        )}
                        <button type="button" onClick={escalateSupportTicket} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700">
                          Transfer to admin
                        </button>
                        <button type="button" onClick={closeSupportTicket} className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-black text-zinc-600">
                          Close
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="min-h-0 space-y-3 overflow-y-auto bg-zinc-50 p-4">
                  {activeSupportTicket?.messages.map((message) => {
                    const fromRider = message.senderType === SUPPORT_MESSAGE_SENDER_TYPES.Rider;

                    return (
                      <article
                        key={message.id}
                        className={`max-w-[82%] rounded-lg px-4 py-3 ${
                          fromRider ? "border border-zinc-200 bg-white" : "ml-auto bg-red-50 text-red-900"
                        }`}
                      >
                        <p className="text-[11px] font-black uppercase tracking-wide opacity-70">{message.senderName}</p>
                        <p className="mt-1 text-sm font-semibold leading-6">{message.body}</p>
                      </article>
                    );
                  })}
                </div>

                <div className="border-t border-zinc-200 p-4">
                  <div className="flex gap-2">
                    <input
                      value={supportDraft}
                      onChange={(event) => {
                        setSupportDraft(event.target.value);
                        setSupportError("");
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          sendSupportReply();
                        }
                      }}
                      disabled={!activeSupportTicket}
                      placeholder="Reply to rider"
                      className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-bold outline-none focus:border-red-300 disabled:opacity-60"
                    />
                    <button
                      type="button"
                      onClick={sendSupportReply}
                      disabled={!supportDraft.trim() || !activeSupportTicket || isSendingSupport}
                      className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 text-white transition hover:bg-red-700 disabled:bg-zinc-300"
                      aria-label="Send support reply"
                    >
                      <FiSend />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          )}

          {activeFilter !== SUPPORT_QUEUE_FILTER && (
          <>
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
            ) : visibleTasks.length || visibleSupportDoneTasks.length ? (
              <>
              {visibleSupportDoneTasks.map((task) => (
                <article key={task.id} className="rounded-lg border border-emerald-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="flex items-center gap-2 text-lg font-black">
                          <FiHeadphones className="text-red-500" />
                          {task.title}
                        </h3>
                        <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusStyles[task.status]}`}>
                          Done
                        </span>
                        <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-black text-red-700">
                          Support ticket
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-semibold leading-6 text-zinc-600">{task.description}</p>
                      <div className="mt-4 flex flex-wrap gap-2 text-xs font-black text-zinc-500">
                        <span className="rounded-lg bg-zinc-100 px-3 py-2">
                          Rider: {task.riderName || task.riderEmail || "Rider"}
                        </span>
                        <span className="rounded-lg bg-zinc-100 px-3 py-2">
                          Closed: {formatDate(task.closedAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </article>
              ))}

              {visibleTasks.map((task) => {
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
              })}
              </>
            ) : (
              <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-10 text-center">
                <p className="text-lg font-black">No tasks in this view</p>
                <p className="mt-2 text-sm font-semibold text-zinc-500">
                  Try another status filter or refresh the page.
                </p>
              </div>
            )}
          </div>
          </>
          )}
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
