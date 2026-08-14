import { SearchLoadingLogo } from "@/components/ui/SearchLoadingLogo";

/** Full-page loading state shown while a route segment streams in --
 * the same rotating logo mark used for in-page fetches (see
 * SearchLoadingLogo), centered to fill the content area instead of a
 * skeleton layout. */
export function PageLoader() {
  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center">
      <SearchLoadingLogo size={72} />
    </div>
  );
}
