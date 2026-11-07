"use client";

import { useEffect, useState } from "react";
import { Template } from "@contractar/shared";
import { CONDICIONES, VERIFICACIONES } from "@/lib/demo-options";
import { formatARS, parseARStoCents } from "./domain";
import { CopyField } from "./copy-field";
import { CarFront, Ticket, Plus, ArrowLeft, ShieldCheck, Check } from "lucide-react";

type Deal = { id: string; title: string; party: string; template: Template; amount: number; terms: string[]; verification: string; step: number; history: string[] };
const KEY = "contractar.mobile-demo.v1";
const STAGES = ["Por aceptar", "Aceptado", "Saldo cargado", "En garantía", "Entregado", "Finalizado"];
const button = "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue px-5 font-bold text-on-blue no-underline disabled:opacity-50";
const panel = "rounded-2xl border border-line bg-surface p-5";
const input = "mt-2 min-h-12 w-full rounded-xl border border-[#7d8ba3] bg-bg px-3 text-base";

function accessQuery() {
  const access = new URLSearchParams(window.location.search).get("demo_access") || sessionStorage.getItem("contractar.demo-access");
  if (!access) return "";
  sessionStorage.setItem("contractar.demo-access", access);
  return `?demo_access=${encodeURIComponent(access)}&_vercel_share=${encodeURIComponent(access)}`;
}
function share(deal: Deal) {
  return `${window.location.origin}/demo${accessQuery()}#${encodeURIComponent(JSON.stringify(deal))}`;
}
function validDeal(value: unknown): value is Deal {
  if (!value || typeof value !== "object") return false;
  const d = value as Deal;
  return typeof d.id === "string" && typeof d.title === "string" && typeof d.party === "string" && (d.template === Template.Guarantee || d.template === Template.Sale) && Number.isSafeInteger(d.amount) && d.amount > 0 && Array.isArray(d.terms) && d.terms.every((t) => typeof t === "string") && typeof d.verification === "string" && Number.isInteger(d.step) && d.step >= 0 && d.step <= 5 && Array.isArray(d.history) && d.history.every((t) => typeof t === "string");
}

export function DemoApp() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [active, setActive] = useState<Deal | null>(null);
  const [creating, setCreating] = useState(false);
  const [ready, setReady] = useState(false);
  const [template, setTemplate] = useState<Template>(Template.Guarantee);
  const [title, setTitle] = useState("Garantía de alquiler de auto");
  const [party, setParty] = useState("");
  const [amount, setAmount] = useState("600.000");
  const [selected, setSelected] = useState<number[]>([0, 1, 2, 3, 4]);
  const [verification, setVerification] = useState("ia");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [url, setUrl] = useState("");
  const [payment, setPayment] = useState(false);

  useEffect(() => {
    try {
      accessQuery();
      const saved: unknown = JSON.parse(localStorage.getItem(KEY) || "[]");
      const items = Array.isArray(saved) ? saved.filter(validDeal) : [];
      setDeals(items);
      if (location.hash.length > 1) {
        const incoming: unknown = JSON.parse(decodeURIComponent(location.hash.slice(1)));
        if (!validDeal(incoming)) throw new Error("invalid");
        setActive(incoming); setUrl(share(incoming));
        const updated = [incoming, ...items.filter((d) => d.id !== incoming.id)];
        setDeals(updated); localStorage.setItem(KEY, JSON.stringify(updated));
      }
    } catch { setError("No pudimos leer el acuerdo guardado o compartido. Podés crear uno nuevo."); }
    setReady(true);
  }, []);

  function save(deal: Deal) {
    const updated = [deal, ...deals.filter((d) => d.id !== deal.id)];
    setDeals(updated); setActive(deal); setUrl(share(deal)); setConsent(false); setError("");
    try { localStorage.setItem(KEY, JSON.stringify(updated)); } catch { setError("El navegador no permite guardar. Conservá el enlace para volver a abrir el acuerdo."); }
    history.replaceState(null, "", share(deal));
  }
  function advance(step: number, event: string) {
    if (!active) return;
    save({ ...active, step, history: [...active.history, event] });
  }
  function create(e: React.FormEvent) {
    e.preventDefault(); const cents = parseARStoCents(amount);
    if (!cents || !Number.isSafeInteger(cents) || title.trim().length < 3 || !party.trim() || !selected.length) { setError("Completá título, otra parte, monto mayor a cero y al menos una condición."); return; }
    save({ id: crypto.randomUUID(), title: title.trim(), party: party.trim(), amount: cents, template, terms: selected.map((i) => CONDICIONES[template][i]), verification, step: 0, history: ["Acuerdo creado con condiciones y verificación definidas."] });
    setCreating(false);
  }
  function back() { setActive(null); setCreating(false); setError(""); setPayment(false); history.replaceState(null, "", `/demo${accessQuery()}`); }

  return <div className="mx-auto max-w-2xl">
    <div className="mb-6 flex items-center justify-between gap-3"><span className="rounded-full border border-ice px-3 py-1 text-xs font-bold text-ice">DEMO INTERACTIVA</span><span className="text-xs text-muted">Sin dinero real</span></div>
    {error && <p role="alert" className="mb-4 rounded-xl border border-coral p-4 text-sm text-coral">{error}</p>}
    {!ready ? <p role="status">Abriendo tu demo…</p> : active ? <>
      <button onClick={back} className="mb-4 inline-flex min-h-11 items-center gap-2 text-muted"><ArrowLeft size={16} /> Todos mis acuerdos</button>
      <p className="text-sm text-ice">{active.template === Template.Guarantee ? "Garantía de auto" : "Compra de entrada"} · {STAGES[active.step]}</p>
      <h1 className="mt-2 break-words text-3xl font-extrabold tracking-tight">{active.title}</h1>
      <p className="mt-2 text-muted">Con {active.party}</p>
      <div className={`${panel} mt-6`}><p className="text-sm text-muted">Monto acordado</p><p className="mt-1 text-4xl font-extrabold tracking-tight">{formatARS(active.amount)}</p><p className="mt-3 flex items-center gap-2 text-sm text-green"><ShieldCheck size={18} /> {active.step >= 3 && active.step < 5 ? "Dinero simulado protegido en garantía" : active.step === 5 ? "Acuerdo cerrado · comprobante guardado" : "Se protege después de aceptar y depositar"}</p></div>
      <ol aria-label="Progreso del acuerdo" className="my-6 grid grid-cols-3 gap-2">{["Aceptar", "Cargar", "Proteger", "Entregar", "Cerrar"].map((label, i) => <li key={label} className={`rounded-lg border p-2 text-center text-xs font-semibold ${active.step > i ? "border-green text-green" : "border-line text-muted"}`}>{active.step > i ? "✓ " : `${i + 1}. `}{label}</li>)}</ol>
      <section className={panel}><h2 className="text-lg font-bold">{active.step === 0 ? "Compartí y aceptá" : active.step === 1 ? "Cargá el saldo" : active.step === 2 ? "Protegé el monto" : active.step === 3 ? "Registrá la entrega" : active.step === 4 ? "Verificá y cerrá" : "Acuerdo finalizado"}</h2>
        {active.step === 0 && <><p className="mt-2 text-sm text-muted">Enviá el enlace. La otra parte puede abrirlo en su teléfono y aceptar estas condiciones.</p><label className="my-4 flex min-h-12 items-start gap-3"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 size-5 shrink-0" /><span className="text-sm">Soy la otra parte, leí las condiciones y acepto el acuerdo por {formatARS(active.amount)}.</span></label><button disabled={!consent} onClick={() => advance(1, `${active.party} aceptó las condiciones (simulación).`)} className={`${button} w-full`}>Aceptar el acuerdo</button></>}
        {active.step === 1 && <><p className="mt-2 text-sm text-muted">Ingresá {formatARS(active.amount)} a tu saldo de demostración.</p>{!payment ? <button onClick={() => setPayment(true)} className={`${button} mt-4 w-full`}>Cargar con Mercado Pago · demo</button> : <div className="mt-4 rounded-xl border border-ice bg-bg p-4"><p className="font-bold">Mercado Pago · pago de prueba</p><p className="my-3 text-2xl font-bold">{formatARS(active.amount)}</p><p className="mb-4 text-sm text-muted">No se solicitan datos de tarjeta ni se realizan cobros.</p><button className={`${button} w-full`} onClick={() => { setPayment(false); advance(2, `Carga simulada aprobada por ${formatARS(active.amount)}.`); }}>Simular pago aprobado</button><button className="mt-2 min-h-11 w-full text-sm text-coral" onClick={() => { setPayment(false); setError("Pago simulado rechazado. Podés volver a intentar sin que se descuente dinero."); }}>Simular rechazo</button></div>}</>}
        {active.step === 2 && <><p className="mt-2 text-sm text-muted">Saldo disponible: {formatARS(active.amount)}. Al depositarlo queda reservado para este acuerdo.</p><button onClick={() => advance(3, "Depósito en garantía confirmado (simulación).")} className={`${button} mt-4 w-full`}>Depositar en garantía</button></>}
        {active.step === 3 && <><p className="mt-2 text-sm text-muted">Registrá que se devolvió el auto o se entregó la entrada para pasar a la verificación.</p><button onClick={() => advance(4, "Entrega registrada. Pendiente de verificación del cumplimiento.")} className={`${button} mt-4 w-full`}>Confirmar entrega</button></>}
        {active.step === 4 && <><p className="mt-2 text-sm text-muted">Método elegido: {VERIFICACIONES.find((v) => v.id === active.verification)?.nombre}. En esta demo la decisión se simula manualmente; no se ejecuta IA ni arbitraje de Kleros.</p><button onClick={() => advance(5, active.template === Template.Guarantee ? "Cumplimiento confirmado. Garantía devuelta al cliente, sin comisión (simulación)." : "Cumplimiento confirmado. Pago liberado al vendedor, con cargo del 1% (simulación)." )} className={`${button} mt-4 w-full`}>{active.template === Template.Guarantee ? "Sí, se cumplió · devolver garantía" : "Sí, se cumplió · liberar pago"}</button><button onClick={() => advance(5, "Incumplimiento confirmado. Reembolso completo al depositante (simulación).")} className="mt-3 min-h-12 w-full rounded-xl border border-coral px-4 font-semibold text-coral">No se cumplió · reembolsar</button></>}
        {active.step === 5 && <p role="status" className="mt-3 flex items-start gap-2 text-green"><Check className="shrink-0" />{active.history.at(-1)}</p>}
      </section>
      <section className={`${panel} mt-4`}><h2 className="mb-3 font-bold">Compartir este estado</h2><CopyField value={url} label="Copiar acuerdo" /><a href={`https://wa.me/?text=${encodeURIComponent(`Revisá nuestro acuerdo: ${url}`)}`} target="_blank" rel="noreferrer" className={`${button} mt-2 w-full`}>Compartir por WhatsApp</a><p className="mt-3 text-xs text-muted">El enlace contiene una copia de la demo. Al aceptar o avanzar, compartí el enlace actualizado para que la otra parte vea ese estado. No hay sincronización entre teléfonos.</p></section>
      <section className={`${panel} mt-4`}><h2 className="font-bold">Condiciones aceptadas</h2><ul className="mt-3 flex flex-col gap-3">{active.terms.map((t) => <li key={t} className="flex gap-2 text-sm"><Check size={18} className="shrink-0 text-green" />{t}</li>)}</ul><p className="mt-4 border-t border-line pt-3 text-sm text-ice">Verificación: {VERIFICACIONES.find((v) => v.id === active.verification)?.nombre}</p></section>
      <section className={`${panel} mt-4`}><h2 className="font-bold">Historial y comprobante</h2><ol className="mt-3 flex flex-col gap-3">{active.history.map((event, i) => <li key={i} className="text-sm text-muted"><span className="mr-2 font-mono text-ice">{String(i + 1).padStart(2, "0")}</span>{event}</li>)}</ol><p className="mt-4 break-all text-xs text-muted">Referencia demo: {active.id}</p></section>
    </> : creating ? <>
      <button className="mb-4 inline-flex min-h-11 items-center gap-2 text-muted" onClick={back}><ArrowLeft size={16} /> Mis acuerdos</button><h1 className="text-3xl font-extrabold">Nuevo acuerdo</h1><p className="mt-2 text-muted">Elegí las condiciones. Compartilo. Protegé el pago.</p>
      <form onSubmit={create} className="mt-6 flex flex-col gap-5">
        <fieldset><legend className="mb-2 font-bold">¿Qué querés acordar?</legend><div className="grid grid-cols-2 gap-3">{[Template.Guarantee, Template.Sale].map((t) => <label key={t} className={`flex min-h-20 cursor-pointer items-center gap-2 rounded-xl border p-3 ${template === t ? "border-ice bg-surface-elevated" : "border-line"}`}><input type="radio" name="template" checked={template === t} onChange={() => { setTemplate(t); setSelected(CONDICIONES[t].map((_, i) => i)); setTitle(t === Template.Guarantee ? "Garantía de alquiler de auto" : "Compra de entrada"); }} />{t === Template.Guarantee ? <CarFront size={20} /> : <Ticket size={20} />}<span className="text-sm font-bold">{t === Template.Guarantee ? "Auto" : "Entrada"}</span></label>)}</div></fieldset>
        <label className="font-semibold">Título<input required minLength={3} maxLength={80} className={input} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <label className="font-semibold">La otra parte<input required maxLength={80} placeholder="Nombre de la persona" className={input} value={party} onChange={(e) => setParty(e.target.value)} /></label>
        <label className="font-semibold">Monto en pesos<input required inputMode="decimal" className={input} value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
        <fieldset><legend className="mb-3 font-bold">Condiciones prearmadas</legend><div className="flex flex-col gap-2">{CONDICIONES[template].map((t, i) => <label key={t} className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface p-4"><input type="checkbox" className="mt-1 size-5 shrink-0" checked={selected.includes(i)} onChange={(e) => setSelected(e.target.checked ? [...selected, i].sort() : selected.filter((n) => n !== i))} /><span className="text-sm">{t}</span></label>)}</div></fieldset>
        <fieldset><legend className="mb-3 font-bold">Tipo de verificación</legend><div className="flex flex-col gap-2">{VERIFICACIONES.map((v) => <label key={v.id} className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border p-4 ${verification === v.id ? "border-ice bg-surface-elevated" : "border-line"}`}><input type="radio" name="verification" className="mt-1 size-5 shrink-0" checked={verification === v.id} onChange={() => setVerification(v.id)} /><span><strong className="block">{v.nombre}</strong><span className="mt-1 block text-sm text-muted">{v.detalle}</span></span></label>)}</div></fieldset>
        <button type="submit" className={`${button} w-full`}>Crear y compartir acuerdo</button>
      </form>
    </> : <>
      <p className="text-sm font-semibold text-ice">CONTRACTAR / TUS OPERACIONES</p><h1 className="mt-2 text-4xl font-extrabold tracking-tight">Todo acordado.<br />Todo a la vista.</h1><p className="mt-3 text-muted">Creá un acuerdo, compartilo y recorré el pago protegido de principio a fin.</p><button onClick={() => setCreating(true)} className={`${button} my-6 w-full`}><Plus size={20} /> Crear acuerdo</button>
      <div className="mb-6 grid grid-cols-2 gap-3"><div className={panel}><p className="text-sm text-muted">Acuerdos guardados</p><p className="mt-1 text-3xl font-extrabold">{deals.length}</p></div><div className={panel}><p className="text-sm text-muted">En garantía · demo</p><p className="mt-1 text-xl font-extrabold">{formatARS(deals.filter((d) => d.step >= 3 && d.step < 5).reduce((sum, d) => sum + d.amount, 0))}</p></div></div>
      <h2 className="mb-3 text-lg font-bold">Mis acuerdos</h2>{deals.length === 0 ? <div className={panel}><p className="font-bold">Tu primer acuerdo empieza acá.</p><p className="mt-2 text-sm text-muted">Probá una garantía de auto o una entrada. Tus acuerdos quedan guardados en este navegador.</p></div> : <ul className="flex flex-col gap-3">{deals.map((d) => <li key={d.id}><button onClick={() => { setActive(d); setUrl(share(d)); setConsent(false); }} className={`${panel} w-full text-left`}><span className="text-xs font-semibold text-ice">{STAGES[d.step]}</span><strong className="mt-2 block break-words text-lg">{d.title}</strong><span className="mt-1 block text-sm text-muted">Con {d.party}</span><span className="mt-3 block text-2xl font-bold">{formatARS(d.amount)} <span className="float-right text-ice">→</span></span></button></li>)}</ul>}
    </>}
    <nav aria-label="Navegación de la demo" className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-2 border-t border-line bg-bg pb-[env(safe-area-inset-bottom)] sm:hidden"><button onClick={back} className="min-h-14 font-semibold text-ice">Mis acuerdos</button><button onClick={() => { back(); setCreating(true); }} className="min-h-14 font-semibold text-ice">Nuevo acuerdo +</button></nav>
  </div>;
}
