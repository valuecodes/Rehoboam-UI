import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app";
import { AppErrorBoundary } from "./shared/errors/app-error-boundary";

import "@fontsource/barlow-condensed/latin-400.css";
import "@fontsource/barlow-condensed/latin-500.css";
import "./index.css";

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
