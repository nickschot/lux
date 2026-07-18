import type { Readable } from 'stream';
import type { Socket } from 'net';

import type Logger from '../../logger';
import type Router from '../../router';
import type { Route } from '../../router';
import type Controller from '../../controller';

export type Request$opts = {
  logger: Logger;
  router: Router;
};

type Request$url = {
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

export type Request$method =
  'GET' | 'HEAD' | 'OPTIONS' | 'PATCH' | 'POST' | 'DELETE';

export type Request$params = {
  id: number | string | Buffer;
  sort: string;
  filter: Record<string, unknown>;
  fields: Record<string, unknown>;
  include: Array<string>;

  page: {
    size?: number;
    number?: number;
  };

  data: {
    id: number | string | Buffer;
    type: string;
    attributes?: Record<string, unknown>;
    relationships?: Record<string, unknown>;
  };
};

export interface Request extends Readable {
  headers: Map<string, string>;
  httpVersion: string;
  method: Request$method;
  trailers: Record<string, unknown>;
  socket: Socket;
  logger: Logger;
  params: Request$params;
  defaultParams: Request$params;
  route: Route;
  action: string;
  controller: Controller;
  url: Request$url;

  connection: {
    encrypted: boolean;
    remoteAddress: string;
  };

  setTimeout(msecs: number, callback: () => void): void;
}
