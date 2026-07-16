import { Container } from './Container'

/** Top band for every page except home — clears the fixed header. */
export function PageHeader({
  eyebrow,
  title,
  intro,
}: {
  eyebrow: string
  title: string
  intro: string
}) {
  return (
    <div className="border-navy-800/60 relative overflow-hidden border-b">
      <div className="blueprint-grid absolute inset-0 opacity-60" aria-hidden="true" />
      <div
        className="from-navy-950 via-navy-950/60 to-navy-950 absolute inset-0 bg-linear-to-b"
        aria-hidden="true"
      />
      <Container className="relative pt-28 pb-14 sm:pt-32 lg:pt-40 lg:pb-20">
        <p className="eyebrow mb-4">{eyebrow}</p>
        <h1 className="text-h1 max-w-3xl text-balance font-semibold text-white">{title}</h1>
        <p className="text-navy-300 mt-6 max-w-2xl text-base leading-relaxed sm:text-lg">{intro}</p>
      </Container>
    </div>
  )
}
