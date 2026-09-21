import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { LocaleLink } from '@/i18n/LocaleLink'
import { useI18n } from '@/i18n/useI18n'
import { ROUTES } from '@/routes'
import type { Urgency } from '@/i18n/dictionaries/el'
import { PageHeader } from '@/components/ui/PageHeader'
import { Section } from '@/components/ui/Section'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { CONTACT_EMAIL, telHref } from '@/lib/contact'
import { mailtoFor, submitEnquiry, type Delivery, type Enquiry } from '@/lib/enquiry'

/** Every field but `urgency`, which is a radio group rather than a text input. */
type TextField = Exclude<keyof Enquiry, 'urgency'>

const EMPTY: Enquiry = {
  urgency: 'urgent',
  vesselName: '',
  imo: '',
  vesselType: '',
  port: '',
  eta: '',
  system: '',
  description: '',
  contactName: '',
  company: '',
  email: '',
  phone: '',
}

const URGENCIES: Urgency[] = ['emergency', 'urgent', 'planned']

/** Only what we genuinely need to dispatch an engineer. Everything else is optional. */
const REQUIRED_FIELDS = ['port', 'description', 'contactName', 'email'] as const
type FieldErrors = Partial<Record<keyof Enquiry, string>>

const inputClass =
  'w-full rounded-md border bg-navy-900/60 px-4 py-3 text-base text-white placeholder:text-navy-600 transition-colors focus:outline-none focus:border-signal-500 disabled:opacity-60'

function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: {
  label: string
  htmlFor: string
  error?: string
  hint?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="text-navy-200 mb-2 block text-sm font-medium">
        {label}
        {hint && <span className="text-navy-500 ml-2 font-normal">{hint}</span>}
      </label>
      {children}
      {error && (
        <p id={`${htmlFor}-error`} className="text-alert-500 mt-1.5 text-xs">
          {error}
        </p>
      )}
    </div>
  )
}

export default function Contact() {
  const { t } = useI18n()
  const uid = useId()
  const [params] = useSearchParams()
  const [form, setForm] = useState<Enquiry>(EMPTY)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [failed, setFailed] = useState(false)
  const [delivery, setDelivery] = useState<Delivery | null>(null)
  // Bots fill in every field they can see; this one no human ever sees.
  const [botcheck, setBotcheck] = useState('')
  const failureRef = useRef<HTMLDivElement>(null)
  const doneRef = useRef<HTMLHeadingElement>(null)

  const f = t.contact.form
  const v = t.contact.validation
  const id = (name: string) => `${uid}-${name}`

  // The breakdown CTAs across the site arrive as ?urgency=emergency, so the
  // form opens on the tier the visitor already chose by clicking that button.
  useEffect(() => {
    const requested = params.get('urgency')
    if (requested && URGENCIES.includes(requested as Urgency)) {
      setForm((prev) => ({ ...prev, urgency: requested as Urgency }))
    }
  }, [params])

  // Send focus where the outcome is, rather than leaving it on a button that
  // has just been replaced by a different screen.
  useEffect(() => {
    if (delivery) doneRef.current?.focus()
  }, [delivery])
  useEffect(() => {
    if (failed) failureRef.current?.focus()
  }, [failed])

  function set<K extends keyof Enquiry>(key: K, value: Enquiry[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    // Clear the error as soon as the user starts fixing it, not on next submit.
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev))
  }

  function validate(): FieldErrors {
    const next: FieldErrors = {}
    for (const key of REQUIRED_FIELDS) {
      if (!form[key].trim()) next[key] = v.required
    }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email)) {
      next.email = v.email
    }
    // IMO is optional, but a wrong one is worse than none — it misroutes the job.
    if (form.imo.trim() && !/^\d{7}$/.test(form.imo.trim())) {
      next.imo = v.imo
    }
    return next
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) {
      document.getElementById(id(Object.keys(found)[0]))?.focus()
      return
    }

    setSubmitting(true)
    setFailed(false)
    try {
      setDelivery(await submitEnquiry(form, { fallbackTo: CONTACT_EMAIL, honeypot: botcheck }))
    } catch {
      // The form keeps every value: a report typed on a ship is not something
      // to make anyone type twice. The banner offers email and phone instead.
      setFailed(true)
    } finally {
      setSubmitting(false)
    }
  }

  function fieldProps(key: TextField) {
    return {
      id: id(key),
      value: form[key],
      disabled: submitting,
      'aria-invalid': errors[key] ? (true as const) : undefined,
      'aria-describedby': errors[key] ? `${id(key)}-error` : undefined,
      onChange: (event: { target: { value: string } }) => set(key, event.target.value),
      className: cn(inputClass, errors[key] ? 'border-alert-600' : 'border-navy-700'),
    }
  }

  const errorCount = Object.values(errors).filter(Boolean).length

  return (
    <>
      <PageHeader eyebrow={t.contact.eyebrow} title={t.contact.title} intro={t.contact.intro} />

      <Section>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-16">
          <div>
            {delivery ? (
              <div className="border-signal-500/40 bg-signal-500/5 rounded-lg border p-8 text-center sm:p-12">
                <svg
                  viewBox="0 0 24 24"
                  className="text-signal-400 mx-auto size-12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="9.5" />
                  <path d="M7.5 12.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <h2
                  ref={doneRef}
                  tabIndex={-1}
                  className="text-h3 mt-5 font-semibold text-white focus:outline-none"
                >
                  {delivery === 'sent' ? t.contact.success.title : t.contact.success.mailTitle}
                </h2>
                <p className="text-navy-300 mx-auto mt-3 max-w-md text-sm leading-relaxed">
                  {delivery === 'sent' ? t.contact.success.body : t.contact.success.mailBody}
                </p>
                {/* The mail-client route only finishes when the visitor presses
                    send over there — give them the address in case it never opened. */}
                {delivery === 'mail-client' && (
                  <p className="text-navy-400 mx-auto mt-3 max-w-md text-sm leading-relaxed">
                    {t.contact.success.mailFallback}{' '}
                    <a
                      href={mailtoFor(form, CONTACT_EMAIL)}
                      className="text-signal-400 hover:text-signal-300 font-mono transition-colors"
                    >
                      {CONTACT_EMAIL}
                    </a>
                  </p>
                )}
                <Button
                  variant="secondary"
                  className="mt-8"
                  onClick={() => {
                    setForm(EMPTY)
                    setDelivery(null)
                  }}
                >
                  {t.contact.success.again}
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="space-y-8">
                {errorCount > 0 && (
                  <p className="text-alert-500 text-sm" role="alert">
                    {v.summary}
                  </p>
                )}

                {/* Urgency first: it decides how the rest of the message is handled */}
                <fieldset disabled={submitting}>
                  <legend className="text-navy-200 mb-3 text-sm font-medium">
                    {f.urgency.label}
                  </legend>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {f.urgency.options.map((option) => {
                      const active = form.urgency === option.value
                      const emergency = option.value === 'emergency'
                      return (
                        <label
                          key={option.value}
                          className={cn(
                            'flex cursor-pointer flex-col rounded-md border p-4 transition-colors',
                            active
                              ? emergency
                                ? 'border-alert-600 bg-alert-600/10'
                                : 'border-signal-500 bg-signal-500/10'
                              : 'border-navy-700 bg-navy-900/40 hover:border-navy-600',
                          )}
                        >
                          <input
                            type="radio"
                            name="urgency"
                            value={option.value}
                            checked={active}
                            onChange={() => set('urgency', option.value)}
                            className="sr-only"
                          />
                          <span
                            className={cn(
                              'text-sm font-semibold',
                              active ? (emergency ? 'text-alert-500' : 'text-signal-400') : 'text-navy-200',
                            )}
                          >
                            {option.label}
                          </span>
                          <span className="text-navy-500 mt-1 text-xs leading-relaxed">
                            {option.hint}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </fieldset>

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label={f.vesselName} htmlFor={id('vesselName')} hint={f.optional}>
                    <input {...fieldProps('vesselName')} autoComplete="off" />
                  </Field>

                  <Field label={f.imo} htmlFor={id('imo')} error={errors.imo} hint={f.optional}>
                    <input
                      {...fieldProps('imo')}
                      inputMode="numeric"
                      maxLength={7}
                      placeholder="9074729"
                      className={cn(fieldProps('imo').className, 'font-mono')}
                    />
                  </Field>

                  <Field label={f.vesselType} htmlFor={id('vesselType')} hint={f.optional}>
                    <input {...fieldProps('vesselType')} autoComplete="off" />
                  </Field>

                  <Field label={f.port} htmlFor={id('port')} error={errors.port}>
                    <input {...fieldProps('port')} required autoComplete="off" />
                  </Field>

                  <Field label={f.eta} htmlFor={id('eta')} hint={f.optional}>
                    <input {...fieldProps('eta')} autoComplete="off" />
                  </Field>

                  <Field label={f.system} htmlFor={id('system')} hint={f.optional}>
                    <input
                      {...fieldProps('system')}
                      placeholder={f.systemPlaceholder}
                      autoComplete="off"
                    />
                  </Field>
                </div>

                <Field label={f.description} htmlFor={id('description')} error={errors.description}>
                  <textarea
                    {...fieldProps('description')}
                    required
                    rows={5}
                    placeholder={f.descriptionPlaceholder}
                    className={cn(fieldProps('description').className, 'resize-y')}
                  />
                </Field>

                <div className="border-navy-800 grid gap-5 border-t pt-8 sm:grid-cols-2">
                  <Field label={f.contactName} htmlFor={id('contactName')} error={errors.contactName}>
                    <input {...fieldProps('contactName')} required autoComplete="name" />
                  </Field>

                  <Field label={f.company} htmlFor={id('company')} hint={f.optional}>
                    <input {...fieldProps('company')} autoComplete="organization" />
                  </Field>

                  <Field label={f.email} htmlFor={id('email')} error={errors.email}>
                    <input {...fieldProps('email')} type="email" required autoComplete="email" />
                  </Field>

                  <Field label={f.phone} htmlFor={id('phone')} hint={f.optional}>
                    <input {...fieldProps('phone')} type="tel" autoComplete="tel" />
                  </Field>
                </div>

                {/* Honeypot: hidden from sight, from the tab order and from
                    assistive tech, so anything that fills it in is not a person. */}
                <input
                  type="text"
                  name="botcheck"
                  value={botcheck}
                  onChange={(event) => setBotcheck(event.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  className="hidden"
                />

                {failed && (
                  <div
                    ref={failureRef}
                    tabIndex={-1}
                    role="alert"
                    className="border-alert-600/50 bg-alert-600/10 rounded-md border p-5 focus:outline-none"
                  >
                    <p className="text-alert-500 text-sm font-semibold">{t.contact.error.title}</p>
                    <p className="text-navy-300 mt-2 text-sm leading-relaxed">
                      {t.contact.error.body}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-4 text-sm">
                      {/* Both escape hatches carry the report with them — the
                          mailto is pre-composed from what is already typed. */}
                      <a
                        href={mailtoFor(form, CONTACT_EMAIL)}
                        className="text-signal-400 hover:text-signal-300 font-medium transition-colors"
                      >
                        {t.contact.error.mail}
                      </a>
                      <a
                        href={telHref(t.emergency.phone)}
                        className="text-alert-500 hover:text-alert-600 font-medium transition-colors"
                      >
                        {t.contact.error.call} · {t.emergency.phone}
                      </a>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <Button
                    type="submit"
                    variant={form.urgency === 'emergency' ? 'alert' : 'primary'}
                    size="lg"
                    disabled={submitting}
                    className="w-full sm:w-auto"
                  >
                    {submitting ? f.submitting : f.submit}
                  </Button>
                  <p className="text-navy-500 text-xs leading-relaxed">
                    {f.privacyNotice}{' '}
                    <LocaleLink
                      to={ROUTES.privacy}
                      className="text-navy-400 hover:text-signal-400 underline underline-offset-2 transition-colors"
                    >
                      {f.privacyLink}
                    </LocaleLink>
                    .
                  </p>
                </div>
              </form>
            )}
          </div>

          <aside className="lg:pt-2">
            <h2 className="text-navy-200 border-navy-800 border-b pb-4 text-h3 font-semibold">
              {t.contact.direct.title}
            </h2>

            <dl className="mt-6 space-y-6">
              <div>
                <dt className="text-alert-500 flex items-center gap-2 text-xs font-semibold tracking-wide uppercase">
                  <span className="bg-alert-500 size-2 animate-pulse rounded-full" aria-hidden="true" />
                  {t.contact.direct.emergency}
                </dt>
                <dd className="mt-2">
                  <a
                    href={telHref(t.emergency.phone)}
                    className="text-alert-500 hover:text-alert-600 font-mono text-lg font-semibold transition-colors"
                  >
                    {t.emergency.phone}
                  </a>
                  <p className="text-navy-500 mt-1.5 text-xs leading-relaxed">
                    {t.contact.direct.hoursNote}
                  </p>
                </dd>
              </div>

              <div>
                <dt className="text-navy-500 text-xs font-semibold tracking-wide uppercase">
                  {t.contact.direct.email}
                </dt>
                <dd className="mt-2">
                  <a
                    href={`mailto:${CONTACT_EMAIL}`}
                    className="text-signal-400 hover:text-signal-300 font-mono text-sm transition-colors"
                  >
                    {CONTACT_EMAIL}
                  </a>
                </dd>
              </div>

              <div>
                <dt className="text-navy-500 text-xs font-semibold tracking-wide uppercase">
                  {t.contact.direct.address}
                </dt>
                <dd className="text-navy-300 mt-2 text-sm leading-relaxed">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      t.contact.direct.addressValue,
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-signal-400 transition-colors"
                  >
                    {t.contact.direct.addressValue}
                  </a>
                </dd>
              </div>

              <div>
                <dt className="text-navy-500 text-xs font-semibold tracking-wide uppercase">
                  {t.contact.direct.hours}
                </dt>
                <dd className="text-navy-300 mt-2 text-sm">{t.contact.direct.hoursValue}</dd>
              </div>
            </dl>
          </aside>
        </div>
      </Section>
    </>
  )
}
