---
tags: [protocolo-pro, pwa, offline, dexie, indexeddb]
---

# Offline-first e PWA

← [[00 - MOC Protocolo.Pro]]

O paciente precisa abrir a dieta no mercado, na academia, sem sinal. Daí o offline-first — foi o último grande bloco de trabalho do projeto.

## Banco local — Dexie / IndexedDB

`src/lib/db.ts` — database `ProtocoloProDatabase`, versão 1, 3 stores:

```
diets      id, version, lastModified, syncStatus
checkins   ++id, [patientId+checkinDate+mealKey], syncStatus, timestamp
syncQueue  ++id, type, timestamp, retries
```

### `LocalDiet`
Guarda a dieta **junto com a identidade visual** (`nutritionistName`, `clinicName`, `brandPrimaryColor`) — offline a marca continua aparecendo, não degrada para genérico.
Campos de sincronização: `version`, `lastModified`, `syncStatus: synced | pending | conflict`.

> Existe estado `conflict` explícito — o modelo prevê divergência, não assume que o servidor sempre ganha.

### `checkins`
Índice composto `[patientId+checkinDate+mealKey]` garante um check-in por refeição por dia — dedupe na camada local.

### `syncQueue`
Fila genérica de operações pendentes: `type: meal_checkin | push_subscription | anamnesis`, com `action`, `endpoint`, `payload`, `retries`. Padrão outbox — qualquer ação nova entra na fila sem código de sync novo.

## PWA

- `manifest.webmanifest` gerado **por paciente** em `p/[slug]/manifest.webmanifest/route.ts` — cada paciente instala um app com a marca do seu nutricionista.
- Ícone gerado on-the-fly: `app/pwa-icon/[size]/route.tsx`
- `ServiceWorkerRegistrar.tsx`, `OfflineToast.tsx`
- ⚠️ **Armadilha registrada (v18)**: o `short_name` do PWA era cortado no meio da palavra. A correção corta **por palavra**.

## Push

`src/lib/push.ts` (web-push/VAPID) · tabela `push_subscriptions` · `PushOptIn.tsx` · `push-actions.ts` · `SendReminderButton.tsx`

## Ver também
- [[20 - Modelo de Dados]]
- [[90 - Aprendizados e Armadilhas]]
