import type Controller from '../../../../controller';

/**
 * Without a fieldset, primary data loads every attribute its Serializer
 * declares. Other types need no default: an absent fieldset means all fields.
 *
 * @internal
 */
export default function getDefaultMemberParams({
  model,
  serializer: { attributes }
}: Controller): Record<string, unknown> {
  return {
    fields: {
      [model.resourceName]: attributes
    }
  };
}
