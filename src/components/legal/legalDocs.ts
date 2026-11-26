import { FileText, RefreshCw, ShieldCheck, type LucideIcon } from "lucide-react";

/** The date every legal document was last revised, shown as "Last updated". */
export const LEGAL_LAST_UPDATED = "November 26, 2026";

export type LegalDoc = {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
};

export const LEGAL_DOCS: LegalDoc[] = [
  {
    href: "/legal/terms",
    label: "Terms of Service",
    icon: FileText,
    description: "The rules that govern your use of Verlab",
  },
  {
    href: "/legal/privacy",
    label: "Privacy Policy",
    icon: ShieldCheck,
    description: "What we collect, how we use it, and your rights",
  },
  {
    href: "/legal/refunds",
    label: "Refund Policy",
    icon: RefreshCw,
    description: "14-day refunds, cancelling, and what happens after",
  },
];
