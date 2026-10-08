import { pluralize } from 'inflection';

import Query from '../query';
import ChangeSet from '../change-set';
import { updateRelationship } from '../relationship';
import {
  createTransactionResultProxy,
  createStaticTransactionProxy,
  createInstanceTransactionProxy
} from '../transaction';
import pick from '../../../utils/pick';
import underscore from '../../../utils/underscore';
import { compose } from '../../../utils/compose';
import { map as diffMap } from '../../../utils/diff';
import mapToObject from '../../../utils/map-to-object';
import type Logger from '../../logger';
import type Database from '../../database';
import type Serializer from '../../serializer';

import type { RelationshipOptions } from '../relationship';
import type { ModelClass, Database$column } from '../interfaces';
import type { TransactionResult } from '../transaction';

import { create, update, destroy, createRunner } from './utils/persistence';
import initializeClass from './initialize-class';
import validate from './utils/validate';
import { rethrowWriteError } from './utils/process-write-error';
import runHooks from './utils/run-hooks';
import { readAttribute, writeAttribute } from './utils/attribute';
import type { ModelHooks } from './interfaces';

/**
 * The base class of an app's models. A model is one database table: its
 * attributes are the table's columns, read when the app boots, and the class
 * declares the rest as statics — relationships (`hasOne`, `hasMany`,
 * `belongsTo`), `validates`, `hooks` and `scopes`.
 *
 * ```javascript
 * import { Model } from 'lumen-framework';
 *
 * class Post extends Model {
 *   static belongsTo = {
 *     user: { inverse: 'posts' }
 *   };
 * }
 *
 * export default Post;
 * ```
 *
 * The static query methods (`find`, `where`, `first`, …) start a
 * {@link Query}; `create`, and `update`, `save` and `destroy` on a record,
 * write. See the
 * [models guide](https://github.com/nickschot/lux/blob/main/docs/guides/models.md).
 */
class Model {
  /**
   * The record's model class, typed with its statics
   * (`this.constructor.primaryKey`, `.relationshipFor`, …).
   */
  declare ['constructor']: ModelClass;

  /**
   * The model's table name; the same as the static {@link Model.tableName}.
   */
  declare tableName: string;

  /**
   * The model's name (`post`); the same as the static
   * {@link Model.modelName}.
   */
  declare modelName: string;

  /**
   * The resource type the model is served as (`posts`); the same as the
   * static {@link Model.resourceName}.
   */
  declare resourceName: string;

  /**
   * When the record was created, if the table has a `created_at` column.
   */
  declare createdAt: Date;

  /**
   * When the record was last updated, if the table has an `updated_at`
   * column.
   */
  declare updatedAt: Date;

  /** @internal */
  declare initialized: boolean;

  /** @internal */
  declare rawColumnData: Record<string, unknown>;

  /** @internal */
  declare isModelInstance: boolean;

  /** @internal */
  declare prevAssociations: Set<Model>;

  /**
   * Names of `hasOne` relationships that were eager-loaded (joined) and found
   * to have no related record. Lets the relationship getter answer `null`
   * without a per-record query. Kept outside of the change sets so it never
   * counts as a change to the record.
   *
   * @internal
   */
  declare absentRelationships: Set<string>;

  /** @internal */
  declare changeSets: Array<ChangeSet>;

  /**
   * The model's to-one relationships whose foreign key is on the *other*
   * table, by name. Each names its `inverse`, the relationship on the other
   * model that points back:
   *
   * ```javascript
   * class User extends Model {
   *   static hasOne = {
   *     profile: { inverse: 'user' }   // profiles.user_id
   *   };
   * }
   *
   * class Profile extends Model {
   *   static belongsTo = {
   *     user: { inverse: 'profile' }
   *   };
   * }
   * ```
   *
   * The foreign key is `<inverse>_id` on the other table. Set `model` when
   * the related model's name differs from the relationship's
   * (`avatar: { inverse: 'owner', model: 'image' }`).
   */
  declare static hasOne: Record<string, unknown>;

  /**
   * The model's to-many relationships, by name. Each names its `inverse`, the
   * relationship on the other model that points back:
   *
   * ```javascript
   * class Author extends Model {
   *   static hasMany = {
   *     books: { inverse: 'author' }   // books.author_id
   *   };
   * }
   *
   * class Book extends Model {
   *   static belongsTo = {
   *     author: { inverse: 'books' }
   *   };
   * }
   * ```
   *
   * The foreign key is `<inverse>_id` on the other table. Set `model` when
   * the related model's name differs from the relationship's
   * (`publications: { inverse: 'author', model: 'book' }`).
   *
   * A many-to-many relationship goes `through` a join model, which
   * `belongsTo` both sides; each side's `inverse` names the other side's
   * relationship:
   *
   * ```javascript
   * class Post extends Model {
   *   static hasMany = {
   *     tags: { inverse: 'posts', through: 'categorization' }
   *   };
   * }
   *
   * class Tag extends Model {
   *   static hasMany = {
   *     posts: { inverse: 'tags', through: 'categorization' }
   *   };
   * }
   *
   * class Categorization extends Model {
   *   static belongsTo = {
   *     post: { inverse: 'tags' },
   *     tag: { inverse: 'posts' }
   *   };
   * }
   * ```
   */
  declare static hasMany: Record<string, unknown>;

  /**
   * The model's to-one relationships whose foreign key is on *this* table,
   * by name. Each names its `inverse`, the relationship on the other model
   * that points back:
   *
   * ```javascript
   * class Book extends Model {
   *   static belongsTo = {
   *     author: { inverse: 'books' }   // books.author_id
   *   };
   * }
   *
   * class Author extends Model {
   *   static hasMany = {
   *     books: { inverse: 'author' }
   *   };
   * }
   * ```
   *
   * The foreign key is `<name>_id` on this table, and is also an attribute
   * (`book.authorId`), so the relationship can be set by id as well as by
   * record. Set `model` when the related model's name differs from the
   * relationship's (`writer: { inverse: 'books', model: 'author' }`, with a
   * `writer_id` column).
   */
  declare static belongsTo: Record<string, unknown>;

  /**
   * Validators for the model's attributes, by attribute name. Each takes the
   * value and returns whether it is valid; they run before every create and
   * update, after the `beforeValidation` hooks.
   *
   * ```javascript
   * import { isEmail } from 'validator';
   *
   * class User extends Model {
   *   static validates = {
   *     email: isEmail,
   *     username: value => /^\w{2,30}$/.test(value)
   *   };
   * }
   * ```
   *
   * A value that fails throws a `ValidationError`, which the API answers
   * with `422 Unprocessable Entity` and a pointer to the attribute. Lumen
   * ships no validators of its own; use plain functions or a package such as
   * [validator](https://www.npmjs.com/package/validator).
   */
  declare static validates: Record<string, unknown>;

  /**
   * Named, reusable query conditions. Each scope becomes a method on the
   * model and on its queries, with `this` the query it is called on, and
   * chains like the built-in methods:
   *
   * ```javascript
   * class Post extends Model {
   *   static scopes = {
   *     isPublic() {
   *       return this.where({ isPublic: true });
   *     },
   *
   *     byUser(user) {
   *       return this.where({ userId: user.id });
   *     }
   *   };
   * }
   *
   * const posts = await Post.byUser(user).isPublic().page(2);
   * ```
   *
   * {@link Query.unscope} removes a scope from a query again.
   *
   * A scope narrows only the queries it is called on, and knows nothing of
   * the request. Calling `isPublic()` in a controller's `index` hides private
   * posts from that listing alone: `show`, relationship linkage, `include` and
   * the relationships of a write still reach them, and `unscope('isPublic')`
   * undoes it. To hide records from every request in a namespace, use the
   * scope in a controller visibility rule instead
   * ({@link Controller.visibility}), which Lumen applies to every query it
   * issues for the request and `unscope()` cannot remove.
   */
  declare static scopes: Record<string, unknown>;

  /**
   * Functions that run at points of a record's life, by name.
   *
   * | Creating | Updating | Deleting |
   * |---|---|---|
   * | `beforeValidation` | `beforeValidation` | `beforeDestroy` |
   * | `afterValidation` | `afterValidation` | `afterDestroy` |
   * | `beforeCreate` | `beforeUpdate` | |
   * | `beforeSave` | `beforeSave` | |
   * | `afterCreate` | `afterUpdate` | |
   * | `afterSave` | `afterSave` | |
   *
   * A hook is called with the record and the write's transaction,
   * `(record, trx)`, and may be async. Everything it does through the record
   * — reading a relationship, `update`, `save`, `destroy`, `reload` — runs in
   * that transaction. Pass the transaction on for queries on other models,
   * with `Model.transacting(trx)`. Then they see what the write has done so
   * far, and are rolled back with it if a later step fails:
   *
   * ```javascript
   * class Comment extends Model {
   *   static hooks = {
   *     async afterCreate(comment, trx) {
   *       const post = await comment.post;
   *
   *       await Notification.transacting(trx).create({
   *         recipientId: post.userId,
   *         message: `New comment on "${post.title}"`
   *       });
   *     }
   *   };
   * }
   * ```
   *
   * The record a hook receives is a proxy of the instance being written:
   * attributes read and assign as usual, but compare records by
   * {@link Model.getPrimaryKey}, not `===`.
   */
  declare static hooks: ModelHooks;

  /**
   * The application's logger.
   */
  declare static logger: Logger;

  /**
   * The model's table: the pluralized, underscored class name (`BlogPost` →
   * `blog_posts`), unless the model sets it.
   */
  declare static tableName: string;

  /**
   * The model's name, singular and dasherized (`blog-post`).
   */
  declare static modelName: string;

  /**
   * The resource type the model is served as, plural and dasherized
   * (`blog-posts`).
   */
  declare static resourceName: string;

  /**
   * The primary key column.
   */
  static primaryKey: string = 'id';

  /** @internal */
  declare static table: () => unknown;

  /** @internal */
  declare static store: Database;

  /** @internal */
  declare static initialized: boolean;

  /** @internal */
  declare static serializer: Serializer<Model>;

  /** @internal */
  declare static attributes: Record<string, unknown>;

  /** @internal */
  declare static attributeNames: Array<string>;

  /** @internal */
  declare static relationships: Record<string, RelationshipOptions>;

  /** @internal */
  declare static relationshipNames: Array<string>;

  /**
   * Build a record without saving it; {@link Model.create} builds and saves
   * one. `attrs` may hold attributes and relationships.
   */
  constructor(attrs: Record<string, unknown> = {}, initialize: boolean = true) {
    Object.defineProperties(this, {
      changeSets: {
        value: [new ChangeSet()],
        writable: false,
        enumerable: false,
        configurable: false
      },
      rawColumnData: {
        value: attrs,
        writable: false,
        enumerable: false,
        configurable: false
      },
      prevAssociations: {
        value: new Set(),
        writable: false,
        enumerable: false,
        configurable: false
      },
      absentRelationships: {
        value: new Set(),
        writable: false,
        enumerable: false,
        configurable: false
      }
    });

    const {
      constructor: { attributeNames, relationshipNames }
    } = this;
    const props = pick(attrs, ...attributeNames.concat(relationshipNames));

    Object.assign(this, props);

    if (initialize) {
      Object.defineProperty(this, 'initialized', {
        value: true,
        writable: false,
        enumerable: false,
        configurable: false
      });
    }

    return this;
  }

  /**
   * Whether the record has never been saved.
   *
   * ```javascript
   * new Post({ title: 'Draft' }).isNew; // => true
   *
   * const post = await Post.create({ title: 'Draft' });
   * post.isNew; // => false
   * ```
   */
  get isNew(): boolean {
    return !this.persistedChangeSet;
  }

  /**
   * Whether the record has changes that aren't saved.
   *
   * ```javascript
   * const post = await Post.find(1);
   * post.isDirty; // => false
   *
   * post.title = 'Renamed';
   * post.isDirty; // => true
   *
   * await post.save();
   * post.isDirty; // => false
   * ```
   */
  get isDirty(): boolean {
    return Boolean(this.dirtyProperties.size);
  }

  /**
   * Whether the record is saved and has no unsaved changes: neither
   * {@link Model.isNew} nor {@link Model.isDirty}.
   */
  get persisted(): boolean {
    return !this.isNew && !this.isDirty;
  }

  /**
   * The attributes changed since the record was last saved, with their new
   * values.
   *
   * ```javascript
   * if (user.dirtyAttributes.has('password')) {
   *   user.password = await hash(user.password);
   * }
   * ```
   */
  get dirtyAttributes(): Map<string, unknown> {
    const {
      dirtyProperties,
      constructor: { relationshipNames }
    } = this;

    Array.from(dirtyProperties.keys()).forEach(key => {
      if (relationshipNames.indexOf(key) >= 0) {
        dirtyProperties.delete(key);
      }
    });

    return dirtyProperties;
  }

  /**
   * The relationships changed since the record was last saved, with their new
   * values.
   */
  get dirtyRelationships(): Map<string, unknown> {
    const {
      dirtyProperties,
      constructor: { attributeNames }
    } = this;

    Array.from(dirtyProperties.keys()).forEach(key => {
      if (attributeNames.indexOf(key) >= 0) {
        dirtyProperties.delete(key);
      }
    });

    return dirtyProperties;
  }

  /** @internal */
  get dirtyProperties(): Map<string, unknown> {
    const { currentChangeSet, persistedChangeSet } = this;

    if (!persistedChangeSet) {
      return new Map(currentChangeSet);
    }

    return diffMap(persistedChangeSet, currentChangeSet);
  }

  /** @internal */
  get currentChangeSet(): ChangeSet {
    return this.changeSets[0];
  }

  /** @internal */
  get persistedChangeSet(): ChangeSet | undefined {
    return this.changeSets.find(({ isPersisted }) => isPersisted);
  }

  /**
   * Bind the record to a transaction you started with
   * {@link Model.transaction}: `save`, `update`, `destroy`, `reload` and
   * relationship reads on the returned record run in `trx`, and so do the
   * related records those reads return.
   *
   * ```javascript
   * await Post.transaction(async trx => {
   *   await post.transacting(trx).update({ isPublic: true });
   *   await user.transacting(trx).update({ isActive: true });
   * });
   * ```
   *
   * Model hooks receive their record bound already.
   *
   * @param trx - The transaction.
   * @returns A proxy of the record that uses `trx`.
   */
  transacting(trx: unknown): this {
    return createInstanceTransactionProxy(this, trx);
  }

  /**
   * Run `fn` in a new transaction; the same as {@link Model.transaction} on
   * the record's model.
   *
   * @param fn - Called with the transaction. It commits when the promise `fn`
   * returns resolves, and rolls back when it rejects.
   * @returns Resolves with what `fn` resolved with.
   */
  transaction<T>(fn: (...args: Array<unknown>) => Promise<T>): Promise<T> {
    return this.constructor.transaction(fn);
  }

  /**
   * Save the changes made by assigning to the record.
   *
   * ```javascript
   * const post = await Post.find(1);
   *
   * post.title = 'Renamed';
   * await post.save();
   * ```
   *
   * Validations and the update hooks run, in a transaction of their own unless
   * one is given.
   *
   * @param transaction - A transaction to run in, instead of a new one.
   * @returns Resolves with the record; its `didPersist` is `false` when
   * there was nothing to save.
   */
  save(transaction?: unknown): Promise<TransactionResult<this, boolean>> {
    return this.update(mapToObject(this.dirtyProperties), transaction);
  }

  /**
   * Assign `props` to the record and save it.
   *
   * ```javascript
   * const post = await Post.find(1);
   *
   * await post.update({ title: 'Renamed', isPublic: true });
   * ```
   *
   * Validations and the update hooks run, in a transaction of their own unless
   * one is given.
   *
   * @param props - Attributes and relationships to assign.
   * @param transaction - A transaction to run in, instead of a new one.
   * @returns Resolves with the record; its `didPersist` is `false` when nothing
   * changed.
   */
  update(
    props: Record<string, unknown> = {},
    transaction?: unknown
  ): Promise<TransactionResult<this, boolean>> {
    const run = async (trx: unknown) => {
      const {
        constructor: { hooks }
      } = this;
      let statements: Array<unknown> = [];
      let promise: Array<unknown> | Promise<Array<unknown>> = Promise.resolve(
        []
      );
      let hadDirtyAttrs = false;
      let hadDirtyAssoc = false;

      const associations = Object.keys(props).filter(key =>
        Boolean(this.constructor.relationshipFor(key))
      );

      Object.assign(this, props);

      if (associations.length) {
        hadDirtyAssoc = true;

        for (const key of associations) {
          statements = [
            ...statements,
            ...(await updateRelationship(this, key, trx))
          ];
        }
      }

      if (this.isDirty) {
        hadDirtyAttrs = true;

        await runHooks(this, trx, hooks.beforeValidation);

        validate(this);

        await runHooks(
          this,
          trx,
          hooks.afterValidation,
          hooks.beforeUpdate,
          hooks.beforeSave
        );

        promise = update(this, trx);
      }

      await createRunner(this.constructor, statements)(await promise);

      this.prevAssociations.clear();
      this.currentChangeSet.persist(this.changeSets);

      if (hadDirtyAttrs) {
        await runHooks(this, trx, hooks.afterUpdate, hooks.afterSave);
      }

      return createTransactionResultProxy(this, hadDirtyAttrs || hadDirtyAssoc);
    };

    if (transaction) {
      return run(transaction).catch(rethrowWriteError);
    }

    return this.transaction(run).catch(rethrowWriteError);
  }

  /**
   * Delete the record, running the destroy hooks, in a transaction of its own
   * unless one is given.
   *
   * @param transaction - A transaction to run in, instead of a new one.
   * @returns Resolves with the record.
   */
  destroy(transaction?: unknown): Promise<TransactionResult<this, true>> {
    const run = async (trx: unknown) => {
      const {
        constructor: { hooks }
      } = this;

      await runHooks(this, trx, hooks.beforeDestroy);
      await createRunner(this.constructor, [])(await destroy(this, trx));
      await runHooks(this, trx, hooks.afterDestroy);

      return createTransactionResultProxy(this, true);
    };

    if (transaction) {
      return run(transaction);
    }

    return this.transaction(run);
  }

  /**
   * Fetch the record from the database again.
   *
   * @returns Resolves with a new instance of the record as stored (the record
   * itself if it was never saved).
   */
  reload(): Promise<Model> {
    if (this.isNew) {
      return Promise.resolve(this);
    }

    return this.constructor.find(this.getPrimaryKey());
  }

  /**
   * Discard the changes made since the record was last saved.
   *
   * @returns The record.
   */
  rollback(): this {
    const { persistedChangeSet } = this;

    if (persistedChangeSet && !this.currentChangeSet.isPersisted) {
      persistedChangeSet.applyTo(this).persist(this.changeSets);
    }

    return this;
  }

  /** @internal */
  getAttributes(...keys: Array<string>): Record<string, unknown> {
    return pick(this, ...keys);
  }

  /**
   * The record's primary key value. Compare records by it rather than by
   * identity: the record a hook receives is a proxy of the one being written.
   */
  getPrimaryKey(): number {
    return readAttribute(this, this.constructor.primaryKey) as number;
  }

  /**
   * Build a record from `props` and save it.
   *
   * ```javascript
   * const post = await Post.create({ title: 'Hello', user });
   * ```
   *
   * Validations and the create hooks run, in a transaction of their own unless
   * one is given.
   *
   * @param props - Attributes and relationships of the new record.
   * @param transaction - A transaction to run in, instead of a new one.
   * @returns Resolves with the new record.
   */
  static create(
    props: Record<string, unknown> = {},
    transaction?: unknown
  ): Promise<TransactionResult<Model, true>> {
    const run = async (trx: unknown) => {
      const { hooks, primaryKey } = this;
      const instance = new this(props, false);

      await runHooks(instance, trx, hooks.beforeValidation);

      validate(instance);

      await runHooks(
        instance,
        trx,
        hooks.afterValidation,
        hooks.beforeCreate,
        hooks.beforeSave
      );

      const runner = createRunner(this, []);
      const [[firstRow]] = await runner(await create(instance, trx));

      // `insert().returning(pk)` yields a scalar `[1]` on knex 0.16 but an
      // object `[{ id: 1 }]` on knex >= 1 (once `RETURNING` reached sqlite).
      // Normalize both so the primary key stays a scalar.
      const primaryKeyValue =
        firstRow !== null && typeof firstRow === 'object'
          ? (firstRow as Record<string, unknown>)[primaryKey]
          : firstRow;

      writeAttribute(instance, primaryKey, primaryKeyValue);
      instance.rawColumnData[primaryKey] = primaryKeyValue;

      let statements: Array<unknown> = [];
      const associations = Object.keys(props).filter(key =>
        Boolean(this.relationshipFor(key))
      );

      for (const key of associations) {
        statements = [
          ...statements,
          ...(await updateRelationship(instance, key, trx))
        ];
      }

      await Promise.all(statements);

      Object.defineProperty(instance, 'initialized', {
        value: true,
        writable: false,
        enumerable: false,
        configurable: false
      });

      instance.currentChangeSet.persist(instance.changeSets);

      await runHooks(instance, trx, hooks.afterCreate, hooks.afterSave);

      return createTransactionResultProxy(instance, true);
    };

    if (transaction) {
      return run(transaction).catch(rethrowWriteError);
    }

    return this.transaction(run).catch(rethrowWriteError);
  }

  /**
   * Bind the model to a transaction: `create`, and every query started from
   * the returned model — `find`, `where`, `first`, `count`, scopes and the
   * rest, with the queries that load their included relationships — run in
   * `trx`.
   *
   * ```javascript
   * await Post.transaction(async trx => {
   *   const post = await Post.transacting(trx).create({ title: 'Hello' });
   *   await Comment.transacting(trx).create({ postId: post.id });
   * });
   * ```
   *
   * A model hook reads through the transaction it is given, so it sees what the
   * write has done so far, and doesn't wait for a second connection while the
   * transaction holds one:
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
   * @param trx - The transaction.
   * @returns A proxy of the model that uses `trx`.
   */
  static transacting(trx: unknown): ModelClass {
    return createStaticTransactionProxy(this, trx);
  }

  /**
   * Run `fn` in a new transaction. Every write runs in a transaction of its
   * own; start one yourself to group several, and pass it on with
   * `transacting`:
   *
   * ```javascript
   * await Post.transaction(async trx => {
   *   await Post.transacting(trx).create({ title: 'One' });
   *   await Post.transacting(trx).create({ title: 'Two' });
   * });
   * ```
   *
   * @param fn - Called with the transaction. It commits when the promise `fn`
   * returns resolves, and rolls back when it rejects.
   * @returns Resolves with what `fn` resolved with.
   */
  static transaction<T>(
    fn: (...args: Array<unknown>) => Promise<T>
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const {
        store: { connection }
      } = this;
      let result: T;

      connection
        .transaction(trx => {
          fn(trx)
            .then(data => {
              result = data;
              return trx.commit();
            })
            .catch(trx.rollback);
        })
        .then(() => {
          resolve(result);
        })
        .catch(err => {
          reject(err);
        });
    });
  }

  /**
   * Every record. Starts a {@link Query}; see {@link Query.all}.
   */
  static all(): Query<Array<Model>> {
    return new Query(this).all();
  }

  /**
   * The record with primary key `primaryKey`; rejects with a
   * `RecordNotFoundError` (`404` through the API) if there is none. Starts a
   * {@link Query}; see {@link Query.find}.
   */
  static find(primaryKey: unknown): Query<Model> {
    return new Query(this).find(primaryKey);
  }

  /**
   * Page `num` of the records. Starts a {@link Query}; see {@link Query.page}.
   */
  static page(num: number): Query<Array<Model>> {
    return new Query(this).page(num);
  }

  /**
   * At most `amount` records. Starts a {@link Query}; see {@link Query.limit}.
   */
  static limit(amount: number): Query<Array<Model>> {
    return new Query(this).limit(amount);
  }

  /**
   * Skip `amount` records. Starts a {@link Query}; see {@link Query.offset}.
   */
  static offset(amount: number): Query<Array<Model>> {
    return new Query(this).offset(amount);
  }

  /**
   * The number of records. Starts a {@link Query}; see {@link Query.count}.
   */
  static count(): Query<number> {
    return new Query(this).count();
  }

  /**
   * The records sorted by `attr`. Starts a {@link Query}; see
   * {@link Query.order}.
   */
  static order(attr: string, direction?: string): Query<Array<Model>> {
    return new Query(this).order(attr, direction);
  }

  /**
   * The records matching `conditions`. Starts a {@link Query}; see
   * {@link Query.where}.
   */
  static where(conditions: Record<string, unknown>): Query<Array<Model>> {
    return new Query(this).where(conditions);
  }

  /**
   * The records with values within ranges. Starts a {@link Query}; see
   * {@link Query.whereBetween}.
   */
  static whereBetween(
    conditions: Record<string, unknown>
  ): Query<Array<Model>> {
    return new Query(this).whereBetween(conditions);
  }

  /**
   * The records matching a raw SQL condition. Starts a {@link Query}; see
   * {@link Query.whereRaw}.
   */
  static whereRaw(
    query: string,
    bindings: Array<unknown> = []
  ): Query<Array<Model>> {
    return new Query(this).whereRaw(query, bindings);
  }

  /**
   * The records not matching `conditions`. Starts a {@link Query}; see
   * {@link Query.not}.
   */
  static not(conditions: Record<string, unknown>): Query<Array<Model>> {
    return new Query(this).not(conditions);
  }

  /**
   * The first record. Starts a {@link Query}; see {@link Query.first}.
   */
  static first(): Query<Model> {
    return new Query(this).first();
  }

  /**
   * The last record. Starts a {@link Query}; see {@link Query.last}.
   */
  static last(): Query<Model> {
    return new Query(this).last();
  }

  /**
   * Only these attributes. Starts a {@link Query}; see {@link Query.select}.
   */
  static select(...params: Array<string>): Query<Array<Model>> {
    return new Query(this).select(...params);
  }

  /**
   * Unique values of these attributes. Starts a {@link Query}; see
   * {@link Query.distinct}.
   */
  static distinct(...params: Array<string>): Query<Array<Model>> {
    return new Query(this).distinct(...params);
  }

  /**
   * The records with these relationships loaded. Starts a {@link Query}; see
   * {@link Query.include}.
   */
  static include(
    ...relationships: Array<string | Record<string, unknown>>
  ): Query<Array<Model>> {
    return new Query(this).include(...relationships);
  }

  /**
   * The records without these scopes. Starts a {@link Query}; see
   * {@link Query.unscope}.
   */
  static unscope(...scopes: Array<string>): Query<Array<Model>> {
    return new Query(this).unscope(...scopes);
  }

  /**
   * Whether the model declares the scope `name` in {@link Model.scopes}.
   */
  static hasScope(name: string): boolean {
    return Boolean(this.scopes[name]);
  }

  /**
   * Whether `value` is a record of this model.
   */
  static isInstance(value: unknown): boolean {
    return value instanceof this;
  }

  /**
   * Bind the model's connection to the database and get inferred data from the
   * schema upon application boot.
   *
   * @param store - A reference of the applications database
   * instance.
   * @param table - A function that returns a knex query builder bound
   * to the model's table name.
   * @returns Resolves with the model class.
   * @internal
   */
  static initialize(
    store: Database,
    table: () => unknown
  ): Promise<ModelClass> {
    if (this.initialized) {
      return Promise.resolve(this);
    }

    if (!this.tableName) {
      const getTableName = compose(pluralize, underscore);
      const tableName = getTableName(this.name);

      Object.defineProperty(this, 'tableName', {
        value: tableName,
        writable: false,
        enumerable: true,
        configurable: false
      });

      Object.defineProperty(this.prototype, 'tableName', {
        value: tableName,
        writable: false,
        enumerable: false,
        configurable: false
      });
    }

    return initializeClass({
      store,
      table,
      model: this
    });
  }

  /** @internal */
  static columnFor(key: string): Database$column | undefined {
    return this.attributes[key] as Database$column | undefined;
  }

  /** @internal */
  static columnNameFor(key: string): string | undefined {
    const column = this.columnFor(key);

    return column ? column.columnName : undefined;
  }

  /** @internal */
  static relationshipFor(key: string): RelationshipOptions | undefined {
    // Own keys only: `relationships` is a plain object, so `constructor` or
    // `toString` would otherwise come back as a "relationship".
    return Object.hasOwn(this.relationships, key)
      ? this.relationships[key]
      : undefined;
  }
}

export default Model;
export type { ModelHook, ModelHooks } from './interfaces';
