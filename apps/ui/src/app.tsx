import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";

import { RehoboamScene } from "./features/rehoboam";

import "./features/navigation/app-shell.css";

import {
  getAppRouteFromPathname,
  getPathForAppRoute,
} from "./features/navigation/app-route";
import type { AppRoute } from "./features/navigation/app-route";
import { PrivacyPolicyView } from "./features/navigation/privacy-policy-view";

type NavItem = Readonly<{
  code: string;
  label: string;
  route: AppRoute;
}>;

const appNavItems: readonly NavItem[] = [
  {
    code: "01",
    label: "Home",
    route: "home",
  },
  {
    code: "02",
    label: "HUD",
    route: "hud",
  },
  {
    code: "03",
    label: "Privacy policy",
    route: "privacy",
  },
];

const appRouteTitles: Record<AppRoute, string> = {
  home: "Rehoboam \u2014 Divergence",
  hud: "Developer HUD \u2014 Rehoboam",
  privacy: "Privacy Policy \u2014 Rehoboam",
};

export const App = () => {
  const [appRoute, setAppRoute] = useState<AppRoute>(() => {
    if (typeof window === "undefined") {
      return "home";
    }

    return getAppRouteFromPathname(window.location.pathname);
  });

  const navigateTo = useCallback((route: AppRoute) => {
    const path = getPathForAppRoute(route);

    if (window.location.pathname !== path) {
      window.history.pushState(null, "", path);
    }

    setAppRoute((currentRoute) => {
      return currentRoute === route ? currentRoute : route;
    });
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const nextRoute = getAppRouteFromPathname(window.location.pathname);

      setAppRoute((currentRoute) => {
        return currentRoute === nextRoute ? currentRoute : nextRoute;
      });
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const handleNavClick = useCallback(
    (event: ReactMouseEvent<HTMLAnchorElement>, route: AppRoute) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      event.preventDefault();
      navigateTo(route);
    },
    [navigateTo]
  );

  const mainRef = useRef<HTMLElement>(null);
  const isInitialRenderRef = useRef(true);

  useEffect(() => {
    document.title = appRouteTitles[appRoute];
  }, [appRoute]);

  useEffect(() => {
    if (isInitialRenderRef.current) {
      isInitialRenderRef.current = false;

      return;
    }

    mainRef.current?.focus();
  }, [appRoute]);

  const isSceneRoute = appRoute !== "privacy";

  return (
    <div className="app-shell">
      <aside className="app-shell__rail" aria-label="Application chrome">
        <nav aria-label="Primary" className="app-shell__nav">
          {appNavItems.map((item) => {
            const href = getPathForAppRoute(item.route);
            const isCurrent = appRoute === item.route;

            return (
              <a
                aria-current={isCurrent ? "page" : undefined}
                className={`app-shell__nav-link app-shell__nav-link--${item.route}`}
                href={href}
                key={item.route}
                onClick={(event) => {
                  handleNavClick(event, item.route);
                }}
              >
                <span className="app-shell__nav-meta">{item.code}</span>
                <span className="app-shell__nav-title">{item.label}</span>
              </a>
            );
          })}
        </nav>
      </aside>
      <main className="app-shell__content" ref={mainRef} tabIndex={-1}>
        <div
          className={
            isSceneRoute
              ? "app-shell__view app-shell__view--scene"
              : "app-shell__view app-shell__view--privacy"
          }
        >
          {isSceneRoute ? (
            <RehoboamScene forceHudEnabled={appRoute === "hud"} />
          ) : (
            <PrivacyPolicyView />
          )}
        </div>
      </main>
    </div>
  );
};
