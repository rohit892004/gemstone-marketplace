/**
 * App paths for valuations. Shared by the server actions, notifications and pages, so a path is never
 * typed twice. Each path is an app-relative href (notifications accept only relative paths).
 */
export const VALUATION_ROUTES = {
  /** Standalone wizard, and the entry for "Request valuation" on a product page. */
  wizard: "/valuation",
  /** Requester results page. */
  result: (id: string) => `/valuation/${id}`,
  /** Public verification page. Shows only the reference, date, type, status and method. */
  verify: (reference: string) => `/valuation/verify/${reference}`,
  /** Valuator queue and valuator detail page. Valuators see only their assigned requests. */
  valuatorQueue: "/valuator/queue",
  valuatorDetail: (id: string) => `/valuator/valuations/${id}`,
  /** Admin queue and admin detail page. */
  adminQueue: "/admin/valuations",
  adminDetail: (id: string) => `/admin/valuations/${id}`,
  /** Requester dashboard tab. */
  dashboardTab: "/buyer/valuations",
} as const;
