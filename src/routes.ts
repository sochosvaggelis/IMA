/** Single source of truth for paths — nav, footer and pages all read from here. */
export const ROUTES = {
  home: '/',
  services: '/services',
  capabilities: '/capabilities',
  projects: '/projects',
  spareParts: '/spare-parts',
  certifications: '/certifications',
  coverage: '/coverage',
  contact: '/contact',
  privacy: '/privacy',
} as const

export type RouteKey = keyof typeof ROUTES

/** Where the breakdown CTAs go: the contact form, opened on the emergency
    tier rather than making the visitor pick it a second time. */
export const REPORT_BREAKDOWN = `${ROUTES.contact}?urgency=emergency`

/** The contact form as a planned-work enquiry with the System field already
    filled in — "ask us about this unit" from the spare parts showcase. */
export function enquireAbout(system: string): string {
  return `${ROUTES.contact}?${new URLSearchParams({ urgency: 'planned', system })}`
}

/** The admin panel. Outside ROUTES on purpose: it is not a page of the site,
    has no language, and must never turn up in the nav or the sitemap. */
export const ADMIN_ROOT = '/admin'
