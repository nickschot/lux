import K from '../../src/utils/k';
import type {
  Request,
  Request$method,
  Response
} from '../../src/packages/server';

// Keyed on `object` rather than `Response` so the object literals below can
// pass their own `this` in before the `as unknown as Response` cast applies.
const RESPONSE_HEADERS = new WeakMap<object, Map<string, string>>();

function headersFor(res: object): Map<string, string> {
  let headers = RESPONSE_HEADERS.get(res);

  if (!headers) {
    headers = new Map();
    RESPONSE_HEADERS.set(res, headers);
  }

  return headers;
}

// These mocks implement only the slice of `Request`/`Response` the suites
// actually touch, so they are cast rather than fully populated (this is what
// the `$FlowIgnore` comments used to buy).
export const createResponse = (): Response =>
  ({
    on: K,
    end: K,
    stats: [],
    statusCode: 200,
    statusMessage: 'OK',

    getHeader(key: string) {
      return headersFor(this).get(key);
    },

    setHeader(key: string, value: string) {
      headersFor(this).set(key, value);
    },

    removeHeader(key: string) {
      headersFor(this).delete(key);
    }
  }) as unknown as Response;

type RequestBuilderOptions = {
  path: string;
  route?: unknown;
  params?: Record<string, unknown>;
  method?: Request$method;
};

export const createRequestBuilder =
  ({ path, route, params, method = 'GET' }: RequestBuilderOptions) =>
  (): Request =>
    ({
      route,
      params,
      method,
      httpVersion: '1.1',
      url: {
        protocol: null,
        slashes: null,
        auth: null,
        host: null,
        port: null,
        hostname: null,
        hash: null,
        search: '',
        query: {},
        pathname: path,
        path: path,
        href: path,
        params: []
      },
      headers: new Map([['host', 'localhost:4000']]),
      connection: {
        encrypted: false,
        remoteAddress: '::1'
      }
    }) as unknown as Request;
