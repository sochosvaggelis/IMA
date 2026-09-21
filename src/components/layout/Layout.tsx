import { Suspense, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useI18n } from '@/i18n/useI18n'
import { usePageMeta } from '@/i18n/usePageMeta'
import { Header } from './Header'
import { Footer } from './Footer'

/** A client-side route change doesn't reset scroll on its own. */
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])
  return null
}

export function Layout() {
  const { t } = useI18n()
  usePageMeta()

  return (
    <div className="flex min-h-dvh flex-col">
      <ScrollToTop />
      <a
        href="#main"
        className="focus:bg-signal-500 focus:text-navy-950 sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-md focus:px-4 focus:py-2 focus:font-medium"
      >
        {t.nav.skipToContent}
      </a>
      <Header />
      <main id="main" className="flex-1">
        {/* Route chunks are lazy (see App.tsx). The fallback is deliberately
            empty — the page ground is already painted, and a spinner that
            shows for 80ms reads as a glitch rather than as progress. */}
        <Suspense fallback={<div className="min-h-dvh" aria-hidden="true" />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
