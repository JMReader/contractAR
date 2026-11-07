"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { AsciiSphereStatus } from "./AsciiSphereScene";
import styles from "./landing.module.css";

// Carga diferida: la página (texto y acciones) no espera al JS de la escena.
const AsciiSphereScene = dynamic(() => import("./AsciiSphereScene"), {
  ssr: false,
});

function statusText(s: AsciiSphereStatus | null): string {
  if (!s) return "Escena de identidad · carga diferida";
  const gpu =
    s.webgpu === "available"
      ? "WebGPU detectada (no utilizada)"
      : s.webgpu === "pending"
        ? "sondeando WebGPU…"
        : "sin WebGPU";
  return `ASCII · Canvas 2D · ${gpu} · ${s.reducedMotion ? "cuadro estático" : "en movimiento"}`;
}

/**
 * Contenedor de la escena del hero. El texto de estado es el panel técnico de la
 * pieza: declara el backend real (Canvas 2D), el resultado del sondeo WebGPU y el
 * modo de movimiento. Sin JavaScript la página muestra el aviso de <noscript> y
 * todo el contenido sigue disponible.
 */
export default function SceneLoader() {
  const [status, setStatus] = useState<AsciiSphereStatus | null>(null);

  return (
    <figure className="relative m-0 grid place-items-center">
      <div className={`${styles.sceneHalo} relative h-[300px] w-full sm:h-[360px] lg:h-[480px]`}>
        <AsciiSphereScene
          onStatus={setStatus}
          className="absolute inset-0 block h-full w-full"
        />
        <noscript>
          <p className="absolute inset-0 grid place-items-center px-6 text-center text-[13px] text-muted">
            La escultura ASCII necesita JavaScript; el contenido de ContractAR no.
          </p>
        </noscript>
      </div>
      <figcaption className="mt-1 font-mono text-[11px] tracking-[0.04em] text-muted">
        {statusText(status)}
      </figcaption>
    </figure>
  );
}
