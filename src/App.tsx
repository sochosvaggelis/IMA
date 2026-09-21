import { lazy } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { LanguageProvider } from '@/i18n/LanguageProvider'
import type { Language } from '@/i18n/context'
import { EL_PREFIX } from '@/i18n/localePath'
import { Layout } from '@/components/layout/Layout'
import { ROUTES } from '@/routes'

/**
 * Every route is split out of the main bundle.
 *
 * Home and Coverage pull in three.js between them — well over half the
 * JavaScript on the site. Imported statically, that weight lands in the main
 * chunk and is downloaded by everyone, including someone on ship wifi opening
 * /contact to report a breakdown. Splitting it means that page fetches the
 * layout and its own form, and nothing else.
 *
 * The cost is one extra round trip before the home hero's intro curtain can
 * start. If that ever feels too slow, make Home a plain static import again —
 * but note that puts three.js back into every page's critical path.
 *
 * The Suspense boundary these need lives in Layout, around the Outlet, so the
 * header and footer stay put while a route's chunk arrives.
 */
const Home = lazy(() => import('@/pages/Home'))
const Services = lazy(() => import('@/pages/Services'))
const Capabilities = lazy(() => import('@/pages/Capabilities'))
const Projects = lazy(() => import('@/pages/Projects'))
const Certifications = lazy(() => import('@/pages/Certifications'))
const Coverage = lazy(() => import('@/pages/Coverage'))
const Contact = lazy(() => import('@/pages/Contact'))
const Privacy = lazy(() => import('@/pages/Privacy'))
const NotFound = lazy(() => import('@/pages/NotFound'))

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
          <Route index element={<Home />} />
          <Route path={rel(ROUTES.services)} element={<Services />} />
          <Route path={rel(ROUTES.capabilities)} element={<Capabilities />} />
          <Route path={rel(ROUTES.projects)} element={<Projects />} />
          <Route path={rel(ROUTES.certifications)} element={<Certifications />} />
          <Route path={rel(ROUTES.coverage)} element={<Coverage />} />
          <Route path={rel(ROUTES.contact)} element={<Contact />} />
          <Route path={rel(ROUTES.privacy)} element={<Privacy />} />
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
        {/* Greek is prefixed; English owns the bare paths. Order matters —
            '/*' would otherwise swallow '/el/...' before it is tried. */}
        <Route path={`${EL_PREFIX}/*`} element={<LocalisedRoutes lang="el" />} />
        <Route path="/*" element={<LocalisedRoutes lang="en" />} />
      </Routes>
    </BrowserRouter>
  )
}
