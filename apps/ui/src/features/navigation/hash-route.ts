export type AppRoute = "home" | "hud" | "privacy";

const normalizeHash = (hash: string): string => {
  return hash.trim().toLowerCase();
};

export const getAppRouteFromHash = (hash: string): AppRoute => {
  switch (normalizeHash(hash)) {
    case "":
    case "#":
    case "#/":
    case "#/home":
      return "home";
    case "#/hud":
      return "hud";
    case "#/privacy":
    case "#/privacy-policy":
      return "privacy";
    default:
      return "home";
  }
};

export const getHashForAppRoute = (route: AppRoute): string => {
  switch (route) {
    case "home":
      return "#/";
    case "hud":
      return "#/hud";
    case "privacy":
      return "#/privacy";
  }
};
