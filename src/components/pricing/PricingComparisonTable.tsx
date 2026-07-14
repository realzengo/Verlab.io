import { Check, Minus } from "lucide-react";
import type { ComparisonRow, PricingPlan } from "@/lib/types";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";

function Cell({ value }: { value: boolean | string }) {
  if (typeof value === "string") return <TableCell>{value}</TableCell>;
  return (
    <TableCell>
      {value ? <Check className="h-4 w-4 text-primary" /> : <Minus className="h-4 w-4 text-hairline" />}
    </TableCell>
  );
}

export function PricingComparisonTable({ plans, rows }: { plans: PricingPlan[]; rows: ComparisonRow[] }) {
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeaderCell>Feature</TableHeaderCell>
          {plans.map((plan) => (
            <TableHeaderCell key={plan.id}>{plan.name}</TableHeaderCell>
          ))}
        </TableRow>
      </TableHead>
      <tbody>
        {rows.map((row) => (
          <TableRow key={row.feature}>
            <TableCell className="font-medium">{row.feature}</TableCell>
            <Cell value={row.free} />
            <Cell value={row.monthly} />
            <Cell value={row.annual} />
          </TableRow>
        ))}
      </tbody>
    </Table>
  );
}
