# Design System

Central tokens for the Detail Command luxury surface. Import from `@/design-system` for the common cases; import directly from `./z-index`, `./motion`, or `./surfaces` if you only need one module.

## Modules

### `z-index.ts` — stacking hierarchy

Every fixed / absolute / sticky surface that competes for z-index references one of the named constants in `Z`. The mirrored `Z_CLASS` exports the same layers as Tailwind class strings so the JIT can statically purge them.

```tsx
import { Z, Z_CLASS } from "@/design-system";

<header className={`fixed inset-x-0 top-0 ${Z_CLASS.nav}`} />
// or, for inline styles:
<div style={{ zIndex: Z.nav }} />
```

**Hierarchy** (back → front):

| Token | Value | Role |
|---|---|---|
| `underlay` | -10 | Decorative gradients beneath card content |
| `base` | 0 | Page atmosphere (grids, weaves, grain) |
| `plate` | 1 | Hero photographic plate |
| `ambient` | 2 | Fog, particles, scanline |
| `accent` | 3 | MouseSpotlight, EmberOrb, vignette |
| `content` | 10 | Editorial text / CTAs |
| `bleed` | 15 | Section bottom-bleed gradient |
| `cue` | 20 | Static scroll cue |
| `navInternal` | 30 | Sticky sub-nav inside a page |
| `dock` | 40 | MobileBookDock |
| `nav` | 50 | Primary fixed TopNav |
| `scrollProgress` | 55 | Top-edge progress bar |
| `navOverlay` | 60 | Returning-customer ribbon, mobile menu drawer |
| `modal` | 100 | Modals / overlays |
| `boot` | 200 | Boot intro splash |

### `motion.ts` — easing + duration

Cubic-bezier tuples + duration constants for framer-motion. `TRANSITIONS` provides composed presets for the most common patterns. `stagger(i)` returns capped per-index delay.

```tsx
import { TRANSITIONS, EASING, DURATION, stagger } from "@/design-system";

<motion.div transition={TRANSITIONS.reveal} />
<motion.div transition={{ duration: DURATION.measured, ease: EASING.settle, delay: stagger(i) }} />
```

**Easing roles**:
- `settle` — the "luxury settle" curve, default reveal
- `swift` — sharper exit (fade-ins, modals)
- `pulse` — symmetric breath (orb, ember pulse)
- `sheen` — material curve (specular sweep)
- `ambient` — `"easeInOut"` for fog drifts

### `surfaces.ts` — glass / gradient / shadow tokens

Class strings (`SURFACES`) for glass panels. Pure CSS strings (`GRADIENTS`, `SHADOWS`) for inline backgrounds + box-shadows.

```tsx
import { SURFACES, GRADIENTS, SHADOWS } from "@/design-system";

<div className={`${SURFACES.glassPanel} p-5`}>...</div>
<div style={{ background: GRADIENTS.atmosphere }}>...</div>
<div style={{ boxShadow: SHADOWS.selectedSlot }}>...</div>
```

## Migration rules

- **No new inline z-index values** — add a named layer to `Z` instead.
- **No new inline cubic-bezier tuples** — pick the closest `EASING` role, or add one with a clear name.
- **Add tokens lazily** — only promote a value to a token once it's repeated. One-offs stay inline.

## What this isn't

Not a wholesale UI library. Components like `EmberCTA`, `GlassCTA`, `Hairline`, etc. live in `src/components/booking/luxury/primitives.tsx`. The design system provides *primitives that those components consume*, not the components themselves.
