import { useI18n } from '@/i18n/useI18n'
import { Container } from '@/components/ui/Container'
import { ButtonLink } from '@/components/ui/Button'
import { ROUTES } from '@/routes'

export default function NotFound() {
  const { t } = useI18n()

  return (
    <div className="relative flex min-h-dvh items-center overflow-hidden">
      <div className="blueprint-grid absolute inset-0 opacity-60" aria-hidden="true" />
      <div className="from-navy-950 to-navy-950/40 absolute inset-0 bg-linear-to-t" aria-hidden="true" />
      <Container className="relative text-center">
        <p className="text-signal-500/60 font-mono text-6xl font-bold">{t.notFound.code}</p>
        <h1 className="text-h1 mt-6 font-semibold text-white">{t.notFound.title}</h1>
        <p className="text-navy-400 mx-auto mt-4 max-w-md text-base leading-relaxed">
          {t.notFound.body}
        </p>
        <div className="mt-10">
          <ButtonLink to={ROUTES.home} size="lg">
            {t.notFound.cta}
          </ButtonLink>
        </div>
      </Container>
    </div>
  )
}
