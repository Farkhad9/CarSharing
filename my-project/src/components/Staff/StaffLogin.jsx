import { useState } from "react";
import { FiLock, FiLogIn, FiUser } from "react-icons/fi";
import { staffApi } from "../../api/staffApi";

const StaffLogin = () => {
  const [form, setForm] = useState({ login: "", password: "" });
  const [error, setError] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();
    setError("");

    try {
      staffApi.login(form.login, form.password);
      window.location.href = "/staff";
    } catch (nextError) {
      setError(nextError.message);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center">
        <section className="grid w-full gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="flex flex-col justify-center">
            <a href="/" className="text-sm font-black uppercase tracking-[0.28em] text-red-300">
              ElectroStreet
            </a>
            <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-5xl">Личный кабинет сотрудника</h1>
            <p className="mt-4 max-w-xl text-sm font-semibold leading-6 text-zinc-400">
              Отдельный вход для полевой команды и операторов. Здесь видны только назначенные задания и их рабочие статусы.
            </p>
            <div className="mt-8 grid gap-3 text-sm font-bold text-zinc-300 sm:grid-cols-3">
              <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">Задачи</div>
              <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">Статусы</div>
              <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">Live sync</div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="rounded-lg border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-8">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-red-500 text-xl">
                <FiLock />
              </span>
              <div>
                <h2 className="text-2xl font-black">Вход для сотрудников</h2>
                <p className="text-xs font-bold text-zinc-400">Например: nihat / staff123</p>
              </div>
            </div>

            <label className="mt-8 block">
              <span className="text-xs font-black uppercase tracking-wide text-zinc-500">Логин</span>
              <span className="mt-2 flex items-center gap-3 rounded-lg border border-white/10 bg-zinc-950/70 px-4 py-3">
                <FiUser className="text-zinc-500" />
                <input
                  value={form.login}
                  onChange={(event) => setForm((current) => ({ ...current, login: event.target.value }))}
                  className="w-full bg-transparent text-sm font-bold text-white outline-none placeholder:text-zinc-600"
                  placeholder="nihat"
                />
              </span>
            </label>

            <label className="mt-4 block">
              <span className="text-xs font-black uppercase tracking-wide text-zinc-500">Пароль</span>
              <span className="mt-2 flex items-center gap-3 rounded-lg border border-white/10 bg-zinc-950/70 px-4 py-3">
                <FiLock className="text-zinc-500" />
                <input
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                  className="w-full bg-transparent text-sm font-bold text-white outline-none placeholder:text-zinc-600"
                  placeholder="staff123"
                />
              </span>
            </label>

            {error && <p className="mt-4 rounded-lg bg-red-500/15 px-4 py-3 text-sm font-bold text-red-100">{error}</p>}

            <button type="submit" className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-red-500 px-5 py-4 text-sm font-black uppercase tracking-wide text-white transition hover:bg-red-600">
              <FiLogIn />
              Войти
            </button>
          </form>
        </section>
      </div>
    </main>
  );
};

export default StaffLogin;
