# Frontend Craft Specification Templates

Use these Markdown templates to design distinctive, anti-AI-slop frontend experiences with GSAP animation choreography.

---

## 1. Template: `functional-spec.md`

```markdown
# Functional Specification: [Feature Name]

**Feature ID:** `[feature-slug]`  
**Status:** `Draft` | `Pending Approval` | `Approved`  
**Date:** [YYYY-MM-DD]  

---

## 1. Declaración de Dirección de Arte & Tono (Anti-AI Slop)
- **Arquetipo Estético:** [Ej: *Minimalismo Técnico Suizo* / *Editorial Monocromático de Lujo* / *Neo-Brutalismo Refinado*]
- **Sensación Buscada:** [Ej: Precisión milimétrica, tactilidad analógica, ritmo calmado y premium]
- **Elementos Prohibidos:** [Ej: NINGÚN degradado morado genérico, ninguna tarjeta flotante con sombras desenfocadas estándar, nada de tipografías genéricas sin justificación]

## 2. Jerarquía Visual y Escaneo del Ojo
1. **Punto Focal Primario:** [Elemento donde el ojo debe aterrizar primero: ej. Número métrico gigante o titular asimétrico]
2. **Punto Secundario:** [Detalle complementario o selector]
3. **Punto Terciario / Cierre:** [Acción de llamada / botón de confirmación con micro-acento]

## 3. Flujo y Viaje de Interacción
1. **Entrada:** El usuario accede a la vista; la interfaz no parpadea, sino que se revela con serenidad coreografiada.
2. **Exploración:** Interacción con los elementos clave.
3. **Acción:** Envío o selección que produce retroalimentación táctil inmediata.

## 4. Matriz de Estados de la Interfaz
| Estado | Comportamiento Visual | Feedback al Usuario |
| :--- | :--- | :--- |
| **Inicial / Carga** | Skeleton sutil o loader con tipografía editorial | Pulso calmado sin saltos de layout |
| **Poblado (Normal)** | Tipografía nítida, generoso espacio negativo | Jerarquía de lectura clara |
| **Vacío (Empty)** | Ilustración geométrica o tipografía sobria deliberada | Explicación clara sin sensación de error |
| **Hover / Focus** | Micro-desplazamiento de acento, bordes afilados | Confirmación de foco navegable por teclado |
| **Error** | Borde de acento de contraste alto con mensaje conciso | Indicación directa del campo a corregir |
```

---

## 2. Template: `technical-spec.md`

```markdown
# Technical Specification: [Feature Name]

**Feature ID:** `[feature-slug]`  
**Status:** `Draft` | `Pending Approval` | `Approved`  
**Tech Stack:** [Ej: Next.js + Tailwind CSS / Vanilla React + CSS Modules]  
**Animation Engine:** `GSAP Core`  

---

## 1. Sistema de Diseño & Tokens de Identidad
### Tipografía Curada
- **Display / Títulos:** `'Syne', sans-serif` o `'Cabinet Grotesk', sans-serif` (Carácter geométrico fuerte)
- **Body / Lectura:** `'Plus Jakarta Sans', sans-serif` o `'General Sans', sans-serif` (Legibilidad técnica)

### Variables CSS
```css
:root {
  --bg: #0c0d0e;
  --surface: #141618;
  --surface-hover: #1c1f22;
  --border-hairline: rgba(255, 255, 255, 0.08);
  --border-focus: rgba(255, 255, 255, 0.3);
  --text-primary: #f2f3f5;
  --text-muted: #8b9098;
  --accent: #ff4d2e; /* Acento vibrante y quirúrgico */
}
```

### Atmósfera y Textura
- Micro-ruido de fondo en SVG inline (`data:image/svg+xml...`) con opacidad del 3%.
- Bordes nítidos de `1px solid var(--border-hairline)`.

---

## 2. Arquitectura de Componentes
```text
src/components/[feature-slug]/
├── [FeatureContainer].tsx      # Contenedor orquestador, contexto y timeline GSAP
├── [FeatureHeader].tsx         # Título asimétrico con tipografía display
├── [FeatureCard].tsx           # Componente interactivo con micro-hover
└── [FeatureSkeleton].tsx       # Estado de carga con misma geometría
```

---

## 3. Coreografía de Movimiento GSAP (Motion Spec)
### Timeline de Entrada (Entrance Orchestration)
```javascript
// Especificación de la escena de entrada
const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

tl.fromTo(
  ".stagger-header",
  { autoAlpha: 0, y: 24 },
  { autoAlpha: 1, y: 0, duration: 0.7 }
)
.fromTo(
  ".stagger-card",
  { autoAlpha: 0, y: 32 },
  { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.08 },
  "-=0.4"
);
```

### Reglas Técnicas de GSAP:
- **`autoAlpha`**: Se usa estrictamente en lugar de `opacity` para evitar renderizar elementos ocultos en el DOM.
- **Transforms acelerados**: Animar únicamente `x`, `y`, `scale` y `rotation`. Jamás animar `width`, `height`, `top` o `left`.
- **Eases preferidos**: `"power2.out"`, `"power3.out"`, `"expo.out"`.

### Fallback para `prefers-reduced-motion`
```javascript
const mm = gsap.matchMedia();

mm.add({
  motionAllowed: "(prefers-reduced-motion: no-preference)",
  reducedMotion: "(prefers-reduced-motion: reduce)"
}, (context) => {
  const { reducedMotion } = context.conditions;

  if (reducedMotion) {
    // Revelar instantáneamente sin desplazamiento
    gsap.set([".stagger-header", ".stagger-card"], { autoAlpha: 1, y: 0 });
  } else {
    // Ejecutar timeline completo orquestado
    runEntranceTimeline();
  }
});
```

---

## 4. Accesibilidad (a11y) & Estándares
- **Semántica:** Uso estricto de `<main>`, `<article>`, `<button>` nativo (evitar divs con onClick).
- **Contraste:** Ratio de contraste verificado > 4.5:1 para texto normal y > 3:1 para acentos.
- **Teclado:** Anillo de foco personalizado con `focus-visible: outline-2 outline-accent`.
```

---

## 3. Template: `todos.md`

```markdown
# Execution Todos: [Feature Name]

**Feature ID:** `[feature-slug]`  
**Status:** `Pending Approval` | `In Progress` | `Completed`  

---

## Tareas de Implementación (Capas de Refinamiento)

### Capa 1: Tokens y Estructura Semántica Base
- [ ] **[F-01]** Definir variables CSS y carga de fuentes tipográficas en `src/styles/...`
  - *Depends on:* Ninguno
  - *Parallelizable:* No
  - *Exit criteria:* Variables visuales operativas y tipografías renderizando correctamente.
- [ ] **[F-02]** Construir markup semántico HTML5 sin estilos complejos en `src/components/...`
  - *Depends on:* `[F-01]`
  - *Parallelizable:* No
  - *Exit criteria:* Documento estructurado con landmarks accesibles (`<header>`, `<section>`, etc.).

### Capa 2: Composición Visual, Spacing y Estados
- [ ] **[F-03]** Aplicar maquetación asimétrica, espacio negativo y bordes de textura
  - *Depends on:* `[F-02]`
  - *Parallelizable:* No
  - *Exit criteria:* Interfaz fiel a la dirección estética en viewport desktop y mobile.
- [ ] **[F-04]** Implementar estados interactivos de datos (Loading, Populated, Empty)
  - *Depends on:* `[F-03]`
  - *Parallelizable:* Sí
  - *Exit criteria:* Transición limpia entre datos vacíos y datos cargados.

### Capa 3: Coreografía GSAP y Micro-Interacciones
- [ ] **[F-05]** Configurar timeline de entrada con `stagger`, `autoAlpha` y easing natural
  - *Depends on:* `[F-03]`
  - *Parallelizable:* No
  - *Exit criteria:* Los elementos se revelan fluidamente sin saltos visuales ni repintados costosos.
- [ ] **[F-06]** Integrar micro-animaciones en hover/focus táctiles
  - *Depends on:* `[F-05]`
  - *Parallelizable:* Sí
  - *Exit criteria:* Respuestas reactivas suaves con reversión limpia (`gsap.to()`).

### Capa 4: Accesibilidad, Reduced-Motion y Pulido Final
- [ ] **[F-07]** Implementar `gsap.matchMedia()` para `prefers-reduced-motion`
  - *Depends on:* `[F-05]`, `[F-06]`
  - *Parallelizable:* No
  - *Exit criteria:* Con `prefers-reduced-motion` activado en el sistema, todo el contenido es visible de inmediato sin animaciones.
- [ ] **[F-08]** Auditoría de teclado y a11y (focus-visible, contrastes, tab-index)
  - *Depends on:* `[F-07]`
  - *Parallelizable:* No
  - *Exit criteria:* Navegación 100% usable con teclado sin trampas de foco.
```
