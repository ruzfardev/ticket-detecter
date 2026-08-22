import { Screen } from "@/components/Screen";
import { Wordmark } from "@/components/Wordmark";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Home's loading state mirrors Home's layout (header, hero, one list group) so
 * the page does not "load twice" after the splash — the brand header is real,
 * only the data blocks are grey. Keep the block sizes in step with Home.tsx.
 */
export function HomeSkeleton() {
  return (
    <Screen tabbed padded>
      <header className="flex h-8 items-center justify-between">
        <Wordmark size="sm" />
        <Skeleton className="h-8 w-8 rounded-pill" />
      </header>
      <Skeleton className="h-[200px] rounded-xl" />
      <div className="space-y-2">
        <Skeleton className="mx-4 h-3 w-28" />
        <div className="space-y-px overflow-hidden rounded-lg">
          {[0, 1, 2].map(i => (
            <Skeleton key={i} className="h-14 rounded-none" />
          ))}
        </div>
      </div>
    </Screen>
  );
}
