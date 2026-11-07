import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import SceneLoader from "@/components/landing/SceneLoader";
import styles from "@/components/landing/landing.module.css";

const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%230047ff'/%3E%3C/svg%3E";

export const metadata: Metadata = {
  title: "ContractAR — Un acuerdo. Todo claro.",
  description:
    "Acordá condiciones, protegí la plata en garantía y liberá o devolvé el pago cuando se cumpla. Demo: carga y retiro de pesos simulados.",
  icons: { icon: FAVICON },
};

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

const steps = [
  {
    n: "01",
    title: "Acordás y compartís",
    body: "Completás monto, condiciones y plazos. La otra parte recibe un enlace, lee lo mismo que vos y decide: nadie acepta a ciegas.",
  },
  {
    n: "02",
    title: "La plata queda protegida",
    body: "Quien paga deposita en garantía. El monto queda a la vista y no se mueve: ni se cobra antes de tiempo ni desaparece si el trato se tuerce.",
  },
  {
    n: "03",
    title: "Se libera o se devuelve",
    body: "Entregado y conforme, el pago se libera. Si hay un problema, se devuelve o se reparte según lo acordado — nunca por un gesto accidental.",
  },
];

const cases = [
  {
    tag: "plantilla · garantía",
    title: "Garantía de auto",
    amount: "$ 600.000",
    body: "Rentadora y cliente. El depósito cubre daños o infracciones; si el auto vuelve bien, vuelve entero. Si hay reclamo, se propone un reparto por ítems y las dos partes lo revisan antes de moverse un peso.",
  },
  {
    tag: "plantilla · compraventa",
    title: "Compra de entrada",
    amount: "$ 45.000",
    body: "Vendedor y comprador que todavía no se conocen. El pago queda protegido y se libera cuando el comprador confirma que recibió lo acordado.",
  },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
      <header className="flex items-center justify-between gap-4 border-b border-line py-5">
        <p className="text-[22px] font-extrabold tracking-[-0.06em]">
          contract<b className="text-[#87aaff]">AR</b>
        </p>
        <nav aria-label="Secciones" className="flex items-center gap-5 text-[12px] sm:gap-6 sm:text-[13px]">
          <a href="#como-funciona" className={`${styles.navLink} hidden min-[480px]:inline`}>
            Cómo funciona
          </a>
          <a href="#casos" className={`${styles.navLink} hidden min-[480px]:inline`}>
            Casos
          </a>
          <Link href="/acuerdos" className={styles.navLink}>
            Mis acuerdos
          </Link>
        </nav>
      </header>

      <main>
        {/* Hero — contenido y CTAs primero en el DOM y en pantalla chica;
            la escena queda después (móvil) o a la derecha (lg). */}
        <section className="grid items-center gap-10 py-14 sm:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8 lg:py-20">
          <div>
            <p className={`${styles.rise} font-mono text-[11px] uppercase tracking-[0.14em] text-ice`}>
              ContractAR · acuerdos con plata protegida
            </p>
            <h1
              className={`${styles.rise} mt-5 text-[clamp(42px,10vw,88px)] font-extrabold leading-[0.98] tracking-[-0.06em]`}
              style={delay(90)}
            >
              Un acuerdo.
              <br />
              <em className="not-italic text-[#87aaff]">Todo claro.</em>
            </h1>
            <p className={`${styles.rise} mt-6 max-w-[490px] text-[16px] text-muted sm:text-[17px]`} style={delay(180)}>
              Dejás la plata del trato protegida hasta que se cumpla lo pactado: ni se cobra antes de
              tiempo ni se pierde si algo sale mal. En pesos, con condiciones a la vista para las dos
              partes.
            </p>
            <div className={`${styles.rise} mt-8 flex flex-wrap gap-3`} style={delay(270)}>
              <Link href="/acuerdos/nuevo" className={styles.btnPrimary}>
                Crear un acuerdo
              </Link>
              <Link href="/acuerdos" className={styles.btnGhost}>
                Ver mis acuerdos
              </Link>
            </div>
            <p className={`${styles.rise} mt-5 text-[13px] text-muted`} style={delay(360)}>
              Demo de hackatón — carga y retiro de pesos simulados.{" "}
              <a href="#demo" className={styles.textLink}>
                Ver el aviso completo
              </a>
              .
            </p>
          </div>
          <div className={styles.rise} style={delay(220)}>
            <SceneLoader />
          </div>
        </section>

        {/* Cómo funciona — el proceso real del producto, en tres momentos. */}
        <section id="como-funciona" className="border-t border-line py-12 sm:py-16">
          <div className="mb-8 flex flex-wrap items-baseline justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ice">
                01 / cómo funciona
              </p>
              <h2 className="mt-2 text-[clamp(28px,6vw,44px)] font-extrabold leading-[1.05] tracking-[-0.05em]">
                La plata espera donde las dos partes la ven.
              </h2>
            </div>
            <p className="max-w-[420px] text-[14px] text-muted">
              Una sola ficha para garantías y compraventas. Cada estado tiene texto y cada movimiento
              tiene comprobante.
            </p>
          </div>
          <ol className="grid list-none gap-4 p-0 md:grid-cols-3">
            {steps.map((s) => (
              <li key={s.n} className="rounded-xl border border-line bg-surface p-5 sm:p-6">
                <p className="font-mono text-[11px] tracking-[0.08em] text-ice">{s.n}</p>
                <h3 className="mt-3 text-[18px] font-bold tracking-[-0.02em]">{s.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Casos — dos plantillas sobre el mismo motor de acuerdo. */}
        <section id="casos" className="border-t border-line py-12 sm:py-16">
          <div className="mb-8">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ice">
              02 / dos casos, un motor
            </p>
            <h2 className="mt-2 text-[clamp(28px,6vw,44px)] font-extrabold leading-[1.05] tracking-[-0.05em]">
              La misma ficha para cada trato.
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {cases.map((c) => (
              <article key={c.title} className="rounded-xl border border-line bg-surface p-5 sm:p-6">
                <p className="font-mono text-[10px] uppercase tracking-[0.09em] text-[#a8c1ff]">
                  {c.tag}
                </p>
                <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-[22px] font-bold tracking-[-0.03em]">{c.title}</h3>
                  <p className="font-mono text-[24px] font-medium tracking-[-0.04em] text-ink">
                    {c.amount}
                  </p>
                </div>
                <p className="mt-3 text-[13px] leading-relaxed text-muted">{c.body}</p>
              </article>
            ))}
          </div>
          <p className="mt-5 max-w-[640px] text-[13px] text-muted">
            ContractAR registra lo que las partes acuerdan: no certifica la autenticidad de una
            entrada ni determina daños en un auto.
          </p>
        </section>

        {/* Aviso honesto de demo + panel técnico de la escena y del producto. */}
        <section id="demo" className="border-t border-line py-12 sm:py-16">
          <div className="rounded-xl border border-line bg-surface p-5 sm:p-6">
            <div className="flex flex-wrap items-start gap-4">
              <span className="mt-0.5 rounded-full border border-line px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.09em] text-coral">
                Demo
              </span>
              <p className="min-w-0 flex-1 text-[14px] leading-relaxed">
                Carga y retiro de pesos simulados; las operaciones de garantía se registran en una
                red de pruebas pública. En esta demo no se mueve dinero real ni se promete conversión
                bancaria.
              </p>
            </div>
          </div>

          <details className="mt-4 rounded-xl border border-line bg-surface">
            <summary className="cursor-pointer p-5 font-mono text-[12px] uppercase tracking-[0.09em] text-ice">
              Ver detalle técnico
            </summary>
            <ul className="space-y-2 p-5 pt-0 text-[13px] leading-relaxed text-muted">
              <li>
                <b className="text-ink">Escena de identidad:</b> esfera ASCII dibujada con Canvas 2D
                — disponible en todo navegador, sin GPU. Al cargar se sondea WebGPU y el resultado se
                muestra bajo la escena; la integración real con vgpu/WebGPU es trabajo pendiente
                (stretch), no lo que está corriendo.
              </li>
              <li>
                <b className="text-ink">Coste:</b> unos 1.100 caracteres por cuadro,
                devicePixelRatio con tope 2, bucle con requestAnimationFrame. Se pausa fuera del
                viewport (IntersectionObserver) y con la pestaña oculta (document.hidden).
              </li>
              <li>
                <b className="text-ink">Movimiento reducido:</b> con{" "}
                <code className="font-mono text-ice">prefers-reduced-motion</code> la escena dibuja
                un único cuadro estático y no inicia el bucle.
              </li>
              <li>
                <b className="text-ink">Dinero:</b> la interfaz habla en pesos; token, red y hashes
                viven dentro del comprobante técnico de cada acuerdo. La equivalencia 1 tARGt = 1 ARS
                es una convención de demo, no una cotización.
              </li>
            </ul>
          </details>
        </section>
      </main>

      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-line py-8 text-[13px] text-muted">
        <p className="font-extrabold tracking-[-0.06em] text-ink">
          contract<b className="text-[#87aaff]">AR</b>
        </p>
        <p>Fondos y operaciones simulados — demo de hackatón.</p>
        <div className="flex gap-5">
          <Link href="/acuerdos" className={styles.textLink}>
            Mis acuerdos
          </Link>
          <Link href="/acuerdos/nuevo" className={styles.textLink}>
            Crear acuerdo
          </Link>
        </div>
      </footer>
    </div>
  );
}
