/**
 * The facts every legal page cites. Review before going live: the operating entity, its contact
 * address and the governing law are the operator's, not the software's. Self-hosters change these
 * to their own.
 */
export const LEGAL = {
  product: "Evnelo",
  entity: "InEvent",
  website: "https://evnelo.com",
  contactEmail: "dev@inevent.com", // evnelo.com has no mailbox yet; forward support@evnelo.com here when it does
  governingLaw: "the laws of the State of Delaware, United States",
  updated: "2026-09-14",
} as const;

export const LEGAL_DOCS = ["terms", "privacy", "refunds"] as const;
export type LegalDoc = (typeof LEGAL_DOCS)[number];
