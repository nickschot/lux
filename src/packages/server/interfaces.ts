import type Logger from '../logger';
import type Router from '../router';

export type CorsConfig = {
  enabled: boolean;
  origin?: string;
  headers?: Array<string>;
  methods?: Array<string>;
};

export type ServerConfig = {
  cors: CorsConfig;
  /**
   * Whether one proxy sits in front of the app (Heroku's router, a load
   * balancer) whose `X-Forwarded-For` entry is the client's address. Only
   * enable it behind such a proxy: without one, clients can set the header to
   * anything.
   */
  trustProxy?: boolean;
};

export type Server$opts = ServerConfig & {
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
