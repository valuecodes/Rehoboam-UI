import type { LogEntry, LoggerConfig, LogLevel, LogMetadata } from "./types";

export type { LogEntry, LoggerConfig, LogLevel, LogMetadata } from "./types";

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const CONSOLE_METHOD: Record<LogLevel, "debug" | "log" | "warn" | "error"> = {
  debug: "debug",
  info: "log",
  warn: "warn",
  error: "error",
};

export class Logger {
  private readonly context: string;
  private readonly minLevel: LogLevel;

  constructor(config: LoggerConfig) {
    this.context = config.context;
    this.minLevel = config.level ?? "debug";
  }

  readonly debug = (message: string, metadata?: LogMetadata): void => {
    this.log("debug", message, metadata);
  };

  readonly info = (message: string, metadata?: LogMetadata): void => {
    this.log("info", message, metadata);
  };

  readonly warn = (message: string, metadata?: LogMetadata): void => {
    this.log("warn", message, metadata);
  };

  readonly error = (message: string, metadata?: LogMetadata): void => {
    this.log("error", message, metadata);
  };

  private readonly isEnabled = (level: LogLevel): boolean => {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.minLevel];
  };

  private readonly log = (
    level: LogLevel,
    message: string,
    metadata?: LogMetadata
  ): void => {
    if (!this.isEnabled(level)) {
      return;
    }

    const entry: LogEntry = {
      ...(metadata ?? {}),
      timestamp: new Date().toISOString(),
      level,
      context: this.context,
      message,
    };

    const method = CONSOLE_METHOD[level];
    console[method](JSON.stringify(entry));
  };
}
