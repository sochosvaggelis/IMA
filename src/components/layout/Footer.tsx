import { Link } from 'react-router-dom'
import { useI18n } from '@/i18n/useI18n'
import { ROUTES, type RouteKey } from '@/routes'
import { Container } from '@/components/ui/Container'
import { telHref } from '@/lib/contact'
import { Logo } from './Logo'

const COMPANY_KEYS: RouteKey[] = ['projects', 'certifications', 'coverage']
const SERVICE_KEYS: RouteKey[] = ['services', 'capabilities']

export function Footer() {
  const { t } = useI18n()
  const year = new Date().getFullYear()

  return (
    <footer className="border-navy-800 bg-navy-950 border-t">
      <Container size="wide" className="py-14 lg:py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          <div className="lg:col-span-2">
            <Logo />
            <p className="text-navy-400 mt-5 max-w-sm text-sm leading-relaxed">{t.footer.tagline}</p>
            <a
              href={telHref(t.emergency.phone)}
              className="text-alert-500 hover:text-alert-600 mt-6 inline-flex items-center gap-2 font-mono text-sm transition-colors"
            >
              <span className="bg-alert-500 size-2 rounded-full" aria-hidden="true" />
              {t.emergency.label} · {t.emergency.phone}
            </a>
          </div>

          <div>
            <h3 className="text-navy-200 mb-4 text-sm font-semibold">{t.footer.sections.services}</h3>
            <ul className="space-y-3">
              {SERVICE_KEYS.map((key) => (
                <li key={key}>
                  <Link to={ROUTES[key]} className="text-navy-400 hover:text-signal-400 text-sm transition-colors">
                    {t.nav[key]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-navy-200 mb-4 text-sm font-semibold">{t.footer.sections.company}</h3>
            <ul className="space-y-3">
              {COMPANY_KEYS.map((key) => (
                <li key={key}>
                  <Link to={ROUTES[key]} className="text-navy-400 hover:text-signal-400 text-sm transition-colors">
                    {t.nav[key]}
                  </Link>
                </li>
              ))}
              <li>
                <Link to={ROUTES.contact} className="text-navy-400 hover:text-signal-400 text-sm transition-colors">
                  {t.nav.contact}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-navy-800/70 mt-12 flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-navy-500 text-xs">
            © {year} International Marine Automations. {t.footer.rights}
          </p>
          <p className="text-navy-600 font-mono text-xs">{t.footer.placeholder}</p>
        </div>
      </Container>
    </footer>
  )
}
