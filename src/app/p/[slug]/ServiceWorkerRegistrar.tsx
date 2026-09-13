"use client";

import { useEffect } from "react";

/**
 * Registra o service worker do portal. O escopo é `/p/` para o app instalado
 * do paciente nunca interceptar as telas da nutricionista.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js", { scope: "/p/" }).catch(() => {
      // Falha no registro não pode quebrar o portal — offline é um extra.
    });
  }, []);

  return null;
}
