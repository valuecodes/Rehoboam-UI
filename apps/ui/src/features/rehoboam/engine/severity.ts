import type { WorldEventSeverity } from "./types";

export const SEVERITY_RANK: Readonly<Record<WorldEventSeverity, number>> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export const SEVERITY_INTENSITY: Readonly<Record<WorldEventSeverity, number>> =
  {
    low: 0.5,
    medium: 0.8,
    high: 1.2,
    critical: 1.6,
  };

export const compareStrings = (left: string, right: string): number => {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
};
