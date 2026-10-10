/** A log level, from most to least verbose. */
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
/**
 * `context` is written alongside the message as top-level fields in JSON
 * format (e.g. a `requestId` tying an error to its request line); the text
 * format leaves it out.
 */
export type LogFunction = (
  data: string | Error | Record<string, unknown>,
  context?: Record<string, unknown>
) => void;
/** Lines for people (`text`) or one JSON object per line (`json`). */
export type LogFormat = 'text' | 'json';

export type LogData = {
  level: LogLevel;
  message?: unknown;
  context?: Record<string, unknown>;
  timestamp: string;
};

/** Parameters to keep out of the logs. */
export type LogFilter = {
  /**
   * Names of parameters to log as `[FILTERED]`, matched by containment and
   * ignoring case, in addition to `password`, `secret` and `token`.
   */
  params: string[];
};

/**
 * The `logging` section of `config/environments/<environment>.js`.
 *
 * ```javascript
 * logging: {
 *   level: 'INFO',
 *   format: 'json',
 *   enabled: true,
 *   requestBody: false,
 *   filter: { params: ['email'] }
 * }
 * ```
 *
 * An unknown `level` or `format` fails the boot.
 */
export type LoggerConfig = {
  /** The least severe level written: `DEBUG` (development), `INFO` (production). */
  level: LogLevel;

  /** `text` (development) or `json` (production). */
  format: LogFormat;

  /** Parameters to filter, beyond the built-in ones. */
  filter: LogFilter;

  /** Whether anything is logged; off in the test environment. */
  enabled: boolean;

  /**
   * Whether a request's logged parameters include its body. Defaults to on,
   * except in production.
   */
  requestBody?: boolean;

  /**
   * Whether text lines start with the time. Defaults to on; turn it off where
   * the platform stamps every line itself.
   */
  timestamps?: boolean;
};
