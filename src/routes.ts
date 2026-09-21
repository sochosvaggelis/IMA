/** Single source of truth for paths — nav, footer and pages all read from here. */
export const ROUTES = {
  home: '/',
  services: '/services',
  capabilities: '/capabilities',
  projects: '/projects',
  certifications: '/certifications',
  coverage: '/coverage',
  contact: '/contact',
  privacy: '/privacy',
} as const

export type RouteKey = keyof typeof ROUTES

/** Where the breakdown CTAs go: the contact form, opened on the emergency
    tier rather than making the visitor pick it a second time. */
export const REPORT_BREAKDOWN = `${ROUTES.contact}?urgency=emergency`
