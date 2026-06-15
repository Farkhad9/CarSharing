import { useState, useEffect } from 'react';
import { FiX, FiBatteryCharging, FiClock, FiMapPin, FiNavigation, FiLock, FiAlertTriangle, FiCheckCircle } from 'react-icons/fi';
import { TbWind } from 'react-icons/tb';

const VehicleReservationStage = ({ vehicle, onClose, onConfirmReservation, cancellationCount = 0, onPayUnlock }) => {
    // --- STATES ---
    const [isACActive, setIsACActive] = useState(false);
    const [acTimer, setAcTimer] = useState(600); // 10 минут в секундах
    const [acCost, setAcCost] = useState(0.00);
    const [insuranceType, setInsuranceType] = useState('standard'); // 'standard' или 'premium'
    const [destination, setDestination] = useState('');
    const [estimatedPrice, setEstimatedPrice] = useState(null);

    // Состояние блокировки (Защита от спама отмен)
    const isAccountLocked = cancellationCount >= 3;
    const [lockTimer, setLockTimer] = useState(10800); // 3 часа бана в секундах

    // --- EFFECT: Таймер климат-контроля ---
    useEffect(() => {
        let interval = null;
        if (isACActive && acTimer > 0 && !isAccountLocked) {
            interval = setInterval(() => {
                setAcTimer((prev) => {
                    if (prev <= 1) {
                        setIsACActive(false);
                        return 0;
                    }

                    return prev - 1;
                });

                // Логика монетизации: первые 5 минут (300 сек) бесплатно, дальше +0.05 AZN/мин (примерно 0.00083 AZN в секунду)
                if (acTimer <= 300) {
                    setAcCost((prevCost) => prevCost + 0.00083);
                }
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isACActive, acTimer, isAccountLocked]);

    // --- EFFECT: Таймер блокировки профиля ---
    useEffect(() => {
        let interval = null;
        if (isAccountLocked && lockTimer > 0) {
            interval = setInterval(() => {
                setLockTimer((prev) => prev - 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isAccountLocked, lockTimer]);

    // --- FUNCTIONS ---
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const handleDestinationChange = (e) => {
        const value = e.target.value;
        setDestination(value);
        if (value.trim().length > 3) {
            // Имитация Predictive Pricing (Расчет стоимости на основе трафика Баку)
            const basePrice = parseFloat(vehicle.pricePerMinute);
            const mockMinutes = Math.floor(Math.random() * (25 - 10 + 1)) + 10; // 10-25 минут
            const insuranceAddon = insuranceType === 'premium' ? 0.05 * mockMinutes : 0;
            const total = (basePrice * mockMinutes) + insuranceAddon + acCost;
            setEstimatedPrice({ mins: mockMinutes, cost: total.toFixed(2) });
        } else {
            setEstimatedPrice(null);
        }
    };

    // --- UI: ЭКРАН БЛОКИРОВКИ (LOCKOUT SCREEN) ---
    if (isAccountLocked) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-xl p-4 animate-fadeIn">
                <div className="w-full max-w-md overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 p-8 text-center shadow-2xl">
                    <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
                        <FiLock className="h-8 w-8 animate-pulse" />
                    </div>
                    <h3 className="text-2xl font-black tracking-tight text-white mb-2">
                        Account Temporarily Paused
                    </h3>
                    <p className="text-sm text-zinc-400 leading-relaxed mb-6">
                        To keep our fleet fair for everyone in Baku, your reservation privilege has been paused due to 3 consecutive cancellations.
                    </p>

                    {/* Живой таймер обратного отсчета */}
                    <div className="mb-8 rounded-2xl bg-zinc-950/50 border border-zinc-850 py-4 px-6">
                        <span className="text-xs font-bold uppercase tracking-widest text-zinc-500 block mb-1">
                            Unlocks In
                        </span>
                        <span className="font-mono text-3xl font-black text-red-400 tracking-wider">
                            {formatTime(lockTimer)}
                        </span>
                    </div>

                    {/* Кнопка платного мгновенного анлока */}
                    <div className="space-y-3">
                        <button
                            onClick={onPayUnlock}
                            className="w-full rounded-xl bg-white py-4 text-sm font-bold text-zinc-950 transition-all duration-300 hover:bg-zinc-200 hover:shadow-[0_10px_20px_rgba(255,255,255,0.1)]"
                        >
                            Unlock Immediately for 5.00 AZN
                        </button>
                        <button
                            onClick={onClose}
                            className="w-full text-xs font-bold text-zinc-500 hover:text-zinc-300 transition-colors py-2"
                        >
                            Close and Wait
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // --- UI: ОСНОВНОЙ СТЕЙДЖ БРОНИРОВАНИЯ ---
    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-zinc-950/40 backdrop-blur-md flex items-center justify-center p-0 md:p-6 animate-fadeIn">
            <div className="relative w-full max-w-7xl bg-white md:rounded-3xl shadow-[0_30px_100px_rgba(0,0,0,0.25)] border border-gray-150 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-screen md:min-h-[80vh]">

                {/* Кнопка закрытия */}
                <button
                    onClick={onClose}
                    className="absolute right-6 top-6 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-700 transition-all hover:bg-gray-200 hover:scale-105"
                >
                    <FiX className="h-5 w-5" />
                </button>

                {/* ================= ЛЕВАЯ СТОРОНА (60%): ВИЗУАЛ И ЭКСПИРИЕНС ================= */}
                <div className="lg:col-span-7 bg-gradient-to-b from-gray-50 via-gray-50/50 to-white p-8 lg:p-12 flex flex-col justify-between border-r border-gray-100 relative">

                    {/* Живой статус кондиционера */}
                    <div className="absolute top-8 left-8 z-20">
                        {isACActive && (
                            <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-xs font-black text-blue-600 border border-blue-100 animate-pulse">
                                <TbWind className="animate-spin text-sm" />
                                Cabin cooling to 21°C ({formatTime(acTimer)})
                            </span>
                        )}
                    </div>

                    {/* Главный подиум авто */}
                    <div className="flex-grow flex flex-col items-center justify-center my-8">
                        <div className="relative w-full max-w-lg aspect-[16/10] flex items-center justify-center">
                            {/* Эффект тени под машиной */}
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[85%] h-8 bg-zinc-950/10 rounded-full blur-xl transition-all duration-500 group-hover:w-[90%]" />
                            <img
                                src={vehicle.image}
                                alt={vehicle.brand}
                                className="w-full h-full object-contain relative z-10 transition-transform duration-500 hover:scale-105"
                            />
                        </div>

                        {/* Быстрые Live-характеристики */}
                        <div className="flex items-center gap-8 mt-6">
                            <div className="flex items-center gap-2">
                                <FiBatteryCharging className="text-emerald-500 text-xl" />
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Battery</p>
                                    <p className="text-sm font-black text-gray-900">{vehicle.batteryPercent}%</p>
                                </div>
                            </div>
                            <div className="w-px h-6 bg-gray-200" />
                            <div className="flex items-center gap-2">
                                <FiClock className="text-red-500 text-xl" />
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Distance</p>
                                    <p className="text-sm font-black text-gray-900">3 min walk</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Интерактивная кнопка климат-контроля */}
                    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm flex items-center justify-between gap-4">
                        <div>
                            <h4 className="text-sm font-black text-gray-900">Pre-cool Cabin remotely</h4>
                            <p className="text-xs text-gray-400 mt-0.5">
                                {isACActive
                                    ? `Running. Cost accrued: ${acCost.toFixed(2)} AZN (First 5m free)`
                                    : "Turn on AC ahead of time. First 5 mins are complimentary."
                                }
                            </p>
                        </div>
                        <button
                            onClick={() => {
                                if (!isACActive) { setAcTimer(600); setAcCost(0); }
                                setIsACActive(!isACActive);
                            }}
                            className={`px-5 py-3 text-xs font-bold rounded-xl transition-all ${isACActive
                                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                                    : "bg-gray-50 border border-gray-200 text-gray-700 hover:bg-gray-100"
                                }`}
                        >
                            {isACActive ? "Turn Off" : "Pre-cool (21°C)"}
                        </button>
                    </div>
                </div>

                {/* ================= ПРАВАЯ СТОРОНА (40%): НАСТРОЙКИ И ДЕЙСТВИЕ ================= */}
                <div className="lg:col-span-5 p-8 lg:p-12 flex flex-col justify-between h-full bg-white">
                    <div>
                        {/* Предупреждение о лимите отмен (Warning Banner) */}
                        {cancellationCount === 2 && (
                            <div className="mb-6 flex items-start gap-3 rounded-2xl bg-amber-50 border border-amber-200 p-4 text-amber-850">
                                <FiAlertTriangle className="mt-0.5 h-5 w-5 text-amber-600 flex-shrink-0" />
                                <div className="text-xs leading-relaxed">
                                    <span className="font-bold block mb-0.5">Final Warning:</span>
                                    One more cancellation will pause your account reservations for 3 hours.
                                </div>
                            </div>
                        )}

                        {/* Имя авто */}
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Premium Sharing</span>
                        <h3 className="text-3xl font-black text-gray-900 tracking-tight mt-1">{vehicle.brand} {vehicle.model}</h3>
                        <p className="text-xs font-bold text-gray-400 mt-1 tracking-wider uppercase">{vehicle.plateNumber} · {vehicle.year}</p>

                        {/* Опция 1: Выбор Страховки (Premium UX) */}
                        <div className="mt-8">
                            <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-3">Protection Package</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setInsuranceType('standard')}
                                    className={`p-4 rounded-xl text-left border transition-all ${insuranceType === 'standard'
                                            ? "border-zinc-950 bg-zinc-950 text-white shadow-md"
                                            : "border-gray-200 text-gray-500 hover:border-gray-400 bg-white"
                                        }`}
                                >
                                    <p className="text-xs font-black">Standard</p>
                                    <p className={`text-[10px] mt-1 ${insuranceType === 'standard' ? 'text-zinc-400' : 'text-gray-400'}`}>Franchise applies</p>
                                </button>
                                <button
                                    onClick={() => setInsuranceType('premium')}
                                    className={`p-4 rounded-xl text-left border transition-all ${insuranceType === 'premium'
                                            ? "border-red-600 bg-red-50/20 text-red-950 shadow-sm"
                                            : "border-gray-200 text-gray-500 hover:border-gray-400 bg-white"
                                        }`}
                                >
                                    <p className="text-xs font-black flex items-center gap-1">Super Zero Risk <FiCheckCircle className="text-red-500 text-xs" /></p>
                                    <p className="text-[10px] text-red-600/70 mt-1">+0.05 AZN / min</p>
                                </button>
                            </div>
                        </div>

                        {/* Опция 2: Predictive Pricing (Инпут назначения) */}
                        <div className="mt-6">
                            <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-2">Where are you heading?</label>
                            <div className="relative">
                                <FiMapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    value={destination}
                                    onChange={handleDestinationChange}
                                    placeholder="Enter destination in Baku (e.g. Port Baku)"
                                    className="w-full bg-gray-50 border border-gray-200 text-sm rounded-xl py-3.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 transition-all placeholder:text-gray-400 text-gray-900 font-medium"
                                />
                            </div>

                            {/* Показ предрасчета */}
                            {estimatedPrice && (
                                <div className="mt-3 rounded-xl bg-gray-50 border border-gray-100 py-3 px-4 flex justify-between items-center text-xs animate-slideUp">
                                    <span className="font-bold text-gray-500 flex items-center gap-1.5"><FiNavigation /> Est. Trip Time:</span>
                                    <span className="font-black text-gray-900">~{estimatedPrice.mins} mins ({estimatedPrice.cost} AZN)</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Финальный блок чекаута */}
                    <div className="mt-8 pt-6 border-t border-gray-100">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <p className="text-xs font-bold text-gray-400">Reservation Rate</p>
                                <p className="text-xs text-gray-400 mt-0.5">Includes 15m free walk time</p>
                            </div>
                            <p className="text-xl font-black text-gray-900">
                                {insuranceType === 'premium'
                                    ? `${(parseFloat(vehicle.pricePerMinute) + 0.05).toFixed(2)}`
                                    : `${vehicle.pricePerMinute}`
                                } AZN<span className="text-xs font-medium text-gray-400">/m</span>
                            </p>
                        </div>

                        <button
                            onClick={() => onConfirmReservation(vehicle, acCost)}
                            className="w-full group inline-flex items-center justify-center px-8 py-4 font-bold text-white transition-all duration-300 bg-red-600 rounded-xl hover:bg-red-500 hover:shadow-[0_10px_25px_-5px_rgba(220,38,38,0.4)]"
                        >
                            <span>Confirm & Lock Vehicle</span>
                        </button>
                        <p className="text-[11px] text-center text-gray-400 mt-3 font-medium">
                            By confirming, you agree to ElectroStreet terms of service.
                        </p>
                    </div>

                </div>

            </div>
        </div>
    );
};

export default VehicleReservationStage;
