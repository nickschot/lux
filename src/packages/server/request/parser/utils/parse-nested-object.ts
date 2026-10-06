import entries from '../../../../../utils/entries';

// Not global: `test()` on a global regex is stateful (`lastIndex`). Only the
// `replace()` that follows every match, which resets it, kept that harmless.
const DELIMITER = /^(.+)\[(.+)]$/;

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
        const parentValue = result[parentKey];

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
