import { useEffect, useState } from "react";

import { RehoboamScene } from "./features/rehoboam";

import "./features/navigation/app-shell.css";

import {
  getAppRouteFromHash,
  getHashForAppRoute,
} from "./features/navigation/hash-route";
import type { AppRoute } from "./features/navigation/hash-route";
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

const buildRouteUrl = (hash: string): string => {
  return `${window.location.pathname}${window.location.search}${hash}`;
};

export const App = () => {
  const [appRoute, setAppRoute] = useState<AppRoute>(() => {
    if (typeof window === "undefined") {
      return "home";
    }

    return getAppRouteFromHash(window.location.hash);
  });

  useEffect(() => {
    const syncRoute = () => {
      const nextRoute = getAppRouteFromHash(window.location.hash);
      const nextHash = getHashForAppRoute(nextRoute);

      if (window.location.hash !== nextHash) {
        window.history.replaceState(
          window.history.state,
          "",
          buildRouteUrl(nextHash)
        );
      }

      setAppRoute((currentRoute) => {
        return currentRoute === nextRoute ? currentRoute : nextRoute;
      });
    };

    syncRoute();
    window.addEventListener("hashchange", syncRoute);

    return () => {
      window.removeEventListener("hashchange", syncRoute);
    };
  }, []);

  const isSceneRoute = appRoute !== "privacy";

  return (
    <div className="app-shell">
      <aside className="app-shell__rail" aria-label="Application chrome">
        <nav aria-label="Primary" className="app-shell__nav">
          {appNavItems.map((item) => {
            const href = getHashForAppRoute(item.route);
            const isCurrent = appRoute === item.route;

            return (
              <a
                aria-current={isCurrent ? "page" : undefined}
                className={`app-shell__nav-link app-shell__nav-link--${item.route}`}
                href={href}
                key={item.route}
              >
                <span className="app-shell__nav-meta">{item.code}</span>
                <span className="app-shell__nav-title">{item.label}</span>
              </a>
            );
          })}
        </nav>
      </aside>
      <main className="app-shell__content">
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
