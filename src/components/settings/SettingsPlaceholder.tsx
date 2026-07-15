import { Card } from "@/components/ui/Card";

export function SettingsPlaceholder({ label }: { label: string }) {
  return (
    <Card className="max-w-xl">
      <div className="text-sm text-body">{label}</div>
    </Card>
  );
}
