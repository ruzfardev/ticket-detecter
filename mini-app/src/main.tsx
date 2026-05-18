import React from "react";
import ReactDOM from "react-dom/client";
import { AppRoot } from "@telegram-apps/telegram-ui";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

import "@telegram-apps/telegram-ui/dist/styles.css";
import "./ui/tokens.css";
import "./styles.css";

import { App } from "./App";
import { useTelegram } from "./hooks/useTelegram";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Root() {
  const { colorScheme, platform } = useTelegram();
  return (
    <AppRoot appearance={colorScheme} platform={platform}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
      <Toaster position="top-center" theme={colorScheme} />
    </AppRoot>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<Root />);
