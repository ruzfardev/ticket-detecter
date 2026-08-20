import { Navigate, Route, Routes, useLocation } from "react-router-dom";

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
import { BottomNav } from "./components/BottomNav";
import { useBackButton } from "./hooks/useBackButton";
import { useThemeSync } from "./hooks/useThemeSync";

const TABBED_ROUTES = new Set(["/home", "/tickets", "/orders", "/premium", "/settings"]);
const ROOT_ROUTES = new Set(["/"]);

const tabbed = (el: JSX.Element) => <BottomNav>{el}</BottomNav>;

export function App() {
  useThemeSync();
  const location = useLocation();
  const hideBack =
    TABBED_ROUTES.has(location.pathname) || ROOT_ROUTES.has(location.pathname);
  useBackButton(!hideBack);

  return (
    <Routes>
      <Route path="/"           element={<Welcome />} />

      <Route path="/home"     element={tabbed(<Home />)} />
      <Route path="/orders"   element={tabbed(<Orders />)} />
      <Route path="/premium"  element={tabbed(<Premium />)} />
      <Route path="/settings" element={tabbed(<Settings />)} />

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
      <Route path="/tickets"          element={tabbed(<Tickets />)} />
      <Route path="/donate"         element={<Donate />} />
      <Route path="/donate/custom"  element={<DonateCustom />} />

      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}
