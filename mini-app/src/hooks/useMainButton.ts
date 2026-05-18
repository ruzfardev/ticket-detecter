import { useEffect } from "react";
import { useTelegram } from "./useTelegram";

type Opts = {
  text: string;
  enabled?: boolean;
  visible?: boolean;
  progress?: boolean;
  onClick: () => void;
};

export function useMainButton({
  text,
  enabled = true,
  visible = true,
  progress = false,
  onClick,
}: Opts) {
  const { mainButton } = useTelegram();

  useEffect(() => {
    if (!mainButton) return;
    mainButton.setText(text);
    if (visible) mainButton.show(); else mainButton.hide();
    if (enabled) mainButton.enable(); else mainButton.disable();
    if (progress) mainButton.showProgress?.(); else mainButton.hideProgress?.();
    mainButton.onClick(onClick);
    return () => {
      mainButton.offClick(onClick);
      mainButton.hide();
      mainButton.hideProgress?.();
    };
  }, [mainButton, text, enabled, visible, progress, onClick]);
}
