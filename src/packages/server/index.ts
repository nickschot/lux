import { createServer } from 'http';
import type { Writable } from 'stream';
import type { IncomingMessage, Server as HTTPServer } from 'http';

import { tryCatchSync } from '../../utils/try-catch';
import { errorName } from '../logger';
import type Logger from '../logger';
import type Router from '../router';

import { HAS_BODY } from './constants';
import { createRequest, parseRequest } from './request';
import { createResponse } from './response';
import { createResponder } from './responder';
import MethodNotAllowedError from './errors/method-not-allowed-error';
import validateAccept from './utils/validate-accept';
import validateContentType from './utils/validate-content-type';
import setCORSHeaders from './utils/set-cors-headers';
import statusForError from './utils/status-for-error';
import requestIdFor from './utils/request-id-for';
import clientIpFor from './utils/client-ip-for';
import type { Request } from './request/interfaces';
import type { Response } from './response/interfaces';
import type { Server$opts, CorsConfig } from './interfaces';

/** @internal */
class Server {
  declare logger: Logger;

  declare router: Router;

  declare cors: CorsConfig;

  declare trustProxy: boolean;

  declare instance: HTTPServer;

  constructor({ logger, router, cors, trustProxy = false }: Server$opts) {
    Object.defineProperties(this, {
      router: {
        value: router,
        writable: false,
        enumerable: false,
        configurable: false
      },

      logger: {
        value: logger,
        writable: false,
        enumerable: false,
        configurable: false
      },

      cors: {
        value: cors,
        writable: false,
        enumerable: false,
        configurable: false
      },

      trustProxy: {
        value: trustProxy,
        writable: false,
        enumerable: false,
        configurable: false
      },

      instance: {
        value: createServer(this.receiveRequest),
        writable: false,
        enumerable: false,
        configurable: false
      }
    });
  }

  listen(port: number): void {
    this.instance.listen(port);
  }

  initializeRequest(req: IncomingMessage, res: Writable): [Request, Response] {
    const { logger, router, cors } = this;

    req.setEncoding('utf8');

    const response = createResponse(res, {
      logger
    });

    setCORSHeaders(response, cors);

    const request = createRequest(req, {
      logger,
      router
    });

    request.id = requestIdFor(request);
    request.ip = clientIpFor(request, this.trustProxy);
    response.setHeader('X-Request-Id', request.id);

    return [request, response];
  }

  validateRequest({ method, headers }: Request): true {
    let isValid = validateAccept(headers.get('accept'));

    if (HAS_BODY.test(method)) {
      isValid = validateContentType(headers.get('content-type'));
    }

    return isValid;
  }

  receiveRequest = (req: IncomingMessage, res: Writable): void => {
    const { logger } = this;
    const [request, response] = this.initializeRequest(req, res);
    const respond = createResponder(request, response);

    logger.request(request, response, {
      startTime: Date.now()
    });

    const isValid = tryCatchSync(() => this.validateRequest(request), respond);

    if (isValid) {
      parseRequest(request)
        .then(params => {
          const { route, method } = request;
          const allowed = this.router.methodsFor(request);

          Object.assign(request, {
            params
          });

          if (route) {
            if (method === 'OPTIONS') {
              response.setHeader('Allow', allowed.join(', '));
            }

            return route.visit(request, response);
          } else if (allowed.length) {
            response.setHeader('Allow', allowed.join(', '));
            throw new MethodNotAllowedError(method, allowed);
          }

          return undefined;
        })
        .then(respond)
        .catch(err => {
          // A 4xx is the client's mistake, already on the request line with
          // its status; only a 5xx is the server's, worth an ERROR and a stack.
          const context = { requestId: request.id };

          if (statusForError(err) >= 500) {
            logger.error(err, context);
          } else {
            logger.debug(`${errorName(err)}: ${err?.message}`, context);
          }

          respond(err);
        });
    }
  };
}

export default Server;
export { REQUEST_METHODS, getDomain } from './request';
export { default as createServerError } from './utils/create-server-error';

export { default as sourceFor } from './utils/source-for';
export { default as ErrorList } from './errors/error-list';

export type {
  CorsConfig,
  ServerConfig,
  Server$Error,
  Server$ErrorSource
} from './interfaces';

export type {
  Request,
  RequestParams,
  RequestMethod
} from './request/interfaces';

export type { Response } from './response/interfaces';
