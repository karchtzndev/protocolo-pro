"use client";

import { useEffect, useState } from "react";
import { subscribeToPush } from "./actions";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

/**
 * Convite discreto pra ativar lembretes — só aparece se o navegador suporta
 * push, ainda não foi negado, e ainda não está inscrito. Nunca pede
 * permissão sozinho: é sempre um clique explícito do paciente.
 */
export function PushOptIn({ slug, patientId, vapidPublicKey }: { slug: string; patientId: string; vapidPublicKey: string }) {
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<"idle" | "asking" | "done" | "error">("idle");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (Notification.permission === "denied") return;

    navigator.serviceWorker.ready.then(async (registration) => {
      const existing = await registration.pushManager.getSubscription();
      if (!existing) setVisible(true);
    });
  }, []);

  if (!visible) return null;

  async function activate() {
    setStatus("asking");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setVisible(false);
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      const json = subscription.toJSON();
      await subscribeToPush(slug, patientId, {
        endpoint: json.endpoint!,
        keys: { p256dh: json.keys!.p256dh, auth: json.keys!.auth },
      });

      setStatus("done");
      setTimeout(() => setVisible(false), 2000);
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-[0_8px_30px_rgba(27,33,29,.1)]">
      {status === "done" ? (
        <p className="text-sm font-semibold text-success">🔔 Lembretes ativados!</p>
      ) : (
        <>
          <p className="mb-2.5 text-sm">
            <b>🔔 Ativar lembretes</b> — receba um aviso se esquecer de marcar uma refeição.
          </p>
          <button
            type="button"
            disabled={status === "asking"}
            onClick={activate}
            className="rounded-lg bg-brand px-3.5 py-2 text-xs font-bold text-brand-on disabled:opacity-60"
          >
            {status === "asking" ? "Ativando..." : "Ativar"}
          </button>
          {status === "error" && (
            <p className="mt-2 text-xs text-danger">Não foi possível ativar agora. Tente de novo mais tarde.</p>
          )}
        </>
      )}
    </div>
  );
}
