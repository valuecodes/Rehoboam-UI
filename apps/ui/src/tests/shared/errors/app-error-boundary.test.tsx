import React, { act } from "react";
import { createRoot } from "react-dom/client";

import { AppErrorBoundary } from "../../../shared/errors/app-error-boundary";

const testGlobals = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

const ThrowOnRender = () => {
  throw new Error("test crash");
};

describe("AppErrorBoundary", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot> | null;

  beforeEach(() => {
    testGlobals.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root !== null) {
      act(() => {
        root?.unmount();
      });
    }

    vi.restoreAllMocks();
    testGlobals.IS_REACT_ACT_ENVIRONMENT = undefined;
    container.remove();
  });

  it("renders child content when no error occurs", () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    act(() => {
      root?.render(
        <React.StrictMode>
          <AppErrorBoundary>
            <div>Nominal UI</div>
          </AppErrorBoundary>
        </React.StrictMode>
      );
    });

    expect(container.textContent).toContain("Nominal UI");
    expect(container.textContent).not.toContain("System Interruption");
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("renders the fallback and logs when a child throws", () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    act(() => {
      root?.render(
        <React.StrictMode>
          <AppErrorBoundary>
            <ThrowOnRender />
          </AppErrorBoundary>
        </React.StrictMode>
      );
    });

    const fallback = container.querySelector('[role="alert"]');
    const reloadButton = container.querySelector("button");

    expect(fallback).not.toBeNull();
    expect(fallback?.getAttribute("aria-live")).toBe("assertive");
    expect(container.textContent).toContain("System Interruption");
    expect(container.textContent).toContain(
      "The interface hit an unexpected error and stopped rendering."
    );
    expect(container.textContent).toContain("Reload to restart the session.");
    expect(reloadButton?.textContent).toBe("Reload Interface");
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
