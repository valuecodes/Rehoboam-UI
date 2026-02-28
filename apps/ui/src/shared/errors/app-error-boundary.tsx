import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

import "./app-error-boundary.css";

type AppErrorBoundaryProps = Readonly<{
  children: ReactNode;
}>;

type AppErrorBoundaryState = Readonly<{
  hasError: boolean;
}>;

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  public state: AppErrorBoundaryState = {
    hasError: false,
  };

  public static getDerivedStateFromError(): AppErrorBoundaryState {
    return {
      hasError: true,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("Unhandled application render error", error, errorInfo);
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <main
          aria-live="assertive"
          className="app-error-boundary"
          role="alert"
        >
          <section className="app-error-boundary__panel">
            <p className="app-error-boundary__status">System Interruption</p>
            <h1 className="app-error-boundary__title">
              The interface hit an unexpected error and stopped rendering.
            </h1>
            <p className="app-error-boundary__message">
              Reload to restart the session.
            </p>
            <button
              className="app-error-boundary__reload"
              onClick={() => {
                window.location.reload();
              }}
              type="button"
            >
              Reload Interface
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
