import { useI18n } from '@/i18n/useI18n'
import { PageHeader } from '@/components/ui/PageHeader'
import { Section } from '@/components/ui/Section'
import { ButtonLink } from '@/components/ui/Button'
import { ROUTES } from '@/routes'
import { pick } from '@/content/localise'
import { usePublished } from '@/content/usePublished'
import type { CapabilityGroup } from '@/content/types'
import snapshot from '@/content/snapshot/capability_groups.json'

export default function Capabilities() {
  const { t, lang } = useI18n()
  // The groups and their makers are edited in the admin panel; the heading,
  // intro and trademark note around them stay in the dictionaries.
  const groups = usePublished('capability_groups', snapshot as CapabilityGroup[])

  return (
    <>
      <PageHeader
        eyebrow={t.capabilities.eyebrow}
        title={t.capabilities.title}
        intro={t.capabilities.intro}
      />

      <Section>
        <div className="space-y-12 lg:space-y-16">
          {groups.map((group) => (
            <div key={group.id}>
              <h2 className="text-navy-200 border-navy-800 border-b pb-4 text-h3 font-semibold">
                {pick(group, 'title', lang)}
              </h2>
              <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {group.brands.map((brand) => (
                  <li
                    key={brand}
                    className="border-navy-800 bg-navy-900/40 text-navy-300 hover:border-signal-500/40 hover:text-white flex min-h-18 items-center justify-center rounded-md border px-3 py-4 text-center font-mono text-xs tracking-wide transition-colors"
                  >
                    {brand}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="text-navy-500 border-navy-800 mt-16 border-t pt-6 text-xs leading-relaxed">
          {t.capabilities.note}
        </p>
      </Section>

      <Section tone="raised" className="text-center">
        <h2 className="text-h2 text-balance font-semibold text-white">{t.home.ctaBand.title}</h2>
        <div className="mt-8">
          <ButtonLink to={ROUTES.contact} variant="alert" size="lg">
            {t.home.ctaBand.cta}
          </ButtonLink>
        </div>
      </Section>
    </>
  )
}
