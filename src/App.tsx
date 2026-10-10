import { Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { LanguageProvider } from '@/i18n/LanguageProvider'
import type { Language } from '@/i18n/context'
import { EL_PREFIX } from '@/i18n/localePath'
import { Layout } from '@/components/layout/Layout'
import { Admin, NotFound, PAGES } from '@/lazyPages'
import { ADMIN_ROOT, ROUTES } from '@/routes'

/**
 * Every route is split out of the main bundle.
 *
 * Home and Coverage pull in three.js between them — well over half the
 * JavaScript on the site. Imported statically, that weight lands in the main
 * chunk and is downloaded by everyone, including someone on ship wifi opening
 * /contact to report a breakdown. Splitting it means that page fetches the
 * layout and its own form, and nothing else.
 *
 * The lazy components live in lazyPages.ts, which also lets main.tsx load the
 * current page before the first render, so a fresh load never paints the
 * empty fallback. The Suspense boundary is still needed for client-side
 * navigation: it lives in Layout, around the Outlet, so the header and footer
 * stay put while the next route's chunk arrives.
 */

/** ROUTES holds absolute paths ('/services'); nested routes want them relative. */
const rel = (path: string) => path.slice(1)

/**
 * One page tree, mounted twice — once per language.
 *
 * Both mounts render the same components; only the dictionary differs, which
 * is why the language is a prop on the provider rather than something the
 * pages look up for themselves.
 */
function LocalisedRoutes({ lang }: { lang: Language }) {
  return (
    <LanguageProvider lang={lang}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<PAGES.home />} />
          <Route path={rel(ROUTES.services)} element={<PAGES.services />} />
          <Route path={rel(ROUTES.capabilities)} element={<PAGES.capabilities />} />
          <Route path={rel(ROUTES.projects)} element={<PAGES.projects />} />
          <Route path={rel(ROUTES.spareParts)} element={<PAGES.spareParts />} />
          <Route path={rel(ROUTES.certifications)} element={<PAGES.certifications />} />
          <Route path={rel(ROUTES.coverage)} element={<PAGES.coverage />} />
          <Route path={rel(ROUTES.contact)} element={<PAGES.contact />} />
          <Route path={rel(ROUTES.privacy)} element={<PAGES.privacy />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </LanguageProvider>
  )
}

export default function App() {
  return (
    // Router paths are relative to Vite's base, so the same build works both
    // at the root and under a subpath.
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        {/* Outside both language trees: the panel is English-only, has none
            of the site's header or footer, and is never linked from it. */}
        <Route
          path={`${ADMIN_ROOT}/*`}
          element={
            <Suspense fallback={<div className="min-h-dvh" aria-hidden="true" />}>
              <Admin />
            </Suspense>
          }
        />
        {/* Greek is prefixed; English owns the bare paths. Order matters —
            '/*' would otherwise swallow '/el/...' before it is tried. */}
        <Route path={`${EL_PREFIX}/*`} element={<LocalisedRoutes lang="el" />} />
        <Route path="/*" element={<LocalisedRoutes lang="en" />} />
      </Routes>
    </BrowserRouter>
  )
}
