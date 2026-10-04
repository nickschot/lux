import type Logger from '../logger';
import type Router from '../router';

export type Server$cors = {
  enabled: boolean;
  origin?: string;
  headers?: Array<string>;
  methods?: Array<string>;
};

export type Server$config = {
  cors: Server$cors;
};

export type Server$opts = Server$config & {
  logger: Logger;
  router: Router;
};

export type Server$ErrorSource = {
  pointer?: string;
  parameter?: string;
};

/**
 * An error a request is answered with. Besides `statusCode`, it may carry the
 * members of its JSON:API error object: `source` points into the request;
 * `id`, `code`, `title`, `meta` and `links.about` are passed through as set.
 * (`detail` is the message, exposed only in development or when it starts
 * with `[public]`.)
 */
export interface Server$Error extends Error {
  statusCode: number;
  source?: Server$ErrorSource;
  id?: string;
  code?: string;
  title?: string;
  meta?: Record<string, unknown>;
  links?: { about: string };
}
