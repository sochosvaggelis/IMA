import { useI18n } from '@/i18n/useI18n'
import { PageHeader } from '@/components/ui/PageHeader'
import { Section } from '@/components/ui/Section'

export default function Privacy() {
  const { t } = useI18n()

  return (
    <>
      <PageHeader eyebrow={t.privacy.eyebrow} title={t.privacy.title} intro={t.privacy.intro} />

      {/* Default container, then cap the prose — `size="narrow"` would centre
          a narrower column and break the left edge the PageHeader sets. */}
      <Section>
        <div className="max-w-3xl">
          <p className="text-navy-500 font-mono text-xs">{t.privacy.updated}</p>

          <div className="mt-10 space-y-10">
            {t.privacy.sections.map((section) => (
              <section key={section.title}>
                <h2 className="text-h3 font-semibold text-white">{section.title}</h2>
                <div className="mt-4 space-y-4">
                  {section.body.map((paragraph) => (
                    <p key={paragraph} className="text-navy-300 text-base leading-relaxed">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </Section>
    </>
  )
}
