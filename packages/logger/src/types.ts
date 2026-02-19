export type LogLevel = "debug" | "info" | "warn" | "error";

export type LoggerConfig = {
  /** Namespace or context label included in every log entry. */
  context: string;
  /** Minimum log level. Messages below this level are suppressed. Defaults to "debug". */
  level?: LogLevel;
};

export type LogMetadata = Record<string, unknown>;

export type LogEntry = {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  [key: string]: unknown;
};
