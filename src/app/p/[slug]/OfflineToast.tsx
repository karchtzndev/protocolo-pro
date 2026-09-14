"use client";

import { useEffect, useState } from "react";

interface Toast {
  id: string;
  message: string;
  type: "success" | "warning" | "error";
}

export function OfflineToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const showToast = (message: string, type: "success" | "warning" | "error") => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { id, message, type }]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    };

    const handleSyncComplete = () => {
      showToast("Dados sincronizados com sucesso! 🎉", "success");
    };

    const handleOfflineMode = () => {
      showToast("Você está offline. Suas marcações foram salvas localmente.", "warning");
    };

    const handleCustomToast = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && detail.message) {
        showToast(detail.message, detail.type || "success");
      }
    };

    window.addEventListener("sync-complete", handleSyncComplete);
    window.addEventListener("offline-mode", handleOfflineMode);
    window.addEventListener("show-toast", handleCustomToast);

    return () => {
      window.removeEventListener("sync-complete", handleSyncComplete);
      window.removeEventListener("offline-mode", handleOfflineMode);
      window.removeEventListener("show-toast", handleCustomToast);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 space-y-2 px-4">
      {toasts.map((t) => {
        const bgClass = {
          success: "bg-success border-success text-white shadow-success/25",
          warning: "bg-warning border-warning text-white shadow-warning/25",
          error: "bg-danger border-danger text-white shadow-danger/25",
        }[t.type];

        return (
          <div
            key={t.id}
            className={`flex items-center justify-between gap-3 rounded-xl border p-3.5 text-xs font-semibold shadow-lg transition-all duration-300 animate-in fade-in slide-in-from-bottom-5 ${bgClass}`}
          >
            <span>{t.message}</span>
            <button
              onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
              className="rounded p-0.5 opacity-80 hover:opacity-100 focus:outline-none"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
