import { useEffect, useState } from "react";
import Navbar from "./components/Navbar/Navbar";
import Hero from "./components/Hero/Hero";
import BrandsBanner from "./components/BrandsBanner/BrandsBanner";
import Location from "./components/Location/Location";
import Footer from "./components/Footer/Footer";
import FleetSection from "./components/FleetSection/FleetSection";
import WhyElectroStreet from "./components/WhyElectroStreet/WhyElectroStreet";
import UserComments from "./components/UserComments/UserComments";
import AuthModal from "./components/AuthModal/AuthModal";
import Dashboard from "./components/Dashboard/Dashboard";
import PricingPage from "./components/Pricing/PricingPage";
import ChargingPage from "./components/Charging/ChargingPage";
import AboutPage from "./components/About/AboutPage";
import AdminControlRoom from "./components/Admin/AdminControlRoom";
import StaffLogin from "./components/Staff/StaffLogin";
import StaffDashboard from "./components/Staff/StaffDashboard";
import AdvancedReservationStage from "./components/AdvancedReservationStage/AdvancedReservationStage";
import { authApi } from "./api/authApi";
import { userApi } from "./api/userApi";
import { FiArrowUp } from "react-icons/fi";
import { AnimatePresence, motion } from "framer-motion";
import AOS from "aos";
import "aos/dist/aos.css";

const App = () => {
  const isAuthPage = window.location.pathname === "/auth";
  const isDashboardPage = window.location.pathname === "/dashboard";
  const isPricingPage = window.location.pathname === "/pricing";
  const isChargingPage = window.location.pathname === "/charging";
  const isAboutPage = window.location.pathname === "/about";
  const isAdminPage = window.location.pathname === "/admin";
  const isStaffLoginPage = window.location.pathname === "/staff-login";
  const isStaffPage = window.location.pathname === "/staff";
  const hasStaffWorkspaceSession = () => {
    try {
      const session = JSON.parse(localStorage.getItem("electroStreetStaffSession") || "null");
      return Boolean(localStorage.getItem("electroStreetAccessToken") && session?.id && session?.role === "staff");
    } catch {
      return false;
    }
  };
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [emailGateMessage, setEmailGateMessage] = useState("");
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [blockedNotice, setBlockedNotice] = useState("");
  const [user, setUser] = useState(() => {
    try {
      const storedUser = localStorage.getItem("electroStreetUser");
      return storedUser ? JSON.parse(storedUser) : null;
    } catch {
      return null;
    }
  });
  const userId = user?.id;

  useEffect(() => {
    AOS.init({
      duration: 800,
      once: true,
      offset: 50,
    });
  }, []);

  useEffect(() => {
    if (!userId || !localStorage.getItem("electroStreetAccessToken")) return undefined;

    let cancelled = false;
    const refreshCurrentUser = async () => {
      try {
        const nextUser = await userApi.getMe();
        if (cancelled) return;

        if (nextUser.isActive === false) {
          localStorage.removeItem("electroStreetAccessToken");
          localStorage.removeItem("electroStreetUser");
          setUser(null);
          setBlockedNotice(nextUser.blockReason || "Your account is blocked. Contact support for details.");
          return;
        }

        localStorage.setItem("electroStreetUser", JSON.stringify(nextUser));
        setUser(nextUser);
      } catch (error) {
        if (cancelled) return;
        const isBlocked = error.code === "User.Blocked" || error.errors?.some((item) => item.code === "User.Blocked");
        if (isBlocked || error.status === 403) {
          localStorage.removeItem("electroStreetAccessToken");
          localStorage.removeItem("electroStreetUser");
          setUser(null);
          setBlockedNotice(error.message || "Your account is blocked. Contact support for details.");
        }
      }
    };

    refreshCurrentUser();
    const interval = window.setInterval(refreshCurrentUser, 10000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [userId]);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollToTop(window.scrollY > 500);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (window.location.pathname !== "/" || window.location.hash !== "#fleet") {
      return;
    }

    const scrollTimer = window.setTimeout(() => {
      document.getElementById("fleet")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 120);

    return () => window.clearTimeout(scrollTimer);
  }, []);

  useEffect(() => {
    const handleEmailGate = (event) => {
      setEmailGateMessage(event.detail || "Confirm your email to continue.");
    };

    window.addEventListener("electrostreet:email-gate", handleEmailGate);
    return () => window.removeEventListener("electrostreet:email-gate", handleEmailGate);
  }, []);

  useEffect(() => {
    const handleBlockedSession = (event) => {
      setUser(null);
      setSelectedVehicle(null);
      setBlockedNotice(event.detail || "Your account is blocked. Contact support for details.");
    };

    window.addEventListener("electrostreet:account-blocked", handleBlockedSession);
    return () => window.removeEventListener("electrostreet:account-blocked", handleBlockedSession);
  }, []);

  useEffect(() => {
    const handleSessionRefresh = (event) => {
      if (event.detail) {
        setUser(event.detail);
      }
    };

    window.addEventListener("electrostreet:session-refreshed", handleSessionRefresh);
    return () => window.removeEventListener("electrostreet:session-refreshed", handleSessionRefresh);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verificationUserId = params.get("verifyEmail");

    if (!verificationUserId) {
      return;
    }

    authApi.verifyEmail(verificationUserId)
      .then((verifiedUser) => {
        setUser(verifiedUser);
        setEmailGateMessage("Email confirmed. Booking and balance top-up are now available.");
      })
      .catch((error) => {
        setEmailGateMessage(error.message || "Email confirmation link could not be verified.");
      })
      .finally(() => {
        window.history.replaceState({}, "", window.location.pathname);
      });
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("electroStreetUser");
    localStorage.removeItem("electroStreetAccessToken");
    setBlockedNotice("");
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
    if (blockedNotice || user?.isActive === false) {
      setBlockedNotice(blockedNotice || user?.blockReason || "Your account is blocked. Contact support for details.");
      return;
    }

    if (user && user.emailVerified === false) {
      setEmailGateMessage("Confirm your email to open car booking.");
      return;
    }

    setSelectedVehicle(vehicle);
  };

  const renderBlockedNotice = () => blockedNotice ? (
    <div className="fixed left-1/2 top-24 z-[160] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 rounded-2xl border border-red-200 bg-white px-5 py-4 text-sm font-bold text-zinc-800 shadow-2xl shadow-red-950/10">
      <p className="text-red-600">Account blocked.</p>
      <p className="mt-1 text-zinc-600">{blockedNotice}</p>
    </div>
  ) : null;

  const renderBlockedPage = () => (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-5">
      <section className="w-full max-w-xl rounded-3xl border border-red-200 bg-white p-8 text-center shadow-2xl shadow-red-950/10">
        <p className="text-sm font-black uppercase tracking-[0.24em] text-red-500">Account blocked</p>
        <h1 className="mt-4 text-3xl font-black text-zinc-950">Access is restricted</h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-zinc-600">{blockedNotice}</p>
        <button
          type="button"
          onClick={handleLogout}
          className="mt-6 rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-black text-white transition hover:bg-red-500"
        >
          Back to sign in
        </button>
      </section>
    </main>
  );

  if (blockedNotice && !isAdminPage && !isStaffLoginPage && !isStaffPage) {
    return renderBlockedPage();
  }

  if (isDashboardPage) {
    return <Dashboard onLogout={handleLogout} />;
  }

  if (isPricingPage) {
    return (
      <div className="overflow-x-hidden">
        {renderBlockedNotice()}
        <Navbar user={user} onLogout={handleLogout} onVehicleSelect={handleOpenVehicle} />
        <PricingPage user={user} onVehicleSelect={handleOpenVehicle} />
        <Footer />
        {selectedVehicle && (
          <AdvancedReservationStage
            vehicle={selectedVehicle}
            onClose={() => setSelectedVehicle(null)}
          />
        )}
      </div>
    );
  }

  if (isChargingPage) {
    return (
      <div className="overflow-x-hidden">
        {renderBlockedNotice()}
        <Navbar user={user} onLogout={handleLogout} onVehicleSelect={handleOpenVehicle} />
        <ChargingPage />
        <Footer />
        {selectedVehicle && (
          <AdvancedReservationStage
            vehicle={selectedVehicle}
            onClose={() => setSelectedVehicle(null)}
          />
        )}
      </div>
    );
  }

  if (isAboutPage) {
    return (
      <div className="overflow-x-hidden">
        {renderBlockedNotice()}
        <Navbar user={user} onLogout={handleLogout} onVehicleSelect={handleOpenVehicle} />
        <AboutPage />
        <Footer />
        {selectedVehicle && (
          <AdvancedReservationStage
            vehicle={selectedVehicle}
            onClose={() => setSelectedVehicle(null)}
          />
        )}
      </div>
    );
  }

  if (isAdminPage) {
    return <AdminControlRoom />;
  }

  if (isStaffLoginPage) {
    return <StaffLogin />;
  }

  if (isStaffPage) {
    return hasStaffWorkspaceSession() ? <StaffDashboard /> : <StaffLogin />;
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
      {renderBlockedNotice()}
      <Navbar user={user} onLogout={handleLogout} onVehicleSelect={handleOpenVehicle} />
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
      <Location onVehicleSelect={handleOpenVehicle} />
      <FleetSection onVehicleSelect={handleOpenVehicle} onUserChange={setUser} />
      <WhyElectroStreet />
      <UserComments />
      <Footer />
      <AnimatePresence>
        {showScrollToTop && (
          <motion.button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="fixed bottom-5 right-5 z-[90] flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-red-500 text-2xl text-white shadow-[0_12px_28px_rgba(239,68,68,0.32)] outline-none backdrop-blur-sm focus-visible:ring-4 focus-visible:ring-red-200 sm:bottom-6 sm:right-6"
            initial={{ opacity: 0, y: 20, scale: 0.72, rotate: -8 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, y: 18, scale: 0.78, rotate: 8 }}
            whileHover={{
              y: -4,
              scale: 1.06,
              backgroundColor: "#dc2626",
              boxShadow: "0 18px 34px rgba(239,68,68,0.42)",
            }}
            whileTap={{ scale: 0.9, y: 1 }}
            transition={{
              type: "spring",
              stiffness: 320,
              damping: 24,
              mass: 0.75,
            }}
            aria-label="Scroll to top"
            title="Back to top"
          >
            <motion.span
              className="flex items-center justify-center"
              initial={{ y: 2 }}
              animate={{ y: [2, -2, 2] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            >
              <FiArrowUp strokeWidth={2.8} />
            </motion.span>
          </motion.button>
        )}
      </AnimatePresence>
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
