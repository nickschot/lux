import { camelize } from 'inflection';

import type { Model, ModelClass } from '../../database';

/**
 * The resource linkage of one record: the primary key(s) of the records each
 * named relationship points to — an array for has-many, otherwise a single id
 * or `null`.
 *
 * @private
 */
export type Linkage = Record<string, Array<string> | string | null>;

const valueOf = (record: Model, key: string): unknown =>
  Reflect.get(record, key);

const toId = (value: unknown): string | null =>
  value == null ? null : String(value);

/**
 * Batch-load the resource linkage of the relationships `names` for every one of
 * `records` (all instances of `model`), keyed by each record's primary key.
 *
 * This is what lets included resources carry `relationships` without an N+1:
 * it issues at most one query per relationship — and a single query for all
 * belongs-to relationships, whose foreign keys live on `model` itself — however
 * many records there are. The queries mirror the lazy relationship getters in
 * `database/relationship/utils/getters.ts`, which remain the source of truth.
 *
 * @private
 */
export default async function loadLinkage(
  model: ModelClass,
  records: Array<Model>,
  names: Array<string>
): Promise<Map<string, Linkage>> {
  const ids = Array.from(
    new Set(records.map(record => record.getPrimaryKey()))
  );
  const linkage = new Map<string, Linkage>();
  const belongsTo: Array<[string, string, ModelClass]> = [];
  const queries: Array<Promise<void>> = [];

  ids.forEach(id => {
    linkage.set(
      String(id),
      names.reduce<Linkage>((result, name) => {
        const opts = model.relationshipFor(name);

        result[name] = opts && opts.type === 'hasMany' ? [] : null;
        return result;
      }, {})
    );
  });

  if (!ids.length) {
    return linkage;
  }

  // Append `relatedId` to the linkage of the owner identified by `ownerId`.
  const link = (ownerId: unknown, name: string, relatedId: unknown) => {
    const owner = linkage.get(String(ownerId));
    const id = toId(relatedId);

    if (!owner || id === null) {
      return;
    }

    const current = owner[name];

    if (Array.isArray(current)) {
      // A join model can hold the same pair twice; like the getters (which
      // query `WHERE id IN (...)`), each related record is linked once.
      if (!current.includes(id)) {
        current.push(id);
      }
    } else if (current === null) {
      // has-one: like `getHasOne()`, the lowest primary key wins.
      owner[name] = id;
    }
  };

  names.forEach(name => {
    const opts = model.relationshipFor(name);

    if (!opts) {
      return;
    }

    const { type, through, model: related } = opts;
    const foreignKey = camelize(opts.foreignKey, true);

    if (type === 'belongsTo') {
      belongsTo.push([name, foreignKey, related]);
    } else if (through) {
      // Mirrors `getHasManyThrough()`: the join model holds a key pointing at
      // the owner (`foreignKey`) and one pointing at the related record (the
      // inverse relationship's foreign key).
      const inverse = related.relationshipFor(opts.inverse);

      if (!inverse) {
        return;
      }

      const relatedKey = camelize(inverse.foreignKey, true);

      queries.push(
        (async () => {
          const rows = await through
            .select(foreignKey, relatedKey)
            .where({ [foreignKey]: ids });

          rows.forEach(row => {
            link(valueOf(row, foreignKey), name, valueOf(row, relatedKey));
          });
        })()
      );
    } else {
      // has-one and has-many: the foreign key lives on the related model.
      queries.push(
        (async () => {
          const rows = await related
            .select(related.primaryKey, foreignKey)
            .where({ [foreignKey]: ids })
            .order(related.primaryKey, 'ASC');

          rows.forEach(row => {
            link(valueOf(row, foreignKey), name, row.getPrimaryKey());
          });
        })()
      );
    }
  });

  if (belongsTo.length) {
    queries.push(
      (async () => {
        const rows = await model
          .select(model.primaryKey, ...belongsTo.map(([, key]) => key))
          .where({ [model.primaryKey]: ids });

        rows.forEach(row => {
          belongsTo.forEach(([name, key]) => {
            link(row.getPrimaryKey(), name, valueOf(row, key));
          });
        });

        await dropDangling(linkage, belongsTo);
      })()
    );
  }

  await Promise.all(queries);

  return linkage;
}

/**
 * A foreign key can outlive the record it points to (no FK constraint, or a
 * row deleted out from under it). Resolve belongs-to linkage to `null` then,
 * like the primary query's join does — rather than linking a resource that
 * does not exist. One query per distinct related model.
 *
 * @private
 */
async function dropDangling(
  linkage: Map<string, Linkage>,
  belongsTo: Array<[string, string, ModelClass]>
): Promise<void> {
  const wanted = new Map<ModelClass, Set<string>>();

  belongsTo.forEach(([name, , related]) => {
    const ids = wanted.get(related) || new Set<string>();

    linkage.forEach(({ [name]: id }) => {
      if (typeof id === 'string') {
        ids.add(id);
      }
    });

    wanted.set(related, ids);
  });

  const existing = new Map<ModelClass, Set<string>>();

  await Promise.all(
    Array.from(wanted, async ([related, ids]) => {
      if (!ids.size) {
        existing.set(related, ids);
        return;
      }

      const rows = await related
        .select(related.primaryKey)
        .where({ [related.primaryKey]: Array.from(ids) });

      existing.set(
        related,
        new Set(rows.map(row => String(row.getPrimaryKey())))
      );
    })
  );

  belongsTo.forEach(([name, , related]) => {
    const found = existing.get(related);

    linkage.forEach(owner => {
      const id = owner[name];

      if (typeof id === 'string' && !found?.has(id)) {
        owner[name] = null;
      }
    });
  });
}
