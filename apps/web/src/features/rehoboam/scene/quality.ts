export type SceneQualityTier = "low" | "medium" | "high";

export type SceneQualityProfile = Readonly<{
  tier: SceneQualityTier;
  ringCount: number;
  divergenceSampleCount: number;
}>;

export type ResolveSceneQualityInput = Readonly<{
  width: number;
  height: number;
  hardwareConcurrency: number | null;
  deviceMemoryGiB: number | null;
}>;

const HIGH_QUALITY_PROFILE: SceneQualityProfile = {
  tier: "high",
  ringCount: 22,
  divergenceSampleCount: 360,
};

const MEDIUM_QUALITY_PROFILE: SceneQualityProfile = {
  tier: "medium",
  ringCount: 18,
  divergenceSampleCount: 300,
};

const LOW_QUALITY_PROFILE: SceneQualityProfile = {
  tier: "low",
  ringCount: 14,
  divergenceSampleCount: 220,
};

const sanitizePositiveNumber = (value: number): number => {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return value;
};

const isLimitedCpu = (hardwareConcurrency: number | null): boolean => {
  if (hardwareConcurrency === null || !Number.isFinite(hardwareConcurrency)) {
    return false;
  }

  return Math.trunc(hardwareConcurrency) <= 4;
};

const isLimitedMemory = (deviceMemoryGiB: number | null): boolean => {
  if (deviceMemoryGiB === null || !Number.isFinite(deviceMemoryGiB)) {
    return false;
  }

  return deviceMemoryGiB <= 4;
};

export const resolveSceneQualityProfile = (
  input: ResolveSceneQualityInput
): SceneQualityProfile => {
  const width = sanitizePositiveNumber(input.width);
  const height = sanitizePositiveNumber(input.height);
  const shortestSide = Math.min(width, height);
  const area = width * height;
  const constrainedDevice =
    isLimitedCpu(input.hardwareConcurrency) ||
    isLimitedMemory(input.deviceMemoryGiB);

  if (
    shortestSide <= 520 ||
    area <= 340_000 ||
    (constrainedDevice && shortestSide <= 700)
  ) {
    return LOW_QUALITY_PROFILE;
  }

  if (shortestSide <= 780 || area <= 520_000 || constrainedDevice) {
    return MEDIUM_QUALITY_PROFILE;
  }

  return HIGH_QUALITY_PROFILE;
};
