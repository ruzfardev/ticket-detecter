import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import { Welcome } from "./screens/Welcome";
import { Home } from "./screens/Home";
import { NewWatch } from "./screens/NewWatch";
import { SubDetails } from "./screens/SubDetails";
import { Premium } from "./screens/Premium";
import { Donate } from "./screens/Donate";
import { Settings } from "./screens/Settings";
import { History } from "./screens/History";
import { MainLayout } from "./components/MainLayout";
import { useTelegram } from "./hooks/useTelegram";

// Screens that show the bottom Tabbar.
const tabbed = (el: JSX.Element) => <MainLayout>{el}</MainLayout>;
const TABBED_PATHS = ["/home", "/premium", "/settings"];

export function App() {
  const { backButton, mainButton } = useTelegram();
  const location = useLocation();
  const navigate = useNavigate();

  // We use our own in-app buttons now. Keep the native MainButton hidden
  // everywhere so it never leaks across pages.
  useEffect(() => {
    mainButton?.hide?.();
  }, [mainButton, location.pathname]);

  // Native back button mirrors the in-app PageHeader back arrow.
  useEffect(() => {
    if (!backButton) return;
    const isTab = TABBED_PATHS.includes(location.pathname) || location.pathname === "/";
    if (isTab) backButton.hide();
    else backButton.show();

    const handler = () => navigate(-1);
    backButton.onClick(handler);
    return () => backButton.offClick(handler);
  }, [backButton, location.pathname, navigate]);

  return (
    <Routes>
      <Route path="/" element={<Welcome />} />

      {/* Tabbed (main) screens */}
      <Route path="/home"     element={tabbed(<Home />)} />
      <Route path="/premium"  element={tabbed(<Premium />)} />
      <Route path="/settings" element={tabbed(<Settings />)} />

      {/* Stack screens (no tabbar) */}
      <Route path="/new"      element={<NewWatch />} />
      <Route path="/sub/:id"  element={<SubDetails />} />
      <Route path="/donate"   element={<Donate />} />
      <Route path="/history"  element={<History />} />

      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}
