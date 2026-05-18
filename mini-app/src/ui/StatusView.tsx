import { ReactNode } from "react";
import { Placeholder, Spinner } from "@telegram-apps/telegram-ui";
import { Screen } from "./Screen";

type Props = {
  kind: "loading" | "error" | "empty";
  header?: string;
  description?: string;
  children?: ReactNode;
};

const DEFAULTS = {
  loading: { header: "", description: "Yuklanmoqda..." },
  error:   { header: "Xato", description: "Bir oz keyin qayta urinib ko'ring." },
  empty:   { header: "Hech narsa yo'q", description: "" },
};

export function StatusView({ kind, header, description, children }: Props) {
  const d = DEFAULTS[kind];
  return (
    <Screen center>
      <Placeholder header={header ?? d.header} description={description ?? d.description}>
        {kind === "loading" && <Spinner size="l" />}
        {children}
      </Placeholder>
    </Screen>
  );
}
