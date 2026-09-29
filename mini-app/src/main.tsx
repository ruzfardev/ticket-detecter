import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

import "./index.css";

import { App } from "./App";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Root() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
      <Toaster
        position="bottom-center"
        offset={96}
        toastOptions={{
          classNames: {
            toast:
              "!bg-canvas !border !border-hairline !text-ink !font-sans !rounded-lg !shadow-md",
            title: "!text-ink !text-body-md !font-medium",
            description: "!text-muted !text-body-sm",
          },
        }}
      />
    </QueryClientProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<Root />);
