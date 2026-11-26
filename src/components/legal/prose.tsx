import type { ReactNode } from "react";

// Shared prose styles for the legal documents, so every clause reads the
// same: one link treatment, quiet list markers, and mono clause numbers.

/** Clause number as shown in the margin and the table of contents: "01", "02". */
export const clauseNumber = (index: number) => String(index + 1).padStart(2, "0");

export const LEGAL_LINK =
  "text-primary underline decoration-primary/30 underline-offset-[3px] transition-colors hover:decoration-primary";

export const LEGAL_LIST = "list-disc space-y-2 pl-5 marker:text-subtle/50";

/**
 * A sub-clause heading inside a section. Deliberately unnumbered: sections
 * are numbered automatically by LegalPageLayout, and hand-typed sub-numbers
 * ("4.1") drifted out of step whenever a section was added or moved.
 */
export function LegalSubheading({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 text-base font-semibold text-heading not-first:mt-8">{children}</h3>;
}
