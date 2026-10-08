import type Logger from '../logger';
import type Router from '../router';

/**
 * CORS headers for every response, so browsers on another origin may call
 * the API:
 *
 * ```javascript
 * cors: {
 *   enabled: true,
 *   origin: 'https://app.example.com',
 *   headers: ['Accept', 'Content-Type', 'Authorization'],
 *   methods: ['GET', 'POST', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']
 * }
 * ```
 */
export type CorsConfig = {
  /** Whether to send the headers at all. Off by default. */
  enabled: boolean;

  /** `Access-Control-Allow-Origin`: the origin allowed, or `*`. */
  origin?: string;

  /** `Access-Control-Allow-Headers`: the request headers allowed. */
  headers?: Array<string>;

  /** `Access-Control-Allow-Methods`: the methods allowed. */
  methods?: Array<string>;
};

/**
 * The `server` section of `config/environments/<environment>.js`.
 */
export type ServerConfig = {
  /** CORS headers; off by default. */
  cors: CorsConfig;

  /**
   * Whether one proxy sits in front of the app (Heroku's router, a load
   * balancer) whose `X-Forwarded-For` entry is the client's address. Only
   * enable it behind such a proxy: without one, clients can set the header to
   * anything.
   */
  trustProxy?: boolean;

  /**
   * How long, in milliseconds, `lumen serve` lets a worker finish the
   * requests in flight when it stops (`SIGTERM`, `SIGINT`) before killing
   * it. Defaults to `8000`: within Docker's 10 s grace period, and Heroku's
   * and Kubernetes' 30 s.
   */
  shutdownTimeout?: number;
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
