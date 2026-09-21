/**
 * Where the company can actually be reached.
 *
 * The email lives here rather than in the dictionaries because it is an
 * address, not a translation: the same string in both languages, and needed
 * outside React by the enquiry module's mail-client fallback. Two copies in
 * two dictionaries is exactly the drift this avoids.
 */
export const CONTACT_EMAIL = 'imagreece@gmail.com'

/** Turns a display phone number into a dialable tel: href. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`
}
