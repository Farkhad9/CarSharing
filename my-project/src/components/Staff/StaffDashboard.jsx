import { useEffect, useMemo, useState } from "react";
import { FiCheckCircle, FiClock, FiLogOut, FiRefreshCw, FiTool } from "react-icons/fi";
import { staffApi } from "../../api/staffApi";
import { STAFF_TASK_STATUS_LABELS, STAFF_TASK_STATUSES } from "../../data/staff";

const statusStyles = {
  [STAFF_TASK_STATUSES.DONE]: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
  [STAFF_TASK_STATUSES.IN_PROGRESS]: "border-blue-400/30 bg-blue-500/10 text-blue-200",
  [STAFF_TASK_STATUSES.WAITING]: "border-amber-400/30 bg-amber-500/10 text-amber-200",
};

const statusOptions = [
  STAFF_TASK_STATUSES.DONE,
  STAFF_TASK_STATUSES.IN_PROGRESS,
  STAFF_TASK_STATUSES.WAITING,
];

const StaffDashboard = () => {
  const [session, setSession] = useState(() => staffApi.getSession());
  const [tasks, setTasks] = useState(() => staffApi.getTasks());

  useEffect(() => {
    if (!session) {
      window.location.href = "/staff-login";
      return undefined;
    }

    return staffApi.subscribe(setTasks);
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
    const nextTasks = staffApi.updateTaskStatus(taskId, status);
    setTasks(nextTasks);
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
            <h1 className="mt-2 text-3xl font-black tracking-tight">Здравствуйте, {session.name}</h1>
          </div>
          <button type="button" onClick={handleLogout} className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-200 px-4 py-3 text-sm font-black transition hover:bg-zinc-100">
            <FiLogOut />
            Выйти
          </button>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="grid gap-3 self-start rounded-lg border border-zinc-200 bg-white p-4">
          {[
            ["Все", stats.total, FiTool],
            ["Выполнено", stats.done, FiCheckCircle],
            ["В процессе", stats.inProgress, FiRefreshCw],
            ["Ожидает", stats.waiting, FiClock],
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
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black">Мои задания</h2>
              <p className="text-sm font-semibold text-zinc-500">Статусы сразу видны администратору в Task Manager.</p>
            </div>
          </div>

          <div className="grid gap-3">
            {myTasks.length ? (
              myTasks.map((task) => (
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
                        <span className="rounded-lg bg-zinc-100 px-3 py-2">Приоритет: {task.priority}</span>
                        <span className="rounded-lg bg-zinc-100 px-3 py-2">Срок: {task.dueAt}</span>
                        {task.vehicleId && <span className="rounded-lg bg-zinc-100 px-3 py-2">Авто: {task.vehicleId}</span>}
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
                          {STAFF_TASK_STATUS_LABELS[status]}
                        </button>
                      ))}
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-10 text-center">
                <p className="text-lg font-black">Назначенных заданий нет</p>
                <p className="mt-2 text-sm font-semibold text-zinc-500">Новые задачи появятся здесь после назначения администратором.</p>
              </div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
};

export default StaffDashboard;
