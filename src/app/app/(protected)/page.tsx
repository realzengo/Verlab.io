import { CreativeToolsSection } from "@/components/dashboard/home/CreativeToolsSection";
import { FeaturedTools } from "@/components/dashboard/home/FeaturedTools";
import { ToolsGrid } from "@/components/dashboard/home/ToolsGrid";

export default function AppHome() {
  return (
    <div className="flex flex-col gap-10 pt-6 sm:pt-8">
      <CreativeToolsSection />

      <FeaturedTools />

      <ToolsGrid />
    </div>
  );
}
