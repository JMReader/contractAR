---
name: spec-frontend-craft-flow
description: "Create distinctive, human-crafted frontend interfaces using a gated Markdown spec-first workflow: (1) scan repo context & design tokens, (2) produce functional-spec.md (UX flows, aesthetic persona, state catalog), (3) produce technical-spec.md (anti-AI-slop design direction, curated typography, refined minimalism, GSAP motion choreography, component architecture, a11y), (4) produce todos.md, then implement only after explicit approval at each gate. Use when designing and building web components, landing pages, interactive apps, or UI features with high aesthetic quality and orchestrated animation."
---

# Spec Frontend Craft Flow (Markdown-Gated Workflow)

## Overview
Create production-grade, aesthetically distinctive frontend interfaces that feel genuinely designed by human art directors, completely avoiding generic "AI slop" (cliché purple gradients, default Inter/Roboto fonts, cookie-cutter centered cards).

This workflow enforces human-in-the-loop review through readable Markdown files:
`functional-spec.md` ➔ `technical-spec.md` ➔ `todos.md` ➔ `Code implementation`.

**Treat each document as an approval gate. Never skip gates or implement code without explicit user confirmation.**

---

## Core Aesthetics & Motion Foundations
Every feature planned with this skill must integrate principles from `/frontend-design` and `/gsap-core`:

1. **Refined Minimalism with Character (Anti-AI Aesthetic)**:
   - **Curated Typography**: Pair a distinctive display/headline font with a refined, highly readable body font. Never default to generic system fonts, standard Arial, or overused Inter without deliberate reason.
   - **Palette with Point-of-View**: Dominant muted/architectural surfaces with a single sharp, high-contrast accent. Define strict CSS variables.
   - **Composition**: Asymmetric layouts, unexpected alignments, generous whitespace or controlled editorial density.
   - **Atmosphere & Depth**: Subtle grain/noise overlays, hairline geometric borders (`1px solid var(--border)`), and crisp tactile micro-details.

2. **Choreographed Motion with GSAP**:
   - **One Orchestrated Entrance**: Prioritize a sequenced page/component reveal with `stagger` and natural easing over scattered, chaotic micro-animations.
   - **High-Performance Transforms**: Animate only GPU-accelerated properties using transform aliases (`x`, `y`, `scale`, `rotation`).
   - **Visibility & Rendering**: Use `autoAlpha` instead of `opacity` (automatically toggles `visibility: hidden` when 0).
   - **Natural Physics**: Use organic easing (`power2.out`, `power3.out`, `expo.out`).
   - **Accessibility & Responsiveness**: Obligatory use of `gsap.matchMedia()` with a dedicated condition for `(prefers-reduced-motion: reduce)`.

---

## Mandatory Sequence

### Step 0: Context Scan
Inspect the frontend environment before making design decisions:
- **Framework & Setup**: Next.js, React, Vue, Svelte, Astro, or Vanilla HTML/CSS/JS.
- **Styling Engine**: Tailwind CSS, CSS Modules, Styled Components, vanilla CSS variables.
- **Assets & Typography**: Available fonts in `index.html` or font loaders (`next/font`), SVG icon set, existing design tokens.
- **Animation Libraries**: Confirm `@gsap` or `gsap` presence (or plan its lightweight import).

### Step 1: Draft `functional-spec.md`
Define the user experience, aesthetic intention, and interface state matrix.

**Include:**
- **Aesthetic Persona & Tone**: The chosen design archetype (e.g., *Swiss Technical Minimalism*, *Refined Editorial*, *Monochrome Architectural*, *Nordic Clean*).
- **Visual Hierarchy & Scanning Pattern**: Where the user's eye lands first, second, and third.
- **User Journeys & Interactions**: User flow through the interface.
- **Complete UI State Catalog**:
  - Initial / Entrance state.
  - Populated state.
  - Loading & Skeleton state.
  - Empty state (designed with purpose, not just blank).
  - Error and edge-case state.
  - Interactive states (Hover, Focus accessible, Active).

**Do NOT include:**
- Component file paths or framework-specific hooks.
- Raw CSS properties or GSAP code syntax.

### GATE 1: STOP
Ask the user explicitly in chat:
> *"He redactado el documento `specs/frontend/<feature-id>/functional-spec.md` con la dirección estética y el flujo de usuario. ¿Lo apruebas para proceder al diseño técnico o deseas ajustar el tono visual?"*

---

### Step 2: Draft `technical-spec.md`
Define the technical design system, component hierarchy, and GSAP animation script.

**Include:**
1. **Design Tokens & System**:
   - Font family definitions (`--font-display`, `--font-body`).
   - Color variables (`--bg`, `--surface`, `--text-primary`, `--text-muted`, `--accent`, `--border`).
   - Elevation, hairline borders, and texture overlays.
2. **Component Architecture & State**:
   - Component tree and props contracts.
   - Client state vs Server/Async state management.
3. **GSAP Motion Choreography (Motion Specification)**:
   - **Entrance Timeline**: Sequence of element reveals, durations (default ~0.6s - 0.8s), stagger interval (e.g. `0.08s`), and ease curve.
   - **Micro-Interactions**: Hover / click animations (e.g., button scale, card highlight, arrow translate).
   - **Reduced Motion Fallback**: Behavior when `prefers-reduced-motion: reduce` is detected (immediate visibility, duration 0).
4. **Accessibility (a11y) & Semantic Markup**:
   - Landmark elements (`<main>`, `<nav>`, `<section>`, `<header>`).
   - WAI-ARIA roles, live regions for dynamic updates, keyboard navigation, and focus ring styling.

### GATE 2: STOP
Ask the user explicitly in chat:
> *"He redactado `specs/frontend/<feature-id>/technical-spec.md` con los tokens de diseño, arquitectura y la coreografía GSAP. ¿Lo apruebas para generar el plan de ejecución de tareas?"*

---

### Step 3: Draft `todos.md`
Create a layered implementation plan:
- Task ID (e.g., `[F-01]`, `[F-02]`).
- Explicit target files.
- `Depends on` and `Parallelizable: true|false`.
- Exit criteria.

**Layered Execution Order:**
1. **Tokens & Base Layout**: Semantic HTML structure + CSS variables + typography pairing.
2. **Component Logic & Dynamic State**: Interactive state, props, data binding.
3. **GSAP Animation Core**: Entrance timeline, staggers, and microinteractions.
4. **Refined Craft Polish**: Grain/noise overlays, hairline borders, responsive fine-tuning.
5. **a11y & Reduced-Motion Audit**: Keyboard testing, screen reader landmarks, and reduced-motion verification.

### GATE 3: STOP
Ask the user explicitly in chat:
> *"He generado el plan de tareas en `specs/frontend/<feature-id>/todos.md`. ¿Confirmas tu aprobación para iniciar la implementación del código?"*

---

## File Path Convention
Save all specs in:
- `specs/frontend/<feature-id>/functional-spec.md`
- `specs/frontend/<feature-id>/technical-spec.md`
- `specs/frontend/<feature-id>/todos.md`

Replace `<feature-id>` with the kebab-case identifier (e.g., `pricing-editorial-table`, `checkout-glass-panel`, `hero-minimal-showcase`).
