### Task 1: CSS foundation for PackageLoader

**Files:**
- Modify: `frontend/src/index.css` (append at end of file)

**Interfaces:**
- Produces: CSS classes `.pb-loader`, `.pb-loader--sm|md|lg`, `.pb-loader--fullscreen`, `.pb-loader--phase-arrive|transform|load|complete|fade`, `.pb-loader__stage`, `.pb-loader__box`, `.pb-loader__box--open`, `.pb-loader__stripes`, `.pb-loader__stripe`, `.pb-loader__ring`, `.pb-loader__burst`, `.pb-loader__label`, `.pb-loader--reduced`

- [ ] **Step 1: Append loader CSS**

Append to `frontend/src/index.css`:

```css
/* â€”â€” PackageLoader â€”â€” */
.pb-loader {
  --pb-green: var(--color-boss-green);
  --pb-gold: var(--color-boss-gold);
  --pb-size: 120px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
}

.pb-loader--sm { --pb-size: 72px; }
.pb-loader--md { --pb-size: 120px; }
.pb-loader--lg { --pb-size: 160px; }

.pb-loader--fullscreen {
  min-height: 40vh;
  width: 100%;
}

.pb-loader__stage {
  position: relative;
  width: var(--pb-size);
  height: var(--pb-size);
}

.pb-loader__stage svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.pb-loader__label {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-muted);
}

/* Box slide-in */
.pb-loader--phase-arrive .pb-loader__box {
  animation: pb-loader-arrive 0.6s ease-out both;
}

@keyframes pb-loader-arrive {
  from { transform: translateX(-42%); opacity: 0.35; }
  to { transform: translateX(0); opacity: 1; }
}

/* Stripes: horizontal in arrive â†’ arc slots in transform â†’ hidden when ring owns motion */
.pb-loader__stripes {
  transform-origin: 50% 50%;
}

.pb-loader--phase-arrive .pb-loader__stripes {
  opacity: 1;
}

.pb-loader--phase-transform .pb-loader__stripes {
  animation: pb-loader-stripes-curl 0.5s ease-in-out both;
}

.pb-loader--phase-load .pb-loader__stripes,
.pb-loader--phase-complete .pb-loader__stripes,
.pb-loader--phase-fade .pb-loader__stripes {
  opacity: 0;
  pointer-events: none;
}

@keyframes pb-loader-stripes-curl {
  from { opacity: 1; transform: scaleX(1) rotate(0deg); }
  to { opacity: 0; transform: scaleX(0.35) rotate(-55deg); }
}

/* Ring appears after transform; spins during load */
.pb-loader__ring {
  transform-origin: 50% 50%;
  opacity: 0;
}

.pb-loader--phase-transform .pb-loader__ring {
  animation: pb-loader-ring-in 0.5s ease-out both;
}

.pb-loader--phase-load .pb-loader__ring {
  opacity: 1;
  animation: pb-loader-spin 1.05s linear infinite;
}

.pb-loader--phase-complete .pb-loader__ring,
.pb-loader--phase-fade .pb-loader__ring {
  animation: pb-loader-ring-out 0.35s ease-in both;
}

@keyframes pb-loader-ring-in {
  from { opacity: 0; transform: scale(0.7) rotate(-40deg); }
  to { opacity: 1; transform: scale(1) rotate(0deg); }
}

@keyframes pb-loader-spin {
  to { transform: rotate(360deg); }
}

@keyframes pb-loader-ring-out {
  to { opacity: 0; transform: scale(1.08); }
}

/* Closed vs open box */
.pb-loader__box-open {
  opacity: 0;
}

.pb-loader--phase-complete .pb-loader__box-closed {
  opacity: 0;
  transition: opacity 0.15s ease;
}

.pb-loader--phase-complete .pb-loader__box-open {
  opacity: 1;
  animation: pb-loader-pop 0.45s cubic-bezier(0.2, 1.4, 0.4, 1) both;
}

@keyframes pb-loader-pop {
  from { transform: scale(0.92); }
  60% { transform: scale(1.06); }
  to { transform: scale(1); }
}

.pb-loader__burst {
  opacity: 0;
  transform-origin: 50% 40%;
}

.pb-loader--phase-complete .pb-loader__burst {
  animation: pb-loader-burst 0.7s ease-out both;
}

@keyframes pb-loader-burst {
  0% { opacity: 0; transform: scale(0.4); }
  35% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(1.25); }
}

.pb-loader--phase-fade {
  animation: pb-loader-fade 0.4s ease-in both;
}

@keyframes pb-loader-fade {
  to { opacity: 0; }
}

.pb-loader__shadow {
  fill: rgb(15 23 42 / 0.18);
}

:root.dark .pb-loader__shadow,
.dark .pb-loader__shadow {
  fill: rgb(0 0 0 / 0.45);
}

@media (prefers-reduced-motion: reduce) {
  .pb-loader--reduced .pb-loader__box,
  .pb-loader--reduced .pb-loader__stripes,
  .pb-loader--reduced .pb-loader__ring,
  .pb-loader--reduced .pb-loader__burst {
    animation: none !important;
  }

  .pb-loader--reduced.pb-loader--phase-arrive .pb-loader__box,
  .pb-loader--reduced.pb-loader--phase-transform .pb-loader__box,
  .pb-loader--reduced.pb-loader--phase-load .pb-loader__box {
    animation: pb-loader-pulse 1.2s ease-in-out infinite !important;
  }

  .pb-loader--reduced .pb-loader__stripes,
  .pb-loader--reduced .pb-loader__ring,
  .pb-loader--reduced .pb-loader__burst {
    opacity: 0 !important;
  }

  .pb-loader--reduced.pb-loader--phase-complete .pb-loader__box-closed {
    opacity: 0;
  }

  .pb-loader--reduced.pb-loader--phase-complete .pb-loader__box-open {
    opacity: 1;
  }
}

@keyframes pb-loader-pulse {
  0%, 100% { opacity: 0.55; }
  50% { opacity: 1; }
}
```

- [ ] **Step 2: Confirm CSS parses with the app**

Run from `frontend`: `npx vite build` is heavy; instead open `index.css` and ensure no unclosed braces. Optionally run:

```bash
cd frontend
npx tsc -b --pretty false --noEmit
```

Expected: PASS (CSS not typechecked; this just confirms repo still clean).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/index.css
git commit -m "Add PackageLoader CSS phase keyframes."
```

---

