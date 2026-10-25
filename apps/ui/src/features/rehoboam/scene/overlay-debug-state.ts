type OverlayDebugState = Readonly<{
  hasCalloutDebugQuery: boolean;
  isHudEnabled: boolean;
  isIntroDebugMode: boolean;
}>;

const INTRO_DEBUG_QUERY_KEY = "intro-debug";
const HUD_DEBUG_QUERY_KEY = "hud";
const CALLOUT_DEBUG_QUERY_KEYS = [
  "callout-debug",
  "callout-debug-half",
  "callout-debug-side",
] as const;

const isDebugFlagEnabled = (value: string | null): boolean => {
  if (value === null) {
    return false;
  }

  const normalizedValue = value.trim().toLowerCase();

  if (normalizedValue.length === 0) {
    return true;
  }

  return ["1", "true", "on", "yes"].includes(normalizedValue);
};

const readOverlayDebugState = (): OverlayDebugState => {
  const searchParams = new URLSearchParams(globalThis.location.search);
  const hasCalloutDebugQuery = CALLOUT_DEBUG_QUERY_KEYS.some((queryKey) =>
    searchParams.has(queryKey)
  );
  const isIntroDebugMode =
    !hasCalloutDebugQuery &&
    isDebugFlagEnabled(searchParams.get(INTRO_DEBUG_QUERY_KEY));

  return {
    hasCalloutDebugQuery,
    isHudEnabled: isDebugFlagEnabled(searchParams.get(HUD_DEBUG_QUERY_KEY)),
    isIntroDebugMode,
  };
};

export { readOverlayDebugState };
