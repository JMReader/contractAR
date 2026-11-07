---
name: bencho-contractar
description: Importar bloques de Bencho, incluidos Pro con acceso autorizado, y adaptarlos al sistema visual de ContractAR en web o a un equivalente nativo. Usar al pedir componentes Bencho para una pantalla concreta.
---

# Bencho para ContractAR

Convertir un bloque seleccionado en un componente integrado y probado. El sitio de referencia es https://bencho.dev/. Esta skill define un procedimiento de importación; no incluye acceso Pro, credenciales ni un descargador de endpoints privados.

## Resolver proyecto y diseño

Leer AGENTS.md, el package.json y lockfile del proyecto destino, y el DESIGN.md vigente de ContractAR. Si está en el cerebro, resolverlo mediante brain.yaml y comprobar identidad del vault. No confundir el HTML de propuesta con componentes implementados. Identificar la pantalla, la interacción y la plataforma: Next.js web o React Native.

Preferir un bloque que resuelva el caso concreto: Copy field para compartir; Checklist para aceptación explícita; Progress tracker para etapas; Pay button para revisión y feedback; Upload dropzone para evidencia. No importar catálogos completos.

## Obtener el bloque autorizado

1. Abrir la página real del bloque y revisar su descripción, requisitos y licencia vigente. No inventar rutas de descarga ni asumir permisos por el nombre Pro.
2. Usar el mecanismo oficial de copia/exportación/descarga disponible con la sesión autorizada del usuario, mediante navegador o conector disponible. También admitir un export proporcionado por el usuario o un archivo local obtenido legítimamente. No extraer cookies ni persistir credenciales en el repo.
3. Si falta sesión o acceso Pro, pedir al usuario que complete la autenticación o facilite el export autorizado. No comprar una suscripción, aceptar términos en su nombre ni intentar eludir el control de acceso. Se puede avanzar con tokens y análisis de integración mientras el acceso esté pendiente; no afirmar que se descargó el original.
4. Revisar el código y assets antes de ejecutar instaladores o comandos. Comprobar imports, paquetes, archivos auxiliares, URLs remotas, fuentes y avisos de licencia. No reconstruir el fuente Pro desde bundles servidos por la demo.
5. Registrar en la documentación del proyecto: URL exacta del bloque, fecha, mecanismo de obtención sin secretos, licencia o condiciones observadas, archivos destino y modificaciones. Distribuir código original o adaptado sólo en destinos permitidos por la licencia; un repo público requiere verificar esa condición antes de commitear el bloque. El cerebro puede guardar el registro sin contener el fuente Pro.

## Adaptar a nuestra UI

- Reutilizar tokens vigentes: fondo oscuro, superficie, cobalt para acciones, texto claro, verde y coral semánticos. Mantener contraste, foco visible y estado textual.
- Usar la tipografía y geometría del DESIGN.md y las primitivas existentes; preservar atribuciones y comentarios exigidos por la licencia.
- Conservar la interacción que aporta valor, eliminando decoración o dependencias que no necesita la pantalla. No reescribir el bloque sólo por estilo.
- Evitar dependencias de hover en celular; incluir teclado, tacto, etiquetas, errores, carga y movimiento reducido. Definir props tipadas y separar presentación de lógica de dominio.
- Para React Native, comprobar si el bloque usa DOM, CSS, canvas o librerías web. Si es incompatible, crear un equivalente con primitivas nativas manteniendo el comportamiento; no anunciar que el componente web fue instalado como nativo.
- En operaciones financieras, la animación no determina el resultado: el estado lo proporciona el flujo real. Mantener revisión y consentimiento explícitos; nunca disparar un movimiento por hover, swipe o finalización de una animación.
- Para identidad, coordinar con las piezas de Octa; no introducir escenas ASCII/3D dentro de una confirmación de dinero. Usar sólo las librerías necesarias y las versiones compatibles con el lockfile.

## Skills y verificaciones

Si están disponibles en el proyecto, aplicar frontend-design para composición, shadcn/ui-styling para primitivas, antislop-human y antislop-layoutmobile para interacción accesible, web-perf para carga y gsap-react para animaciones GSAP en React. Leer sólo las relevantes a la pieza solicitada.

Ejecutar build/typecheck/lint disponibles y las verificaciones proporcionadas al riesgo de la adaptación. Revisar en navegador a ancho móvil y escritorio, teclado y movimiento reducido. Probar la interacción principal, error y carga; validar contraste de las combinaciones cambiadas. Para móvil nativo, verificar en un runtime/emulador disponible o declarar esa limitación.

Entregar componente y archivos modificados, origen del bloque, qué se adaptó, dependencias añadidas y resultados reales de verificación. Distinguir original importado, recreación conceptual y equivalente nativo. No publicar, desplegar ni ampliar permisos por el solo hecho de usar esta skill.
