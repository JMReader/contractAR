"use client";

import { useEffect, useRef } from "react";

/**
 * Escultura ASCII de identidad — port fiel del canvas de `propuesta-identidad.html`
 * (SharedBrain → team/projects/escrow-argt): esfera de caracteres `·:+*#%@` con
 * rotación, warp y descarte de la cara oculta, dibujada con Canvas 2D.
 *
 * Honestidad técnica: el render real es Canvas 2D, disponible en todo navegador.
 * Al montar se sondea `navigator.gpu.requestAdapter()` sólo para *registrar* si
 * WebGPU existe en el dispositivo — no se usa para dibujar. La integración vgpu /
 * WebGPU real queda como trabajo posterior (M16); este componente es el fallback
 * que funciona sin GPU y sin JavaScript de terceros.
 */

const CHARS = "·:+*#%@";
const DPR_CAP = 2;

export type AsciiSpherePalette = {
  /** Canales RGB del trazo tal como van dentro de `rgba()`, p. ej. "130,169,255". */
  glyph: string;
};

/** Tinta por defecto: hielo del azul cobalt (rgba(130,169,255) de la propuesta). */
export const COBALT: AsciiSpherePalette = { glyph: "130,169,255" };

export type AsciiSphereStatus = {
  /** Render real en uso. Hoy siempre Canvas 2D. */
  backend: "canvas2d";
  /** Resultado del sondeo WebGPU: se informa en el panel técnico, no se usa. */
  webgpu: "pending" | "available" | "unavailable";
  reducedMotion: boolean;
};

type Props = {
  palette?: AsciiSpherePalette;
  /** Fuerza el cuadro estático (t = 0), igual que `prefers-reduced-motion`. */
  static?: boolean;
  /** Reporta el backend real y las capacidades detectadas (para el panel técnico). */
  onStatus?: (status: AsciiSphereStatus) => void;
  className?: string;
};

type GpuNavigator = Navigator & {
  gpu?: { requestAdapter?: () => Promise<unknown | null> };
};

export default function AsciiSphereScene({
  palette = COBALT,
  static: forceStatic = false,
  onStatus,
  className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onStatusRef = useRef(onStatus);

  useEffect(() => {
    onStatusRef.current = onStatus;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const glyph = palette.glyph;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const still = () => forceStatic || reduced.matches;

    let frame = 0;
    let raf = 0;
    let inView = true;
    let disposed = false;

    // --- Sondeo WebGPU: registra disponibilidad; el render sigue siendo Canvas 2D.
    let webgpu: AsciiSphereStatus["webgpu"] = "unavailable";
    const report = () =>
      onStatusRef.current?.({
        backend: "canvas2d",
        webgpu,
        reducedMotion: reduced.matches,
      });
    const nav = window.navigator as GpuNavigator;
    if (typeof nav.gpu?.requestAdapter === "function") {
      webgpu = "pending";
      report();
      nav.gpu
        .requestAdapter()
        .then((adapter) => {
          webgpu = adapter ? "available" : "unavailable";
          console.info(
            `[contractar] escena ASCII: Canvas 2D activo · WebGPU ${
              adapter ? "disponible (no utilizada)" : "sin adaptador"
            }`
          );
          if (!disposed) report();
        })
        .catch(() => {
          webgpu = "unavailable";
          console.info("[contractar] escena ASCII: Canvas 2D activo · sondeo WebGPU falló");
          if (!disposed) report();
        });
    } else {
      report();
    }

    // Dibuja un cuadro. Con `still()` t = 0 → esfera estática (misma escena, sin giro).
    const draw = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) {
        frame++;
        return;
      }
      const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
      const pw = Math.round(w * dpr);
      const ph = Math.round(h * dpr);
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const t = still() ? 0 : frame * 0.014;
      ctx.font = "12px 'IBM Plex Mono', ui-monospace, monospace";
      ctx.textAlign = "center";
      const scale = Math.min(w, h) * 0.36;
      for (let y = -1; y <= 1; y += 0.085) {
        const radius = Math.sqrt(Math.max(0, 1 - y * y));
        for (let a = 0; a < Math.PI * 2; a += 0.13) {
          const x = Math.cos(a) * radius;
          const z = Math.sin(a) * radius;
          const warp = 1 + 0.08 * Math.sin(4 * a + t * 1.4 + y * 3);
          const rx = x * Math.cos(t) + z * Math.sin(t);
          const rz = -x * Math.sin(t) + z * Math.cos(t);
          if (rz < -0.2) continue; // cara oculta: no se dibuja
          ctx.fillStyle = `rgba(${glyph},${0.25 + (0.75 * (rz + 1)) / 2})`;
          ctx.fillText(
            CHARS[Math.min(6, Math.floor((rz + 1) * 3))],
            w / 2 + rx * scale * warp,
            h / 2 + y * scale * warp
          );
        }
      }
      frame++;
    };

    // Una sola cadena de rAF: `raf` distinto de 0 significa "hay cuadro pendiente".
    const tick = () => {
      raf = 0;
      if (inView && !document.hidden) draw();
      if (!still() && !disposed) raf = requestAnimationFrame(tick);
    };
    const kick = () => {
      if (disposed) return;
      if (!still()) {
        if (!raf) raf = requestAnimationFrame(tick);
      } else if (inView && !document.hidden) {
        draw(); // modo estático: un cuadro por evento relevante, sin bucle
      }
    };

    const observer = new IntersectionObserver((entries) => {
      inView = entries[0]?.isIntersecting ?? true;
      kick();
    });
    observer.observe(canvas);

    // En modo estático el bucle no corre: un resize redibuja el cuadro quieto.
    const resizer = new ResizeObserver(() => {
      if (inView && !document.hidden && still()) draw();
    });
    resizer.observe(canvas);

    const onVisibility = () => {
      if (!document.hidden) kick();
    };
    const onReducedChange = () => {
      report();
      kick();
    };
    document.addEventListener("visibilitychange", onVisibility);
    reduced.addEventListener("change", onReducedChange);

    kick();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      resizer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      reduced.removeEventListener("change", onReducedChange);
    };
  }, [forceStatic, palette.glyph]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      role="img"
      aria-label="Escultura ASCII de una esfera en rotación lenta, dibujada con Canvas 2D. No requiere GPU: si el navegador no tiene WebGPU la escena funciona igual, y con movimiento reducido se muestra como un cuadro estático."
    />
  );
}
