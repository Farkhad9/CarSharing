import { useCallback, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FiAlertTriangle, FiCheckCircle, FiInfo, FiX } from "react-icons/fi";

const toneStyles = {
  danger: {
    icon: FiAlertTriangle,
    iconClass: "bg-red-500/15 text-red-200 ring-red-400/25",
    confirmClass: "bg-red-500 text-white shadow-lg shadow-red-950/20 hover:bg-red-600",
  },
  success: {
    icon: FiCheckCircle,
    iconClass: "bg-emerald-500/15 text-emerald-200 ring-emerald-400/25",
    confirmClass: "bg-emerald-500 text-white shadow-lg shadow-emerald-950/20 hover:bg-emerald-600",
  },
  warning: {
    icon: FiAlertTriangle,
    iconClass: "bg-amber-500/15 text-amber-200 ring-amber-400/25",
    confirmClass: "bg-red-500 text-white shadow-lg shadow-red-950/20 hover:bg-red-600",
  },
  info: {
    icon: FiInfo,
    iconClass: "bg-sky-500/15 text-sky-200 ring-sky-400/25",
    confirmClass: "bg-red-500 text-white shadow-lg shadow-red-950/20 hover:bg-red-600",
  },
};

const defaultOptions = {
  title: "Confirm action",
  message: "",
  confirmLabel: "Confirm",
  cancelLabel: "Cancel",
  tone: "info",
  hideCancel: false,
};

export const useConfirmDialog = () => {
  const resolverRef = useRef(null);
  const [options, setOptions] = useState(null);

  const close = useCallback((result) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setOptions(null);
  }, []);

  const confirm = useCallback(
    (nextOptions) =>
      new Promise((resolve) => {
        resolverRef.current?.(false);
        resolverRef.current = resolve;
        setOptions({ ...defaultOptions, ...nextOptions });
      }),
    []
  );

  const dialog = useMemo(() => {
    const activeOptions = options;
    const tone = toneStyles[activeOptions?.tone] || toneStyles.info;
    const Icon = tone.icon;

    return (
      <AnimatePresence>
        {activeOptions && (
          <motion.div
            className="fixed inset-0 z-[5000] flex items-center justify-center bg-[#020617]/72 px-4 py-6 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="confirm-dialog-title"
              className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#0b1424] text-white shadow-2xl shadow-black/40"
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              <div className="h-1 bg-red-500" />
              <div className="flex items-start gap-4 p-5">
                <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ring-1 ${tone.iconClass}`}>
                  <Icon className="text-xl" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <h2 id="confirm-dialog-title" className="text-lg font-black tracking-tight text-white">
                      {activeOptions.title}
                    </h2>
                    <button
                      type="button"
                      onClick={() => close(false)}
                      className="rounded-full p-1 text-slate-400 transition hover:bg-white/[0.08] hover:text-white"
                      aria-label="Close dialog"
                    >
                      <FiX />
                    </button>
                  </div>
                  {activeOptions.message && (
                    <p className="mt-2 whitespace-pre-line text-sm font-semibold leading-6 text-slate-300">
                      {activeOptions.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-white/10 bg-white/[0.035] px-5 py-4 sm:flex-row sm:justify-end">
                {!activeOptions.hideCancel && (
                  <button
                    type="button"
                    onClick={() => close(false)}
                    className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm font-black text-slate-200 transition hover:bg-white/[0.1] hover:text-white"
                  >
                    {activeOptions.cancelLabel}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => close(true)}
                  className={`rounded-xl px-4 py-2.5 text-sm font-black transition ${tone.confirmClass}`}
                >
                  {activeOptions.confirmLabel}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }, [close, options]);

  return { confirm, dialog };
};
