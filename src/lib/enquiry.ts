/**
 * Delivery for the breakdown report form.
 *
 * The site is a static build on GitHub Pages — there is no server of ours to
 * POST to. Reports go to Web3Forms, a relay that turns a browser POST into an
 * email to the address its access key was issued for. That keeps the whole
 * site a static artifact while the form still actually delivers.
 *
 * If no key is configured the form does NOT pretend to send: it hands the
 * report to the visitor's own mail client, fully composed. A breakdown report
 * is the one thing on this site that must never be silently dropped.
 */
import type { Urgency } from '@/i18n/dictionaries/el'

export type Enquiry = {
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

/** How the report actually left the browser — the success screen says which. */
export type Delivery = 'sent' | 'mail-client'

export class EnquiryError extends Error {}

const ENDPOINT = 'https://api.web3forms.com/submit'

/** Long enough for a phone on ship wifi, short enough to fail before the user does. */
const TIMEOUT_MS = 20_000

/** The office reads these; they are labelled in English regardless of site language. */
const URGENCY_LABEL: Record<Urgency, string> = {
  emergency: 'EMERGENCY — vessel stopped',
  urgent: 'Urgent — within days',
  planned: 'Planned work',
}

const LABELS: [keyof Enquiry, string][] = [
  ['vesselName', 'Vessel'],
  ['imo', 'IMO'],
  ['vesselType', 'Vessel type'],
  ['port', 'Port / location'],
  ['eta', 'ETA / window'],
  ['system', 'System'],
  ['description', 'Fault description'],
  ['contactName', 'Contact'],
  ['company', 'Company'],
  ['email', 'Email'],
  ['phone', 'Phone'],
]

/** Only the fields that were filled in — an inbox full of empty rows reads as noise. */
function filled(enquiry: Enquiry): [string, string][] {
  const rows: [string, string][] = [['Urgency', URGENCY_LABEL[enquiry.urgency]]]
  for (const [key, label] of LABELS) {
    const value = enquiry[key].trim()
    if (value) rows.push([label, value])
  }
  return rows
}

/**
 * Subject line built to be triaged from a notification preview, before the
 * mail is even opened: urgency first, then the two facts that decide who goes
 * and where — the vessel and the port.
 */
export function subjectFor(enquiry: Enquiry): string {
  const tag = enquiry.urgency === 'emergency' ? 'EMERGENCY' : enquiry.urgency === 'urgent' ? 'URGENT' : 'PLANNED'
  const vessel = enquiry.vesselName.trim() || 'Unnamed vessel'
  const imo = enquiry.imo.trim() ? ` (IMO ${enquiry.imo.trim()})` : ''
  const port = enquiry.port.trim() ? ` — ${enquiry.port.trim()}` : ''
  return `[${tag}] ${vessel}${imo}${port}`
}

/** The same report as plain text, for the mail-client path and the error escape hatch. */
export function bodyFor(enquiry: Enquiry): string {
  return filled(enquiry)
    .map(([label, value]) => `${label}: ${value}`)
    .join('\n')
}

/** A pre-composed message to `to`, carrying the whole report. */
export function mailtoFor(enquiry: Enquiry, to: string): string {
  const query = new URLSearchParams({ subject: subjectFor(enquiry), body: bodyFor(enquiry) })
  // URLSearchParams encodes spaces as '+', which mail clients paste literally.
  return `mailto:${to}?${query.toString().replace(/\+/g, '%20')}`
}

/**
 * Send the report. Resolves with the route it took; throws `EnquiryError` if
 * nothing was delivered, leaving the form filled in so the user can retry or
 * fall back to the phone.
 *
 * @param honeypot Contents of the hidden field no human ever fills in.
 */
export async function submitEnquiry(
  enquiry: Enquiry,
  { fallbackTo, honeypot = '' }: { fallbackTo: string; honeypot?: string },
): Promise<Delivery> {
  const accessKey = import.meta.env.VITE_WEB3FORMS_KEY?.trim()

  if (!accessKey) {
    // No relay configured. Hand the composed report to the visitor's mail
    // client rather than dropping it on the floor.
    window.location.href = mailtoFor(enquiry, fallbackTo)
    return 'mail-client'
  }

  const payload: Record<string, string> = {
    access_key: accessKey,
    subject: subjectFor(enquiry),
    from_name: enquiry.contactName.trim() || 'imagreece.gr',
    // Web3Forms uses a field named `email` as the Reply-To, so hitting reply
    // in the inbox answers the person who reported the fault.
    email: enquiry.email.trim(),
    botcheck: honeypot,
  }
  for (const [label, value] of filled(enquiry)) payload[label] = value

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
  } catch (cause) {
    // Offline, DNS, timeout, blocked by an extension — indistinguishable here.
    throw new EnquiryError('Could not reach the form service.', { cause })
  } finally {
    clearTimeout(timer)
  }

  // A non-2xx carries a JSON reason; a 2xx can still report success: false.
  const result = (await response.json().catch(() => null)) as { success?: boolean; message?: string } | null
  if (!response.ok || !result?.success) {
    throw new EnquiryError(result?.message ?? `Form service returned ${response.status}.`)
  }

  return 'sent'
}
