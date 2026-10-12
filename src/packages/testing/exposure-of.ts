import type Application from '../application';
import type Controller from '../controller';
import type Route from '../router/route';
import {
  enumerateIncludeTypes,
  includePathsFor
} from '../serializer/utils/include-tree';

/** What a namespace's controller lets a client ask for, in {@link NamespaceExposure}. */
export type ControllerExposure = {
  /** The attributes `?sort=` accepts. */
  sort: Array<string>;
  /** The attributes `?filter[…]=` accepts. */
  filter: Array<string>;
  /** The paths `?include=` accepts. */
  include: Array<string>;
  /** The controller's own query parameters (`query`). */
  query: Array<string>;
  /**
   * The attributes and relationships a `POST` or `PATCH` may set, for a
   * controller with such a route of a resource.
   */
  params?: Array<string>;
};

/** A type a namespace can return, include or link to, in {@link NamespaceExposure}. */
export type TypeExposure = {
  /**
   * The type's visibility rule: `narrows` for a function, `all` for `true`,
   * `none` for no rule (every record is visible).
   */
  rule: 'narrows' | 'all' | 'none';
  /** The attributes the namespace's serializer outputs. */
  attributes: Array<string>;
  /** The relationships it outputs. */
  relationships: Array<string>;
  /** The relationships it outputs as links only, when there are any. */
  linksOnly?: Array<string>;
};

/**
 * What one namespace exposes, as {@link exposureOf} reports it. Every list
 * and every object's keys are sorted, so that it compares and snapshots
 * stably.
 */
export type NamespaceExposure = {
  /** The namespace, as a path: `/` or `/members`. */
  namespace: string;
  /** Whether it has visibility rules, its own or a parent's. */
  visibilityRules: boolean;
  /** Whether it has `strictVisibility`. */
  strictVisibility: boolean;
  /**
   * Its routes, as `GET /members/posts/:id → show`: the method, the path and
   * the action. `HEAD` and `OPTIONS`, which every route has, are left out.
   */
  routes: Array<string>;
  /** Per resource type, what its controller lets a client ask for. */
  controllers: Record<string, ControllerExposure>;
  /** Per type the namespace can return, include or link to, what it shows. */
  types: Record<string, TypeExposure>;
};

const WRITES = new Set(['POST', 'PATCH']);

const sorted = (list: Iterable<string>) => Array.from(new Set(list)).sort();

/** `entries` as an object whose keys are in order. */
const byKey = <T>(entries: Iterable<[string, T]>): Record<string, T> =>
  Object.fromEntries(
    Array.from(entries).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  );

/** The namespaces `app`'s routes are in, as their names (`''`, `members`). */
function namespacesOf(app: Application): Array<string> {
  return sorted(
    Array.from(app.router.values(), route => route.controller.namespace)
  );
}

function exposureOfNamespace(
  app: Application,
  namespace: string
): NamespaceExposure {
  const routes = Array.from(app.router.values()).filter(
    route =>
      route.method !== 'HEAD' &&
      route.method !== 'OPTIONS' &&
      route.controller.namespace === namespace
  );

  if (!routes.length) {
    throw new Error(`exposureOf: namespace '/${namespace}' serves no routes.`);
  }

  // The controllers whose settings the namespace's routes take: each
  // route's own, and for a related endpoint the related type's.
  const controllers = new Set<Controller>();
  const writers = new Set<Controller>();

  routes.forEach((route: Route) => {
    [route.controller, route.related].forEach(controller => {
      if (controller?.hasModel && controller.hasSerializer) {
        controllers.add(controller);
      }
    });

    if (WRITES.has(route.method) && route.type !== 'custom') {
      writers.add(route.controller);
    }
  });

  const [anyController] = routes.map(route => route.controller);
  const rules = anyController.visibility;

  const types = new Map<string, TypeExposure>();

  controllers.forEach(controller => {
    enumerateIncludeTypes(
      controller.model,
      controller.serializer,
      controller.maxIncludeDepth,
      related => controller.serializerFor(related)
    ).forEach((serializer, type) => {
      if (types.has(type)) {
        return;
      }

      const rule = rules[type];
      const linksOnly = sorted(serializer.linksOnly ?? []);

      types.set(type, {
        rule:
          typeof rule === 'function'
            ? 'narrows'
            : rule === true
              ? 'all'
              : 'none',
        attributes: sorted(serializer.attributes),
        relationships: sorted([...serializer.hasOne, ...serializer.hasMany]),
        ...(linksOnly.length ? { linksOnly } : {})
      });
    });
  });

  return {
    namespace: `/${namespace}`,
    visibilityRules: anyController.hasVisibilityRules,
    strictVisibility: anyController.hasStrictVisibility,
    routes: sorted(
      routes.map(({ method, path, action }) => `${method} ${path} → ${action}`)
    ),
    controllers: byKey(
      Array.from(controllers, (controller): [string, ControllerExposure] => [
        controller.model.resourceName,
        {
          sort: sorted(controller.sort),
          filter: sorted(controller.filter),
          include: sorted(includePathsFor(controller)),
          query: sorted(controller.query),
          ...(writers.has(controller)
            ? { params: sorted(controller.params) }
            : {})
        }
      ])
    ),
    types: byKey(types)
  };
}

/**
 * What every namespace exposes, from the booted app, keyed by its path (`/`,
 * `/members`): its routes, what each of its controllers lets a client sort,
 * filter, include and write, and every type it can return, include or link
 * to, with the attributes and relationships it shows of each and whether a
 * visibility rule covers it.
 *
 * What a namespace exposes is spread over routes, controllers, serializers,
 * visibility rules and namespace settings, so a change to any of them can
 * widen it without the diff looking like an access change. Snapshot the
 * report, and such a change shows up in review as a diff of the snapshot:
 *
 * ```javascript
 * import { exposureOf } from 'lumen-framework/testing';
 *
 * it('exposes what we expect', () => {
 *   expect(exposureOf(app)).toMatchSnapshot();
 * });
 * ```
 *
 * Lists and keys are sorted, so the report only changes when the exposure
 * does. Visibility rules show as whether one covers a type, not what it does:
 * {@link auditVisibility} checks the records a request sees.
 *
 * @param app - The application, booted (it need not listen).
 * @returns Every namespace's exposure, by path.
 */
function exposureOf(app: Application): Record<string, NamespaceExposure>;
/**
 * What one namespace exposes; see the overload without a `namespace`.
 *
 * @param app - The application, booted (it need not listen).
 * @param namespace - The namespace: `''` for the root, `'members'`.
 * @returns The namespace's exposure.
 * @throws When `namespace` serves no routes, so a mistyped one cannot
 * snapshot nothing.
 */
function exposureOf(app: Application, namespace: string): NamespaceExposure;
function exposureOf(
  app: Application,
  namespace?: string
): NamespaceExposure | Record<string, NamespaceExposure> {
  if (namespace !== undefined) {
    return exposureOfNamespace(app, namespace);
  }

  return byKey(
    namespacesOf(app).map((name): [string, NamespaceExposure] => [
      `/${name}`,
      exposureOfNamespace(app, name)
    ])
  );
}

export default exposureOf;
