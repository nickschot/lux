import { LUMEN_CONSOLE } from '../../constants';
import K from '../../utils/k';

import { FORMATS, LEVELS } from './constants';
import InvalidConfigError from './errors/invalid-config-error';
import { createWriter } from './writer';
import { createRequestLogger } from './request-logger';
import type { LogWriter } from './writer/interfaces';
import type { RequestLoggerFn } from './request-logger/interfaces';
import type {
  LoggerConfig,
  LogFormat,
  LogLevel,
  LogFunction,
  LogFilter
} from './interfaces';

/**
 * The application's logger, configured by the `logging` section of
 * `config/environments/<environment>.js` ({@link LoggerConfig}). Actions and
 * hooks reach it as `request.logger`, models as `Model.logger`.
 *
 * It logs every request, server errors, and — with the database's `debug` on —
 * SQL, and has a method per level for the app's own messages. See the
 * [logging guide](https://github.com/nickschot/lux/blob/main/docs/guides/logging.md).
 */
class Logger {
  /** The least severe level written: `DEBUG`, `INFO`, `WARN` or `ERROR`. */
  declare level: LogLevel;

  /** `text`, lines for people, or `json`, one object per line. */
  declare format: LogFormat;

  /**
   * Parameters to keep out of the logs. A parameter whose name contains
   * `password`, `secret` or `token`, or a name listed in `filter.params`,
   * ignoring case, is logged as `[FILTERED]` — in the body, the query string
   * and inside arrays:
   *
   * ```javascript
   * // config/environments/production.js
   * export default {
   *   logging: {
   *     // …
   *     filter: { params: ['email'] } // also filters `recoveryEmail`
   *   }
   * };
   * ```
   */
  declare filter: LogFilter;

  /** Whether anything is logged; off in the test environment. */
  declare enabled: boolean;

  /**
   * Whether the request log includes the request body — the JSON:API document
   * of a `POST` or `PATCH`. Off unless enabled, and off by default in
   * production: a body is large and full of user data. Query and route params
   * are always logged (filtered).
   */
  declare requestBody: boolean;

  /**
   * Whether the text format stamps each line with the time. Turn it off where
   * the platform already does — Heroku prefixes every line with its own — to
   * avoid two timestamps per line. The JSON format always includes it.
   */
  declare timestamps: boolean;

  /**
   * Log a message at `DEBUG`.
   *
   * `context` adds fields to the line: top-level fields in JSON, left out of
   * text. Pass the request's id to tie the message to its request:
   *
   * ```javascript
   * request.logger.debug('Cache miss', { requestId: request.id });
   * ```
   */
  declare debug: LogFunction;

  /**
   * Log a message at `INFO`.
   *
   * `context` adds fields to the line: top-level fields in JSON, left out of
   * text. Pass the request's id to tie the message to its request:
   *
   * ```javascript
   * request.logger.info('Synced posts', { requestId: request.id });
   * ```
   */
  declare info: LogFunction;

  /**
   * Log a message at `WARN`.
   *
   * `context` adds fields to the line: top-level fields in JSON, left out of
   * text. Pass the request's id to tie the message to its request:
   *
   * ```javascript
   * request.logger.warn('Slow upstream', { requestId: request.id });
   * ```
   */
  declare warn: LogFunction;

  /**
   * Log a message, or an error with its stack, at `ERROR`.
   *
   * `context` adds fields to the line: top-level fields in JSON, left out of
   * text. Pass the request's id to tie the message to its request:
   *
   * ```javascript
   * request.logger.error('Sync failed', { requestId: request.id });
   * ```
   */
  declare error: LogFunction;

  /** @internal */
  declare request: RequestLoggerFn;

  constructor({
    level,
    format,
    filter,
    enabled,
    requestBody = false,
    timestamps = true
  }: LoggerConfig) {
    let write: LogWriter = K;
    let request: RequestLoggerFn = K;

    // A disabled logger never writes, so only an enabled one needs these —
    // and must have them right: a typo used to fall back to DEBUG silently,
    // which in production meant SQL with its bound values in the logs.
    if (enabled) {
      if (!LEVELS.has(level)) {
        throw new InvalidConfigError('level', level, LEVELS.keys());
      }

      if (!FORMATS.has(format)) {
        throw new InvalidConfigError('format', format, FORMATS);
      }
    }

    if (!LUMEN_CONSOLE && enabled) {
      write = createWriter(format, { timestamps });
      request = createRequestLogger(this);
    }

    Object.defineProperties(this, {
      level: {
        value: level,
        writable: false,
        enumerable: true,
        configurable: false
      },

      format: {
        value: format,
        writable: false,
        enumerable: true,
        configurable: false
      },

      filter: {
        value: filter,
        writable: false,
        enumerable: true,
        configurable: false
      },

      enabled: {
        value: Boolean(enabled),
        writable: false,
        enumerable: true,
        configurable: false
      },

      requestBody: {
        value: Boolean(requestBody),
        writable: false,
        enumerable: true,
        configurable: false
      },

      timestamps: {
        value: Boolean(timestamps),
        writable: false,
        enumerable: true,
        configurable: false
      },

      request: {
        value: request,
        writable: false,
        enumerable: false,
        configurable: false
      }
    });

    const levelNum = LEVELS.get(level) || 0;

    LEVELS.forEach((val, key: LogLevel) => {
      Object.defineProperty(this, key.toLowerCase(), {
        writable: false,
        enumerable: false,
        configurable: false,

        value:
          val >= levelNum
            ? (message?: unknown, context?: Record<string, unknown>) => {
                write({
                  message,
                  context,
                  level: key,
                  timestamp: this.getTimestamp()
                });
              }
            : K
      });
    });
  }

  /**
   * @returns The current time as an ISO8601 string.
   * @internal
   */
  getTimestamp() {
    return new Date().toISOString();
  }
}

export default Logger;
export { default as line } from './utils/line';
export { default as errorName } from './utils/error-name';

export type {
  LoggerConfig,
  LogFilter,
  LogFormat,
  LogFunction,
  LogLevel
} from './interfaces';
