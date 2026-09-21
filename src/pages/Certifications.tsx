import { useI18n } from '@/i18n/useI18n'
import { Container } from '@/components/ui/Container'
import { Section } from '@/components/ui/Section'
import { CertificateBackdrop } from '@/components/certifications/CertificateBackdrop'

export default function Certifications() {
  const { t } = useI18n()

  return (
    <div className="relative overflow-hidden">
      {/* Blueprint texture down the page, behind the certificate. */}
      <div
        className="blueprint-grid pointer-events-none absolute inset-x-0 top-0 z-0 h-[52rem] opacity-40"
        aria-hidden="true"
      />

      {/* The certificate is a page-level backdrop, the counterpart to the
          coverage globe: a large sheet on the right, running from the title
          band down past the grid of approvals.

          Unlike the globe it is NOT bled off the edge. A sphere still reads as
          a sphere when it is clipped; a clipped rectangle reads as a few stray
          lines, which is exactly how the first attempt looked.

          Desktop only. On phones the cards stack full-width and cover all but
          a sliver of it, so it never resolves into a drawing — just noise
          behind the content. Better absent than half-there. */}
      <div
        className="pointer-events-none absolute top-[13rem] right-4 z-0 hidden w-[40rem] -rotate-3 opacity-40 lg:block"
        aria-hidden="true"
      >
        <CertificateBackdrop />
      </div>

      {/* All copy rides above the certificate. */}
      <div className="relative z-10">
        {/* The title band is written out here rather than using PageHeader,
            for the same reason Coverage writes out its own: PageHeader lays an
            opaque navy gradient across its whole area, which buried the top of
            the certificate and left it looking sliced off. Same type and
            spacing, minus the gradient. */}
        <section>
          <Container className="pt-28 pb-14 sm:pt-32 lg:pt-40 lg:pb-20">
            <p className="eyebrow mb-4">{t.certifications.eyebrow}</p>
            <h1 className="text-h1 max-w-3xl text-balance font-semibold text-white">
              {t.certifications.title}
            </h1>
            <p className="text-navy-300 mt-6 max-w-2xl text-base leading-relaxed sm:text-lg">
              {t.certifications.intro}
            </p>
          </Container>
        </section>

        <Section className="pt-0 sm:pt-0 lg:pt-0">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {t.certifications.items.map((item) => (
              <li
                key={item.name}
                className="border-navy-800 bg-navy-900/40 flex flex-col rounded-lg border p-6 backdrop-blur-sm"
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

          {/* <p className="border-alert-600/30 bg-alert-600/5 text-alert-500 mt-12 rounded-md border px-5 py-4 text-sm leading-relaxed">
            {t.certifications.disclaimer}
          </p> */}
        </Section>
      </div>
    </div>
  )
}
