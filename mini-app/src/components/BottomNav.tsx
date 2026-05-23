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
 * Floating, compact active-pill tabbar — the only persistent chrome in the
 * mini-app. A detached rounded panel hovers above the safe-area; the active
 * tab morphs into a coral pill (icon + label) while the rest stay icon-only.
 * Translucent + blurred so content scrolls pleasantly beneath it.
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
      <div
        className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pointer-events-none"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
      >
        <nav
          className={cn(
            "pointer-events-auto flex items-center gap-1 rounded-pill p-1.5",
            "border border-hairline bg-canvas/85 backdrop-blur-xl",
            "shadow-[0_8px_30px_-8px_rgba(0,0,0,0.18)] dark:shadow-[0_8px_30px_-6px_rgba(0,0,0,0.6)]",
          )}
          aria-label="Asosiy navigatsiya"
        >
          {TABS.map(({ path, label, Icon }) => {
            const active = location.pathname === path;
            return (
              <button
                key={path}
                type="button"
                onClick={() => handleTab(path, active)}
                aria-current={active ? "page" : undefined}
                aria-label={label}
                className={cn(
                  "group flex h-11 items-center justify-center rounded-pill",
                  "transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/40",
                  active
                    ? "bg-coral/12 px-4 text-coral"
                    : "w-11 px-0 text-muted hover:text-ink active:scale-95",
                )}
              >
                <Icon
                  className="h-[22px] w-[22px] shrink-0"
                  strokeWidth={active ? 2.25 : 1.75}
                />
                <span
                  className={cn(
                    "overflow-hidden whitespace-nowrap text-button font-medium",
                    "transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
                    active ? "ml-2 max-w-[120px] opacity-100" : "ml-0 max-w-0 opacity-0",
                  )}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
}
