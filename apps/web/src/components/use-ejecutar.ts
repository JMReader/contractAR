"use client";

// Ejecuta una operación de dinero mostrando el ciclo completo de estados:
// esperando firma → enviada → confirmando → confirmada/fallida.
// La firma la hace el operador de demo en el servidor; la UI refleja el ciclo.

import { useCallback, useEffect, useRef, useState } from "react";
import { toHumanError } from "@contractar/shared";
import { ApiError } from "@/lib/api";
import { pausa, type Fase } from "./tx-status";

export function useEjecutar() {
  const [fase, setFase] = useState<Fase>("idle");
  const [error, setError] = useState<string>();
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  const ejecutar = useCallback(
    async <T>(
      operacion: () => Promise<T>,
      confirmar?: () => Promise<unknown>,
    ): Promise<T | null> => {
      setError(undefined);
      setFase("firma");
      try {
        // La pausa mínima hace legible cada fase; el estado real lo da la respuesta.
        const [res] = await Promise.all([operacion(), pausa(600)]);
        if (!vivo.current) return res;
        setFase("enviada");
        await pausa(500);
        if (!vivo.current) return res;
        setFase("confirmando");
        if (confirmar) await Promise.all([confirmar(), pausa(600)]);
        if (vivo.current) setFase("confirmada");
        return res;
      } catch (e) {
        if (vivo.current) {
          setFase("fallida");
          setError(e instanceof ApiError ? e.human : toHumanError(e));
        }
        return null;
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setFase("idle");
    setError(undefined);
  }, []);

  return { fase, error, ejecutar, reset, vivo };
}
