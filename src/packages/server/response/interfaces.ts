import type { Writable } from 'stream';

import type Logger from '../../logger';

type ResponseStat = {
  type: string;
  name: string;
  duration: number;
  controller: string;
};

export type ResponseOptions = {
  logger: Logger;
};

/**
 * The response an action or hook receives: Node's server response. Use it
 * for headers, or for a status the action's return value doesn't decide.
 */
export interface Response extends Writable {
  [key: string]: unknown;

  /** @internal */
  stats: Array<ResponseStat>;

  /** The application's logger. */
  logger: Logger;

  /** The status code to send. */
  statusCode: number;

  /** The status message to send; defaults to the code's standard one. */
  statusMessage: string;

  /** A header set so far. */
  getHeader(name: string): string | void;

  /** Set a header. */
  setHeader(name: string, value: string): void;

  /** Remove a header set earlier. */
  removeHeader(name: string): void;
}
