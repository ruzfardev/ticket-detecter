import { Screen } from "@/components/Screen";
import { Logo } from "@/components/Logo";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Home's loading state mirrors Home's layout (header, hero, one list group) so
 * the page does not "load twice" after the splash — the brand mark is real,
 * only the data blocks are placeholders with a light sweeping over them. Keep
 * the block sizes in step with Home.tsx.
 */
export function HomeSkeleton() {
  return (
    <Screen tabbed padded reveal={false}>
      <header className="flex min-h-11 items-center justify-between">
        <div className="flex items-center gap-3 text-ink">
          <Logo size={28} />
          <Skeleton className="h-4 w-40 rounded-full" />
        </div>
        <Skeleton className="size-11 rounded-full" />
      </header>
      <Skeleton className="h-[292px] rounded-[30px]" />
      <div className="space-y-2">
        <Skeleton className="mx-5 h-3.5 w-28 rounded-full" />
        <div className="space-y-px overflow-hidden rounded-[26px]">
          {[0, 1, 2].map(i => (
            <Skeleton key={i} className="h-[62px] rounded-none" />
          ))}
        </div>
      </div>
    </Screen>
  );
}
