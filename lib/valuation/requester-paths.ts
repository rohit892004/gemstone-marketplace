import { VALUATION_ROUTES } from "./routes";

/**
 * Requester-side paths. Built from VALUATION_ROUTES where a path exists there, so each path is typed once.
 * App-relative only: redirects and links never take an absolute URL from user input.
 */
export const REQUESTER_PATHS = {
  /** Landing page and standalone start. */
  landing: VALUATION_ROUTES.wizard,
  /** Step 1 of the wizard: details and photos. */
  upload: (id: string) => `/valuation/${id}/upload`,
  /** Step 2 of the wizard: review and submit. */
  review: (id: string) => `/valuation/${id}/review`,
  /** Step 3 and the requester's result page. */
  result: (id: string) => VALUATION_ROUTES.result(id),
  /** Public verification page. Never a link to any other valuation. */
  verify: (reference: string) => VALUATION_ROUTES.verify(reference),
  /** Requester dashboard tabs. */
  buyerValuations: VALUATION_ROUTES.dashboardTab,
  buyerReports: "/buyer/reports",
  sellerValuations: "/seller/valuations",
  sellerReports: "/seller/reports",
  /** Route handlers for the PDF and photos. Access is checked there. */
  pdf: (id: string) => `/api/valuation/${id}/pdf`,
  media: (mediaId: string, variant: "thumb" | "full") => `/api/valuation/media/${mediaId}/${variant}`,
  /** Sign-in with a return path. */
  login: (next: string) => `/login?next=${encodeURIComponent(next)}`,
} as const;
