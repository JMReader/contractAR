import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

export const PRESENTATION = process.env.EXPO_PUBLIC_PRESENTATION === "true";
type Raw = Record<string, any>;
type Store = { agreements: Raw[]; balances: Record<string, number>; payments: Record<string, Raw> };
const KEY = "contractar.presentation.v2";
let cache: Store | undefined;
async function read(): Promise<Store> {
  if (cache) return cache;
  try { cache = JSON.parse(await AsyncStorage.getItem(KEY) || "null") || undefined; } catch {}
  return cache ??= { agreements: [], balances: {}, payments: {} };
}
async function persist(s: Store) { cache = s; await AsyncStorage.setItem(KEY, JSON.stringify(s)); }
function view(d: Raw, uid: string) {
  const role = d.roles.depositor.userId === uid ? "depositor" : d.roles.beneficiary.userId === uid ? "beneficiary" : d.roles.arbiter.userId === uid ? "arbiter" : null;
  return { ...d, yourRole: role };
}
export async function presentationRequest(path: string, init?: RequestInit): Promise<unknown> {
  const s = await read(); const u = new URL(path, "https://demo.local");
  const b: Raw = init?.body ? JSON.parse(String(init.body)) : {};
  const parts = u.pathname.split("/").filter(Boolean); const uid = b.userId || u.searchParams.get("userId") || "demo";
  if (parts[1] === "agreements") {
    if (parts.length === 2 && init?.method === "POST") {
      const id = `demo-${Date.now().toString(36)}`; const now = Date.now();
      const d: Raw = { id, agreementId: id, template: b.template, title: b.title, terms: { ...b, amountARS: b.amountARS, acceptDeadline: new Date(now + b.acceptDeadlineSec * 1000).toISOString(), reviewDeadline: new Date(now + b.reviewDeadlineSec * 1000).toISOString() }, state: "Created", amountARS: b.amountARS, remainingARS: b.amountARS, roles: { creator: { userId: uid }, beneficiary: { userId: uid }, depositor: {}, arbiter: { userId: "arbiter-demo" } }, onchain: { pending: true, txHashes: {} }, timeline: [{ label: "Acuerdo creado · simulación", at: now }], createdAt: now };
      s.agreements.unshift(d); await persist(s); return d;
    }
    if (parts.length === 2) return s.agreements.filter((d) => Object.values(d.roles).some((r: any) => r.userId === uid)).map((d) => view(d, uid));
    const d = s.agreements.find((a) => a.id === parts[2]); if (!d) throw new Error("No encontramos este acuerdo de demostración.");
    if (parts[3] === "action") {
      const action = b.action; const balance = s.balances[uid] || 0;
      if (action === "accept" && d.state === "Created") { d.roles.depositor = { userId: uid }; d.state = "Accepted"; }
      else if (action === "fund" && d.state === "Accepted") { if (balance < d.amountARS) throw new Error("Saldo insuficiente. Cargá saldo simulado primero."); s.balances[uid] = balance - d.amountARS; d.state = "Funded"; }
      else if (action === "proposeOutcome" && ["Funded", "Delivered"].includes(d.state)) { d.state = "OutcomeProposed"; d.outcomeProposerUserId = uid; d.proposedToBeneficiaryARS = b.toBeneficiaryARS; }
      else if (action === "dispute") d.state = "Disputed";
      else if (["acceptOutcome", "rule", "refundAfterTimeout"].includes(action)) {
        const toB = action === "refundAfterTimeout" ? 0 : action === "rule" ? b.toBeneficiaryARS : d.proposedToBeneficiaryARS;
        const fee = Math.floor(toB / 100); const toD = d.amountARS - toB;
        s.balances[d.roles.beneficiary.userId] = (s.balances[d.roles.beneficiary.userId] || 0) + toB - fee;
        s.balances[d.roles.depositor.userId] = (s.balances[d.roles.depositor.userId] || 0) + toD;
        d.settlement = { toBeneficiary: toB - fee, toDepositor: toD, fee }; d.state = toB === 0 ? "Refunded" : "Released"; d.remainingARS = 0;
      } else if (action === "cancel") d.state = "Cancelled";
      d.timeline.push({ label: `${({ accept: "Condiciones aceptadas", fund: "Depósito en garantía confirmado", proposeOutcome: "Entrega registrada y cierre propuesto", acceptOutcome: "Cierre aceptado", dispute: "Disputa abierta", rule: "Resolución registrada", cancel: "Acuerdo cancelado" } as Raw)[action] || action} · simulación`, at: Date.now() });
      await persist(s); return d;
    }
    return view(d, uid);
  }
  if (parts[1] === "ledger") { const user = parts[2]; return { available: s.balances[user] || 0, inEscrow: s.agreements.filter((d) => d.roles.depositor.userId === user && ["Funded", "Delivered", "OutcomeProposed", "Disputed"].includes(d.state)).reduce((sum, d) => sum + d.amountARS, 0), withdrawing: 0, entries: [] }; }
  if (parts[1] === "payments") {
    if (["load", "withdraw"].includes(parts[2])) { const id = `pay-${Date.now()}`; if (parts[2] === "withdraw" && (s.balances[uid] || 0) < b.amountARS) throw new Error("Saldo insuficiente."); s.payments[id] = { paymentId: id, userId: uid, amount: b.amountARS, kind: parts[2], status: "pending" }; await persist(s); return s.payments[id]; }
    const p = s.payments[parts[2]]; if (!p) throw new Error("Pago no encontrado.");
    if (parts[3] === "resolve" && p.status === "pending") { p.status = b.status; if (b.status === "approved") s.balances[p.userId] = (s.balances[p.userId] || 0) + (p.kind === "load" ? p.amount : -p.amount); await persist(s); }
    return p;
  }
  return {};
}
export async function importPresentationSnapshot() {
  if (!PRESENTATION || Platform.OS !== "web") return;
  const params = new URLSearchParams(window.location.search); const raw = params.get("acuerdo"); if (!raw) return;
  try {
    const d = JSON.parse(raw); if (typeof d.id !== "string" || !d.roles || !Number.isSafeInteger(d.amountARS) || d.amountARS <= 0 || !d.terms || !Array.isArray(d.timeline)) return;
    const s = await read(); s.agreements = [d, ...s.agreements.filter((a) => a.id !== d.id)]; await persist(s);
    sessionStorage.setItem("contractar.return", `/acuerdo/${d.id}`);
  } catch {}
}
export async function presentationLink(id: string) {
  const s = await read(); const d = s.agreements.find((a) => a.id === id);
  return `${window.location.origin}/acuerdo/${id}?acuerdo=${encodeURIComponent(JSON.stringify(d))}`;
}
export async function presentationRole(id: string, uid: string, role: string) {
  const s = await read(); const d = s.agreements.find((a) => a.id === id); if (!d) return;
  const previousRole = d.roles.depositor.userId === uid ? "depositor" : d.roles.beneficiary.userId === uid ? "beneficiary" : "arbiter";
  if (role !== previousRole && d.outcomeProposerUserId === uid) d.outcomeProposerUserId = "otra-parte-demo";
  if (role === "depositor") { d.roles.depositor.userId = uid; if (d.roles.beneficiary.userId === uid) d.roles.beneficiary.userId = "otra-parte-demo"; }
  else { d.roles[role].userId = uid; if (d.roles.depositor.userId === uid) d.roles.depositor.userId = "otra-parte-demo"; }
  await persist(s);
}
