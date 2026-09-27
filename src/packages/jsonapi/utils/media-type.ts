export type MediaType = {
  // `type/subtype`, lowercased — media types are case-insensitive.
  type: string;

  // Media type parameters as written (`name=value`), trimmed.
  params: Array<string>;
};

const QUALITY = /^q\s*=/i;

/**
 * Split `value` on `delimiter`, ignoring delimiters inside quoted strings
 * (parameter values may be quoted and contain `,` or `;`).
 *
 * @private
 */
function splitUnquoted(value: string, delimiter: string): Array<string> {
  const parts: Array<string> = [];
  let current = '';
  let quoted = false;
  let escaped = false;

  for (const char of value) {
    if (escaped) {
      escaped = false;
    } else if (quoted && char === '\\') {
      escaped = true;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (!quoted && char === delimiter) {
      parts.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  return [...parts, current];
}

/**
 * Parse a single media type, e.g. a `Content-Type` header value.
 *
 * @private
 */
export function parseMediaType(value: string): MediaType {
  const [type = '', ...params] = splitUnquoted(value, ';').map(part =>
    part.trim()
  );

  return {
    type: type.toLowerCase(),
    params: params.filter(Boolean)
  };
}

/**
 * Parse an `Accept` header into its media ranges.
 *
 * Per RFC 7231 §5.3.2 the `q` weight (and any accept-extension after it) is
 * not a media type parameter, so it is not reported in `params`.
 *
 * @private
 */
export function parseAccept(value: string): Array<MediaType> {
  return splitUnquoted(value, ',')
    .map(range => {
      const { type, params } = parseMediaType(range);
      const quality = params.findIndex(param => QUALITY.test(param));

      return {
        type,
        params: quality === -1 ? params : params.slice(0, quality)
      };
    })
    .filter(({ type }) => type.length > 0);
}
