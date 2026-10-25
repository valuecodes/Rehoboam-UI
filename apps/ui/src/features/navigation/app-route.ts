type AppRoute = "home" | "hud" | "privacy" | "stats";

const normalizePathname = (pathname: string): string =>
  pathname.trim().toLowerCase().replace(/\/+$/u, "") || "/";

const getAppRouteFromPathname = (pathname: string): AppRoute => {
  switch (normalizePathname(pathname)) {
    case "/":
    case "/home": {
      return "home";
    }
    case "/hud": {
      return "hud";
    }
    case "/privacy":
    case "/privacy-policy": {
      return "privacy";
    }
    case "/stats": {
      return "stats";
    }
    default: {
      return "home";
    }
  }
};

const appRoutePaths: Readonly<Record<AppRoute, string>> = {
  home: "/",
  hud: "/hud",
  privacy: "/privacy",
  stats: "/stats",
};

const getPathForAppRoute = (route: AppRoute): string => appRoutePaths[route];

export { getAppRouteFromPathname, getPathForAppRoute };
export type { AppRoute };
