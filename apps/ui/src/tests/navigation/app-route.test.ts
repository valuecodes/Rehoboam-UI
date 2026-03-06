import {
  getAppRouteFromPathname,
  getPathForAppRoute,
} from "../../features/navigation/app-route";

describe("app route helpers", () => {
  it("maps canonical pathnames to app routes", () => {
    expect(getAppRouteFromPathname("/")).toBe("home");
    expect(getAppRouteFromPathname("/hud")).toBe("hud");
    expect(getAppRouteFromPathname("/privacy")).toBe("privacy");
  });

  it("treats unknown pathnames as home", () => {
    expect(getAppRouteFromPathname("/unknown")).toBe("home");
    expect(getAppRouteFromPathname("/settings")).toBe("home");
  });

  it("returns canonical paths for supported routes", () => {
    expect(getPathForAppRoute("home")).toBe("/");
    expect(getPathForAppRoute("hud")).toBe("/hud");
    expect(getPathForAppRoute("privacy")).toBe("/privacy");
  });

});
