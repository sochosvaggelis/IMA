/** Single source of truth for paths — nav, footer and pages all read from here. */
export const ROUTES = {
  home: '/',
  services: '/services',
  capabilities: '/capabilities',
  projects: '/projects',
  certifications: '/certifications',
  coverage: '/coverage',
  contact: '/contact',
} as const

export type RouteKey = keyof typeof ROUTES
