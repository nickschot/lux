import type { Readable } from 'stream';
import type { Socket } from 'net';

import type Logger from '../../logger';
import type Router from '../../router';
import type { Route } from '../../router';
import type Controller from '../../controller';

export type RequestOptions = {
  logger: Logger;
  router: Router;
};

type RequestUrl = {
  protocol?: string;
  slashes?: boolean;
  auth?: string;
  host?: string;
  port?: string;
  hostname?: string;
  hash?: string;
  search?: string;
  params: Array<string>;
  query: Record<string, unknown>;
  pathname: string;
  path: string;
  href: string;
};

/** An HTTP method Lumen routes. */
export type RequestMethod =
  'GET' | 'HEAD' | 'OPTIONS' | 'PATCH' | 'POST' | 'DELETE';

/**
 * A request's parameters, parsed and validated: `request.params`. Member
 * names are camelCase whatever the client sent. Only what the request
 * carries is present; query parameters a controller lists in
 * {@link Controller.query} appear under their own names.
 */
export type RequestParams = {
  /** The route's `:id`: a number for an integer primary key. */
  id: number | string | Buffer;

  /** `?sort=`: an attribute, `-` first for descending. */
  sort: string;

  /** `?filter[…]=`, by attribute; a comma-separated value is a list. */
  filter: Record<string, unknown>;

  /** `?fields[…]=`: the fields to serialize, by resource type. */
  fields: Record<string, unknown>;

  /** `?include=`: relationship paths (`comments.user`). */
  include: Array<string>;

  /** `?page[…]=`. */
  page: {
    /** `page[size]`. */
    size?: number;

    /** `page[number]`, counting from 1. */
    number?: number;
  };

  /** The body's primary data, on `POST` and `PATCH`. */
  data: {
    /** The resource's id (`PATCH`). */
    id: number | string | Buffer;

    /** The resource type. */
    type: string;

    /** The attributes the controller accepts. */
    attributes?: Record<string, unknown>;

    /** The relationships, each as `{ data }` linkage. */
    relationships?: Record<string, unknown>;
  };
};

/**
 * The request an action or hook receives: Node's incoming message, with
 * Lumen's parsed parameters and routing.
 */
export interface Request extends Readable {
  /**
   * Identifies the request in the logs and the `X-Request-Id` response
   * header: the client's own `X-Request-Id` when it is well-formed, otherwise
   * a fresh UUID.
   */
  id: string;
  /**
   * The client's address: the connection's, or — with `server.trustProxy` —
   * the one the proxy in front added to `X-Forwarded-For`.
   */
  ip?: string;
  /**
   * The headers, by lowercase name, as a `Map`:
   * `request.headers.get('authorization')`.
   */
  headers: Map<string, string>;

  /** The HTTP version, `'1.1'`. */
  httpVersion: string;

  /** The method, or an `X-HTTP-Method-Override` header's. */
  method: RequestMethod;

  /** Node's request trailers. */
  trailers: Record<string, unknown>;

  /** The connection's socket. */
  socket: Socket;

  /** The application's logger. */
  logger: Logger;

  /** @internal */
  router: Router;

  /** The parsed, validated parameters. */
  params: RequestParams;

  /**
   * The parsed JSON body of a `POST` or `PATCH`, as the client sent it. On a
   * plain route (neither `member` nor `collection`) it is any JSON, and is
   * not validated: read it here, not in `params`. `undefined` without a body.
   */
  body?: unknown;

  /** @internal */
  defaultParams: RequestParams;

  /**
   * The matched route. `route.type` is `'relationship'` or `'related'` on a
   * relationship or related endpoint, and `route.relationship` names the
   * relationship there.
   */
  route: Route;

  /** The name of the action handling the request (`'index'`). */
  action: string;

  /** The controller handling the request. */
  controller: Controller;

  /** The parsed URL: `pathname`, `query` and the rest. */
  url: RequestUrl;

  /** @internal */
  connection: {
    encrypted: boolean;
    remoteAddress: string;
  };

  /** Node's `setTimeout` for the request. */
  setTimeout(msecs: number, callback: () => void): void;
}
