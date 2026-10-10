/**
 * Every page, split out of the main bundle (see App.tsx for why), and able to
 * be loaded ahead of React.
 *
 * React.lazy on its own always suspends a page's first render, even when its
 * chunk is already in the browser: it reads the import as a promise, and a
 * promise cannot answer synchronously. On a fresh load that meant React
 * painted the header and footer around an empty <main>, then the page a
 * moment later — the flicker on every reload.
 *
 * So main.tsx calls preloadPageFor() before the first render, and once a
 * page's module has arrived its lazy component hands it back through a
 * thenable that resolves on the spot. React.lazy checks for exactly that,
 * and renders the page straight away with no fallback. The page's chunk is
 * also named in its HTML file as a modulepreload (scripts/prerender-routes.mjs),
 * so the wait before that first render is the main bundle's, not an extra
 * round trip after it.
 */
import { lazy, type ComponentType } from 'react'
import { parseLocalePath } from '@/i18n/localePath'
import { ADMIN_ROOT, ROUTES, type RouteKey } from '@/routes'

type PageModule = { default: ComponentType }

function lazyPage(load: () => Promise<PageModule>) {
  let loaded: PageModule | undefined
  const preload = () => load().then((module) => (loaded = module))
  const Page = lazy(() => {
    const module = loaded
    if (!module) return preload()
    // Synchronous on purpose — a real Promise would resolve a tick later.
    return { then: (resolve: (module: PageModule) => void) => resolve(module) } as unknown as Promise<PageModule>
  })
  return Object.assign(Page, { preload })
}

export const PAGES = {
  home: lazyPage(() => import('@/pages/Home')),
  services: lazyPage(() => import('@/pages/Services')),
  capabilities: lazyPage(() => import('@/pages/Capabilities')),
  projects: lazyPage(() => import('@/pages/Projects')),
  spareParts: lazyPage(() => import('@/pages/SpareParts')),
  certifications: lazyPage(() => import('@/pages/Certifications')),
  coverage: lazyPage(() => import('@/pages/Coverage')),
  contact: lazyPage(() => import('@/pages/Contact')),
  privacy: lazyPage(() => import('@/pages/Privacy')),
} satisfies Record<RouteKey, unknown>

export const NotFound = lazyPage(() => import('@/pages/NotFound'))

/** The admin panel, with supabase-js inside it — a chunk no visitor loads. */
export const Admin = lazyPage(() => import('@/admin/AdminApp'))

/** Loads the page the router is about to draw for `pathname`, mirroring
    App.tsx's route table. Never rejects: a failed load is left for the lazy
    component to retry and report the usual way. */
export function preloadPageFor(pathname: string): Promise<unknown> {
  // The router ignores case and a trailing slash, so this does too.
  const route = pathname
    .slice(import.meta.env.BASE_URL.length - 1)
    .toLowerCase()
    .replace(/(.)\/$/, '$1')
  let page = NotFound
  if (route === ADMIN_ROOT || route.startsWith(`${ADMIN_ROOT}/`)) {
    page = Admin
  } else {
    const { path } = parseLocalePath(route)
    const key = (Object.keys(ROUTES) as RouteKey[]).find((k) => ROUTES[k] === path)
    if (key) page = PAGES[key]
  }
  return page.preload().catch(() => undefined)
}
