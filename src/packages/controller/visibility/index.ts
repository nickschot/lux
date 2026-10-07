import { CONDITIONS } from '../../database/query';
import { Query } from '../../database';
import type { Model, ModelClass } from '../../database';
import type { Request } from '../../server';

import { VisibilityRuleError } from './errors';

/**
 * A namespace's visibility rules: per resource type, a function that narrows
 * a `Query` of that type to the rows the request may see.
 */
export type Visibility = Record<
  string,
  (query: Query<Array<Model>>, request: Request) => Query<Array<Model>>
>;

/**
 * Applies a namespace's visibility rules for one request. Every query Lumen
 * issues for the request — primary data, linkage, `included`, relationship
 * checks on writes — goes through `apply()`.
 *
 * @private
 */
export class Scope {
  /**
   * Applies no rules. The default wherever no request is involved.
   */
  static readonly none = new Scope({}, null);

  declare private readonly rules: Visibility;

  declare private readonly request: Request | null;

  declare private readonly compiled: Map<ModelClass, Array<Array<unknown>>>;

  constructor(rules: Visibility, request: Request | null) {
    Object.assign(this, { rules, request, compiled: new Map() });
  }

  /**
   * Whether a rule narrows `model`.
   */
  covers(model: ModelClass): boolean {
    return typeof this.rules[model.resourceName] === 'function';
  }

  /**
   * Add the conditions of `query.model`'s rule, if it has one, to `query`.
   *
   * The conditions are added untagged, so `query.unscope()` cannot remove
   * them.
   */
  apply<Q extends Query<unknown>>(query: Q): Q {
    const conditions = this.conditionsFor(query.model);

    if (conditions.length) {
      query.snapshots.push(...conditions);
    }

    return query;
  }

  /**
   * Run `model`'s rule once per request against an empty probe query and keep
   * the conditions it adds. Only conditions are allowed: the same rule has to
   * hold for `count()`, for the narrow selects linkage is loaded with and for
   * existence checks, which a `select`, `order`, `limit`, `include` or join
   * would break.
   */
  private conditionsFor(model: ModelClass): Array<Array<unknown>> {
    const { rules, request, compiled } = this;
    let conditions = compiled.get(model);

    if (conditions) {
      return conditions;
    }

    const rule = rules[model.resourceName];

    if (typeof rule !== 'function') {
      conditions = [];
    } else {
      const result: unknown = rule(new Query(model), request as Request);

      // `Query` is a Promise, so test for it first: an `async` rule returns a
      // plain Promise, having already awaited — and so run — its query.
      if (!(result instanceof Query) || result.model !== model) {
        throw new VisibilityRuleError(
          model,
          'must synchronously return the query it is given, narrowed. ' +
            'Load anything it needs in a `beforeAction` hook instead.'
        );
      }

      const invalid = result.snapshots.find(([name]) => !CONDITIONS.has(name));

      if (invalid) {
        throw new VisibilityRuleError(
          model,
          `may only add conditions (where, not, whereBetween, whereRaw), ` +
            `not \`${String(invalid[0])}\`.`
        );
      }

      // Drop the scope name a model scope (`query.isPublic()`) tags its
      // conditions with, which is what `unscope()` matches on.
      conditions = result.snapshots.map(([name, params]) => [name, params]);
    }

    compiled.set(model, conditions);

    return conditions;
  }
}

const scopes = new WeakMap<Request, Scope>();

/**
 * The `Scope` of `request` under `rules`, created once per request so each
 * rule runs at most once however many queries it narrows.
 *
 * @private
 */
export function scopeFor(rules: Visibility, request: Request): Scope {
  let scope = scopes.get(request);

  if (!scope) {
    scope = new Scope(rules, request);
    scopes.set(request, scope);
  }

  return scope;
}
