# contractAR

Pagos protegidos para acuerdos cotidianos: las partes aceptan reglas, bloquean un token ERC-20 de prueba y liberan, devuelven o disputan los fondos según el estado del acuerdo.

## Estructura inicial

- `apps/web/`: frontend Next.js.
- `services/api/`: backend Python/FastAPI para acuerdos, enlaces y datos no financieros.
- `contracts/`: contratos Solidity y pruebas.
- `docs/`: backlog inicial de frontend y backend.

El contrato onchain es la fuente de verdad sobre los fondos. No usar ARGt real hasta confirmar red, token y condiciones de integración.

## Trabajo del equipo

El board está en [Issue #1](https://github.com/JMReader/contractAR/issues/1). Asociar cada trabajo a ese issue o a un issue hijo, y abrir PRs contra este repositorio.
