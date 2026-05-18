import { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Bell, Sparkles, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHaptic } from "@/hooks/useHaptic";

type Tab = {
  path: string;
  label: string;
  Icon: typeof Bell;
};

const TABS: Tab[] = [
  { path: "/home",     label: "Xabarnoma",  Icon: Bell     },
  { path: "/premium",  label: "Premium",    Icon: Sparkles },
  { path: "/settings", label: "Sozlamalar", Icon: Settings },
];

type Props = { children: ReactNode };

/**
 * Bottom tabbar — the only persistent chrome in the mini-app. Cream surface,
 * coral active accent, hairline top divider. Sticks to the bottom safe-area.
 */
export function BottomNav({ children }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const haptic = useHaptic();

  const handleTab = (path: string, active: boolean) => {
    haptic.selection();
    if (active) {
      // iOS convention — tapping the active tab scrolls back to top.
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    navigate(path);
  };

  return (
    <>
      {children}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 bg-canvas border-t border-hairline"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="mx-auto max-w-screen-sm h-[76px] grid grid-cols-3">
          {TABS.map(({ path, label, Icon }) => {
            const active = location.pathname === path;
            return (
              <button
                key={path}
                type="button"
                onClick={() => handleTab(path, active)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/30",
                  active ? "text-coral" : "text-muted hover:text-ink",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon
                  className={cn("h-7 w-7", active && "fill-coral/10")}
                  strokeWidth={active ? 2 : 1.75}
                />
                <span className="text-caption font-medium">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
