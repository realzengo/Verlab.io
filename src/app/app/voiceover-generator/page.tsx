import { Suspense } from "react";
import { VoiceoverGenerator } from "@/components/features/VoiceoverGenerator";

export default function VoiceoverGeneratorPage() {
  return (
    <div className="pt-2">
      <Suspense fallback={null}>
        <VoiceoverGenerator />
      </Suspense>
    </div>
  );
}
