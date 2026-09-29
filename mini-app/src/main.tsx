import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LazyMotion, MotionConfig, domMax } from "motion/react";
import { Toaster } from "sonner";

import "./index.css";

import { App } from "./App";
import { LightProvider } from "./hooks/useLight";
import { spring } from "./lib/motion";

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
    // reducedMotion="user": with the OS setting on, transforms and layout
    // animations are dropped and only opacity changes remain.
    <MotionConfig reducedMotion="user" transition={spring.smooth}>
      <LazyMotion features={domMax} strict>
        <LightProvider>
          <QueryClientProvider client={queryClient}>
            <BrowserRouter>
              <App />
            </BrowserRouter>
            {/* Toasts are glass banners that drop from the top, clear of the
                tab bar and the floating actions at the bottom. */}
            <Toaster
              position="top-center"
              offset="calc(var(--safe-t) + 10px)"
              toastOptions={{
                unstyled: true,
                classNames: {
                  toast:
                    "glass pointer-events-auto mx-auto flex w-fit max-w-[92vw] items-center gap-3 rounded-[22px] px-5 py-3.5 text-body-sm text-ink",
                  title: "font-semibold",
                  description: "text-muted",
                  success: "[&_[data-icon]]:text-success",
                  error: "[&_[data-icon]]:text-error",
                },
              }}
            />
          </QueryClientProvider>
        </LightProvider>
      </LazyMotion>
    </MotionConfig>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<Root />);
