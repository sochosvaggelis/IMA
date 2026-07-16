import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { useI18n } from '@/i18n/useI18n'
import type { Urgency } from '@/i18n/dictionaries/el'
import { PageHeader } from '@/components/ui/PageHeader'
import { Section } from '@/components/ui/Section'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { telHref } from '@/lib/contact'

type FormState = {
  urgency: Urgency
  vesselName: string
  imo: string
  vesselType: string
  port: string
  eta: string
  system: string
  description: string
  contactName: string
  company: string
  email: string
  phone: string
}

const EMPTY: FormState = {
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

/** Only what we genuinely need to dispatch an engineer. Everything else is optional. */
const REQUIRED_FIELDS = ['port', 'description', 'contactName', 'email'] as const
type FieldErrors = Partial<Record<keyof FormState, string>>

const inputClass =
  'w-full rounded-md border bg-navy-900/60 px-4 py-3 text-base text-white placeholder:text-navy-600 transition-colors focus:outline-none focus:border-signal-500'

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
        <p className="text-alert-500 mt-1.5 text-xs" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export default function Contact() {
  const { t } = useI18n()
  const uid = useId()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  const f = t.contact.form
  const v = t.contact.validation
  const id = (name: string) => `${uid}-${name}`

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
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
    // TODO: no backend yet — wire this to the real endpoint (or a form service
    // such as Formspree/Resend) before launch. Right now nothing is delivered.
    await new Promise((resolve) => setTimeout(resolve, 700))
    setSubmitting(false)
    setSent(true)
  }

  const borderFor = (key: keyof FormState) =>
    errors[key] ? 'border-alert-600' : 'border-navy-700'

  return (
    <>
      <PageHeader eyebrow={t.contact.eyebrow} title={t.contact.title} intro={t.contact.intro} />

      <Section>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-16">
          <div>
            {sent ? (
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
                <h2 className="text-h3 mt-5 font-semibold text-white">{t.contact.success.title}</h2>
                <p className="text-navy-300 mx-auto mt-3 max-w-md text-sm leading-relaxed">
                  {t.contact.success.body}
                </p>
                <Button
                  variant="secondary"
                  className="mt-8"
                  onClick={() => {
                    setForm(EMPTY)
                    setSent(false)
                  }}
                >
                  {t.contact.success.again}
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="space-y-8">
                {/* Urgency first: it decides how the rest of the message is handled */}
                <fieldset>
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
                    <input
                      id={id('vesselName')}
                      value={form.vesselName}
                      onChange={(e) => set('vesselName', e.target.value)}
                      className={cn(inputClass, borderFor('vesselName'))}
                    />
                  </Field>

                  <Field label={f.imo} htmlFor={id('imo')} error={errors.imo} hint={f.optional}>
                    <input
                      id={id('imo')}
                      inputMode="numeric"
                      maxLength={7}
                      placeholder="9074729"
                      value={form.imo}
                      onChange={(e) => set('imo', e.target.value)}
                      className={cn(inputClass, 'font-mono', borderFor('imo'))}
                    />
                  </Field>

                  <Field label={f.vesselType} htmlFor={id('vesselType')} hint={f.optional}>
                    <input
                      id={id('vesselType')}
                      value={form.vesselType}
                      onChange={(e) => set('vesselType', e.target.value)}
                      className={cn(inputClass, borderFor('vesselType'))}
                    />
                  </Field>

                  <Field label={f.port} htmlFor={id('port')} error={errors.port}>
                    <input
                      id={id('port')}
                      required
                      value={form.port}
                      onChange={(e) => set('port', e.target.value)}
                      className={cn(inputClass, borderFor('port'))}
                    />
                  </Field>

                  <Field label={f.eta} htmlFor={id('eta')} hint={f.optional}>
                    <input
                      id={id('eta')}
                      value={form.eta}
                      onChange={(e) => set('eta', e.target.value)}
                      className={cn(inputClass, borderFor('eta'))}
                    />
                  </Field>

                  <Field label={f.system} htmlFor={id('system')} hint={f.optional}>
                    <input
                      id={id('system')}
                      placeholder={f.systemPlaceholder}
                      value={form.system}
                      onChange={(e) => set('system', e.target.value)}
                      className={cn(inputClass, borderFor('system'))}
                    />
                  </Field>
                </div>

                <Field label={f.description} htmlFor={id('description')} error={errors.description}>
                  <textarea
                    id={id('description')}
                    required
                    rows={5}
                    placeholder={f.descriptionPlaceholder}
                    value={form.description}
                    onChange={(e) => set('description', e.target.value)}
                    className={cn(inputClass, 'resize-y', borderFor('description'))}
                  />
                </Field>

                <div className="border-navy-800 grid gap-5 border-t pt-8 sm:grid-cols-2">
                  <Field label={f.contactName} htmlFor={id('contactName')} error={errors.contactName}>
                    <input
                      id={id('contactName')}
                      required
                      autoComplete="name"
                      value={form.contactName}
                      onChange={(e) => set('contactName', e.target.value)}
                      className={cn(inputClass, borderFor('contactName'))}
                    />
                  </Field>

                  <Field label={f.company} htmlFor={id('company')} hint={f.optional}>
                    <input
                      id={id('company')}
                      autoComplete="organization"
                      value={form.company}
                      onChange={(e) => set('company', e.target.value)}
                      className={cn(inputClass, borderFor('company'))}
                    />
                  </Field>

                  <Field label={f.email} htmlFor={id('email')} error={errors.email}>
                    <input
                      id={id('email')}
                      type="email"
                      required
                      autoComplete="email"
                      value={form.email}
                      onChange={(e) => set('email', e.target.value)}
                      className={cn(inputClass, borderFor('email'))}
                    />
                  </Field>

                  <Field label={f.phone} htmlFor={id('phone')} hint={f.optional}>
                    <input
                      id={id('phone')}
                      type="tel"
                      autoComplete="tel"
                      value={form.phone}
                      onChange={(e) => set('phone', e.target.value)}
                      className={cn(inputClass, borderFor('phone'))}
                    />
                  </Field>
                </div>

                <Button
                  type="submit"
                  variant={form.urgency === 'emergency' ? 'alert' : 'primary'}
                  size="lg"
                  disabled={submitting}
                  className="w-full sm:w-auto"
                >
                  {submitting ? f.submitting : f.submit}
                </Button>
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
                    href="mailto:service@ima.example"
                    className="text-signal-400 hover:text-signal-300 font-mono text-sm transition-colors"
                  >
                    service@ima.example
                  </a>
                </dd>
              </div>

              <div>
                <dt className="text-navy-500 text-xs font-semibold tracking-wide uppercase">
                  {t.contact.direct.address}
                </dt>
                <dd className="text-navy-300 mt-2 text-sm leading-relaxed">
                  {t.contact.direct.addressValue}
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
