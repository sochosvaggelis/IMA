import { useI18n } from '@/i18n/useI18n'
import { PageHeader } from '@/components/ui/PageHeader'
import { Section } from '@/components/ui/Section'

export default function Certifications() {
  const { t } = useI18n()

  return (
    <>
      <PageHeader
        eyebrow={t.certifications.eyebrow}
        title={t.certifications.title}
        intro={t.certifications.intro}
      />

      <Section>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {t.certifications.items.map((item) => (
            <li
              key={item.name}
              className="border-navy-800 bg-navy-900/40 flex flex-col rounded-lg border p-6"
            >
              <svg
                viewBox="0 0 24 24"
                className="text-signal-500 size-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <path
                  d="M12 2.5l7.5 3v6c0 4.6-3.1 8.5-7.5 10-4.4-1.5-7.5-5.4-7.5-10v-6l7.5-3z"
                  strokeLinejoin="round"
                />
                <path d="M8.5 12l2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <h2 className="mt-4 text-lg font-semibold text-white">{item.name}</h2>
              <p className="text-navy-400 mt-1.5 text-sm leading-relaxed">{item.detail}</p>
            </li>
          ))}
        </ul>

        <p className="border-alert-600/30 bg-alert-600/5 text-alert-500 mt-12 rounded-md border px-5 py-4 text-sm leading-relaxed">
          {t.certifications.disclaimer}
        </p>
      </Section>
    </>
  )
}
