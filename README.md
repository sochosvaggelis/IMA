# IMA — International Marine Automations

Website for a marine electrical / electronics / automation workshop.
Vite + React 19 + TypeScript + Tailwind v4, bilingual EL/EN.

> **All content is placeholder.** Phone numbers, address, certifications,
> project cases and statistics are invented. Replace them before this goes
> anywhere near a real visitor — see "Editing content" below.

**Live:** https://imagreece.gr

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

The site is served from the custom domain `imagreece.gr` (set via
`public/CNAME`, and DNS at the registrar), so it serves from root rather than
a subpath — `vite.config.ts` sets `base: '/'`. `App.tsx` still passes
`import.meta.env.BASE_URL` to the router's `basename`; never hardcode a path
prefix elsewhere.

Pages has no rewrite rules, so every page needs a real file behind it, or it
is answered by `404.html` with a 404 status — which search engines take at
its word and do not index. The last step of `npm run build`
(`scripts/prerender-routes.mjs`) therefore writes one HTML file per page and
language (`services.html`, `el/services.html`, …), each the app shell with
that page's own title, description, canonical, hreflang and `<html lang>`
already in it. Pages serves `foo.html` at `/foo` with a 200, so the
addresses are unchanged, and link previews (which run no JavaScript) show the
right page. A new route in `src/routes.ts` gets its file automatically, but
needs a `pageMeta` entry in both dictionaries or the build stops.

The workflow still copies `index.html` to `404.html`, for addresses that
are not pages: the app boots there and shows its not-found screen, with a
genuine 404 status.

## Editing content

Two kinds of content, edited in two places:

- **Lists** are edited by the site owner in the admin panel at `/admin`,
  and stored in a database — see the next section: projects, spare parts,
  the makers on /capabilities, the cards on /certifications and the ports
  on /coverage.
- **Everything else** — page copy, headings, intros, labels — lives in two
  files:
  - `src/i18n/dictionaries/el.ts` — Greek, and the source of truth for the shape
  - `src/i18n/dictionaries/en.ts` — English, type-checked against the Greek file

`en.ts` is typed as `Dictionary`, so a missing or misspelled key fails
`npm run build` instead of leaving a blank spot on the page. Add a key to
`el.ts` first, then to `en.ts`.

No content lives inside components.

## Content & admin panel

The site is still a static build on GitHub Pages; the editable content lives
in a [Supabase](https://supabase.com) project (hosted Postgres + logins + file
storage, free tier) that the browser talks to directly. There is no server of
ours in between.

```
visitor ──GET published rows──►  Supabase  ◄──sign in, edit, upload── owner at /admin
   ▲                               │
   └── build-time snapshot ◄───────┘  (deploy workflow, on push + daily)
```

- **Public pages** (`/projects`, `/spare-parts`, `/capabilities`,
  `/certifications`, `/coverage`, and the home teasers) render the
  snapshot baked into the build at once, then swap in the live rows — so an
  edit shows up without a redeploy, and if the database is unreachable the
  site shows the last snapshot instead of an empty page. Plain `fetch`, no
  client library: see `src/content/`.
- **The admin panel** (`src/admin/`) is its own lazy chunk carrying
  supabase-js; visitors never download it. It is English-only, works on a
  phone (photos can be taken straight from the camera), and shrinks every
  photo in the browser to a 2000px and a 640px WebP (JPEG from Safari,
  which cannot encode WebP) before upload.
- **Security is the database's row-level security**, in
  `supabase/migrations/20260928120000_content.sql`: anyone reads published
  rows; only users listed in the `admins` table read drafts or write
  anything, photos included. The key in the bundle is the public one and
  grants nothing more. The rules are worth re-reading before changing them.
- **The snapshot** is `src/content/snapshot/*.json`, written by
  `npm run snapshot`. The deploy workflow refreshes it before every build and
  runs once a day on a schedule — which also stops a free-tier Supabase
  project from pausing after a week without traffic.

### Setting it up (once)

1. **Create a project** at [supabase.com](https://supabase.com) — pick the
   **Frankfurt (eu-central-1)** region: visitors' browsers will fetch content
   and photos from it.
2. **Create the tables.** In the dashboard's SQL Editor, run every file in
   `supabase/migrations/`, oldest first (the file names sort that way). The
   first creates the access rules and photo bucket the others rely on; the
   rest create their tables and load the content the site launched with, so
   nothing disappears when the site switches over. Already ran some? Run only the ones you have not —
   each file is a one-time step.
3. **Lock down sign-up.** Authentication → Sign In / Providers → turn **off**
   "Allow new users to sign up". (The admins table protects the data even if
   this is left on, but there is no reason for strangers to have accounts.)
4. **Set the URLs.** Authentication → URL Configuration: Site URL
   `https://imagreece.gr`; add `https://imagreece.gr/admin/reset-password`
   and `http://localhost:5173/admin/reset-password` to the Redirect URLs, or
   password-reset links will not come back to the panel.
5. **Create the owner's login.** Authentication → Users → Add user → Create
   new user, with their email, a temporary password, and "Auto Confirm User"
   ticked. Then make them an admin in the SQL Editor:

   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'owner@example.com';
   ```

   They can change the password themselves under Account in the panel.
   Remove someone's access with `delete from public.admins where …`.
6. **Connect the site.** Copy the Project URL (`https://<project-id>.supabase.co`
   — "Connect" button, or Project Settings → Data API) and the **publishable**
   key (Project Settings → API Keys; never the secret one) into `.env` as
   `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` (see `.env.example`),
   and add them as repository secrets `SUPABASE_URL` /
   `SUPABASE_PUBLISHABLE_KEY` for the deploy.
7. Push. The next deploy takes a fresh snapshot, and `/admin` is live.

### Making more of the site editable

The admin screens are generic — they render whatever
`src/admin/collections.ts` describes. To hand over another list: add
a table with the same access rules to a new migration, its row type to
`src/content/types.ts`, an entry to `collections.ts` and the table name to
`scripts/snapshot-content.mjs`, then read it on the page with
`usePublished()`. No new admin screens are needed.

## Structure

```
supabase/
  migrations/      database tables, access rules, photo bucket, seed data
src/
  admin/           the /admin panel (own lazy chunk, supabase-js)
  content/         published rows for the public pages + their snapshot
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
- **The Coverage page's search-result text names the ports.** Its title and
  description in `pageMeta.coverage` (both dictionaries) say "9 Greek
  ports" and list them; they will not follow edits made in the admin panel.
- **The privacy policy does not mention Supabase.** Visitors' browsers now
  fetch projects, spare parts and photos from it, so it sees their IP
  addresses the way a host does. Name it as a processor alongside Web3Forms
  (and choose the EU region — see "Setting it up").
- No analytics, no sitemap, no `robots.txt`.
- Fonts load from Google Fonts; self-host them if that matters to you.
