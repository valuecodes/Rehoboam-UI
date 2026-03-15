export type AppRoute = "home" | "hud" | "privacy" | "stats";

const normalizePathname = (pathname: string): string => {
  return pathname.trim().toLowerCase().replace(/\/+$/u, "") || "/";
};

export const getAppRouteFromPathname = (pathname: string): AppRoute => {
  switch (normalizePathname(pathname)) {
    case "/":
    case "/home":
      return "home";
    case "/hud":
      return "hud";
    case "/privacy":
    case "/privacy-policy":
      return "privacy";
    case "/stats":
      return "stats";
    default:
      return "home";
  }
};

export const getPathForAppRoute = (route: AppRoute): string => {
  switch (route) {
    case "home":
      return "/";
    case "hud":
      return "/hud";
    case "privacy":
      return "/privacy";
    case "stats":
      return "/stats";
  }
};
