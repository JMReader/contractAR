// Sesión de la demo: el userId (elegido en el login mock) y los ids de acuerdos
// que este usuario conoce desde el teléfono. AsyncStorage alcanza: no hay
// secretos, sólo identificadores de demostración. En web (export estático de
// la demo) se usa localStorage con la misma interfaz.

import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const store =
  Platform.OS === "web"
    ? {
        getItem: (k: string) => Promise.resolve(globalThis.localStorage?.getItem(k) ?? null),
        setItem: (k: string, v: string) => {
          globalThis.localStorage?.setItem(k, v);
          return Promise.resolve();
        },
        removeItem: (k: string) => {
          globalThis.localStorage?.removeItem(k);
          return Promise.resolve();
        },
      }
    : AsyncStorage;

const KEY_USER = "contractar.userId";
const keyIds = (userId: string) => `contractar.agreements.${userId}`;

export async function getUserId(): Promise<string | null> {
  return store.getItem(KEY_USER);
}

export async function setUserId(userId: string): Promise<void> {
  await store.setItem(KEY_USER, userId);
}

export async function clearUserId(): Promise<void> {
  await store.removeItem(KEY_USER);
}

/** Ids vistos por este usuario, más nuevos primero. Fallback mientras
 *  GET /api/agreements?userId= no exista en el server. */
export async function getKnownIds(userId: string): Promise<string[]> {
  const raw = await store.getItem(keyIds(userId));
  if (!raw) return [];
  try {
    const ids = JSON.parse(raw) as unknown;
    return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export async function rememberAgreement(userId: string, id: string): Promise<void> {
  const ids = await getKnownIds(userId);
  await store.setItem(keyIds(userId), JSON.stringify([id, ...ids.filter((x) => x !== id)]));
}

// ── Pago pendiente de resolver ───────────────────────────────────────────────
// No existe GET /api/payments para recuperarlo del server: si la app se cierra
// con una carga/retiro pendiente, sin esto la plata queda trabada.

const keyPending = (userId: string) => `contractar.pending.${userId}`;

export interface PendingPay {
  paymentId: string;
  kind: "load" | "withdraw";
  cents: number;
}

export async function getPendingPay(userId: string): Promise<PendingPay | null> {
  const raw = await store.getItem(keyPending(userId));
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<PendingPay>;
    return typeof p.paymentId === "string" && (p.kind === "load" || p.kind === "withdraw") && typeof p.cents === "number"
      ? { paymentId: p.paymentId, kind: p.kind, cents: p.cents }
      : null;
  } catch {
    return null;
  }
}

export async function setPendingPay(userId: string, p: PendingPay): Promise<void> {
  await store.setItem(keyPending(userId), JSON.stringify(p));
}

export async function clearPendingPay(userId: string): Promise<void> {
  await store.removeItem(keyPending(userId));
}

/** username de login → userId demo estable (minúsculas, sin espacios). */
export function userIdFromLogin(usuario: string): string {
  const slug = usuario
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/@.*$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return slug || "demo";
}
