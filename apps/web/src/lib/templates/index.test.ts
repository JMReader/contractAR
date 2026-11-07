import { describe, expect, it } from "vitest";
import { AgreementState, Template } from "@contractar/shared";
import { engineTransitions, getSettlementLabel, getTemplate, isValidAmountARS, templateRegistry } from "./index";

describe("plantillas sobre el mismo motor", () => {
  it.each([
    [Template.Guarantee, "Rentadora", "Cliente", "refund"],
    [Template.Sale, "Vendedor", "Comprador", "release"],
  ] as const)("asigna roles y salida sugerida de %s", (id, beneficiary, depositor, outcome) => {
    const template = getTemplate(id);
    expect(template.id).toBe(id);
    expect(template.roles.creator).toBe(beneficiary);
    expect(template.roles.beneficiary).toBe(beneficiary);
    expect(template.roles.depositor).toBe(depositor);
    expect(template.defaultOutcome).toBe(outcome);
    expect(template.currency).toBe("ARS");
    expect(template.amountUnit).toBe("centavos");
    for (const state of Object.values(AgreementState).filter((value) => typeof value === "number")) {
      expect(template.states[state]).toBeTruthy();
    }
    for (const step of Object.values(template.steps)) {
      expect(step.help).toBeTruthy();
      expect(step.cta).toBeTruthy();
      if (step.action !== null && step.action !== "create") {
        expect(engineTransitions[step.action].actors).toContain(step.actor);
      }
    }
    expect(template.fields.find((field) => field.key === "amountARS")?.input).toBe("amountARS");
    expect(new Set(template.fields.map((field) => field.key)).size).toBe(template.fields.length);
  });

  it("B-01: entregar propone; confirmar por la contraparte liquida", () => {
    const sale = getTemplate(Template.Sale);
    expect(sale.steps.accept.actor).toBe("depositor");
    expect(sale.steps.fund.actor).toBe("depositor");
    expect(sale.steps.deliver).toMatchObject({ actor: "beneficiary", action: "proposeOutcome" });
    expect(sale.steps.confirm).toMatchObject({ actor: "depositor", action: "acceptOutcome" });
    expect(engineTransitions.accept).toMatchObject({ from: [AgreementState.Created], to: AgreementState.Accepted, actors: ["depositor"] });
    expect(engineTransitions.fund).toMatchObject({ from: [AgreementState.Accepted], to: AgreementState.Funded, actors: ["depositor"] });
    expect(engineTransitions.proposeOutcome.from).toContain(AgreementState.Funded);
    expect(engineTransitions.proposeOutcome.to).toBe(AgreementState.OutcomeProposed);
    expect(engineTransitions.acceptOutcome).toMatchObject({ from: [AgreementState.OutcomeProposed], to: AgreementState.Settled });
    expect(engineTransitions.acceptOutcome.help).toContain("Quien propuso no puede confirmarla");
    expect(sale.steps.collect.action).toBeNull();
    expect(sale.steps.withdraw.action).toBeNull();
  });

  it("B-02: disputa bloquea propuestas y devolución por plazo; sólo árbitro resuelve", () => {
    expect(engineTransitions.dispute.to).toBe(AgreementState.Disputed);
    expect(engineTransitions.rule).toMatchObject({ from: [AgreementState.Disputed], to: AgreementState.Settled, actors: ["arbiter"] });
    for (const action of ["fund", "proposeOutcome", "acceptOutcome", "refundAfterTimeout"] as const) {
      expect(engineTransitions[action].from).not.toContain(AgreementState.Disputed);
      expect(engineTransitions[action].from).not.toContain(AgreementState.Settled);
      expect(engineTransitions[action].from).not.toContain(AgreementState.Cancelled);
    }
    expect(engineTransitions.refundAfterTimeout.actors).toEqual(["depositor"]);
  });

  it.each(Object.values(templateRegistry))("incluye avisos obligatorios en $title", (template) => {
    for (const disclaimer of template.disclaimers) expect(template.defaultTerms).toContain(disclaimer);
    expect(template.defaultTerms).toContain("No se realizan transferencias bancarias reales");
    expect(template.defaultTerms).toContain("árbitro de demo");
    expect(template.defaultTerms).toContain("1%");
    expect(template.defaultTerms).toContain("las devoluciones no tienen ese costo");
    const userCopy = JSON.stringify(template.fields) + template.defaultTerms + JSON.stringify(template.states) + JSON.stringify(template.steps);
    expect(userCopy).not.toMatch(/\b(token|wallet|gas|blockchain|fuji|avax|tARGt)\b/i);
  });

  it("B-01: no promete autenticidad ni acceso", () => {
    expect(getTemplate(Template.Sale).defaultTerms).toContain("ContractAR no certifica la autenticidad de la entrada ni garantiza el acceso al evento.");
  });

  it.each([1, 100, 12_000_000, Number.MAX_SAFE_INTEGER])("acepta %s centavos enteros", (amount) => {
    expect(isValidAmountARS(amount)).toBe(true);
  });

  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])("rechaza importe inválido %s", (amount) => {
    expect(isValidAmountARS(amount)).toBe(false);
  });

  it("B-03: identifica destinatarios reales incluso por debajo de un centavo", () => {
    expect(getSettlementLabel(Template.Sale, 0n, 1n)).toBe("Devolución total al comprador");
    expect(getSettlementLabel(Template.Sale, 1n, 0n)).toBe("Pago al vendedor");
    expect(getSettlementLabel(Template.Sale, 1n, 2n)).toBe("Pago al vendedor y devolución al comprador");
    expect(getSettlementLabel(Template.Guarantee, 0n, 600n)).toBe("Devolución total al cliente");
    expect(getSettlementLabel(Template.Guarantee, 180n, 420n)).toBe("Pago a la rentadora y devolución al cliente");
    expect(getTemplate(Template.Sale).states[AgreementState.Settled]).not.toContain("vendedor");
    expect(() => getSettlementLabel(Template.Sale, -1n, 2n)).toThrow(RangeError);
    expect(() => getSettlementLabel(Template.Sale, 0n, 0n)).toThrow(RangeError);
  });
});
