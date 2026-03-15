import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "@fontsource/barlow-condensed/latin-400.css";
import "@fontsource/barlow-condensed/latin-500.css";
import "./index.css";

import { App } from "./app";
import { AppErrorBoundary } from "./shared/errors/app-error-boundary";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>
);
