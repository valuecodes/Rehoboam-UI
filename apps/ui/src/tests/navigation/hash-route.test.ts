import {
  getAppRouteFromHash,
  getHashForAppRoute,
} from "../../features/navigation/hash-route";

describe("hash route helpers", () => {
  it("maps canonical hashes to app routes", () => {
    expect(getAppRouteFromHash("")).toBe("home");
    expect(getAppRouteFromHash("#/")).toBe("home");
    expect(getAppRouteFromHash("#/hud")).toBe("hud");
    expect(getAppRouteFromHash("#/privacy")).toBe("privacy");
  });

  it("treats unknown hashes as home", () => {
    expect(getAppRouteFromHash("#/unknown")).toBe("home");
    expect(getAppRouteFromHash("#/settings")).toBe("home");
  });

  it("returns canonical hashes for supported routes", () => {
    expect(getHashForAppRoute("home")).toBe("#/");
    expect(getHashForAppRoute("hud")).toBe("#/hud");
    expect(getHashForAppRoute("privacy")).toBe("#/privacy");
  });
});
