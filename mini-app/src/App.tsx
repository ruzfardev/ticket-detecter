import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";

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
import { Settings } from "./screens/Settings";
import { MainLayout } from "./components/MainLayout";
import { useTelegram } from "./hooks/useTelegram";

// Screens that show the bottom Tabbar.
const tabbed = (el: JSX.Element) => <MainLayout>{el}</MainLayout>;

export function App() {
  const { backButton } = useTelegram();
  const location = useLocation();
  const navigate = useNavigate();

  // Back button: hide on tabbed screens, show on wizard / details / donate.
  useEffect(() => {
    if (!backButton) return;
    const tabbedPath = ["/home", "/premium", "/settings"].includes(location.pathname);
    if (tabbedPath || location.pathname === "/") backButton.hide();
    else backButton.show();

    const handler = () => navigate(-1);
    backButton.onClick(handler);
    return () => backButton.offClick(handler);
  }, [backButton, location.pathname, navigate]);

  return (
    <Routes>
      <Route path="/"           element={<Welcome />} />

      {/* Tabbed (main) screens */}
      <Route path="/home"     element={tabbed(<Home />)} />
      <Route path="/premium"  element={tabbed(<Premium />)} />
      <Route path="/settings" element={tabbed(<Settings />)} />

      {/* Stack screens (no tabbar) */}
      <Route path="/new"          element={<RoutePicker />} />
      <Route path="/new/date"     element={<DateScreen />} />
      <Route path="/new/train"    element={<TrainPicker />} />
      <Route path="/new/car-type" element={<CarTypePicker />} />
      <Route path="/new/berth"    element={<BerthPicker />} />
      <Route path="/new/confirm"  element={<Confirm />} />
      <Route path="/sub/:id"      element={<SubDetails />} />
      <Route path="/donate"       element={<Donate />} />

      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}
