import { SearchLoadingLogo } from "@/components/ui/SearchLoadingLogo";

/** Full-page loading state shown while a route segment streams in --
 * the same rotating logo mark used for in-page fetches (see
 * SearchLoadingLogo), centered in the viewport below the top bar instead
 * of a skeleton layout. */
export function PageLoader() {
  return (
    <div className="flex min-h-[calc(100dvh-4.5rem)] w-full items-center justify-center">
      <SearchLoadingLogo size={88} />
    </div>
  );
}
