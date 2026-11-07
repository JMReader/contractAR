---
name: gsap-react
description: Official GSAP skill for React — useGSAP hook, refs, gsap.context(), cleanup. Use when the user wants animation in React or Next.js, or asks about GSAP with React, useGSAP, or cleanup on unmount.
license: MIT
---

## When to Use This Skill
Apply when writing or reviewing GSAP code in React or Next.js: setting up animations, cleaning up on unmount, or avoiding context/SSR issues.

**Related skills:** For tweens and timelines use **gsap-core** and **gsap-timeline**.

## Installation
```bash
npm install gsap
npm install @gsap/react
```

## Prefer useGSAP() Hook
```javascript
import { useGSAP } from "@gsap/react";
gsap.registerPlugin(useGSAP);

const containerRef = useRef(null);

useGSAP(() => {
  gsap.to(".box", { x: 100 });
  gsap.from(".item", { opacity: 0, stagger: 0.1 });
}, { scope: containerRef });
```

- ✅ Pass a **scope** ref so selectors are scoped to that root.
- ✅ Cleanup runs automatically on unmount.
- ✅ Use **contextSafe** for callbacks created after the hook runs.

## With Dependencies
```javascript
useGSAP(() => {
  // gsap code
}, {
  dependencies: [endX],
  scope: container,
  revertOnUpdate: true
});
```

## gsap.context() in useEffect (fallback)
```javascript
useEffect(() => {
  const ctx = gsap.context(() => {
    gsap.to(".box", { x: 100 });
  }, containerRef);
  return () => ctx.revert(); // always cleanup
}, []);
```

## Context-Safe Callbacks
```javascript
useGSAP((context, contextSafe) => {
  gsap.to(ref.current, { x: 100 });

  const onClick = contextSafe(() => {
    gsap.to(ref.current, { rotation: 180 });
  });
  ref.current.addEventListener("click", onClick);
  return () => ref.current.removeEventListener("click", onClick);
}, { scope: container });
```

## SSR (Next.js)
- Use **useGSAP** or **useEffect** — GSAP runs only on the client.
- Do not call `gsap.*` or `ScrollTrigger.*` during server render.

## Best Practices
- ✅ Prefer `useGSAP()` from `@gsap/react`.
- ✅ Always pass a `scope` ref.
- ✅ Run GSAP only on the client.
- ❌ Target by selector without a scope.
- ❌ Skip cleanup — always revert context or kill tweens on unmount.
- ❌ Run GSAP during SSR.
