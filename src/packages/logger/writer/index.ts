import { WriteStream } from 'tty';

import { dim, red, yellow } from 'chalk';

import { WARN, ERROR } from '../constants';
import omit from '../../../utils/omit';
import type { Logger$format } from '../interfaces';

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
 * @private
 */
export function createWriter(format: Logger$format): Logger$Writer {
  return function write(data) {
    const { level, ...etc } = data;
    let { message, timestamp } = etc;
    let output: unknown;

    if (format === 'json') {
      output = {};

      if (isMessageObject(message) && message.message) {
        output = {
          timestamp,
          level,
          message: message.message,
          ...omit(message, 'message')
        };
      } else {
        // The Flow original spread `...etc` here too, but `etc` is just
        // `{ message, timestamp }` — both already listed above with the same
        // values — so the spread only re-wrote them. Dropping it keeps the
        // identical key order and values.
        output = {
          timestamp,
          level,
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

      switch (level) {
        case WARN:
          timestamp = yellow(`[${timestamp}]`);
          break;

        case ERROR:
          timestamp = red(`[${timestamp}]`);
          break;

        default:
          timestamp = dim(`[${timestamp}]`);
          break;
      }

      output = `${timestamp} ${message}\n\n${dim('-').repeat(columns)}\n`;
    }

    if (STDOUT.test(level)) {
      process.stdout.write(`${output}\n`);
    } else if (STDERR.test(level)) {
      process.stderr.write(`${output}\n`);
    }
  };
}
