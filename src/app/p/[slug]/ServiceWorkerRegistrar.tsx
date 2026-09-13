"use client";

import { useEffect } from "react";

/**
 * Registra o service worker do portal. O escopo é `/p/` para o app instalado
 * do paciente nunca interceptar as telas da nutricionista.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js", { scope: "/p/" }).then((registration) => {
      // Verifica se há uma nova versão disponível
      if (registration.waiting) {
        // Nova versão pronta para ativar
        window.dispatchEvent(new CustomEvent("sw-update-available"));
      }

      // Escuta por atualizações
      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (installingWorker) {
          installingWorker.onstatechange = () => {
            if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
              // Nova versão disponível
              window.dispatchEvent(new CustomEvent("sw-update-available"));
            }
          };
        }
      };
    }).catch(() => {
      // Falha no registro não pode quebrar o portal — offline é um extra.
    });

    // Escuta mensagens do service worker
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data.type === "DIET_UPDATED") {
        // Notifica o usuário sobre atualização de dieta
        window.dispatchEvent(new CustomEvent("diet-updated", { detail: event.data.url }));
      }
    });
  }, []);

  return null;
}
