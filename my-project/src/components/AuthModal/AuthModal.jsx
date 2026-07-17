import { useState } from "react";
import { FaGithub, FaGoogle } from "react-icons/fa";
import {
  FiCheck,
  FiEye,
  FiEyeOff,
  FiLock,
  FiMail,
  FiPhone,
  FiSend,
  FiUser,
} from "react-icons/fi";
import { authApi } from "../../api/authApi";

const AuthModal = ({ isOpen = true, onClose, onAuthSuccess, reservationNotice }) => {
  const [isRegister, setIsRegister] = useState(() => {
    return new URLSearchParams(window.location.search).get("mode") === "register";
  });
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [firstName, setFirstName] = useState("Farhad");
  const [lastName, setLastName] = useState("Aliyev");
  const [phone, setPhone] = useState("+994501234567");
  const [password, setPassword] = useState("Password123!");
  const [confirmPassword, setConfirmPassword] = useState("Password123!");
  const [licenseNumber, setLicenseNumber] = useState("AZE1234567");
  const [age, setAge] = useState("25");
  const [email, setEmail] = useState("farhad@electrostreet.az");
  const [verificationLink, setVerificationLink] = useState("");
  const [verificationNotice, setVerificationNotice] = useState("");
  const [authError, setAuthError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) {
    return null;
  }

  const goHome = () => {
    if (onClose) {
      onClose();
      return;
    }

    window.location.href = "/";
  };

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    setAuthError("");
    setVerificationNotice("");
    if (isRegister && password !== confirmPassword) {
      setAuthError("Passwords do not match.");
      return;
    }
    const parsedAge = Number(age);
    if (isRegister && (!Number.isInteger(parsedAge) || parsedAge < 18 || parsedAge > 65)) {
      setAuthError("Age must be between 18 and 65.");
      return;
    }
    setIsSubmitting(true);
    try {
      if (isRegister) {
        const registration = await authApi.register({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          age: parsedAge,
          password,
          driverLicenseNumber: licenseNumber.replace(/[^a-zA-Z0-9]/g, ""),
        });
        if (registration?.emailVerificationUrl) {
          setVerificationLink("");
          setVerificationNotice(
            registration.emailSent
              ? "We sent a verification email. Open the link in your inbox to activate booking and payments."
              : registration.emailDeliveryError || "We could not send the verification email right now. Please try again later."
          );
          return;
        }
        setVerificationNotice("We sent a verification email. Please confirm it before signing in.");
        return;
      }
      const user = await authApi.login(email, password);
      if (onAuthSuccess) onAuthSuccess(user);
      else window.location.href = "/";
    } catch (error) {
      setAuthError(error.message || "Authentication failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-900 outline-none transition focus:border-red-500 focus:bg-white focus:shadow-sm";

  const iconInputClass =
    "w-full rounded-lg border border-zinc-200 bg-zinc-50 py-3 pl-11 pr-4 text-sm font-semibold text-zinc-900 outline-none transition focus:border-red-500 focus:bg-white focus:shadow-sm";

  const passwordInputClass =
    "w-full rounded-lg border border-zinc-200 bg-zinc-50 py-3 pl-11 pr-11 text-sm font-semibold text-zinc-900 outline-none transition focus:border-red-500 focus:bg-white focus:shadow-sm";

  const socialButtonClass =
    "flex h-11 w-11 items-center justify-center rounded-lg border border-zinc-200 bg-white text-lg shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg";

  const primaryButtonClass =
    "auth-primary-button relative overflow-hidden rounded-lg bg-red-500 px-11 py-3 text-xs font-black uppercase tracking-wide text-white shadow-md shadow-red-500/20 transition duration-300 hover:-translate-y-1 hover:bg-red-600 hover:shadow-xl hover:shadow-red-500/35 active:translate-y-0";

  const outlineButtonClass =
    "auth-outline-button relative mt-7 overflow-hidden rounded-lg border border-white/80 px-11 py-3 text-xs font-black uppercase tracking-wide text-white transition duration-300 hover:-translate-y-1 hover:bg-white hover:text-red-700";

  if (verificationNotice) {
    return (
      <main className="auth-page min-h-screen bg-gradient-to-br from-white via-zinc-50 to-red-50 px-4 py-6 text-zinc-900">
        <div className="mx-auto flex min-h-[calc(100vh-48px)] w-full max-w-3xl items-center justify-center">
          <div className="w-full rounded-[28px] border border-red-100 bg-white p-8 text-center shadow-2xl shadow-red-950/10">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-500">
              <FiSend className="text-3xl" />
            </div>
            <p className="mt-6 text-xs font-black uppercase tracking-[0.22em] text-red-500">
              Email verification
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-zinc-950">
              Confirm your email
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm font-semibold leading-6 text-zinc-500">
              {verificationNotice || `We sent a verification email to ${email}. Booking and payments stay locked until email is confirmed.`}
            </p>
            <h1 className="hidden">
              Проверьте почту
            </h1>
            <p className="hidden">
              Мы отправили письмо на {email}. До подтверждения email бронирование и платежные функции будут ограничены.
            </p>
            <div className="hidden">
              <p className="text-xs font-black uppercase tracking-wide text-red-500">
                Demo email link
              </p>
              <a
                href={verificationLink}
                className="mt-2 block break-all text-sm font-bold text-zinc-900 underline decoration-red-300 underline-offset-4"
              >
                {verificationLink}
              </a>
            </div>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <a
                href={verificationLink}
                className="hidden"
              >
                <span className="text-white">Confirm email</span>
                Подтвердить email
              </a>
              <button
                type="button"
                onClick={goHome}
                className="rounded-lg border border-zinc-200 px-6 py-3 text-sm font-black text-zinc-700 transition hover:border-red-200 hover:text-red-600"
              >
                Вернуться на сайт
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-page min-h-screen bg-gradient-to-br from-white via-zinc-50 to-red-50 px-4 py-6 text-zinc-900">
      <style>{`
        @keyframes authPageIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes authHeaderIn {
          from {
            opacity: 0;
            transform: translateY(-12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes authCardIn {
          from {
            opacity: 0;
            transform: translateY(22px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes authButtonShine {
          from { transform: translateX(-130%) skewX(-18deg); }
          to { transform: translateX(230%) skewX(-18deg); }
        }

        @keyframes authPanelGlow {
          0%, 100% { opacity: 0.55; transform: translateY(0) scale(1); }
          50% { opacity: 0.75; transform: translateY(-10px) scale(1.05); }
        }

        .auth-page {
          animation: authPageIn 420ms ease both;
        }

        .auth-page-header {
          animation: authHeaderIn 520ms ease both;
        }

        .auth-card {
          animation: authCardIn 680ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .auth-primary-button::before,
        .auth-outline-button::before {
          content: "";
          position: absolute;
          inset: 0;
          width: 42%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent);
          transform: translateX(-130%) skewX(-18deg);
        }

        .auth-primary-button:hover::before,
        .auth-outline-button:hover::before {
          animation: authButtonShine 850ms ease;
        }

        .auth-panel-glow {
          animation: authPanelGlow 6s ease-in-out infinite;
        }

        .auth-back-button {
          display: block;
          position: relative;
          width: 56px;
          height: 56px;
          margin: 0;
          overflow: hidden;
          outline: none;
          background-color: transparent;
          cursor: pointer;
          border: 0;
        }

        .auth-back-button::before,
        .auth-back-button::after {
          content: "";
          position: absolute;
          border-radius: 50%;
          inset: 7px;
        }

        .auth-back-button::before {
          border: 4px solid #f0eeef;
          transition:
            opacity 0.4s cubic-bezier(0.77, 0, 0.175, 1) 80ms,
            transform 0.5s cubic-bezier(0.455, 0.03, 0.515, 0.955) 80ms;
        }

        .auth-back-button::after {
          border: 4px solid #ef4444;
          transform: scale(1.3);
          opacity: 0;
          transition:
            opacity 0.4s cubic-bezier(0.165, 0.84, 0.44, 1),
            transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }

        .auth-back-button:hover::before,
        .auth-back-button:focus-visible::before {
          opacity: 0;
          transform: scale(0.7);
          transition:
            opacity 0.4s cubic-bezier(0.165, 0.84, 0.44, 1),
            transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }

        .auth-back-button:hover::after,
        .auth-back-button:focus-visible::after {
          opacity: 1;
          transform: scale(1);
          transition:
            opacity 0.4s cubic-bezier(0.77, 0, 0.175, 1) 80ms,
            transform 0.5s cubic-bezier(0.455, 0.03, 0.515, 0.955) 80ms;
        }

        .auth-back-button-box {
          display: flex;
          position: absolute;
          top: 0;
          left: 0;
        }

        .auth-back-button-elem {
          display: block;
          width: 20px;
          height: 20px;
          margin: 18px 18px 0 18px;
          transform: rotate(180deg);
          fill: #52525b;
          transition: fill 0.3s ease;
        }

        .auth-back-button:hover .auth-back-button-elem,
        .auth-back-button:focus-visible .auth-back-button-elem {
          fill: #ef4444;
        }

        .auth-back-button:hover .auth-back-button-box,
        .auth-back-button:focus-visible .auth-back-button-box {
          transition: 0.4s;
          transform: translateX(-56px);
        }

        .auth-map-layer {
          position: absolute;
          inset: 0;
          opacity: 0.62;
          pointer-events: none;
        }

        .auth-map-road {
          fill: none;
          stroke: rgba(255, 255, 255, 0.2);
          stroke-width: 2;
          stroke-linecap: round;
        }

        .auth-map-road-thin {
          fill: none;
          stroke: rgba(255, 255, 255, 0.14);
          stroke-width: 1.2;
          stroke-linecap: round;
        }

        .auth-map-route {
          fill: none;
          stroke: rgba(255, 255, 255, 0.5);
          stroke-width: 3.5;
          stroke-linecap: round;
          stroke-dasharray: 10 12;
          animation: authRouteMove 5.5s linear infinite;
        }

        .auth-map-pin {
          fill: rgba(255, 255, 255, 0.86);
          filter: drop-shadow(0 8px 18px rgba(127, 29, 29, 0.25));
        }

        @keyframes authRouteMove {
          from { stroke-dashoffset: 0; }
          to { stroke-dashoffset: -88; }
        }

        .auth-card .auth-form-panel {
          position: absolute;
          top: 0;
          height: 100%;
          width: 50%;
          background: #fff;
          transition: all 0.6s ease-in-out;
        }

        .auth-card .auth-sign-in {
          left: 0;
          z-index: 2;
          opacity: 1;
          pointer-events: auto;
        }

        .auth-card.auth-register-active .auth-sign-in {
          transform: translateX(100%);
          opacity: 0;
          pointer-events: none;
        }

        .auth-card .auth-sign-up {
          left: 0;
          z-index: 1;
          opacity: 0;
          pointer-events: none;
        }

        .auth-card.auth-register-active .auth-sign-up {
          transform: translateX(100%);
          z-index: 5;
          opacity: 1;
          pointer-events: auto;
        }

        .auth-card .auth-toggle-container {
          position: absolute;
          top: 0;
          left: 50%;
          z-index: 10;
          height: 100%;
          width: 50%;
          overflow: hidden;
          border-radius: 80px 0 0 64px;
          transition: all 0.6s ease-in-out;
        }

        .auth-card.auth-register-active .auth-toggle-container {
          transform: translateX(-100%);
          border-radius: 0 80px 64px 0;
        }

        .auth-card .auth-toggle {
          position: relative;
          left: -100%;
          height: 100%;
          width: 200%;
          transform: translateX(0);
          transition: all 0.6s ease-in-out;
        }

        .auth-card.auth-register-active .auth-toggle {
          transform: translateX(50%);
        }

        .auth-card .auth-toggle-panel {
          position: absolute;
          top: 0;
          display: flex;
          height: 100%;
          width: 50%;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 0 42px;
          text-align: center;
          transition: all 0.6s ease-in-out;
        }

        .auth-card .auth-toggle-left {
          transform: translateX(-200%);
        }

        .auth-card.auth-register-active .auth-toggle-left {
          transform: translateX(0);
        }

        .auth-card .auth-toggle-right {
          right: 0;
          transform: translateX(0);
        }

        .auth-card.auth-register-active .auth-toggle-right {
          transform: translateX(200%);
        }

        @media (max-width: 767px) {
          .auth-card {
            min-height: auto;
          }

          .auth-card .auth-form-panel {
            position: relative;
            width: 100%;
            min-height: 660px;
            transform: none;
          }

          .auth-card .auth-sign-in,
          .auth-card.auth-register-active .auth-sign-in {
            display: flex;
            transform: none;
            opacity: 1;
            pointer-events: auto;
          }

          .auth-card .auth-sign-up,
          .auth-card.auth-register-active .auth-sign-up {
            display: none;
            transform: none;
            opacity: 1;
            pointer-events: auto;
          }

          .auth-card.auth-register-active .auth-sign-in {
            display: none;
          }

          .auth-card.auth-register-active .auth-sign-up {
            display: flex;
          }
        }
      `}</style>

      <div className="mx-auto flex min-h-[calc(100vh-48px)] w-full max-w-6xl flex-col">
        <header className="auth-page-header flex items-center justify-between py-3">
          <button
            type="button"
            onClick={goHome}
            className="auth-back-button"
            aria-label="Back to site"
          >
            <span className="auth-back-button-box">
              <span className="auth-back-button-elem">
                <svg viewBox="0 0 46 40" xmlns="http://www.w3.org/2000/svg">
                  <path d="M46 20.038c0-.7-.3-1.5-.8-2.1l-16-17c-1.1-1-3.2-1.4-4.4-.3-1.2 1.1-1.2 3.3 0 4.4l11.3 11.9H3c-1.7 0-3 1.3-3 3s1.3 3 3 3h33.1l-11.3 11.9c-1 1-1.2 3.3 0 4.4 1.2 1.1 3.3.8 4.4-.3l16-17c.5-.5.8-1.1.8-1.9z" />
                </svg>
              </span>
              <span className="auth-back-button-elem">
                <svg viewBox="0 0 46 40" xmlns="http://www.w3.org/2000/svg">
                  <path d="M46 20.038c0-.7-.3-1.5-.8-2.1l-16-17c-1.1-1-3.2-1.4-4.4-.3-1.2 1.1-1.2 3.3 0 4.4l11.3 11.9H3c-1.7 0-3 1.3-3 3s1.3 3 3 3h33.1l-11.3 11.9c-1 1-1.2 3.3 0 4.4 1.2 1.1 3.3.8 4.4-.3l16-17c.5-.5.8-1.1.8-1.9z" />
                </svg>
              </span>
            </span>
          </button>

          <div className="hidden items-center gap-2 sm:flex">
            <span className="h-2.5 w-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.55)]" />
            <span className="text-xs font-black uppercase tracking-wide text-zinc-500">
              ElectroStreet
            </span>
          </div>
        </header>

        <section className="flex flex-1 items-center justify-center py-8">
          <div
            className={`auth-card relative min-h-[620px] w-full max-w-[940px] overflow-hidden rounded-[28px] bg-white shadow-2xl shadow-red-950/10 ring-1 ring-zinc-200/70 ${
              isRegister ? "auth-register-active" : ""
            }`}
          >
            {reservationNotice && (
              <div className="absolute left-1/2 top-4 z-20 w-[calc(100%-2rem)] max-w-[560px] -translate-x-1/2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-center text-xs font-black uppercase tracking-wide text-red-700 shadow-sm">
                {reservationNotice}
              </div>
            )}
            <div className="auth-form-panel auth-sign-up flex items-center justify-center px-7 py-10 sm:px-10">
              <form
                onSubmit={handleAuthSubmit}
                className="flex w-full max-w-[340px] flex-col items-center"
              >
                <h1 className="text-center text-3xl font-black leading-tight">
                  Create Account
                </h1>

                <div className="mt-5 flex gap-3">
                  <button
                    type="button"
                    className={`${socialButtonClass} text-[#4285F4] hover:border-[#4285F4]/25 hover:bg-[#4285F4]/5`}
                    aria-label="Sign up with Google"
                  >
                    <FaGoogle />
                  </button>
                  <button
                    type="button"
                    className={`${socialButtonClass} text-zinc-950 hover:border-zinc-900/20 hover:bg-zinc-100`}
                    aria-label="Sign up with GitHub"
                  >
                    <FaGithub />
                  </button>
                </div>

                <p className="mb-4 mt-4 text-center text-xs font-bold text-zinc-400">
                  or use your email for registration
                </p>

                <div className="mb-3 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="relative">
                    <FiUser className="absolute left-4 top-3.5 text-zinc-400" />
                    <input
                      className={iconInputClass}
                      type="text"
                      placeholder="First name"
                      value={firstName}
                      onChange={(event) => setFirstName(event.target.value)}
                    />
                  </div>
                  <input className={inputClass} type="text" placeholder="Last name" value={lastName} onChange={(event) => setLastName(event.target.value)} />
                </div>

                <div className="relative mb-3 w-full">
                  <FiPhone className="absolute left-4 top-3.5 text-zinc-400" />
                  <input className={iconInputClass} type="tel" placeholder="+994 (50) 000-00-00" value={phone} onChange={(event) => setPhone(event.target.value)} />
                </div>

                <div className="relative mb-3 w-full">
                  <FiMail className="absolute left-4 top-3.5 text-zinc-400" />
                  <input
                    className={iconInputClass}
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>

                <div className="relative mb-5 w-full">
                  <FiLock className="absolute left-4 top-3.5 text-zinc-400" />
                  <input
                    className={passwordInputClass}
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-3.5 text-zinc-400 transition hover:text-red-500"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <FiEyeOff /> : <FiEye />}
                  </button>
                </div>

                <div className="relative mb-3 w-full">
                  <FiLock className="absolute left-4 top-3.5 text-zinc-400" />
                  <input
                    className={passwordInputClass}
                    type={showPassword ? "text" : "password"}
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                  />
                </div>

                <div className="mb-5 grid w-full grid-cols-2 gap-3">
                  <input
                    className={inputClass}
                    type="number"
                    min="18"
                    max="65"
                    placeholder="Age"
                    value={age}
                    onChange={(event) => setAge(event.target.value)}
                  />
                  <input className={inputClass} type="text" placeholder="License ID" value={licenseNumber} onChange={(event) => setLicenseNumber(event.target.value)} />
                </div>

                <button
                  type="submit"
                  className={primaryButtonClass}
                >
                  {isSubmitting ? "Creating account..." : "Sign Up"}
                </button>
                {authError && <p className="mt-4 text-center text-sm font-bold text-red-600">{authError}</p>}

                <button
                  type="button"
                  onClick={() => setIsRegister(false)}
                  className="mt-5 text-sm font-bold text-zinc-500 transition hover:text-red-500 md:hidden"
                >
                  Already have an account?
                </button>
              </form>
            </div>

            <div className="auth-form-panel auth-sign-in flex items-center justify-center px-7 py-10 sm:px-10">
              <form
                onSubmit={handleAuthSubmit}
                className="flex w-full max-w-[340px] flex-col items-center"
              >
                <h1 className="text-center text-3xl font-black leading-tight">
                  Sign In
                </h1>

                <div className="mt-5 flex gap-3">
                  <button
                    type="button"
                    className={`${socialButtonClass} text-[#4285F4] hover:border-[#4285F4]/25 hover:bg-[#4285F4]/5`}
                    aria-label="Sign in with Google"
                  >
                    <FaGoogle />
                  </button>
                  <button
                    type="button"
                    className={`${socialButtonClass} text-zinc-950 hover:border-zinc-900/20 hover:bg-zinc-100`}
                    aria-label="Sign in with GitHub"
                  >
                    <FaGithub />
                  </button>
                </div>

                <p className="mb-4 mt-4 text-center text-xs font-bold text-zinc-400">
                  or use your email password
                </p>

                <div className="relative mb-3 w-full">
                  <FiMail className="absolute left-4 top-3.5 text-zinc-400" />
                  <input
                    className={iconInputClass}
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>

                <div className="relative mb-2 w-full">
                  <FiLock className="absolute left-4 top-3.5 text-zinc-400" />
                  <input
                    className={passwordInputClass}
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-3.5 text-zinc-400 transition hover:text-red-500"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <FiEyeOff /> : <FiEye />}
                  </button>
                </div>

                <div className="mb-4 mt-2 flex w-full items-center justify-between gap-3">
                  <label className="flex cursor-pointer select-none items-center gap-2 text-xs font-bold text-zinc-500 transition hover:text-zinc-800">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={() => setRememberMe(!rememberMe)}
                      className="hidden"
                    />
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded border transition ${
                        rememberMe
                          ? "border-red-500 bg-red-500 text-white"
                          : "border-zinc-300 bg-white"
                      }`}
                    >
                      {rememberMe && <FiCheck className="text-[10px] stroke-[4]" />}
                    </span>
                    Remember me
                  </label>

                  <a
                    href="#forgot-password"
                    className="text-xs font-bold text-zinc-500 transition hover:text-red-500"
                  >
                    Forgot password?
                  </a>
                </div>

                <button
                  type="submit"
                  className={primaryButtonClass}
                >
                  {isSubmitting ? "Signing in..." : "Sign In"}
                </button>
                {authError && <p className="mt-4 text-center text-sm font-bold text-red-600">{authError}</p>}

                <button
                  type="button"
                  onClick={() => setIsRegister(true)}
                  className="mt-5 text-sm font-bold text-zinc-500 transition hover:text-red-500 md:hidden"
                >
                  Create new account
                </button>
              </form>
            </div>

            <div className="auth-toggle-container hidden md:block">
              <div className="auth-toggle bg-gradient-to-br from-red-400 via-red-500 to-red-500 text-white">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.16)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.16)_1px,transparent_1px)] bg-[size:42px_42px] opacity-20" />
                <svg
                  className="auth-map-layer"
                  viewBox="0 0 920 620"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path className="auth-map-road" d="M-40 130 C 120 95, 185 210, 315 178 S 530 70, 715 125 S 895 275, 980 210" />
                  <path className="auth-map-road" d="M-30 410 C 115 365, 230 455, 360 405 S 550 270, 740 330 S 870 465, 970 420" />
                  <path className="auth-map-road" d="M115 -40 C 155 95, 120 205, 185 315 S 275 485, 235 670" />
                  <path className="auth-map-road" d="M610 -35 C 560 110, 635 210, 590 340 S 475 500, 525 660" />
                  <path className="auth-map-road-thin" d="M20 255 C 190 245, 265 315, 420 285 S 680 210, 900 250" />
                  <path className="auth-map-road-thin" d="M80 545 C 210 500, 340 535, 470 485 S 640 390, 850 505" />
                  <path className="auth-map-road-thin" d="M365 -20 C 350 120, 410 215, 385 355 S 335 505, 380 640" />
                  <path className="auth-map-route" d="M95 460 C 220 360, 300 390, 405 305 S 565 150, 750 185" />
                  <circle className="auth-map-pin" cx="95" cy="460" r="7" />
                  <circle className="auth-map-pin" cx="405" cy="305" r="6" />
                  <circle className="auth-map-pin" cx="750" cy="185" r="8" />
                  <circle className="auth-map-pin" cx="615" cy="405" r="5" />
                </svg>
                <div className="auth-panel-glow absolute -bottom-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-white/18 blur-3xl" />

                <div className="auth-toggle-panel auth-toggle-left">
                  <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-white/70">
                    ElectroStreet
                  </p>
                  <h2 className="text-3xl font-black leading-tight">
                    Welcome Back!
                  </h2>
                  <p className="mt-4 max-w-xs text-sm font-semibold leading-6 text-white/80">
                    Sign in and continue booking electric cars across Baku.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsRegister(false)}
                    className={outlineButtonClass}
                  >
                    Sign In
                  </button>
                </div>

                <div className="auth-toggle-panel auth-toggle-right">
                  <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-white/70">
                    ElectroStreet
                  </p>
                  <h2 className="text-3xl font-black leading-tight">
                    Hello, Friend!
                  </h2>
                  <p className="mt-4 max-w-xs text-sm font-semibold leading-6 text-white/80">
                    Create your profile to unlock quick EV reservations and ride history.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsRegister(true)}
                    className={outlineButtonClass}
                  >
                    Sign Up
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

export default AuthModal;
