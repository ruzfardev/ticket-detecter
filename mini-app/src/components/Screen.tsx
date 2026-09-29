import {
  Children, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import * as m from "motion/react-m";
import { useScroll, useTransform } from "motion/react";
import { ChevronLeft } from "lucide-react";

import { cn } from "@/lib/utils";
import { reveal } from "@/lib/motion";
import { isTabRoute } from "@/lib/routes";
import { inTelegram } from "@/lib/platform";
import { useSmartBack } from "@/hooks/useBackButton";
import { IconButton } from "@/components/ui/icon-button";
import { NavBar } from "./NavBar";
import { WizardSteps } from "./WizardSteps";

type Props = {
  children: ReactNode;
  /** Reserve bottom space for the floating tab bar. */
  tabbed?: boolean;
  /** Center contents vertically (Welcome / StatusView). */
  center?: boolean;
  /** Add the standard horizontal page padding. */
  padded?: boolean;
  /** Show the wizard step indicator in the top bar. */
  wizard?: boolean;
  /** Large title (34pt), which collapses into the top bar as you scroll. */
  title?: ReactNode;
  /** Secondary line under the large title. */
  subtitle?: ReactNode;
  /** Small title for the top bar when `title` is not a plain string. */
  navTitle?: string;
  /** Controls on the right of the top bar. */
  actions?: ReactNode;
  /** Draw the top bar at all. Defaults to yes when there is a title, actions or wizard. */
  nav?: boolean;
  /** Stagger the blocks in on arrival (default). */
  reveal?: boolean;
  className?: string;
};

/** The in-app back chevron. Inside Telegram the native Back button does this
 *  job, so it only appears in a plain browser. */
function InAppBack() {
  const goBack = useSmartBack();
  return (
    <IconButton aria-label="Orqaga" onClick={goBack}>
      <ChevronLeft strokeWidth={2.6} />
    </IconButton>
  );
}

/**
 * The frame every screen sits in: a sticky top bar, a large title, then the
 * screen's blocks — each one rising in with a spring, a beat after the last.
 * Fixed chrome (tab bar, sticky actions, sheets) is deliberately NOT in here:
 * a page that is mid-transition carries a transform, which would drag fixed
 * children along with it.
 */
export function Screen({
  children, tabbed, center, padded = true, wizard, title, subtitle, navTitle,
  actions, nav, reveal: stagger = true, className,
}: Props) {
  const location = useLocation();
  const tabRoot = isTabRoute(location.pathname);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const [threshold, setThreshold] = useState(0);
  const { scrollY } = useScroll();

  const showNav = nav ?? !!(title || actions || wizard);
  const hasBack = !tabRoot && !inTelegram();
  // Nothing to put in the bar but a small title: let it float over the page so
  // the large title can sit at the top, and appear only when it is needed.
  const overlayNav = showNav && !hasBack && !actions && !wizard;
  const navText = navTitle ?? (typeof title === "string" ? title : undefined);

  // A new screen is a new "page": move focus into it so keyboard and screen
  // reader users land there instead of on the control that was just tapped.
  // Never steals focus from a field that asked for it (autoFocus runs first).
  useEffect(() => {
    if (document.activeElement === document.body || document.activeElement === null) {
      mainRef.current?.focus({ preventScroll: true });
    }
  }, []);

  // Where the large title has scrolled fully under the bar.
  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) { setThreshold(0); return; }
    const measure = () => {
      const r = el.getBoundingClientRect();
      setThreshold(Math.max(0, r.bottom + window.scrollY - 52 - 8));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [title]);

  const range = useMemo(
    () => (title ? [Math.max(0, threshold - 26), Math.max(1, threshold)] : [0, 22]),
    [title, threshold],
  );
  const progress = useTransform(scrollY, range, [0, 1], { clamp: true });

  const blocks = stagger && !center ? Children.toArray(children) : null;
  const longTitle = typeof title === "string" && title.length > 16;

  return (
    <div className={cn("relative min-h-[100dvh]", center && "flex flex-col")}>
      {showNav && (
        <NavBar
          progress={progress}
          title={navText}
          overlay={overlayNav}
          leading={hasBack ? <InAppBack /> : undefined}
          trailing={actions}
          center={wizard ? <WizardSteps current={location.pathname} /> : undefined}
        />
      )}

      <main
        ref={mainRef}
        tabIndex={-1}
        className={cn(
          "outline-none",
          padded && "page-frame",
          (!showNav || overlayNav) && "pt-[calc(var(--safe-t)+14px)]",
          tabbed
            ? "pb-[calc(var(--tabbar-h)+var(--tabbar-gap)+var(--safe-b)+34px)]"
            : "pb-[calc(var(--safe-b)+32px)]",
          center && "flex flex-1 flex-col items-center justify-center",
          className,
        )}
      >
        {(title || subtitle) && (
          <div className="pb-5 pt-1">
            {title && (
              <h1
                ref={titleRef}
                className={cn(
                  "font-display text-ink [text-wrap:balance]",
                  longTitle ? "text-display-lg" : "text-display-xl",
                )}
              >
                {title}
              </h1>
            )}
            {subtitle && <p className="mt-1.5 text-body-md text-muted">{subtitle}</p>}
          </div>
        )}

        {blocks ? (
          <m.div initial="hidden" animate="show" className="space-y-6">
            {blocks.map((child, i) => (
              <m.div
                key={(child as { key?: string }).key ?? i}
                variants={reveal}
                custom={i}
              >
                {child}
              </m.div>
            ))}
          </m.div>
        ) : (
          <div className={cn(!center && "space-y-6", center && "w-full")}>{children}</div>
        )}
      </main>
    </div>
  );
}
