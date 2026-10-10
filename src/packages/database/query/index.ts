/* eslint-disable @typescript-eslint/no-explicit-any --
 * `Query` is the chainable query builder. Its snapshot tuples (method name +
 * arbitrary Knex arguments), where/include condition objects, and the values it
 * ultimately resolves are genuinely dynamic; the original Flow typed them
 * `any`/`Object` for the same reason. The generic `T` still types what a query
 * resolves to for callers.
 */
import { camelize } from 'inflection';

import entries from '../../../utils/entries';
import uniq from '../../../utils/uniq';
import type { ModelClass } from '../interfaces';

import scopesFor from './utils/scopes-for';
import formatSelect from './utils/format-select';
import { runQuery, createRunner } from './runner';

/**
 * The snapshots that narrow which rows match — the only ones `count()` keeps.
 * Every condition the query builder can push belongs here: dropping one makes
 * the count (and so the index action's page links) disagree with the rows.
 *
 * @internal
 */
const CONDITIONS = new Set([
  'where',
  'whereNot',
  'whereIn',
  'whereNotIn',
  'whereNull',
  'whereNotNull',
  'whereBetween',
  'whereNotBetween',
  'whereRaw'
]);

/**
 * A knex query builder (e.g. `Model.table().select('user_id')`), used as a
 * subquery.
 *
 * @internal
 */
function isSubquery(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { toSQL?: unknown }).toSQL === 'function'
  );
}

/**
 * A lazily built database query. `Model.all()`, `Model.where()`,
 * `Model.find()` and the other static query methods start one; chain more
 * methods, and the model's scopes, onto it, and `await` it to run it:
 *
 * ```javascript
 * const posts = await Post.where({ isPublic: true })
 *   .order('createdAt', 'DESC')
 *   .include('user')
 *   .page(2);
 * ```
 *
 * A query resolves with an array of records, or with one record after
 * {@link Query.find}, {@link Query.first} or {@link Query.last}, or with a
 * number after {@link Query.count}. A controller action may return a query
 * without awaiting it; Lumen runs it and serializes the result.
 */
class Query<T = any> extends Promise<T> {
  /** @internal */
  declare model: ModelClass;

  /** @internal */
  declare isFind: boolean;

  /** @internal */
  declare snapshots: Array<Array<any>>;

  /** @internal */
  declare collection: boolean;

  /** @internal */
  declare shouldCount: boolean;

  /** @internal */
  declare relationships: Record<string, any>;

  /** @internal */
  declare trx: unknown;

  constructor(model: ModelClass) {
    let resolve;
    let reject;

    super((res, rej) => {
      resolve = res;
      reject = rej;
    });

    createRunner(this, {
      resolve,
      reject
    });

    Object.defineProperties(this, {
      model: {
        value: model,
        writable: false,
        enumerable: false,
        configurable: false
      },

      collection: {
        value: true,
        writable: true,
        enumerable: false,
        configurable: false
      },

      snapshots: {
        value: [],
        writable: true,
        enumerable: false,
        configurable: false
      },

      shouldCount: {
        value: false,
        writable: true,
        enumerable: false,
        configurable: false
      },

      relationships: {
        value: {},
        writable: true,
        enumerable: false,
        configurable: false
      },

      trx: {
        value: null,
        writable: true,
        enumerable: false,
        configurable: false
      }
    });

    Object.defineProperties(this, scopesFor(this));
  }

  static override get [Symbol.species]() {
    return Promise;
  }

  /**
   * Run the query — and the queries that load its included relationships —
   * in the transaction `trx`, so it sees the rows the transaction has written
   * and does not wait for another connection while the transaction holds
   * one. Model hooks receive the write's transaction for this:
   *
   * ```javascript
   * static hooks = {
   *   async afterCreate(comment, trx) {
   *     const post = await Post.transacting(trx).find(comment.postId);
   *     // …
   *   }
   * };
   * ```
   *
   * `Model.transacting(trx)` starts a query that is already bound, as above;
   * this method binds one built another way.
   */
  transacting(trx: unknown): this {
    this.trx = trx;
    return this;
  }

  /**
   * Every record: adds no condition. `Model.all()` reads better than a bare
   * query.
   */
  all(): this {
    return this;
  }

  /**
   * The records that do *not* match `conditions`; the opposite of
   * {@link Query.where}, with the same conditions.
   *
   * ```javascript
   * await User.not({ name: 'Bob' });
   * await User.not({ deletedAt: null }); // deleted_at IS NOT NULL
   * ```
   */
  not(conditions: Record<string, any> = {}): this {
    return this.where(conditions, true);
  }

  /**
   * The record with primary key `primaryKey`. The query resolves with the
   * record, or rejects with a `RecordNotFoundError` — a `404` through the API —
   * if there is none.
   *
   * ```javascript
   * const post = await Post.find(1);
   * ```
   */
  find(primaryKey: any): this {
    Object.assign(this, {
      isFind: true,
      collection: false
    });

    this.where({
      [this.model.primaryKey]: primaryKey
    });

    if (!this.shouldCount) {
      this.limit(1);
    }

    return this;
  }

  /**
   * Page `num` of the records, counting from 1. The page size is the query's
   * {@link Query.limit}, or 25.
   *
   * ```javascript
   * await Post.order('createdAt', 'DESC').limit(10).page(2); // records 11–20
   * ```
   */
  page(num?: number): this {
    if (this.shouldCount) {
      return this;
    }

    let limit: any = this.snapshots.find(([name]) => name === 'limit');

    if (limit) {
      [, limit] = limit;
    }

    if (typeof limit !== 'number') {
      limit = 25;
    }

    this.limit(limit);

    return this.offset(Math.max(parseInt(String(num), 10) - 1, 0) * limit);
  }

  /**
   * At most `amount` records.
   */
  limit(amount?: number): this {
    if (!this.shouldCount) {
      this.snapshots.push(['limit', amount]);
    }

    return this;
  }

  /**
   * Sort by the attribute `attr`, `'ASC'` (the default) or `'DESC'`. Ties are
   * broken by the primary key, so pages are stable. A later `order` replaces an
   * earlier one; an attribute the model doesn't have is ignored.
   *
   * ```javascript
   * await Post.order('createdAt', 'DESC');
   * ```
   */
  order(attr: string, direction: string = 'ASC'): this {
    if (!this.shouldCount) {
      const columnName = this.model.columnNameFor(attr);

      if (columnName) {
        this.snapshots = this.snapshots
          .filter(([method]) => method !== 'orderByRaw')
          .concat([
            [
              'orderByRaw',
              uniq([columnName, this.model.primaryKey])
                .map(key => `${this.model.tableName}.${key} ${direction}`)
                .join(', ')
            ]
          ]);
      }
    }

    return this;
  }

  /**
   * The records matching every condition in `conditions`, an object of
   * attribute names (camelCase, as on records) and values:
   *
   * ```javascript
   * await Post.where({ userId: 1, isPublic: true });
   * await Post.where({ id: [1, 2, 3] });   // any of: id IN (1, 2, 3)
   * await Post.where({ publishedAt: null }); // published_at IS NULL
   * ```
   *
   * Names that aren't attributes of the model are ignored. Calls chain as
   * `AND`.
   *
   * @param not - Used by {@link Query.not}.
   */
  where(conditions: Record<string, any> = {}, not: boolean = false): this {
    const {
      model: { tableName }
    } = this;

    const where = entries(conditions).reduce<Record<string, any>>(
      (obj, condition) => {
        let [key, value] = condition;
        const columnName = this.model.columnNameFor(key);

        if (columnName) {
          key = `${tableName}.${columnName}`;

          if (typeof value === 'undefined') {
            value = null;
          }

          if (isSubquery(value)) {
            // `model.table().select(...)`: the column is one of its values.
            this.snapshots.push([not ? 'whereNotIn' : 'whereIn', [key, value]]);
          } else if (Array.isArray(value)) {
            if (value.length === 1) {
              return {
                ...obj,
                [key]: value[0]
              };
            }

            this.snapshots.push([not ? 'whereNotIn' : 'whereIn', [key, value]]);
          } else if (value === null) {
            this.snapshots.push([not ? 'whereNotNull' : 'whereNull', [key]]);
          } else {
            return {
              ...obj,
              [key]: value
            };
          }
        }

        return obj;
      },
      {}
    );

    if (Object.keys(where).length) {
      this.snapshots.push([not ? 'whereNot' : 'where', where]);
    }

    return this;
  }

  /**
   * The records whose attributes lie within ranges, inclusive:
   *
   * ```javascript
   * await Post.whereBetween({ createdAt: [lastWeek, now] });
   * ```
   *
   * @param not - `true` for the records *outside* the ranges.
   */
  whereBetween(conditions: Record<string, any>, not: boolean = false): this {
    const {
      model: { tableName }
    } = this;

    entries(conditions).forEach(condition => {
      let [key] = condition;
      const [, value] = condition;
      const columnName = this.model.columnNameFor(key);

      if (columnName) {
        key = `${tableName}.${columnName}`;

        if (Array.isArray(value)) {
          this.snapshots.push([
            `where${not ? 'NotBetween' : 'Between'}`,
            [key, value]
          ]);
        }
      }
    });

    return this;
  }

  /**
   * The records matching a raw SQL condition, with `?` placeholders for
   * `bindings`. Columns are snake_case here, as in the database:
   *
   * ```javascript
   * await Post.whereRaw('lower(title) LIKE ?', ['%lumen%']);
   * ```
   *
   * Never build `query` from user input; pass values as `bindings`.
   */
  whereRaw(query: string, bindings: Array<any> = []): this {
    this.snapshots.push(['whereRaw', [query, bindings]]);
    return this;
  }

  /**
   * Only the first record — by primary key, or by the query's
   * {@link Query.order} — instead of an array. Resolves with `undefined` when
   * nothing matches.
   */
  first(): this {
    if (!this.shouldCount) {
      const willSort = this.snapshots.some(
        ([method]) => method === 'orderByRaw'
      );

      this.collection = false;

      if (!willSort) {
        this.order(this.model.primaryKey, 'ASC');
      }

      this.limit(1);
    }

    return this;
  }

  /**
   * Only the last record — by primary key, or by the query's
   * {@link Query.order} — instead of an array. Resolves with `undefined` when
   * nothing matches.
   */
  last(): this {
    if (!this.shouldCount) {
      const willSort = this.snapshots.some(
        ([method]) => method === 'orderByRaw'
      );

      this.collection = false;

      if (!willSort) {
        this.order(this.model.primaryKey, 'DESC');
      }

      this.limit(1);
    }

    return this;
  }

  /**
   * The number of matching records, instead of the records. Only the query's
   * conditions count; `limit`, `page`, `order` and `include` are ignored.
   *
   * ```javascript
   * const total = await Post.where({ isPublic: true }).count();
   * ```
   */
  count(): Query<number> {
    Object.assign(this, {
      shouldCount: true,

      snapshots: [
        ['count', '* as countAll'],
        ...this.snapshots.filter(([name]) => CONDITIONS.has(name))
      ]
    });

    return this as unknown as Query<number>;
  }

  /**
   * Skip the first `amount` records.
   */
  offset(amount: number): this {
    if (!this.shouldCount) {
      this.snapshots.push(['offset', amount]);
    }

    return this;
  }

  /**
   * Load only these attributes. Include the primary key when you will use
   * the records for more than reading these values.
   *
   * ```javascript
   * await User.select('id', 'name');
   * ```
   */
  select(...attrs: Array<string>): this {
    if (!this.shouldCount) {
      this.snapshots.push(['select', formatSelect(this.model, attrs)]);
    }

    return this;
  }

  /**
   * Only unique combinations of these attributes.
   */
  distinct(...attrs: Array<string>): this {
    if (!this.shouldCount) {
      this.snapshots.push(['distinct', formatSelect(this.model, attrs)]);
    }

    return this.select();
  }

  /**
   * Load these relationships with the records, so reading them doesn't cost
   * a query per record:
   *
   * ```javascript
   * const posts = await Post.where({ isPublic: true }).include('user', 'tags');
   * ```
   *
   * Pass an object to load only some attributes of each:
   * `include({ user: ['name'] })`.
   */
  include(...relationships: Array<Record<string, any> | string>): this {
    let included: Array<any>;

    if (!this.shouldCount) {
      if (relationships.length === 1 && typeof relationships[0] === 'object') {
        included = entries(relationships[0]).reduce<Array<any>>(
          (arr, relationship) => {
            const [name] = relationship;
            const opts = this.model.relationshipFor(name);
            let [, attrs] = relationship;

            if (opts) {
              if (!attrs.length) {
                attrs = opts.model.attributeNames;
              }

              return [...arr, { name, attrs, relationship: opts }];
            }

            return arr;
          },
          []
        );
      } else {
        included = relationships.reduce<Array<any>>((arr, name) => {
          let str = name;

          if (typeof str !== 'string') {
            str = String(str);
          }

          const opts = this.model.relationshipFor(str);

          if (opts) {
            const attrs = opts.model.attributeNames;

            return [...arr, { attrs, name: str, relationship: opts }];
          }

          return arr;
        }, []);
      }

      const willInclude = included
        .filter(opts => {
          const { name, relationship } = opts;
          let { attrs } = opts;

          if (relationship.type === 'hasMany') {
            attrs = relationship.through
              ? attrs
              : [...attrs, camelize(relationship.foreignKey, true)];

            this.relationships[name] = {
              attrs,
              type: 'hasMany',
              model: relationship.model,
              inverse: relationship.inverse,
              through: relationship.through,
              foreignKey: relationship.foreignKey
            };

            return false;
          }

          return true;
        })
        .reduce<Array<any>>((arr, { name, attrs, relationship }) => {
          arr.push([
            'includeSelect',
            formatSelect(relationship.model, attrs, `${name}.`)
          ]);

          if (relationship.type === 'belongsTo') {
            arr.push([
              'leftOuterJoin',
              [
                relationship.model.tableName,
                `${this.model.tableName}.${relationship.foreignKey}`,
                '=',
                `${relationship.model.tableName}.${relationship.model.primaryKey}`
              ]
            ]);
          } else if (relationship.type === 'hasOne') {
            arr.push([
              'leftOuterJoin',
              [
                relationship.model.tableName,
                `${this.model.tableName}.${this.model.primaryKey}`,
                '=',
                `${relationship.model.tableName}.${relationship.foreignKey}`
              ]
            ]);
          }

          return arr;
        }, []);

      this.snapshots.push(...willInclude);
    }

    return this;
  }

  /**
   * Remove scopes from the query — by name, or every scope when called
   * without arguments. `'order'` removes the sort order.
   *
   * ```javascript
   * await Post.isPublic().unscope('isPublic');
   * ```
   */
  unscope(...scopes: Array<string>): this {
    if (scopes.length) {
      const keys = scopes.map(scope => {
        if (scope === 'order') {
          return 'orderByRaw';
        }

        return scope;
      });

      this.snapshots = this.snapshots.filter(([, , scope]) => {
        if (typeof scope === 'string') {
          return keys.indexOf(scope) < 0;
        }

        return true;
      });
    } else {
      this.snapshots = this.snapshots.filter(([, , scope]) => !scope);
    }

    return this;
  }

  override then<TResult1 = T, TResult2 = never>(
    onFulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onRejected?: ((error: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    runQuery(this);
    return super.then(onFulfilled, onRejected);
  }

  override catch<TResult = never>(
    onRejected?: ((error: unknown) => TResult | PromiseLike<TResult>) | null
  ): Promise<T | TResult> {
    runQuery(this);
    return super.catch(onRejected);
  }

  /** @internal */
  static from(src: any): Query<unknown> {
    const { model, snapshots, collection, shouldCount, relationships, trx } =
      src;

    const dest = new this(model) as Query<unknown>;

    Object.assign(dest, {
      snapshots,
      collection,
      shouldCount,
      relationships,
      trx: trx ?? null
    });

    return dest;
  }
}

export default Query;
export { RecordNotFoundError } from './errors';
export { CONDITIONS };
