import { WriteStream } from 'tty';

import chalk from '../../../utils/chalk';
import { WARN, ERROR } from '../constants';
import errorName from '../utils/error-name';
import omit from '../../../utils/omit';
import type { LogFormat } from '../interfaces';

import { STDOUT, STDERR } from './constants';
import formatMessage from './utils/format-message';
import type { Logger$Writer } from './interfaces';

/**
 * A logged message that is itself an object carrying its own `message` field,
 * which the JSON writer hoists to the top level.
 */
function isMessageObject(value: unknown): value is { message?: unknown } {
  return Boolean(value) && typeof value === 'object';
}

/**
 * The text format's handle on a request id: its first 8 characters, enough
 * to find the request's other lines (a UUID's first block) without the full
 * 36. The JSON format logs it whole.
 */
function shortRequestId(context?: Record<string, unknown>): string {
  const id = context?.requestId;

  return typeof id === 'string' && id ? `[${id.slice(0, 8)}]` : '';
}

/**
 * @private
 */
export function createWriter(
  format: LogFormat,
  { timestamps = true }: { timestamps?: boolean } = {}
): Logger$Writer {
  return function write(data) {
    const { level, context, timestamp, ...etc } = data;
    let { message } = etc;
    let output: unknown;

    if (format === 'json') {
      if (message instanceof Error) {
        // `stack` and `name` are not own enumerable properties, so spreading
        // the error alone would drop them — and with them where it came from.
        output = {
          timestamp,
          level,
          ...context,
          message: message.message,
          name: errorName(message),
          ...omit(message, 'message'),
          stack: message.stack
        };
      } else if (isMessageObject(message) && message.message) {
        output = {
          timestamp,
          level,
          ...context,
          message: message.message,
          ...omit(message, 'message')
        };
      } else {
        // The Flow original spread `...etc` here too, but `etc` is just
        // `{ message }` — already listed with the same value — so the spread
        // only re-wrote it. Dropping it keeps the identical key order and
        // values.
        output = {
          timestamp,
          level,
          ...context,
          message
        };
      }

      output = formatMessage(output, 'json');
    } else {
      let columns = 0;

      if (process.stdout instanceof WriteStream) {
        columns = process.stdout.columns;
      }

      message = formatMessage(message, 'text');

      // Colour is lost off a terminal, so the level is spelled out: an ERROR
      // has to stand out in a plain log viewer too.
      let label = level.padEnd(5);

      switch (level) {
        case WARN:
          label = chalk.yellow(label);
          break;

        case ERROR:
          label = chalk.red(label);
          break;

        default:
          label = chalk.dim(label);
          break;
      }

      const prefix = [
        timestamps ? chalk.dim(`[${timestamp}]`) : '',
        label,
        shortRequestId(context)
      ]
        .filter(Boolean)
        .join(' ');

      // The rule separates multi-line entries in a terminal; piped output
      // (Docker, an IDE console) has no width, so it gets one line per entry
      // instead of a rule-less blank block.
      output = columns
        ? `${prefix} ${message}\n\n${chalk.dim('-').repeat(columns)}\n`
        : `${prefix} ${message}`;
    }

    if (STDOUT.test(level)) {
      process.stdout.write(`${output}\n`);
    } else if (STDERR.test(level)) {
      process.stderr.write(`${output}\n`);
    }
  };
}
