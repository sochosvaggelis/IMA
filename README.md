# IMA — International Marine Automations

Website for a marine electrical / electronics / automation workshop.
Vite + React 19 + TypeScript + Tailwind v4, bilingual EL/EN.

> **All content is placeholder.** Phone numbers, address, certifications,
> project cases and statistics are invented. Replace them before this goes
> anywhere near a real visitor — see "Editing content" below.

**Live:** https://sochosvaggelis.github.io/IMA/

## Running

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build to dist/
npm run lint
```

## Deployment

Every push to `main` builds and publishes to GitHub Pages via
`.github/workflows/deploy.yml`. A type error fails the deploy rather than
shipping a broken site.

Pages serves the site from the `/IMA/` subpath, which costs two things:

- `vite.config.ts` sets `base: '/IMA/'` for builds (dev stays at `/`), and
  `App.tsx` passes `import.meta.env.BASE_URL` to the router's `basename`, so
  one build works in both places. Never hardcode `/IMA/` anywhere else.
- Pages has no rewrite rules, so the workflow copies `index.html` to
  `404.html`. Deep links land on the 404 page, the app boots, and React Router
  resolves the URL. It works, but those responses carry a 404 status — worth
  knowing if search ranking ever matters.

Both of those disappear the day this moves to a real domain: set `base` back
to `'/'` and drop the `404.html` step in favour of a proper
`/* -> /index.html` rewrite.

## Editing content

Every user-facing string lives in two files:

- `src/i18n/dictionaries/el.ts` — Greek, and the source of truth for the shape
- `src/i18n/dictionaries/en.ts` — English, type-checked against the Greek file

`en.ts` is typed as `Dictionary`, so a missing or misspelled key fails
`npm run build` instead of leaving a blank spot on the page. Add a key to
`el.ts` first, then to `en.ts`.

No content lives inside components.

## Structure

```
src/
  i18n/            language context + the two dictionaries
  components/
    hero/          HeroSeaScene — the animated blueprint vessel
    layout/        Header, Footer, Layout, Logo, LanguageSwitcher
    ui/            Container, Section, Button, PageHeader
  pages/           one file per route
  routes.ts        path constants — nav and pages both read from here
  index.css        design tokens (@theme), utilities, keyframes
```

## The hero scene

`src/components/hero/HeroSeaScene.tsx` is a hand-drawn SVG general-arrangement
plan of a geared bulk carrier. It is code, not an asset, because:

- it costs ~1.5 kB gzipped, against 5–15 MB for an equivalent GIF
- it stays sharp at any pixel density and any viewport
- it recolours from the brand tokens in `index.css`
- it honours `prefers-reduced-motion`

It renders as two stacked SVG layers: the sea stretches to fill the container
so the water always spans the full screen width, while the vessel layer keeps
its aspect ratio so the whole ship stays in frame and undistorted at every
viewport. The finest annotations (frame
numbers, dimensions, bollards, callouts) are gated behind `md`/`lg` because at
phone width they would render as noise.

To swap in real drone footage later, replace this one component — the hero
layout does not care what renders inside it.

## Known gaps before launch

- **The contact form does not send anything.** `src/pages/Contact.tsx` fakes a
  700ms delay and shows the success state. Wire it to a real endpoint or a form
  service, and only then is the "we reply within 2 hours" copy honest.
- Replace all placeholder content (see above), especially the certifications
  page — claiming class approvals you do not hold is a real problem.
- Deep links work, but return a 404 status — see "Deployment" above.
- No analytics, no sitemap, no `robots.txt`.
- Fonts load from Google Fonts; self-host them if that matters to you.
