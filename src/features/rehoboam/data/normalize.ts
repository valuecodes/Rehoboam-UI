import type {
  WorldEvent,
  WorldEventLocation,
  WorldEventSeverity,
} from "../engine/types";

const HALF_HOUR_MS = 30 * 60 * 1000;
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const DEFAULT_TITLE = "Untitled Event";
const DEFAULT_CATEGORY = "general";

const SEVERITY_RANK: Readonly<Record<WorldEventSeverity, number>> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export type NormalizeEventOptions = Readonly<{
  idPrefix?: string;
  timeBucketMs?: number;
  defaultCategory?: string;
  defaultTimestampMs?: number;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const compareStrings = (left: string, right: string): number => {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
};

const firstDefined = <T>(
  values: readonly (T | null | undefined)[]
): T | undefined => {
  for (const value of values) {
    if (value !== undefined && value !== null) {
      return value;
    }
  }

  return undefined;
};

const readProperty = (
  record: Record<string, unknown>,
  keys: readonly string[]
): unknown => {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      const value = record[key];

      if (value !== undefined && value !== null) {
        return value;
      }
    }
  }

  return undefined;
};

const toTrimmedString = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    const trimmed = value.trim();

    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return `${value}`;
  }

  return undefined;
};

const toFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (trimmed.length === 0) {
      return undefined;
    }

    const asNumber = Number(trimmed);

    if (Number.isFinite(asNumber)) {
      return asNumber;
    }
  }

  return undefined;
};

const toTimestampMs = (value: unknown): number | undefined => {
  const numeric = toFiniteNumber(value);

  if (numeric !== undefined) {
    return Math.trunc(numeric);
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);

    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed);
    }
  }

  return undefined;
};

const sanitizeForKey = (value: string): string => {
  return value.trim().toLowerCase().replace(/\s+/gu, " ");
};

const hashString = (value: string): number => {
  let hash = FNV_OFFSET_BASIS;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME);
  }

  return hash >>> 0;
};

const normalizeSeverityFromNumber = (severity: number): WorldEventSeverity => {
  const clamped = Math.min(1, Math.max(0, severity));

  if (clamped < 0.25) {
    return "low";
  }

  if (clamped < 0.6) {
    return "medium";
  }

  if (clamped < 0.85) {
    return "high";
  }

  return "critical";
};

const normalizeSeverity = (
  record: Record<string, unknown>
): WorldEventSeverity => {
  const rawSeverity = firstDefined([
    readProperty(record, ["severity"]),
    readProperty(record, ["severityLabel"]),
    readProperty(record, ["severity_level"]),
  ]);

  if (typeof rawSeverity === "string") {
    const normalized = rawSeverity.trim().toLowerCase();

    if (
      normalized === "low" ||
      normalized === "medium" ||
      normalized === "high" ||
      normalized === "critical"
    ) {
      return normalized;
    }
  }

  const numericSeverity = toFiniteNumber(rawSeverity);

  if (numericSeverity !== undefined) {
    return normalizeSeverityFromNumber(numericSeverity);
  }

  return "low";
};

const normalizeTimestampMs = (
  record: Record<string, unknown>,
  defaultTimestampMs: number
): number => {
  const parsed = firstDefined([
    toTimestampMs(readProperty(record, ["timestampMs"])),
    toTimestampMs(readProperty(record, ["timestamp"])),
    toTimestampMs(readProperty(record, ["time"])),
    toTimestampMs(readProperty(record, ["publishedAt"])),
    toTimestampMs(readProperty(record, ["createdAt"])),
    toTimestampMs(readProperty(record, ["date"])),
  ]);

  return parsed ?? defaultTimestampMs;
};

const normalizeLocation = (
  record: Record<string, unknown>
): WorldEventLocation | undefined => {
  const rawLocation = firstDefined([
    readProperty(record, ["location"]),
    readProperty(record, ["geo"]),
  ]);

  if (!isRecord(rawLocation)) {
    return undefined;
  }

  const latitude = firstDefined([
    toFiniteNumber(readProperty(rawLocation, ["latitude"])),
    toFiniteNumber(readProperty(rawLocation, ["lat"])),
  ]);
  const longitude = firstDefined([
    toFiniteNumber(readProperty(rawLocation, ["longitude"])),
    toFiniteNumber(readProperty(rawLocation, ["lng"])),
  ]);

  if (latitude === undefined || longitude === undefined) {
    return undefined;
  }

  const label =
    firstDefined([
      toTrimmedString(readProperty(rawLocation, ["label"])),
      toTrimmedString(readProperty(rawLocation, ["place"])),
      toTrimmedString(readProperty(rawLocation, ["name"])),
      toTrimmedString(readProperty(record, ["locationLabel"])),
    ]) ?? "Unknown location";

  return {
    label,
    latitude,
    longitude,
  };
};

const buildStableEventId = (
  record: Record<string, unknown>,
  title: string,
  category: string,
  timestampMs: number,
  options: NormalizeEventOptions
): string => {
  const prefix = sanitizeForKey(options.idPrefix ?? "evt");
  const timeBucketMs = Math.max(
    1,
    Math.trunc(options.timeBucketMs ?? HALF_HOUR_MS)
  );
  const timeBucket = Math.floor(timestampMs / timeBucketMs);

  const rawId = toTrimmedString(
    readProperty(record, ["id", "eventId", "guid"])
  );
  const source = toTrimmedString(
    readProperty(record, ["source", "publisher", "provider"])
  );
  const canonicalUrl = toTrimmedString(
    readProperty(record, ["canonicalUrl", "url", "link"])
  );

  const fingerprint =
    rawId === undefined
      ? [
          sanitizeForKey(title),
          sanitizeForKey(category),
          sanitizeForKey(source ?? "unknown"),
          sanitizeForKey(canonicalUrl ?? ""),
          `${timeBucket}`,
        ].join("|")
      : `raw:${sanitizeForKey(rawId)}`;

  return `${prefix}-${hashString(fingerprint).toString(36)}`;
};

const normalizeSummary = (
  record: Record<string, unknown>
): string | undefined => {
  return firstDefined([
    toTrimmedString(readProperty(record, ["summary"])),
    toTrimmedString(readProperty(record, ["description"])),
    toTrimmedString(readProperty(record, ["details"])),
  ]);
};

const normalizeCreatedAtMs = (
  record: Record<string, unknown>
): number | undefined => {
  return firstDefined([
    toTimestampMs(readProperty(record, ["createdAtMs"])),
    toTimestampMs(readProperty(record, ["createdAt"])),
  ]);
};

const normalizeUpdatedAtMs = (
  record: Record<string, unknown>
): number | undefined => {
  return firstDefined([
    toTimestampMs(readProperty(record, ["updatedAtMs"])),
    toTimestampMs(readProperty(record, ["updatedAt"])),
    toTimestampMs(readProperty(record, ["modifiedAt"])),
  ]);
};

const normalizeTitle = (record: Record<string, unknown>): string => {
  return (
    firstDefined([
      toTrimmedString(readProperty(record, ["title"])),
      toTrimmedString(readProperty(record, ["headline"])),
      toTrimmedString(readProperty(record, ["name"])),
      toTrimmedString(readProperty(record, ["event"])),
    ]) ?? DEFAULT_TITLE
  );
};

const normalizeCategory = (
  record: Record<string, unknown>,
  options: NormalizeEventOptions
): string => {
  return (
    firstDefined([
      toTrimmedString(readProperty(record, ["category"])),
      toTrimmedString(readProperty(record, ["type"])),
      toTrimmedString(readProperty(record, ["kind"])),
      toTrimmedString(readProperty(record, ["topic"])),
    ]) ??
    options.defaultCategory ??
    DEFAULT_CATEGORY
  );
};

export const normalizeEvent = (
  input: unknown,
  options: NormalizeEventOptions = {}
): WorldEvent => {
  const defaultTimestampMs = Math.trunc(options.defaultTimestampMs ?? 0);
  const record = isRecord(input) ? input : {};
  const title = normalizeTitle(record);
  const category = normalizeCategory(record, options);
  const timestampMs = normalizeTimestampMs(record, defaultTimestampMs);
  const severity = normalizeSeverity(record);
  const summary = normalizeSummary(record);
  const location = normalizeLocation(record);
  const createdAtMs = normalizeCreatedAtMs(record);
  const updatedAtMs = normalizeUpdatedAtMs(record);
  const id = buildStableEventId(record, title, category, timestampMs, options);

  return {
    id,
    title,
    timestampMs,
    severity,
    category,
    summary,
    location,
    createdAtMs,
    updatedAtMs,
  };
};

const compareWorldEvents = (left: WorldEvent, right: WorldEvent): number => {
  if (left.timestampMs !== right.timestampMs) {
    return left.timestampMs - right.timestampMs;
  }

  const idComparison = compareStrings(left.id, right.id);

  if (idComparison !== 0) {
    return idComparison;
  }

  const severityComparison =
    SEVERITY_RANK[right.severity] - SEVERITY_RANK[left.severity];

  if (severityComparison !== 0) {
    return severityComparison;
  }

  return compareStrings(left.title, right.title);
};

export const sortWorldEvents = (
  events: readonly WorldEvent[]
): readonly WorldEvent[] => {
  return [...events].sort(compareWorldEvents);
};

export const normalizeEvents = (
  inputs: readonly unknown[],
  options: NormalizeEventOptions = {}
): readonly WorldEvent[] => {
  const normalized = inputs.map((input) => normalizeEvent(input, options));

  return sortWorldEvents(normalized);
};
