import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTelegram } from "./useTelegram";

export function useBackButton(visible: boolean) {
  const { backButton } = useTelegram();
  const navigate = useNavigate();

  useEffect(() => {
    if (!backButton) return;
    if (visible) backButton.show(); else backButton.hide();
    const handler = () => navigate(-1);
    backButton.onClick(handler);
    return () => {
      backButton.offClick(handler);
      backButton.hide();
    };
  }, [backButton, visible, navigate]);
}
