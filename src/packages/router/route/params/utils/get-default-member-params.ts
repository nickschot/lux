import type Controller from '../../../../controller';

/**
 * @private
 */
export default function getDefaultMemberParams({
  model,
  serializer: { hasOne, hasMany, attributes }
}: Controller): Record<string, unknown> {
  return {
    fields: {
      [model.resourceName]: attributes,
      ...[...hasOne, ...hasMany].reduce<Record<string, unknown>>(
        (include, key) => {
          const opts = model.relationshipFor(key);

          if (!opts || model === opts.model) {
            return include;
          }

          return {
            ...include,
            [opts.model.resourceName]: [opts.model.primaryKey]
          };
        },
        {}
      )
    }
  };
}
