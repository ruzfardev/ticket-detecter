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
import { MainLayout } from "./components/MainLayout";
import { useBackButton } from "./hooks/useBackButton";

const TABBED_ROUTES = new Set(["/home", "/premium", "/settings"]);
const ROOT_ROUTES = new Set(["/"]);

const tabbed = (el: JSX.Element) => <MainLayout>{el}</MainLayout>;

export function App() {
  const location = useLocation();
  const hideBack =
    TABBED_ROUTES.has(location.pathname) || ROOT_ROUTES.has(location.pathname);
  useBackButton(!hideBack);

  return (
    <Routes>
      <Route path="/"           element={<Welcome />} />

      <Route path="/home"     element={tabbed(<Home />)} />
      <Route path="/premium"  element={tabbed(<Premium />)} />
      <Route path="/settings" element={tabbed(<Settings />)} />

      <Route path="/new"            element={<RoutePicker />} />
      <Route path="/new/date"       element={<DateScreen />} />
      <Route path="/new/train"      element={<TrainPicker />} />
      <Route path="/new/car-type"   element={<CarTypePicker />} />
      <Route path="/new/berth"      element={<BerthPicker />} />
      <Route path="/new/confirm"    element={<Confirm />} />
      <Route path="/sub/:id"        element={<SubDetails />} />
      <Route path="/donate"         element={<Donate />} />
      <Route path="/donate/custom"  element={<DonateCustom />} />

      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}
