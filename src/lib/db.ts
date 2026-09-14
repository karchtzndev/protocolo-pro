import Dexie, { type Table } from "dexie";
import type { DayMenu, MealCheckinStatus } from "./types";

export interface LocalDiet {
  id: string;
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
  checkinDate: string;
  mealKey: string;
  status: MealCheckinStatus;
  syncStatus: "synced" | "pending";
  timestamp: number;
}

export interface SyncQueueItem {
  id?: number;
  type: "meal_checkin" | "push_subscription" | "anamnesis";
  action: "upsert" | "delete";
  endpoint: string;
  payload: unknown;
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

export async function saveDietOffline(diet: LocalDiet) {
  diet.lastModified = Date.now();
  await db.diets.put(diet);
}

export async function recordMealCheckinOffline(
  patientId: string,
  checkinDate: string,
  mealKey: string,
  status: MealCheckinStatus
) {
  const timestamp = Date.now();
  const existing = await db.checkins
    .where("[patientId+checkinDate+mealKey]")
    .equals([patientId, checkinDate, mealKey])
    .first();

  await db.transaction("rw", db.checkins, db.syncQueue, async () => {
    await db.checkins.put({
      id: existing?.id,
      patientId,
      checkinDate,
      mealKey,
      status,
      syncStatus: "pending",
      timestamp,
    });
    await db.syncQueue.add({
      type: "meal_checkin",
      action: "upsert",
      endpoint: "recordMealCheckin",
      payload: { patientId, checkinDate, mealKey, status },
      timestamp,
      retries: 0,
    });
  });

  if (typeof navigator !== "undefined" && navigator.onLine) triggerSyncBackground();
}

export function triggerSyncBackground() {
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: "SYNC_QUEUE" });
  }
}
