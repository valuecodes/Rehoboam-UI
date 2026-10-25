const readDevicePixelRatio = (): number => {
  const value = globalThis.devicePixelRatio;

  return Number.isFinite(value) && value > 0 ? value : 1;
};

const readHardwareConcurrency = (): number | null => {
  const value = navigator.hardwareConcurrency;

  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  return Math.trunc(value);
};

const readDeviceMemoryGiB = (): number | null => {
  const capabilityNavigator = navigator as Navigator & {
    deviceMemory?: number;
  };
  const value = capabilityNavigator.deviceMemory;

  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return value;
};

export { readDeviceMemoryGiB, readDevicePixelRatio, readHardwareConcurrency };
