import { resolveSceneQualityProfile } from "../../../features/rehoboam/scene/quality";

describe("resolveSceneQualityProfile", () => {
  it("returns low quality on constrained small devices", () => {
    const profile = resolveSceneQualityProfile({
      width: 480,
      height: 480,
      hardwareConcurrency: 4,
      deviceMemoryGiB: 2,
    });

    expect(profile).toStrictEqual({
      tier: "low",
      ringCount: 14,
      divergenceSampleCount: 220,
    });
  });

  it("returns medium quality for constrained desktop-sized devices", () => {
    const profile = resolveSceneQualityProfile({
      width: 1100,
      height: 760,
      hardwareConcurrency: 4,
      deviceMemoryGiB: 8,
    });

    expect(profile).toStrictEqual({
      tier: "medium",
      ringCount: 18,
      divergenceSampleCount: 300,
    });
  });

  it("returns high quality when viewport and capabilities are unconstrained", () => {
    const profile = resolveSceneQualityProfile({
      width: 1280,
      height: 900,
      hardwareConcurrency: 8,
      deviceMemoryGiB: 16,
    });

    expect(profile).toStrictEqual({
      tier: "high",
      ringCount: 22,
      divergenceSampleCount: 360,
    });
  });
});
