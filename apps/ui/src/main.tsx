import React from "react";
import { createRoot } from "react-dom/client";

import "@fontsource/barlow-condensed/300.css";
import "@fontsource/barlow-condensed/400.css";
import "@fontsource/barlow-condensed/500.css";
import "@fontsource/barlow-condensed/600.css";
import "./index.css";

import { App } from "./app";
import { AppErrorBoundary } from "./shared/errors/app-error-boundary";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
);
