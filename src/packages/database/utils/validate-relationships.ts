import { camelize } from 'inflection';

import { RelationshipConfigError } from '../errors';
import type { ModelClass } from '../interfaces';
import type { RelationshipOptions } from '../relationship';

/**
 * Whether `inverse`, a relationship of `related`, is a valid counterpart of
 * `opts`, declared on `model`.
 */
function pairs(
  model: ModelClass,
  opts: RelationshipOptions,
  inverse: RelationshipOptions
): string | null {
  // A join model's `belongsTo` names the many-to-many relationship that goes
  // through it (`Categorization.post` → `Post.tags`).
  const viaJoin = inverse.through === model;

  if (inverse.model !== model && !viaJoin) {
    return `points at ${inverse.model.name}, not ${model.name}`;
  }

  if (opts.through) {
    if (inverse.type !== 'hasMany' || inverse.through !== opts.through) {
      return `is not a hasMany through ${opts.through.name}`;
    }
  } else if (opts.type === 'belongsTo') {
    if (inverse.type === 'belongsTo') {
      return 'is a belongsTo too; one side must be a hasOne or hasMany';
    }
  } else if (!viaJoin && inverse.type !== 'belongsTo') {
    return `is a ${inverse.type}; the other side of a ${opts.type} must be a belongsTo`;
  }

  return null;
}

/**
 * The model whose table holds `opts`'s foreign key, and so must have it as a
 * column.
 */
function keyHolder(model: ModelClass, opts: RelationshipOptions): ModelClass {
  if (opts.through) {
    return opts.through;
  }

  return opts.type === 'belongsTo' ? model : opts.model;
}

/**
 * Check every relationship of `models`, once all of them are initialized:
 * its `inverse` must name a relationship on the related model that points
 * back (or, for a join model, the many-to-many relationship through it), of
 * a kind that pairs with it, and its foreign key must be a column where it
 * is expected. A mistake used to surface only on the first write that set
 * the relationship, as an unrelated-looking `500`. Throws listing every
 * problem.
 *
 * @internal
 */
export default function validateRelationships(
  models: Iterable<ModelClass>
): void {
  const problems: Array<string> = [];

  for (const model of models) {
    for (const name of model.relationshipNames) {
      const opts = model.relationshipFor(name);

      if (!opts) {
        continue;
      }

      const { type, inverse, model: related, foreignKey } = opts;
      const where = `${model.name}.${type}.${name}`;

      if (!inverse) {
        problems.push(`${where} has no \`inverse\``);
        continue;
      }

      const inverseOpts = related.relationshipFor(inverse);

      if (!inverseOpts) {
        const names = related.relationshipNames.join(', ') || 'none';

        problems.push(
          `${where} has inverse '${inverse}', but ${related.name} has no ` +
            `relationship '${inverse}' (it has: ${names})`
        );
        continue;
      }

      const mismatch = pairs(model, opts, inverseOpts);

      if (mismatch) {
        problems.push(
          `${where} has inverse '${inverse}', but ` +
            `${related.name}.${inverseOpts.type}.${inverse} ${mismatch}`
        );
        continue;
      }

      const holder = keyHolder(model, opts);
      const column = camelize(foreignKey, true);

      if (!holder.attributeNames.includes(column)) {
        problems.push(
          `${where} needs the foreign key column \`${foreignKey}\` on ` +
            `\`${holder.tableName}\`, which has no such column`
        );
      }
    }
  }

  if (problems.length) {
    throw new RelationshipConfigError(problems);
  }
}
