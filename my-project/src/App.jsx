import { useEffect, useState } from "react";
import Navbar from "./components/Navbar/Navbar";
import Hero from "./components/Hero/Hero";
import BrandsBanner from "./components/BrandsBanner/BrandsBanner"; 
import Location from "./components/Location/Location";
import Footer from "./components/Footer/Footer";
import FleetSection from "./components/FleetSection/FleetSection";
import WhyElectroStreet from "./components/WhyElectroStreet/WhyElectroStreet";
import AuthModal from "./components/AuthModal/AuthModal";
import Dashboard from "./components/Dashboard/Dashboard";
import AdminControlRoom from "./components/Admin/AdminControlRoom";
import AdvancedReservationStage from "./components/AdvancedReservationStage/AdvancedReservationStage";
import AOS from "aos";
import "aos/dist/aos.css";

const App = () => {
  const isAuthPage = window.location.pathname === "/auth";
  const isDashboardPage = window.location.pathname === "/dashboard";
  const isAdminPage = window.location.pathname === "/admin";
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [emailGateMessage, setEmailGateMessage] = useState("");
  const [user, setUser] = useState(() => {
    try {
      const storedUser = localStorage.getItem("electroStreetUser");
      return storedUser ? JSON.parse(storedUser) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    AOS.init({
      duration: 800,
      once: true,
      offset: 50,
    });
  }, []);

  useEffect(() => {
    const handleEmailGate = (event) => {
      setEmailGateMessage(event.detail || "Подтвердите email, чтобы продолжить.");
    };

    window.addEventListener("electrostreet:email-gate", handleEmailGate);
    return () => window.removeEventListener("electrostreet:email-gate", handleEmailGate);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("verifyEmail");

    if (!token) {
      return;
    }

    try {
      const pending = JSON.parse(localStorage.getItem("electroStreetPendingEmailVerification") || "null");
      const storedUser = JSON.parse(localStorage.getItem("electroStreetUser") || "null");

      if (pending?.token === token && storedUser) {
        const verifiedUser = {
          ...storedUser,
          emailVerified: true,
          emailVerifiedAt: new Date().toISOString(),
        };

        localStorage.setItem("electroStreetUser", JSON.stringify(verifiedUser));
        localStorage.removeItem("electroStreetPendingEmailVerification");
        window.setTimeout(() => {
          setUser(verifiedUser);
          setEmailGateMessage("Email подтверждён. Теперь доступны бронирование и платежи.");
        }, 0);
      }
    } catch {
      window.setTimeout(() => {
        setEmailGateMessage("Ссылка подтверждения устарела. Зарегистрируйтесь ещё раз или войдите в аккаунт.");
      }, 0);
    }

    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("electroStreetUser");
    setUser(null);
    window.location.href = "/";
  };

  const handleFleetScroll = () => {
    const fleetSection = document.getElementById("fleet");

    if (fleetSection) {
      fleetSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleOpenVehicle = (vehicle) => {
    if (user && user.emailVerified === false) {
      setEmailGateMessage("Подтвердите email, чтобы открыть бронирование автомобиля.");
      return;
    }

    setSelectedVehicle(vehicle);
  };

  if (isDashboardPage) {
    return <Dashboard onLogout={handleLogout} />;
  }

  if (isAdminPage) {
    return <AdminControlRoom />;
  }

  return isAuthPage ? (
    <AuthModal
      onClose={() => {
        window.location.href = "/";
      }}
      onAuthSuccess={(nextUser) => {
        setUser(nextUser);
        window.location.href = "/";
      }}
    />
  ) : (
    <div className="overflow-x-hidden">
      <Navbar user={user} onLogout={handleLogout} onVehicleSelect={handleOpenVehicle} />
      {user?.emailVerified === false && (
        <div className="fixed left-1/2 top-24 z-[95] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 rounded-2xl border border-amber-200 bg-white px-5 py-4 text-sm font-bold text-zinc-800 shadow-2xl shadow-amber-950/10">
          <span className="text-amber-600">Email не подтверждён.</span>{" "}
          Проверьте письмо и перейдите по ссылке, чтобы разблокировать бронирование и оплату.
        </div>
      )}
      {emailGateMessage && (
        <div className="fixed bottom-6 left-1/2 z-[130] flex w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 items-center justify-between gap-4 rounded-2xl bg-zinc-950 px-5 py-4 text-sm font-bold text-white shadow-2xl">
          <span>{emailGateMessage}</span>
          <button
            type="button"
            onClick={() => setEmailGateMessage("")}
            className="rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-wide transition hover:bg-white/20"
          >
            OK
          </button>
        </div>
      )}
      <Hero onReserveClick={handleFleetScroll} onFeaturedReserve={handleOpenVehicle} />
      <BrandsBanner />
      <Location />
      <FleetSection onVehicleSelect={handleOpenVehicle} onUserChange={setUser} />
      <WhyElectroStreet />
      <Footer />
      {selectedVehicle && (
        <AdvancedReservationStage
          vehicle={selectedVehicle}
          onClose={() => setSelectedVehicle(null)}
        />
      )}
    </div>
  );
};

export default App;
