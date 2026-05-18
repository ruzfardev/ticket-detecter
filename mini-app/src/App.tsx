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
import { useTelegram } from "./hooks/useTelegram";

export function App() {
  const { backButton } = useTelegram();
  const location = useLocation();
  const navigate = useNavigate();

  // Back button: hide on /home, show elsewhere
  useEffect(() => {
    if (!backButton) return;
    const onHome = location.pathname === "/home" || location.pathname === "/";
    if (onHome) backButton.hide();
    else backButton.show();

    const handler = () => navigate(-1);
    backButton.onClick(handler);
    return () => backButton.offClick(handler);
  }, [backButton, location.pathname, navigate]);

  return (
    <Routes>
      <Route path="/"           element={<Welcome />} />
      <Route path="/home"       element={<Home />} />
      <Route path="/new"        element={<RoutePicker />} />
      <Route path="/new/date"   element={<DateScreen />} />
      <Route path="/new/train"  element={<TrainPicker />} />
      <Route path="/new/car-type" element={<CarTypePicker />} />
      <Route path="/new/berth"  element={<BerthPicker />} />
      <Route path="/new/confirm" element={<Confirm />} />
      <Route path="/sub/:id"    element={<SubDetails />} />
      <Route path="/premium"    element={<Premium />} />
      <Route path="/donate"     element={<Donate />} />
      <Route path="/settings"   element={<Settings />} />
      <Route path="*"           element={<Navigate to="/home" replace />} />
    </Routes>
  );
}
