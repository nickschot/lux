import entries from '../../../../../utils/entries';

const DELIMITER = /^(.+)\[(.+)]$/g;

/**
 * @private
 */
export default function parseNestedObject(
  source: Record<string, unknown>
): Record<string, unknown> {
  return entries(source).reduce<Record<string, unknown>>(
    (result, [key, value]) => {
      if (DELIMITER.test(key)) {
        const parentKey = key.replace(DELIMITER, '$1');
        const parentValue = Reflect.get(result, parentKey);

        return {
          ...result,
          [parentKey]: {
            ...(parentValue || {}),
            [key.replace(DELIMITER, '$2')]: value
          }
        };
      }

      return {
        ...result,
        [key]: value
      };
    },
    {}
  );
}
