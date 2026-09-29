import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence } from "motion/react";

import { Welcome } from "./screens/Welcome";
import { Home } from "./screens/Home";
import { RoutePicker } from "./screens/RoutePicker";
import { DateScreen } from "./screens/DateScreen";
import { TrainPicker } from "./screens/TrainPicker";
import { CarTypePicker } from "./screens/CarTypePicker";
import { BerthPicker } from "./screens/BerthPicker";
import { Confirm } from "./screens/Confirm";
import { SubDetails } from "./screens/SubDetails";
import { Premium } from "./screens/Premium";
import { Donate } from "./screens/Donate";
import { DonateCustom } from "./screens/DonateCustom";
import { Settings } from "./screens/Settings";
import { RailwayLink } from "./screens/RailwayLink";
import { Friends } from "./screens/Friends";
import { AutobuyConfig } from "./screens/AutobuyConfig";
import { CardAdd } from "./screens/CardAdd";
import { Orders } from "./screens/Orders";
import { Tickets } from "./screens/Tickets";
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

export function App() {
  useThemeSync();
  useFx();
  useScrollRestoration();

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
      </PageTransition>

      {/* Outside the page, so it survives route changes and its lens can travel. */}
      <AnimatePresence>{tabbed && <BottomNav key="tabs" />}</AnimatePresence>
    </>
  );
}
