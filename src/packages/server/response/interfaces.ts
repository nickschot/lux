import type { Writable } from 'stream';

import type Logger from '../../logger';

type Response$stat = {
  type: string;
  name: string;
  duration: number;
  controller: string;
};

export type Response$opts = {
  logger: Logger;
};

export interface Response extends Writable {
  [key: string]: unknown;

  stats: Array<Response$stat>;
  logger: Logger;
  statusCode: number;
  statusMessage: string;

  getHeader(name: string): string | void;
  setHeader(name: string, value: string): void;
  removeHeader(name: string): void;
}
