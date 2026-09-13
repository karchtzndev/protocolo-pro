import Dexie, { type Table } from "dexie";
import type { DayMenu, MealCheckinStatus } from "./types";

export interface LocalDiet {
  id: string; // patientId
  patientName: string;
  nutritionistName: string;
  clinicName: string | null;
  brandPrimaryColor: string;
  weeklyMenu: Record<string, DayMenu>;
  shoppingList: string[];
  guidance: string[];
  version: number;
  lastModified: number;
  syncStatus: "synced" | "pending" | "conflict";
}

export interface LocalMealCheckin {
  id?: number;
  patientId: string;
  checkinDate: string; // YYYY-MM-DD
  mealKey: string;
  status: MealCheckinStatus;
  syncStatus: "synced" | "pending";
  timestamp: number;
}

export interface SyncQueueItem {
  id?: number;
  type: "meal_checkin" | "push_subscription" | "anamnesis";
  action: "upsert" | "delete";
  endpoint: string; // API or Action name
  payload: any;
  timestamp: number;
  retries: number;
}

class ProtocoloProDatabase extends Dexie {
  diets!: Table<LocalDiet, string>;
  checkins!: Table<LocalMealCheckin, number>;
  syncQueue!: Table<SyncQueueItem, number>;

  constructor() {
    super("ProtocoloProDatabase");
    this.version(1).stores({
      diets: "id, version, lastModified, syncStatus",
      checkins: "++id, [patientId+checkinDate+mealKey], syncStatus, timestamp",
      syncQueue: "++id, type, timestamp, retries",
    });
  }
}

export const db = new ProtocoloProDatabase();

/**
 * Salva ou atualiza a dieta offline.
 */
export async function saveDietOffline(diet: LocalDiet) {
  diet.lastModified = Date.now();
  await db.diets.put(diet);
}

/**
 * Adiciona um checkin de refeição offline e enfileira para sincronização.
 */
export async function recordMealCheckinOffline(
  patientId: string,
  checkinDate: string,
  mealKey: string,
  status: MealCheckinStatus
) {
  const timestamp = Date.now();

  // Atualiza ou insere localmente
  await db.checkins.put({
    patientId,
    checkinDate,
    mealKey,
    status,
    syncStatus: "pending",
    timestamp,
  });

  // Enfileira a ação para sincronização em background
  await db.syncQueue.add({
    type: "meal_checkin",
    action: "upsert",
    endpoint: "recordMealCheckin",
    payload: { patientId, checkinDate, mealKey, status },
    timestamp,
    retries: 0,
  });

  // Dispara evento para tentar sincronizar imediatamente se estiver online
  if (navigator.onLine) {
    triggerSyncBackground();
  }
}

/**
 * Dispara uma tentativa de sincronização em segundo plano via message ao Service Worker.
 */
export function triggerSyncBackground() {
  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: "SYNC_QUEUE" });
  }
}
