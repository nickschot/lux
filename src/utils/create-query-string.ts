import entries from './entries';

/**
 * A replacement for querystring.stringify that supports nested objects.
 *
 * @private
 */
export default function createQueryString(
  src: Record<string, unknown>,
  prop?: string
): string {
  return entries(src).reduce((str, [key, value], index) => {
    let result = str;

    if (index > 0) {
      result += '&';
    }

    if (prop) {
      result += (
        `${prop
        + encodeURIComponent('[')
        + key
        + encodeURIComponent(']')
         }=`
      );
    } else {
      result += `${key}=`;
    }

    if (value && typeof value === 'object') {
      if (Array.isArray(value)) {
        result += value.map(item => encodeURIComponent(String(item))).join();
      } else {
        result = (
          result.substr(0, result.length - (key.length + 1))
          + createQueryString(value as Record<string, unknown>, key)
        );
      }
    } else if (!value && typeof value !== 'number') {
      result += 'null';
    } else {
      result += encodeURIComponent(String(value));
    }

    return result;
  }, '');
}
