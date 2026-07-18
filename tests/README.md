# Visual & layout regression tests

Two suites, one goal: the site keeps looking the way it was approved, at every
viewport, without anyone having to eyeball it.

## The suites

- **`visual.spec.ts`** — pixel comparison against blessed baselines in
  `__screenshots__/`. Covers all 11 snap stops of the home hero sweep plus a
  full-page shot of every other route, at 5 viewports (360×800, 768×1024,
  1366×768, 1920×1080, 3440×1440). A failure means some viewport no longer
  renders identically to its baseline; the HTML report shows expected /
  actual / diff side by side.
- **`layout.spec.ts`** — geometry rules that must hold everywhere: no
  horizontal overflow on any route, header visible, hero intro and every
  system panel fully inside the viewport at their scroll stops. No baselines,
  so this suite is platform-independent and runs in CI on every push
  (`.github/workflows/e2e.yml`).

## Commands

| Command | What it does |
| --- | --- |
| `npm test` | everything |
| `npm run test:visual` | screenshot comparison only |
| `npm run test:layout` | layout invariants only |
| `npm run test:visual:update` | re-bless baselines after an INTENTIONAL visual change |
| `npm run test:report` | open the HTML report of the last run |

## Workflow

1. Make a change.
2. `npm test`. Green: nothing moved anywhere. Red in `visual`: open the
   report, look at the diff.
3. If the change is unintended — fix it. If it is intended —
   `npm run test:visual:update` and commit the changed PNGs **with** the code
   change, so the baselines always mean "the currently approved look".

## Determinism (`?e2e=1`)

Screenshots only work if the same scroll position always paints the same
pixels, and the hero deliberately never sits still. The tests therefore load
every page with `?e2e=1` (see `src/lib/e2e.ts`), which VesselScene uses to:

- hold the vessel's rest pose and freeze the sea (same switch as
  `prefers-reduced-motion`),
- pin the marker pulse mid-cycle,
- snap scene progress straight to the scroll position instead of easing,
- hide the `DEBUG_SCROLL` readout so baselines survive its later removal.

The GLB load is signalled via `data-vessel-ready` on `<html>`, and the tests
land on snap stops by scrolling to `[data-scroll-stops]` top + *i* ×
viewport-height — see `helpers.ts`.

## Caveats

- Baselines are rendered pixels, so they are keyed by OS
  (`__screenshots__/<platform>/…`). The committed set is `win32`; a run on
  another OS writes its own set on first pass rather than failing against
  foreign pixels. That is also why CI runs only `layout.spec.ts`.
- Tests run in English (`locale: en-US` in the config); Greek shares the same
  layout code paths.
- A GPU-driver update can shift WebGL rasterisation wholesale. If the visual
  suite goes red everywhere at once with hairline diffs, that is the cause —
  inspect a couple of diffs, then re-bless.
