import isObject from '../../../../../utils/is-object';
import { camelizeKeys } from '../../../../../utils/transform-keys';

/** @internal */
function normalizeResource(
  resource: Record<string, unknown>
): Record<string, unknown> {
  const { attributes, relationships } = resource;

  return {
    ...resource,
    ...(isObject(attributes) && { attributes: camelizeKeys(attributes) }),
    ...(isObject(relationships) && {
      relationships: camelizeKeys(relationships)
    })
  };
}

/**
 * Bring a request document's member names into their internal form: the
 * names of `data.attributes` and `data.relationships` are camelized
 * (`is-public` -> `isPublic`). Nothing else is touched — in particular no
 * value: attribute values (and keys inside them) are data, and ids and dates
 * are typed by parameter validation, from the columns they are written to.
 *
 * Anything that is not a resource document is passed through for parameter
 * validation to reject.
 *
 * @internal
 */
export default function normalizeDocument(document: unknown): unknown {
  if (isObject(document) && isObject(document.data)) {
    return {
      ...document,
      data: normalizeResource(document.data)
    };
  }

  return document;
}
