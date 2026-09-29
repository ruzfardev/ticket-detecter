import { lazy, Suspense, useEffect, type ComponentType } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence } from "motion/react";

import { Welcome } from "./screens/Welcome";
import { Home } from "./screens/Home";
import { Settings } from "./screens/Settings";
import { Orders } from "./screens/Orders";
import { Tickets } from "./screens/Tickets";
// The bot deep-links here to ask for the SMS code: keep it in the entry chunk.
import { OrderDetail } from "./screens/OrderDetail";
import { Ambient } from "./components/Ambient";
import { BottomNav } from "./components/BottomNav";
import { PageTransition } from "./components/PageTransition";
import { useBackButton } from "./hooks/useBackButton";
import { useFx } from "./hooks/useFx";
import { useScrollRestoration } from "./hooks/useScrollRestoration";
import { useThemeSync } from "./hooks/useThemeSync";
import { isTabbedRoute } from "./lib/routes";
import { useOverlays } from "./store/overlays";
import { Spinner } from "./components/ui/spinner";

/**
 * Everything a user does not open at launch is split out of the entry chunk
 * (the date step alone drags in a calendar library). The chunks are fetched
 * once the app has settled, so navigating is still instant — the split only
 * moves bytes off the critical path.
 */
const loaders = {
  RoutePicker:   () => import("./screens/RoutePicker"),
  DateScreen:    () => import("./screens/DateScreen"),
  TrainPicker:   () => import("./screens/TrainPicker"),
  CarTypePicker: () => import("./screens/CarTypePicker"),
  BerthPicker:   () => import("./screens/BerthPicker"),
  Confirm:       () => import("./screens/Confirm"),
  SubDetails:    () => import("./screens/SubDetails"),
  AutobuyConfig: () => import("./screens/AutobuyConfig"),
  RailwayLink:   () => import("./screens/RailwayLink"),
  Friends:       () => import("./screens/Friends"),
  CardAdd:       () => import("./screens/CardAdd"),
  Premium:       () => import("./screens/Premium"),
  Donate:        () => import("./screens/Donate"),
  DonateCustom:  () => import("./screens/DonateCustom"),
} as const;

function screen<K extends keyof typeof loaders>(name: K) {
  return lazy(() =>
    (loaders[name]() as Promise<Record<string, ComponentType>>).then(m => ({ default: m[name] })),
  );
}

const RoutePicker   = screen("RoutePicker");
const DateScreen    = screen("DateScreen");
const TrainPicker   = screen("TrainPicker");
const CarTypePicker = screen("CarTypePicker");
const BerthPicker   = screen("BerthPicker");
const Confirm       = screen("Confirm");
const SubDetails    = screen("SubDetails");
const AutobuyConfig = screen("AutobuyConfig");
const RailwayLink   = screen("RailwayLink");
const Friends       = screen("Friends");
const CardAdd       = screen("CardAdd");
const Premium       = screen("Premium");
const Donate        = screen("Donate");
const DonateCustom  = screen("DonateCustom");

/** Only shown if a chunk is genuinely slow: it fades in after a beat. */
function RouteFallback() {
  return (
    <div className="flex min-h-[70dvh] items-center justify-center">
      <Spinner size="lg" className="animate-[fade-in_300ms_ease-out_400ms_both] opacity-0" />
    </div>
  );
}

function usePrefetchScreens() {
  useEffect(() => {
    const run = () => Object.values(loaders).forEach(load => { load().catch(() => {}); });
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(run, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(run, 2500);
    return () => clearTimeout(t);
  }, []);
}

export function App() {
  useThemeSync();
  useFx();
  useScrollRestoration();
  usePrefetchScreens();

  const { pathname } = useLocation();
  const tabbed = isTabbedRoute(pathname);
  const openSheets = useOverlays(s => s.stack.length);
  // Telegram's Back button: hidden on the tab roots, but shown whenever a
  // sheet is open so it can close the sheet.
  useBackButton(!(tabbed || pathname === "/") || openSheets > 0);

  return (
    <>
      <Ambient />

      <PageTransition>
        <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/"           element={<Welcome />} />

          <Route path="/home"     element={<Home />} />
          <Route path="/orders"   element={<Orders />} />
          <Route path="/premium"  element={<Premium />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/tickets"  element={<Tickets />} />

          <Route path="/new"            element={<RoutePicker />} />
          <Route path="/new/date"       element={<DateScreen />} />
          <Route path="/new/train"      element={<TrainPicker />} />
          <Route path="/new/car-type"   element={<CarTypePicker />} />
          <Route path="/new/berth"      element={<BerthPicker />} />
          <Route path="/new/confirm"    element={<Confirm />} />
          <Route path="/sub/:id"          element={<SubDetails />} />
          <Route path="/sub/:id/autobuy"  element={<AutobuyConfig />} />
          <Route path="/railway-link"     element={<RailwayLink />} />
          <Route path="/friends"          element={<Friends />} />
          <Route path="/cards/add"        element={<CardAdd />} />
          <Route path="/order/:id"        element={<OrderDetail />} />
          <Route path="/donate"         element={<Donate />} />
          <Route path="/donate/custom"  element={<DonateCustom />} />

          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
        </Suspense>
      </PageTransition>

      {/* Outside the page, so it survives route changes and its lens can travel. */}
      <AnimatePresence>{tabbed && <BottomNav key="tabs" />}</AnimatePresence>
    </>
  );
}
