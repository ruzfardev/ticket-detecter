import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useTelegram } from "@/hooks/useTelegram";

type Props = {
  title?: string;
  /** Where back navigates. Defaults to history -1. */
  onBack?: () => void;
  /** Hide the back button (e.g. root-level stack pages). */
  hideBack?: boolean;
  right?: ReactNode;
};

export function PageHeader({ title, onBack, hideBack, right }: Props) {
  const navigate = useNavigate();
  const { haptic } = useTelegram();

  const back = () => {
    haptic?.impactOccurred?.("light");
    if (onBack) onBack();
    else navigate(-1);
  };

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 8px",
        minHeight: 52,
        background: "var(--bg)",
        // subtle blur so content scrolls cleanly beneath
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      {!hideBack && (
        <button
          type="button"
          aria-label="Orqaga"
          onClick={back}
          className="w-press"
          style={{
            all: "unset",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 38,
            height: 38,
            borderRadius: "50%",
            cursor: "pointer",
            color: "var(--accent)",
            flexShrink: 0,
          }}
        >
          <ChevronLeft size={26} strokeWidth={2.25} />
        </button>
      )}
      <h1
        style={{
          margin: 0,
          flex: 1,
          minWidth: 0,
          fontSize: 18,
          fontWeight: 700,
          color: "var(--text)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          paddingLeft: hideBack ? 8 : 0,
        }}
      >
        {title}
      </h1>
      {right && <div style={{ flexShrink: 0 }}>{right}</div>}
    </header>
  );
}
