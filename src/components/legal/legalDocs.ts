import { FileText, RefreshCw, ShieldCheck, type LucideIcon } from "lucide-react";

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
    description: "The rules that govern your use of Clypa.",
  },
  {
    href: "/legal/privacy",
    label: "Privacy Policy",
    icon: ShieldCheck,
    description: "What we collect, how we use it, and your rights.",
  },
  {
    href: "/legal/refunds",
    label: "Refund Policy",
    icon: RefreshCw,
    description: "Billing, cancellation, and our no-refund policy.",
  },
];
