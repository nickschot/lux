import type { AddressInfo } from 'net';

import type Application from '../application';
import type { Model } from '../database';
import type Route from '../router/route';

import identifiersIn from './utils/identifiers-in';
import type { Identifier } from './utils/identifiers-in';

/**
 * Which records of one type a request may see, for {@link auditVisibility}:
 * every one (`true`), the ids listed, or the ids a function accepts.
 */
export type VisibleRecords =
  true | ReadonlyArray<string | number> | ((id: string) => boolean);

/** The options of {@link auditVisibility}. */
export type AuditVisibilityOptions = {
  /**
   * The namespace to audit: `''` (the default) for the root, `'admin'` for
   * `/admin`. Nested namespaces are audited on their own.
   */
  namespace?: string;

  /**
   * What the request may see, keyed by type. Written by hand, independently
   * of the app's visibility rules: it is what they are checked against. A
   * type left out may not appear at all.
   */
  visible: Record<string, VisibleRecords>;

  /**
   * Headers sent with every request, such as the `Authorization` of the user
   * the audit is for.
   */
  headers?: Record<string, string>;

  /**
   * The ids to request each type's routes with (`GET /posts/:id`,
   * `/posts/:id/comments`, …), keyed by type: visible and hidden ones
   * alike. A type left out is requested with every id in the database, so
   * keep the database small or list the ids.
   */
  ids?: Record<string, ReadonlyArray<string | number>>;
};

/**
 * A record a response contained that the audit's `visible` does not allow, or
 * a request that failed with an error other than `401`, `403` or `404`, so
 * that what it serves could not be checked.
 */
export type VisibilityViolation = {
  /** The request, as a path and query string. */
  url: string;
  /** Its status. */
  status: number;
  /** The record's type, if the violation is a record. */
  type?: string;
  /** The record's id, if the violation is a record. */
  id?: string;
};

/** What {@link auditVisibility} found. */
export type VisibilityAudit = {
  /** Every request made, as a path and query string. */
  requests: Array<string>;
  /** What should not have been in a response, in request order. */
  violations: Array<VisibilityViolation>;
};

// The built-in reads; custom routes take parameters the audit cannot know.
const READS = new Set(['index', 'show', 'showRelationship', 'showRelated']);

// Statuses that reveal nothing: the request may not read, or there is nothing
// it may see. Any other error means the read went unchecked.
const DENIED = new Set([401, 403, 404]);

// Bounds the `links.next` chain of a single list, should one never end.
const MAX_PAGES = 1000;

function allows(visible: VisibleRecords | undefined, id: string): boolean {
  if (visible === true) {
    return true;
  }

  if (typeof visible === 'function') {
    return visible(id);
  }

  return Boolean(visible?.some(allowed => String(allowed) === id));
}

/**
 * The `include` values to request a route with: none, and every path it
 * accepts at once. A compound document holds what each path reaches, so one
 * request covers them all; a path that leads on to a longer one
 * (`comments` to `comments.user`) adds nothing and is left out. A
 * relationship endpoint (linkage only) accepts none.
 */
function includesOf(route: Route): Array<string | undefined> {
  const include = route.params.get('include') as Set<string> | undefined;
  const paths = include ? Array.from(include) : [];
  const longest = paths.filter(
    path => !paths.some(other => other.startsWith(`${path}.`))
  );

  return longest.length ? [undefined, longest.join(',')] : [undefined];
}

/**
 * Request every read a namespace serves — each list, each record by id, each
 * relationship and related endpoint, without `include` and with every path
 * it accepts, following every page — and report each record in a response that
 * `visible` does not allow: in `data`, in `included`, or in any
 * relationship's linkage. A `401`, `403` or `404` (for a hidden record)
 * reveals nothing and passes; any other error is reported, since the read it
 * answers went unchecked.
 *
 * Visibility rules apply to every one of these paths, but scoping in an
 * `index` or `show` override, or in a hook keyed on the action, does not.
 * This checks the result rather than the mechanism, against a list written
 * by hand:
 *
 * ```javascript
 * import { auditVisibility } from 'lumen-framework/testing';
 *
 * it('shows a member only public posts and their comments', async () => {
 *   const { violations } = await auditVisibility(app, {
 *     namespace: 'members',
 *     headers: { Authorization: `Bearer ${memberToken}` },
 *     visible: {
 *       posts: [publicPost.id],
 *       comments: [commentOnPublicPost.id],
 *       users: true
 *     }
 *   });
 *
 *   expect(violations).toEqual([]);
 * });
 * ```
 *
 * Requests are made one at a time to the running application: `app` must be
 * listening. Custom routes are not requested. Each route is requested once per
 * id (and per page), so run it against a small fixture database, or narrow
 * the ids with `ids`.
 *
 * @param app - The application, listening.
 * @param options - What to audit, and what the request may see.
 * @returns Every request made, and every violation found.
 * @throws When the namespace serves no reads, so a mistyped namespace cannot
 * pass by checking nothing.
 */
export default async function auditVisibility(
  app: Application,
  { namespace = '', visible, headers = {}, ids = {} }: AuditVisibilityOptions
): Promise<VisibilityAudit> {
  const { port } = app.server.instance.address() as AddressInfo;
  const origin = `http://localhost:${port}`;
  const audit: VisibilityAudit = { requests: [], violations: [] };

  const routes = Array.from(app.router.values()).filter(
    route =>
      route.method === 'GET' &&
      READS.has(route.action) &&
      route.controller.namespace === namespace
  );

  if (!routes.length) {
    throw new Error(
      `auditVisibility: namespace '/${namespace}' serves no index, show, ` +
        'relationship or related routes.'
    );
  }

  // A link as a path and query string, which the audit reports.
  const relative = (link: string) => {
    const { pathname, search } = new URL(link, origin);

    return pathname + search;
  };

  const idsCache = new Map<string, Array<string>>();

  const idsOf = async (route: Route): Promise<Array<string>> => {
    const { model } = route.controller;
    const type = model.resourceName;
    let list = idsCache.get(type);

    if (!list) {
      const given = ids[type];

      list = given
        ? given.map(String)
        : (
            (await model.select(model.primaryKey)) as unknown as Array<Model>
          ).map(record => String(record.getPrimaryKey()));

      idsCache.set(type, list);
    }

    return list;
  };

  const check = (url: string, status: number, found: Array<Identifier>) => {
    found.forEach(({ type, id }) => {
      if (!allows(visible[type], id)) {
        audit.violations.push({ url, status, type, id });
      }
    });
  };

  // One request, and the pages after it.
  const read = async (first: string) => {
    let url: string | undefined = first;

    for (let page = 0; url && page < MAX_PAGES; page += 1) {
      audit.requests.push(url);

      const res: globalThis.Response = await fetch(origin + url, {
        headers: { Accept: 'application/vnd.api+json', ...headers }
      });

      if (!res.ok && !DENIED.has(res.status)) {
        audit.violations.push({ url, status: res.status });
        await res.body?.cancel();
        return;
      }

      // An override may answer with something other than a document (a
      // string is `text/plain`); only a JSON body can name records.
      if (!res.ok || !res.headers.get('content-type')?.includes('json')) {
        await res.body?.cancel();
        return;
      }

      const document = (await res.json()) as {
        links?: { next?: unknown };
      } | null;

      check(url, res.status, identifiersIn(document));

      const next: unknown = document?.links?.next;

      url = typeof next === 'string' ? relative(next) : undefined;
    }
  };

  for (const route of routes) {
    const paged = route.params.get('page')
      ? (route.related ?? route.controller).maxPerPage
      : undefined;

    const query = (include: string | undefined) => {
      const params = new URLSearchParams();

      if (include) {
        params.set('include', include);
      }

      if (paged) {
        params.set('page[size]', String(paged));
      }

      const search = params.toString();

      return search ? `?${search}` : '';
    };

    const targets = route.dynamicSegments.length
      ? (await idsOf(route)).map(id =>
          route.path.replace(':id', encodeURIComponent(id))
        )
      : [route.path];

    for (const path of targets) {
      for (const include of includesOf(route)) {
        await read(path + query(include));
      }
    }
  }

  return audit;
}
