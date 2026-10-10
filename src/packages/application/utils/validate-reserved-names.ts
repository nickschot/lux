import { line } from '../../logger';
import ReservedFieldNameError from '../../../errors/reserved-field-name-error';
import type Logger from '../../logger';
import type Serializer from '../../serializer';
import type { Model } from '../../database';
import type { BundleNamespace } from '../../loader';

// JSON:API 1.0, "Fields": a resource's attributes and relationships share a
// namespace with its `type` and `id`, so neither may be a field's name.
const RESERVED = new Set(['type', 'id']);

/**
 * Refuse to boot when a serializer's `attributes`, `hasOne` or `hasMany`
 * names `type` or `id`, listing every one; warn instead for a serializer that
 * sets `allowReservedNames`.
 *
 * @internal
 */
export default function validateReservedNames(
  serializers:
    BundleNamespace<Serializer<Model>> | Map<string, Serializer<Model>>,
  logger: Logger
): void {
  const problems: Array<string> = [];

  serializers.forEach((serializer, key) => {
    (['attributes', 'hasOne', 'hasMany'] as const).forEach(setting => {
      const names = serializer[setting].filter(name => RESERVED.has(name));

      if (!names.length) {
        return;
      }

      const where =
        `serializers/${key}: \`${setting}\` lists ` +
        names.map(name => `\`${name}\``).join(', ');

      if (serializer.allowReservedNames) {
        logger.warn(line`
          ${where}, which JSON:API forbids as a field name. Sent anyway:
          \`allowReservedNames\` is set.
        `);
      } else {
        problems.push(where);
      }
    });
  });

  if (problems.length) {
    throw new ReservedFieldNameError(problems);
  }
}
