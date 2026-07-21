import { useMemo, useState } from 'react';
import { NavbarMenu } from "../../mockData/data"; 
import { FaCar, FaBatteryFull, FaBatteryQuarter } from "react-icons/fa";
import { MdMenu, MdLocationOn } from "react-icons/md";
import { CiSearch } from "react-icons/ci";
import { FiCreditCard, FiLogOut, FiUser } from "react-icons/fi";
import ResponsiveMenu from '../ResponsiveMenu';
import { useVehicles } from "../../hooks/useVehicles";

const Navbar = ({ user, onLogout, onVehicleSelect }) => {
    const { vehicles, isLoading: isLoadingVehicles, error: vehiclesError } = useVehicles();
    const [open, setOpen] = useState(false);
    const [isAuthTransitioning, setIsAuthTransitioning] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const currentPath = window.location.pathname;
    const currentHash = window.location.hash;
    
    // Состояния для поиска
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    // Эффект "живого поиска"
    const searchResults = useMemo(() => {
        if (!searchQuery.trim()) {
            return [];
        }

        return vehicles.filter((car) => {
            const fullName = `${car.brand} ${car.model}`.toLowerCase();
            return fullName.includes(searchQuery.toLowerCase());
        });
    }, [searchQuery, vehicles]);

    // Обработчик клика по результату поиска
    const handleResultClick = (car) => {
        console.log("Переходим к машине:", car.brand, car.model);
        setSearchQuery("");
        setSearchOpen(false);
        onVehicleSelect?.(car);
    };

    // Вспомогательная функция для цвета статуса
    const getStatusColor = (status) => {
        if (!status) return 'text-gray-400';
        const s = status.toString().toLowerCase();
        if (s.includes('available')) return 'text-green-500';
        if (s.includes('charging')) return 'text-yellow-500';
        if (s.includes('in_use')) return 'text-blue-500';
        if (s.includes('reserved')) return 'text-purple-500';
        return 'text-gray-400';
    };

    const openAuthPage = (event) => {
        if (event) {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
                return;
            }

            event.preventDefault();
        }

        if (isAuthTransitioning) {
            return;
        }

        setIsAuthTransitioning(true);
        setOpen(false);
        setSearchOpen(false);

        window.setTimeout(() => {
            window.location.href = "/auth";
        }, 520);
    };

    const isMenuItemActive = (item) => {
        if (item.link === "/#fleet") {
            return currentPath === "/" && (!currentHash || currentHash === "#fleet");
        }

        return item.link === currentPath;
    };

    return (
        <>
            <style>{`
                @keyframes authPageOverlayIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                @keyframes authPageLogoIn {
                    from {
                        opacity: 0;
                        transform: translateY(18px) scale(0.96);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }

                @keyframes authPageLine {
                    from { transform: translateX(-100%); }
                    to { transform: translateX(100%); }
                }

            `}</style>

            <nav className="border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-40">
                <div className="container flex items-center justify-between py-4 md:py-8">
                    
                    {/* ===== ЛОГОТИП ===== */}
                    {/* Анимация: при наведении машинка "едет" вправо */}
                    <div className="group flex cursor-pointer items-center gap-2">
                        <FaCar className="text-2xl text-gray-800 transition-all duration-300 group-hover:translate-x-1 group-hover:text-red-500 md:text-3xl" />
                        <div>
                            <p className="text-xl font-extrabold uppercase leading-none tracking-wide sm:text-2xl md:text-3xl">
                                Electro<span className="text-secondary transition-colors duration-300 group-hover:text-red-500">Street</span>
                            </p>
                            <p className="mt-1 text-[11px] font-semibold text-gray-400 md:text-xs">
                                Baku &middot; Electric Fleet
                            </p>
                        </div>
                    </div>

                    {/* ===== ГЛАВНОЕ МЕНЮ ===== */}
                    <div className="hidden md:block">
                        <ul className="flex items-center gap-4 text-gray-700 lg:gap-6">
                            {NavbarMenu.map((item) => {
                                const isActive = isMenuItemActive(item);

                                return (
                                    <li key={item.id}>
                                        {/* Анимация: Выезжающая красная линия снизу */}
                                        <a 
                                            href={item.link} 
                                            className={`group relative inline-block px-3 py-1 font-bold transition-colors duration-300 hover:text-red-500 ${isActive ? "text-red-500" : "text-gray-700"}`}
                                            aria-current={isActive ? "page" : undefined}
                                        >
                                            {item.title}
                                            <span className={`absolute bottom-0 left-0 h-[2px] bg-red-500 transition-all duration-300 ease-in-out ${isActive ? "w-full" : "w-0 group-hover:w-full"}`}></span>
                                        </a>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>

                    {/* ===== ИКОНКИ И КНОПКИ ===== */}
                    <div className="flex items-center gap-3 md:gap-4">
                        
                        {/* --- ПОИСК --- */}
                        <div className="relative flex flex-col items-end">
                            <form 
                                onSubmit={(e) => e.preventDefault()} 
                                className={`hidden items-center overflow-hidden rounded-full transition-all duration-300 sm:flex ${
                                    searchOpen ? 'w-64 bg-gray-100 px-2 shadow-inner' : 'w-10 bg-transparent'
                                }`}
                            >
                                <button 
                                    type="button"
                                    onClick={() => {
                                        setSearchOpen(!searchOpen);
                                        if (searchOpen) setSearchQuery(""); 
                                    }}
                                    className="p-2 text-2xl text-gray-800 transition-all duration-300 hover:scale-110 hover:text-red-500 active:scale-95"
                                >
                                    <CiSearch />
                                </button>
                                <input 
                                    type="text"
                                    placeholder="Найти EV (напр. Tesla)..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className={`bg-transparent text-sm outline-none transition-all duration-300 ${
                                        searchOpen ? 'w-full opacity-100' : 'w-0 opacity-0'
                                    }`}
                                />
                            </form>

                            {/* Dropdown с результатами поиска */}
                            {searchOpen && searchQuery && (
                                <div className="absolute right-0 top-full z-50 mt-2 max-h-80 w-72 overflow-y-auto rounded-xl border border-gray-100 bg-white p-2 shadow-2xl transition-all animate-in fade-in slide-in-from-top-2">
                                    {searchResults.length > 0 ? (
                                        searchResults.map((car) => (
                                            <div 
                                                key={car.id}
                                                onClick={() => handleResultClick(car)}
                                                className="group cursor-pointer rounded-lg border-b border-gray-50 p-3 transition-all duration-200 last:border-0 hover:bg-red-50"
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <p className="text-sm font-bold text-gray-800 transition-colors group-hover:text-red-500">
                                                            {car.brand} {car.model}
                                                        </p>
                                                        <p className="text-xs text-gray-400">{car.plateNumber}</p>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        {car.batteryPercent > 20 ? (
                                                            <FaBatteryFull className="text-green-500" />
                                                        ) : (
                                                            <FaBatteryQuarter className="text-red-500 animate-pulse" />
                                                        )}
                                                        <span className={`text-xs font-bold ${car.batteryPercent > 20 ? 'text-green-600' : 'text-red-600'}`}>
                                                            {car.batteryPercent}%
                                                        </span>
                                                    </div>
                                                </div>
                                                
                                                <div className="mt-2 flex items-center justify-between">
                                                    <div className="flex items-center gap-1 text-[11px] text-gray-500">
                                                        <MdLocationOn className="text-gray-400 transition-colors group-hover:text-red-400" />
                                                        <span className="truncate max-w-[120px]">{car.location?.label || "Baku"}</span>
                                                    </div>
                                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${getStatusColor(car.status)}`}>
                                                        {car.status}
                                                    </span>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="p-4 text-center text-sm text-gray-400">
                                            Машины не найдены
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* --- ИНДИКАТОР ОНЛАЙН --- */}
                        <div className="hidden items-center gap-2 md:flex">
                            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
                            <span className="text-sm font-bold text-gray-500">
                                {isLoadingVehicles ? "Loading EVs" : vehiclesError ? "Fleet offline" : `${vehicles.length} EVs online`}
                            </span>
                        </div>

                        {/* --- КНОПКА LOGIN --- */}
                        {/* Анимация: поднятие, красная тень, эффект нажатия */}
                        {user ? (
                            <div className="relative hidden items-center gap-3 md:flex">
                                <span className="rounded-full border border-gray-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-wide text-gray-800 shadow-sm">
                                    {(user.balance || 0).toFixed(2)} AZN
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setProfileOpen((visible) => !visible)}
                                    className="flex items-center gap-2 rounded-full border border-gray-200 bg-white py-1.5 pl-2 pr-4 shadow-sm transition hover:-translate-y-0.5 hover:border-red-200 hover:shadow-lg"
                                >
                                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-sm font-black text-white">
                                        {user.avatarInitial || user.name?.charAt(0) || "F"}
                                    </span>
                                    <span className="text-sm font-black text-gray-800">
                                        Hi, {user.name || "Farhad"}!
                                    </span>
                                </button>

                                {profileOpen && (
                                    <div className="absolute right-0 top-full z-50 mt-3 w-56 overflow-hidden rounded-xl border border-gray-100 bg-white p-2 shadow-2xl shadow-gray-900/10">
                                        <a
                                            href="/dashboard"
                                            className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-bold text-gray-700 transition hover:bg-red-50 hover:text-red-600"
                                        >
                                            <FiUser /> Profile
                                        </a>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setProfileOpen(false);
                                                window.location.href = "/dashboard?tab=payments";
                                            }}
                                            className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-bold text-gray-700 transition hover:bg-red-50 hover:text-red-600"
                                        >
                                            <FiCreditCard /> Payment methods
                                        </button>
                                        <button
                                            type="button"
                                            onClick={onLogout}
                                            className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-bold text-gray-700 transition hover:bg-red-50 hover:text-red-600"
                                        >
                                            <FiLogOut /> Sign out
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <a
                                href="/auth"
                                onClick={openAuthPage}
                                className="group hidden items-center gap-2 rounded-md bg-red-500 px-6 py-2 font-bold text-white transition-all duration-300 hover:-translate-y-1 hover:bg-red-600 hover:shadow-lg hover:shadow-red-500/40 active:translate-y-0 active:scale-95 md:flex"
                            >
                                <FiUser className="transition-transform duration-300 group-hover:scale-110" />
                                <span>Login</span>
                            </a>
                        )}
                    </div>

                    {/* ===== МОБИЛЬНОЕ МЕНЮ (ГАМБУРГЕР) ===== */}
                    <div 
                        className="cursor-pointer transition-transform duration-300 hover:scale-110 active:scale-90 md:hidden" 
                        onClick={() => setOpen(!open)}
                    >
                        <MdMenu className="text-4xl text-gray-800 transition-colors duration-300 hover:text-red-500" />
                    </div>
                </div>
            </nav>

            {/* Mobile Sidebar section */}
            <ResponsiveMenu
                open={open}
                menuItems={NavbarMenu}
                user={user}
                onLoginClick={() => openAuthPage()}
                onLogout={onLogout}
            />

            {isAuthTransitioning && (
                <div
                    className="fixed inset-0 z-[999] flex items-center justify-center overflow-hidden bg-white/95 backdrop-blur-md"
                    style={{ animation: "authPageOverlayIn 420ms ease forwards" }}
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-white via-red-50 to-zinc-100" />
                    <div
                        className="relative flex w-64 flex-col items-center rounded-2xl border border-red-100 bg-white px-8 py-7 shadow-2xl shadow-red-950/10"
                        style={{ animation: "authPageLogoIn 520ms cubic-bezier(0.22, 1, 0.36, 1) forwards" }}
                    >
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-500 text-white shadow-lg shadow-red-500/25">
                            <FaCar className="text-2xl" />
                        </div>
                        <p className="text-lg font-black uppercase leading-none tracking-wide text-zinc-900">
                            Electro<span className="text-red-500">Street</span>
                        </p>
                        <div className="mt-5 h-1 w-full overflow-hidden rounded-full bg-zinc-100">
                            <span
                                className="block h-full w-1/2 rounded-full bg-red-500"
                                style={{ animation: "authPageLine 700ms ease-in-out infinite" }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default Navbar;
