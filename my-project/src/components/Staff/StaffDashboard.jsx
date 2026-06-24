import { useEffect, useMemo, useState } from "react";
import { FiCheckCircle, FiClock, FiLogOut, FiRefreshCw, FiTool } from "react-icons/fi";
import { staffApi } from "../../api/staffApi";
import {
  TRIP_COMPLETION_STATUSES,
  tripCompletionApi,
} from "../../api/tripCompletionApi";
import { STAFF_TASK_STATUS_LABELS, STAFF_TASK_STATUSES } from "../../data/staff";

const statusStyles = {
  [STAFF_TASK_STATUSES.DONE]: "border-emerald-400/30 bg-emerald-500/10 text-emerald-700",
  [STAFF_TASK_STATUSES.IN_PROGRESS]: "border-blue-400/30 bg-blue-500/10 text-blue-700",
  [STAFF_TASK_STATUSES.WAITING]: "border-amber-400/30 bg-amber-500/10 text-amber-700",
};

const statusOptions = [
  STAFF_TASK_STATUSES.DONE,
  STAFF_TASK_STATUSES.IN_PROGRESS,
  STAFF_TASK_STATUSES.WAITING,
];

const photoAngles = [
  ["front", "Front"],
  ["rear", "Rear"],
  ["left", "Left side"],
  ["right", "Right side"],
];

const StaffDashboard = () => {
  const [session, setSession] = useState(() => staffApi.getSession());
  const [tasks, setTasks] = useState(() => staffApi.getTasks());
  const [completionRequests, setCompletionRequests] = useState(() =>
    tripCompletionApi.getRequests()
  );
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (!session) {
      window.location.href = "/staff-login";
      return undefined;
    }

    const unsubscribeTasks = staffApi.subscribe(setTasks);
    const unsubscribeCompletionRequests = tripCompletionApi.subscribe(setCompletionRequests);

    return () => {
      unsubscribeTasks();
      unsubscribeCompletionRequests();
    };
  }, [session]);

  const myTasks = useMemo(
    () => tasks.filter((task) => task.assigneeId === session?.id),
    [session?.id, tasks]
  );

  const stats = useMemo(
    () => ({
      total: myTasks.length,
      done: myTasks.filter((task) => task.status === STAFF_TASK_STATUSES.DONE).length,
      inProgress: myTasks.filter((task) => task.status === STAFF_TASK_STATUSES.IN_PROGRESS).length,
      waiting: myTasks.filter((task) => task.status === STAFF_TASK_STATUSES.WAITING).length,
    }),
    [myTasks]
  );

  const updateStatus = (taskId, status) => {
    setTasks(staffApi.updateTaskStatus(taskId, status));
  };

  const approveTripCompletion = (task, request) => {
    setActionError("");

    if (
      !window.confirm(
        `Approve all four photos for ${request.vehicleName}? The customer will immediately receive a payment request for ${Number(request.rideCost || 0).toFixed(2)} AZN.`
      )
    ) {
      return;
    }

    try {
      tripCompletionApi.approveRequest(request.id, session.id);
      setTasks(staffApi.updateTaskStatus(task.id, STAFF_TASK_STATUSES.DONE));
    } catch (error) {
      setActionError(error.message || "The trip could not be approved.");
    }
  };

  const handleLogout = () => {
    staffApi.logout();
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
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-200 px-4 py-3 text-sm font-black transition hover:bg-zinc-100"
          >
            <FiLogOut />
            Log out
          </button>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="grid gap-3 self-start rounded-lg border border-zinc-200 bg-white p-4">
          {[
            ["All", stats.total, FiTool],
            ["Done", stats.done, FiCheckCircle],
            ["In progress", stats.inProgress, FiRefreshCw],
            ["Waiting", stats.waiting, FiClock],
          ].map(([label, value, Icon]) => (
            <div key={label} className="flex items-center justify-between rounded-lg bg-zinc-50 p-4">
              <span className="flex items-center gap-2 text-sm font-black text-zinc-600">
                <Icon />
                {label}
              </span>
              <span className="text-xl font-black">{value}</span>
            </div>
          ))}
        </aside>

        <section className="min-w-0">
          <div className="mb-4">
            <h2 className="text-xl font-black">My tasks</h2>
            <p className="text-sm font-semibold text-zinc-500">
              Review assigned work and approve trip completion photos here.
            </p>
          </div>

          <div className="grid gap-3">
            {actionError && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                {actionError}
              </p>
            )}

            {myTasks.length ? (
              myTasks.map((task) => {
                const completionRequest =
                  task.taskType === "trip_completion_review"
                    ? completionRequests.find(
                        (request) => request.id === task.completionRequestId
                      )
                    : null;
                const isCompletionApproved =
                  completionRequest?.status === TRIP_COMPLETION_STATUSES.APPROVED;

                return (
                  <article key={task.id} className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-black">{task.title}</h3>
                          <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusStyles[task.status]}`}>
                            {STAFF_TASK_STATUS_LABELS[task.status]}
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-semibold leading-6 text-zinc-600">{task.description}</p>
                        <div className="mt-4 flex flex-wrap gap-2 text-xs font-black text-zinc-500">
                          <span className="rounded-lg bg-zinc-100 px-3 py-2">Priority: {task.priority}</span>
                          <span className="rounded-lg bg-zinc-100 px-3 py-2">Due: {task.dueAt}</span>
                          {task.vehicleId && (
                            <span className="rounded-lg bg-zinc-100 px-3 py-2">Vehicle: {task.vehicleId}</span>
                          )}
                        </div>
                      </div>

                      {completionRequest ? (
                        <div className="grid shrink-0 gap-2 sm:grid-cols-2 lg:w-[360px]">
                          <button
                            type="button"
                            onClick={() => updateStatus(task.id, STAFF_TASK_STATUSES.IN_PROGRESS)}
                            disabled={isCompletionApproved}
                            className={`rounded-lg border px-3 py-3 text-xs font-black transition ${
                              task.status === STAFF_TASK_STATUSES.IN_PROGRESS
                                ? statusStyles[STAFF_TASK_STATUSES.IN_PROGRESS]
                                : "border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50"
                            } disabled:cursor-not-allowed disabled:opacity-50`}
                          >
                            Start review
                          </button>
                          <button
                            type="button"
                            onClick={() => approveTripCompletion(task, completionRequest)}
                            disabled={isCompletionApproved}
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-3 text-xs font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-200"
                          >
                            <FiCheckCircle />
                            {isCompletionApproved ? "Trip approved" : "Approve completion"}
                          </button>
                        </div>
                      ) : (
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
                              {STAFF_TASK_STATUS_LABELS[status]}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {completionRequest && (
                      <div className="mt-5 border-t border-zinc-100 pt-5">
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-black uppercase tracking-[0.18em] text-red-500">
                              Trip completion check
                            </p>
                            <p className="mt-1 text-sm font-bold text-zinc-600">
                              {completionRequest.userName} · {completionRequest.plateNumber} ·{" "}
                              {Number(completionRequest.rideCost || 0).toFixed(2)} AZN
                            </p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-black ${
                            isCompletionApproved
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700"
                          }`}>
                            {isCompletionApproved ? "Approved" : "Needs approval"}
                          </span>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          {photoAngles.map(([angle, label]) => (
                            <figure key={angle} className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
                              <div className="aspect-[4/3]">
                                <img
                                  src={completionRequest.photos?.[angle]?.dataUrl}
                                  alt={`${label} of ${completionRequest.vehicleName}`}
                                  className="h-full w-full object-cover"
                                />
                              </div>
                              <figcaption className="border-t border-zinc-200 bg-white px-3 py-2 text-xs font-black text-zinc-700">
                                {label}
                              </figcaption>
                            </figure>
                          ))}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })
            ) : (
              <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-10 text-center">
                <p className="text-lg font-black">No assigned tasks</p>
                <p className="mt-2 text-sm font-semibold text-zinc-500">
                  New tasks will appear here after an administrator assigns them.
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
