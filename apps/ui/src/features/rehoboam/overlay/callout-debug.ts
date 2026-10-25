type CalloutDebugLock = "top" | "bottom";
type CalloutDebugSideLock = "left" | "right";

const CALLOUT_DEBUG_QUERY_KEY = "callout-debug";
const CALLOUT_DEBUG_HALF_QUERY_KEY = "callout-debug-half";
const CALLOUT_DEBUG_SIDE_QUERY_KEY = "callout-debug-side";

const isDebugFlagEnabled = (value: string | null): boolean => {
  if (value === null) {
    return false;
  }

  return ["1", "true", "on", "yes"].includes(value);
};

const getCalloutDebugLock = (): CalloutDebugLock | null => {
  const searchParams = new URLSearchParams(globalThis.location.search);
  const calloutDebugValue = searchParams
    .get(CALLOUT_DEBUG_QUERY_KEY)
    ?.trim()
    .toLowerCase();

  if (calloutDebugValue === "top") {
    return "top";
  }

  if (calloutDebugValue === "bottom") {
    return "bottom";
  }

  if (!isDebugFlagEnabled(calloutDebugValue ?? null)) {
    return null;
  }

  const calloutDebugHalfValue = searchParams
    .get(CALLOUT_DEBUG_HALF_QUERY_KEY)
    ?.trim()
    .toLowerCase();

  if (calloutDebugHalfValue === "bottom") {
    return "bottom";
  }

  if (calloutDebugHalfValue === "top") {
    return "top";
  }

  return "top";
};

const getCalloutDebugSideLock = (): CalloutDebugSideLock | null => {
  const searchParams = new URLSearchParams(globalThis.location.search);
  const calloutDebugSideValue = searchParams
    .get(CALLOUT_DEBUG_SIDE_QUERY_KEY)
    ?.trim()
    .toLowerCase();

  if (calloutDebugSideValue === "left") {
    return "left";
  }

  if (calloutDebugSideValue === "right") {
    return "right";
  }

  return null;
};

export { getCalloutDebugLock, getCalloutDebugSideLock };
export type { CalloutDebugLock, CalloutDebugSideLock };
