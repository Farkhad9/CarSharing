import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  FiActivity,
  FiArrowLeft,
  FiCheckCircle,
  FiClock,
  FiCreditCard,
  FiDollarSign,
  FiFileText,
  FiLock,
  FiMail,
  FiMapPin,
  FiNavigation,
  FiPlus,
  FiShield,
  FiSmartphone,
  FiTrash2,
  FiUploadCloud,
  FiUserCheck,
  FiX,
  FiZap,
} from "react-icons/fi";
import { FaCar } from "react-icons/fa";
import { vehicles } from "../../data/vehicles";
import { trips } from "../../data/trips";

const RESERVATION_SECONDS = 15 * 60;

const getStoredJson = (key, fallback = null) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const formatTimer = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
};

const formatMoney = (amount) => `${Number(amount || 0).toFixed(2)} AZN`;

const getReservationVehicle = (reservation) => {
  if (!reservation) return null;

  const vehicle = vehicles.find((item) => item.id === reservation.vehicleId);
  return {
    ...vehicle,
    ...reservation,
    brand: reservation.brand || vehicle?.brand || "Tesla",
    model: reservation.model || vehicle?.model || "Model 3",
    image: reservation.image || vehicle?.image,
    plateNumber: reservation.plateNumber || vehicle?.plateNumber || "99-AA-000",
    location: reservation.location || vehicle?.location,
  };
};

const tabs = [
  { id: "trip", label: "Поездка", icon: FiActivity },
  { id: "payments", label: "Оплата", icon: FiCreditCard },
  { id: "documents", label: "Документы", icon: FiFileText },
  { id: "security", label: "Безопасность", icon: FiLock },
];

const panelMotion = {
  initial: { opacity: 0, y: 18, scale: 0.99 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -12, scale: 0.99 },
  transition: { duration: 0.28, ease: "easeOut" },
};

const Dashboard = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState("trip");
  const [user, setUser] = useState(() =>
    getStoredJson("electroStreetUser", {
      name: "Farhad",
      email: "farhad@electrostreet.az",
      balance: 0,
      avatarInitial: "F",
      emailVerified: true,
    })
  );
  const [reservation, setReservation] = useState(() => getStoredJson("reservedVehicle"));
  const [remainingSeconds, setRemainingSeconds] = useState(RESERVATION_SECONDS);
  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("50");
  const [cardForm, setCardForm] = useState({ number: "", holder: user.name || "Farhad" });
  const [paymentCards, setPaymentCards] = useState(() =>
    getStoredJson("electroStreetCards", [
      { id: "visa-4321", holder: "Farhad", brand: "Visa", last4: "4321" },
    ])
  );
  const [documents, setDocuments] = useState(() =>
    getStoredJson("electroStreetDocuments", {
      license: { status: "На проверке", fileName: "driver-license-front.jpg" },
      passport: { status: "Требуется загрузка", fileName: "" },
    })
  );
  const [security, setSecurity] = useState({
    twoFactor: true,
    biometrics: false,
    rideAlerts: true,
  });

  const licenseInputRef = useRef(null);
  const passportInputRef = useRef(null);
  const activeVehicle = useMemo(() => getReservationVehicle(reservation), [reservation]);
  const progress = Math.max(0, Math.min(100, (remainingSeconds / RESERVATION_SECONDS) * 100));

  const recentTrips = useMemo(() => {
    return trips.slice(0, 4).map((trip) => ({
      ...trip,
      vehicle: vehicles.find((vehicle) => vehicle.id === trip.vehicleId),
    }));
  }, []);

  const pendingVerification = useMemo(
    () => getStoredJson("electroStreetPendingEmailVerification"),
    [user?.emailVerified]
  );

  useEffect(() => {
    if (!reservation?.reservedAt) return undefined;

    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - new Date(reservation.reservedAt).getTime()) / 1000);
      setRemainingSeconds(Math.max(0, RESERVATION_SECONDS - elapsed));
    };

    updateTimer();
    const interval = window.setInterval(updateTimer, 1000);
    return () => window.clearInterval(interval);
  }, [reservation]);

  const persistUser = (nextUser) => {
    setUser(nextUser);
    localStorage.setItem("electroStreetUser", JSON.stringify(nextUser));
  };

  const persistCards = (nextCards) => {
    setPaymentCards(nextCards);
    localStorage.setItem("electroStreetCards", JSON.stringify(nextCards));
  };

  const persistDocuments = (nextDocuments) => {
    setDocuments(nextDocuments);
    localStorage.setItem("electroStreetDocuments", JSON.stringify(nextDocuments));
  };

  const cancelReservation = () => {
    localStorage.removeItem("reservedVehicle");
    setReservation(null);
  };

  const handleTopUp = (event) => {
    event.preventDefault();
    const amount = Number(topUpAmount);

    if (!Number.isFinite(amount) || amount <= 0) return;

    persistUser({
      ...user,
      balance: Number(((user.balance || 0) + amount).toFixed(2)),
    });
    setTopUpAmount("50");
    setIsTopUpModalOpen(false);
  };

  const handleAddCard = (event) => {
    event.preventDefault();
    const digits = cardForm.number.replace(/\D/g, "");
    const last4 = digits.slice(-4) || String(Math.floor(1000 + Math.random() * 9000));
    const brand = digits.startsWith("5") ? "Mastercard" : "Visa";

    persistCards([
      ...paymentCards,
      {
        id: `card-${Date.now()}`,
        holder: cardForm.holder.trim() || user.name || "Farhad",
        brand,
        last4,
      },
    ]);
    setCardForm({ number: "", holder: user.name || "Farhad" });
    setIsCardModalOpen(false);
  };

  const handleRemoveCard = (cardId) => {
    persistCards(paymentCards.filter((card) => card.id !== cardId));
  };

  const handleDocumentUpload = (type, event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    persistDocuments({
      ...documents,
      [type]: {
        status: "Загружено",
        fileName: file.name,
      },
    });
  };

  const verifyEmailNow = () => {
    const verifiedUser = {
      ...user,
      emailVerified: true,
      emailVerifiedAt: new Date().toISOString(),
    };

    localStorage.removeItem("electroStreetPendingEmailVerification");
    persistUser(verifiedUser);
  };

  const renderTripPanel = () => (
    <motion.div {...panelMotion} className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
      <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 p-6">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-red-500">Active ride</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-zinc-950">
            {activeVehicle ? "Автомобиль зарезервирован" : "Готовы к следующей поездке"}
          </h2>
        </div>

        {activeVehicle ? (
          <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
            <div className="relative flex min-h-[360px] items-center justify-center bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.16),transparent_60%)] p-8">
              <img
                src={activeVehicle.image}
                alt={`${activeVehicle.brand} ${activeVehicle.model}`}
                className="relative z-10 max-h-[280px] w-full object-contain drop-shadow-2xl"
              />
              <div className="absolute bottom-16 h-5 w-2/3 rounded-full bg-zinc-950/20 blur-xl" />
            </div>
            <div className="border-t border-zinc-100 p-6 lg:border-l lg:border-t-0">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">
                {activeVehicle.plateNumber}
              </p>
              <h3 className="mt-2 text-3xl font-black text-zinc-950">
                {activeVehicle.brand} {activeVehicle.model}
              </h3>
              <div className="mt-6 rounded-2xl bg-zinc-950 p-5 text-white">
                <div className="flex items-end justify-between gap-4">
                  <span className="font-mono text-5xl font-black tabular-nums">
                    {formatTimer(remainingSeconds)}
                  </span>
                  <span className="pb-1 text-xs font-black uppercase tracking-wide text-white/45">
                    free walk
                  </span>
                </div>
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-red-500 transition-all duration-1000"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-zinc-50 p-4">
                  <FiMapPin className="text-red-500" />
                  <p className="mt-3 text-xs font-bold text-zinc-400">Pickup</p>
                  <p className="text-sm font-black text-zinc-950">{activeVehicle.location?.label || "Baku"}</p>
                </div>
                <div className="rounded-2xl bg-zinc-50 p-4">
                  <FiDollarSign className="text-red-500" />
                  <p className="mt-3 text-xs font-bold text-zinc-400">Rate</p>
                  <p className="text-sm font-black text-zinc-950">{formatMoney(activeVehicle.rate)}/min</p>
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={cancelReservation}
                  className="rounded-2xl border border-zinc-200 px-5 py-4 text-sm font-black text-zinc-700 transition hover:border-red-200 hover:text-red-600"
                >
                  Отменить бронь
                </button>
                <button
                  type="button"
                  disabled={remainingSeconds > 0}
                  className="rounded-2xl bg-red-500 px-5 py-4 text-sm font-black text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
                >
                  Открыть машину
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-5 p-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-3xl bg-zinc-950 p-6 text-white">
              <FiNavigation className="text-3xl text-red-400" />
              <h3 className="mt-8 text-2xl font-black">Нет активной аренды</h3>
              <p className="mt-3 text-sm font-semibold leading-6 text-white/55">
                Выберите автомобиль на главной странице, изучите 3D модель, маршрут и способ оплаты, затем подтвердите бронь.
              </p>
              <a
                href="/#fleet"
                className="mt-8 inline-flex rounded-2xl bg-white px-5 py-3 text-sm font-black text-zinc-950 transition hover:bg-red-50 hover:text-red-600"
              >
                Выбрать автомобиль
              </a>
            </div>
            <div className="grid gap-3">
              {recentTrips.slice(0, 3).map((trip) => (
                <div key={trip.id} className="flex items-center gap-4 rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
                  <div className="flex h-14 w-16 items-center justify-center rounded-2xl bg-white">
                    {trip.vehicle?.image ? (
                      <img src={trip.vehicle.image} alt="" className="h-10 w-full object-contain" />
                    ) : (
                      <FaCar />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-zinc-950">
                      {trip.vehicle?.brand} {trip.vehicle?.model}
                    </p>
                    <p className="text-xs font-bold text-zinc-400">{trip.startLocation} → {trip.endLocation || trip.currentLocation || "Reserved"}</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-wide text-zinc-500">
                    {trip.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <aside className="grid gap-5">
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-zinc-400">Fleet pass</p>
          <div className="mt-5 grid grid-cols-3 gap-3">
            {[
              ["Balance", formatMoney(user.balance)],
              ["Cards", paymentCards.length],
              ["Trips", recentTrips.length],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-zinc-50 p-4">
                <p className="text-xs font-bold text-zinc-400">{label}</p>
                <p className="mt-2 text-lg font-black text-zinc-950">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {user.emailVerified === false && (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
            <FiMail className="text-2xl text-amber-600" />
            <h3 className="mt-4 text-xl font-black text-zinc-950">Подтвердите email</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-zinc-600">
              До подтверждения email бронирование и платежи ограничены.
            </p>
            <button
              type="button"
              onClick={verifyEmailNow}
              className="mt-5 rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-black text-white transition hover:bg-zinc-800"
            >
              Подтвердить в демо
            </button>
            {pendingVerification?.link && (
              <a href={pendingVerification.link} className="mt-3 block break-all text-xs font-bold text-amber-700 underline">
                Открыть ссылку письма
              </a>
            )}
          </div>
        )}
      </aside>
    </motion.div>
  );

  const renderPaymentsPanel = () => (
    <motion.div {...panelMotion} className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
      <section className="rounded-3xl bg-zinc-950 p-6 text-white shadow-xl shadow-zinc-950/10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-red-300">Profile balance</p>
            <p className="mt-4 text-5xl font-black tracking-tight">{formatMoney(user.balance)}</p>
            <p className="mt-3 text-sm font-semibold text-white/50">Можно выбрать как способ оплаты при бронировании.</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-4">
            <FiSmartphone className="text-3xl" />
          </div>
        </div>
        <div className="mt-8 grid grid-cols-3 gap-2">
          {["25", "50", "100"].map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => {
                setTopUpAmount(amount);
                setIsTopUpModalOpen(true);
              }}
              className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-black transition hover:bg-white hover:text-zinc-950"
            >
              +{amount}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setIsTopUpModalOpen(true)}
          className="mt-4 w-full rounded-2xl bg-red-500 px-5 py-4 text-sm font-black transition hover:bg-red-600"
        >
          Пополнить баланс
        </button>
      </section>

      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-red-500">Payment vault</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-zinc-950">Карты и способы оплаты</h2>
          </div>
          <button
            type="button"
            onClick={() => setIsCardModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-black text-white transition hover:bg-red-500"
          >
            <FiPlus /> Добавить карту
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {paymentCards.map((card, index) => (
            <motion.div
              key={card.id}
              layout
              className={`relative min-h-[210px] overflow-hidden rounded-3xl p-6 text-white shadow-xl ${
                index % 2 === 0
                  ? "bg-[linear-gradient(135deg,#18181b,#ef4444)]"
                  : "bg-[linear-gradient(135deg,#111827,#2563eb)]"
              }`}
            >
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
              <div className="relative flex items-start justify-between">
                <FiCreditCard className="text-3xl text-white/80" />
                <button
                  type="button"
                  onClick={() => handleRemoveCard(card.id)}
                  className="rounded-full bg-white/10 p-2 text-white/70 transition hover:bg-white hover:text-red-600"
                  aria-label="Remove payment card"
                >
                  <FiTrash2 />
                </button>
              </div>
              <div className="relative mt-16">
                <p className="font-mono text-2xl font-black tracking-widest">•••• {card.last4}</p>
                <div className="mt-5 flex items-center justify-between text-xs font-black uppercase tracking-widest text-white/65">
                  <span>{card.holder}</span>
                  <span>{card.brand}</span>
                </div>
              </div>
            </motion.div>
          ))}

          <button
            type="button"
            onClick={() => setIsCardModalOpen(true)}
            className="flex min-h-[210px] flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-300 bg-zinc-50 text-zinc-500 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600"
          >
            <FiPlus className="mb-3 text-3xl" />
            <span className="text-sm font-black">Новая карта</span>
          </button>
        </div>
      </section>
    </motion.div>
  );

  const renderDocumentsPanel = () => {
    const documentCards = [
      {
        type: "license",
        title: "Водительское удостоверение",
        helper: "Нужно для допуска к аренде",
        icon: FiUserCheck,
        inputRef: licenseInputRef,
      },
      {
        type: "passport",
        title: "Паспорт",
        helper: "Используется для KYC-проверки",
        icon: FiFileText,
        inputRef: passportInputRef,
      },
    ];

    return (
      <motion.div {...panelMotion} className="grid gap-5 xl:grid-cols-[1fr_0.8fr]">
        <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-red-500">Verification</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-zinc-950">Мои документы</h2>
          <input
            ref={licenseInputRef}
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={(event) => handleDocumentUpload("license", event)}
          />
          <input
            ref={passportInputRef}
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={(event) => handleDocumentUpload("passport", event)}
          />

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {documentCards.map((doc) => {
              const Icon = doc.icon;
              const data = documents[doc.type] || {};
              const uploaded = Boolean(data.fileName);

              return (
                <div key={doc.type} className="rounded-3xl border border-zinc-100 bg-zinc-50 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="rounded-2xl bg-white p-4 text-red-500 shadow-sm">
                      <Icon className="text-2xl" />
                    </div>
                    <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wide ${
                      uploaded ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    }`}>
                      {data.status}
                    </span>
                  </div>
                  <h3 className="mt-6 text-xl font-black text-zinc-950">{doc.title}</h3>
                  <p className="mt-1 text-sm font-semibold text-zinc-500">{doc.helper}</p>
                  <p className="mt-4 min-h-5 truncate text-xs font-bold text-zinc-400">
                    {data.fileName || "Файл ещё не загружен"}
                  </p>
                  <button
                    type="button"
                    onClick={() => doc.inputRef.current?.click()}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-black text-white transition hover:bg-red-500"
                  >
                    <FiUploadCloud /> {uploaded ? "Заменить файл" : "Загрузить"}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="rounded-3xl bg-red-500 p-6 text-white shadow-xl shadow-red-500/20">
          <FiCheckCircle className="text-4xl" />
          <h3 className="mt-8 text-2xl font-black">Статус допуска</h3>
          <div className="mt-5 space-y-3">
            {[
              ["Email", user.emailVerified ? "Подтверждён" : "Ожидает"],
              ["Права", documents.license?.fileName ? "На проверке" : "Нужна загрузка"],
              ["Паспорт", documents.passport?.fileName ? "Загружен" : "Нужна загрузка"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-2xl bg-white/12 px-4 py-3">
                <span className="text-sm font-bold text-white/70">{label}</span>
                <span className="text-sm font-black">{value}</span>
              </div>
            ))}
          </div>
        </aside>
      </motion.div>
    );
  };

  const renderSecurityPanel = () => (
    <motion.div {...panelMotion} className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-red-500">Account</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-zinc-950">Безопасность</h2>
        <div className="mt-6 grid gap-3">
          {[
            ["twoFactor", "Двухфакторная защита", "Код подтверждения при входе", FiShield],
            ["biometrics", "Биометрия", "Быстрый вход на доверенных устройствах", FiUserCheck],
            ["rideAlerts", "Уведомления поездок", "Email и push при каждой операции", FiZap],
          ].map(([key, title, detail, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSecurity((current) => ({ ...current, [key]: !current[key] }))}
              className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-100 bg-zinc-50 p-4 text-left transition hover:border-red-200 hover:bg-red-50"
            >
              <span className="flex min-w-0 items-center gap-4">
                <span className="rounded-2xl bg-white p-3 text-red-500 shadow-sm">
                  <Icon />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-black text-zinc-950">{title}</span>
                  <span className="block truncate text-xs font-bold text-zinc-500">{detail}</span>
                </span>
              </span>
              <span className={`h-7 w-12 rounded-full p-1 transition ${security[key] ? "bg-red-500" : "bg-zinc-300"}`}>
                <span className={`block h-5 w-5 rounded-full bg-white transition ${security[key] ? "translate-x-5" : ""}`} />
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-3xl bg-zinc-950 p-6 text-white">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-red-300">Password</p>
        <h3 className="mt-2 text-3xl font-black tracking-tight">Смена пароля</h3>
        <div className="mt-6 grid gap-3">
          <input className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm font-bold outline-none transition placeholder:text-white/35 focus:border-red-400" type="password" placeholder="Текущий пароль" />
          <input className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm font-bold outline-none transition placeholder:text-white/35 focus:border-red-400" type="password" placeholder="Новый пароль" />
          <input className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm font-bold outline-none transition placeholder:text-white/35 focus:border-red-400" type="password" placeholder="Повторите пароль" />
          <button className="rounded-2xl bg-red-500 px-5 py-4 text-sm font-black transition hover:bg-red-600">
            Обновить пароль
          </button>
        </div>
      </section>
    </motion.div>
  );

  const activeRenderer = {
    trip: renderTripPanel,
    payments: renderPaymentsPanel,
    documents: renderDocumentsPanel,
    security: renderSecurityPanel,
  }[activeTab];

  return (
    <main className="min-h-screen bg-[#f5f7fb] text-zinc-950">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8">
        <header className="sticky top-0 z-40 -mx-4 mb-5 border-b border-zinc-200/70 bg-[#f5f7fb]/85 px-4 py-4 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <a href="/" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-950 text-white shadow-lg shadow-zinc-950/10">
                <FiArrowLeft />
              </a>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-red-500">ElectroStreet</p>
                <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Личный кабинет</h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-wide text-zinc-400">Баланс</p>
                <p className="text-sm font-black">{formatMoney(user.balance)}</p>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-3 py-2 shadow-sm">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500 text-sm font-black text-white">
                  {user.avatarInitial || user.name?.charAt(0) || "F"}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-black">{user.name || "Farhad"}</span>
                  <span className="block truncate text-xs font-bold text-zinc-400">{user.email}</span>
                </span>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm font-black text-zinc-600 shadow-sm transition hover:border-red-200 hover:text-red-600"
              >
                Выйти
              </button>
            </div>
          </div>
        </header>

        <section className="mb-5 grid gap-4 lg:grid-cols-[1fr_0.72fr_0.72fr]">
          <div className="overflow-hidden rounded-3xl bg-zinc-950 p-6 text-white shadow-xl shadow-zinc-950/10">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-red-300">Good to see you</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight">Привет, {user.name || "Farhad"}.</h2>
            <p className="mt-3 max-w-xl text-sm font-semibold leading-6 text-white/55">
              Управляйте поездками, балансом, документами и безопасностью из одного аккуратного центра.
            </p>
          </div>
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <FiClock className="text-2xl text-red-500" />
            <p className="mt-6 text-xs font-black uppercase tracking-wide text-zinc-400">Next action</p>
            <p className="mt-1 text-xl font-black">{activeVehicle ? "Дойти до авто" : "Выбрать EV"}</p>
          </div>
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <FiCheckCircle className={`text-2xl ${user.emailVerified === false ? "text-amber-500" : "text-emerald-500"}`} />
            <p className="mt-6 text-xs font-black uppercase tracking-wide text-zinc-400">Account status</p>
            <p className="mt-1 text-xl font-black">{user.emailVerified === false ? "Email ожидает" : "Verified"}</p>
          </div>
        </section>

        <div className="mb-5 overflow-x-auto">
          <nav className="inline-flex min-w-full gap-2 rounded-3xl border border-zinc-200 bg-white p-2 shadow-sm lg:min-w-0">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex min-w-40 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black transition ${
                    isActive
                      ? "bg-red-500 text-white shadow-lg shadow-red-500/20"
                      : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-950"
                  }`}
                >
                  <Icon />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <AnimatePresence mode="wait">{activeRenderer?.()}</AnimatePresence>
      </div>

      {isTopUpModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/65 p-4 backdrop-blur">
          <motion.form
            onSubmit={handleTopUp}
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl font-black">Пополнить баланс</h2>
              <button type="button" className="rounded-full bg-zinc-100 p-2 text-zinc-500 hover:text-red-500" onClick={() => setIsTopUpModalOpen(false)}>
                <FiX />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {["25", "50", "100"].map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => setTopUpAmount(amount)}
                  className={`rounded-2xl border px-4 py-3 text-sm font-black transition ${
                    topUpAmount === amount ? "border-red-500 bg-red-500 text-white" : "border-zinc-200 bg-zinc-50 text-zinc-600"
                  }`}
                >
                  {amount} AZN
                </button>
              ))}
            </div>
            <input
              className="mt-3 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm font-bold outline-none focus:border-red-500 focus:bg-white"
              type="number"
              min="1"
              step="1"
              value={topUpAmount}
              onChange={(event) => setTopUpAmount(event.target.value)}
              placeholder="Amount"
            />
            <button type="submit" className="mt-5 w-full rounded-2xl bg-zinc-950 px-5 py-4 text-sm font-black text-white transition hover:bg-red-500">
              Подтвердить
            </button>
          </motion.form>
        </div>
      )}

      {isCardModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/65 p-4 backdrop-blur">
          <motion.form
            onSubmit={handleAddCard}
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl font-black">Новая карта</h2>
              <button type="button" className="rounded-full bg-zinc-100 p-2 text-zinc-500 hover:text-red-500" onClick={() => setIsCardModalOpen(false)}>
                <FiX />
              </button>
            </div>
            <div className="mb-5 min-h-[190px] rounded-3xl bg-[linear-gradient(135deg,#18181b,#ef4444)] p-6 text-white shadow-xl">
              <FiCreditCard className="text-3xl text-white/80" />
              <p className="mt-16 font-mono text-2xl font-black tracking-widest">
                •••• {cardForm.number.replace(/\D/g, "").slice(-4) || "0000"}
              </p>
              <p className="mt-4 text-xs font-black uppercase tracking-widest text-white/60">
                {cardForm.holder || user.name || "Card holder"}
              </p>
            </div>
            <div className="grid gap-3">
              <input
                className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm font-bold outline-none focus:border-red-500 focus:bg-white"
                placeholder="Номер карты"
                value={cardForm.number}
                onChange={(event) => setCardForm((current) => ({ ...current, number: event.target.value }))}
              />
              <input
                className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm font-bold outline-none focus:border-red-500 focus:bg-white"
                placeholder="Имя на карте"
                value={cardForm.holder}
                onChange={(event) => setCardForm((current) => ({ ...current, holder: event.target.value }))}
              />
              <button type="submit" className="rounded-2xl bg-zinc-950 px-5 py-4 text-sm font-black text-white transition hover:bg-red-500">
                Добавить карту
              </button>
            </div>
          </motion.form>
        </div>
      )}
    </main>
  );
};

export default Dashboard;
