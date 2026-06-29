import { useCallback, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FiAlertTriangle, FiCheckCircle, FiInfo, FiX } from "react-icons/fi";

const toneStyles = {
  danger: {
    icon: FiAlertTriangle,
    iconClass: "bg-red-50 text-red-600 ring-red-100",
    confirmClass: "bg-red-600 text-white hover:bg-red-700",
  },
  success: {
    icon: FiCheckCircle,
    iconClass: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    confirmClass: "bg-emerald-600 text-white hover:bg-emerald-700",
  },
  info: {
    icon: FiInfo,
    iconClass: "bg-zinc-100 text-zinc-700 ring-zinc-200",
    confirmClass: "bg-zinc-950 text-white hover:bg-zinc-800",
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
            className="fixed inset-0 z-[5000] flex items-center justify-center bg-zinc-950/55 px-4 py-6 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="confirm-dialog-title"
              className="w-full max-w-md overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-2xl"
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              <div className="flex items-start gap-4 p-5">
                <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg ring-1 ${tone.iconClass}`}>
                  <Icon className="text-xl" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <h2 id="confirm-dialog-title" className="text-lg font-black tracking-tight text-zinc-950">
                      {activeOptions.title}
                    </h2>
                    <button
                      type="button"
                      onClick={() => close(false)}
                      className="rounded-full p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
                      aria-label="Close dialog"
                    >
                      <FiX />
                    </button>
                  </div>
                  {activeOptions.message && (
                    <p className="mt-2 whitespace-pre-line text-sm font-semibold leading-6 text-zinc-600">
                      {activeOptions.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-zinc-100 bg-zinc-50 px-5 py-4 sm:flex-row sm:justify-end">
                {!activeOptions.hideCancel && (
                  <button
                    type="button"
                    onClick={() => close(false)}
                    className="rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-black text-zinc-700 transition hover:bg-zinc-100"
                  >
                    {activeOptions.cancelLabel}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => close(true)}
                  className={`rounded-lg px-4 py-2.5 text-sm font-black transition ${tone.confirmClass}`}
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
