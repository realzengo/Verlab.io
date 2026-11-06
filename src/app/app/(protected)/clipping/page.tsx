import { Suspense } from "react";
import { ClippingPage } from "@/components/clipping/ClippingPage";
import { ClippingSkeleton } from "@/components/skeletons/ToolSkeletons";

export default function Page() {
  return (
    <Suspense fallback={<ClippingSkeleton />}>
      <ClippingPage />
    </Suspense>
  );
}
