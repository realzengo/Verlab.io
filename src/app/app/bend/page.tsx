import { BendFlow } from "@/components/features/bend/BendFlow";

export default function BendPage() {
  return (
    <div className="flex flex-col gap-6 pt-2">
      <div>
        <h2 className="text-lg font-semibold text-heading">Niche Bending</h2>
        <p className="mt-1 text-sm text-body">
          Pick a proven viral niche, tell us your own topic, and Clypa maps the winning structure across.
        </p>
      </div>
      <BendFlow />
    </div>
  );
}
