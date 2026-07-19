const BOOLEAN_TYPE = /^(?:boolean|tinyint)$/;

export default function createNormalizer(
  type: string
): (value: unknown) => unknown {
  let normalizer: (value: unknown) => unknown = value => value;

  if (BOOLEAN_TYPE.test(type)) {
    normalizer = value => {
      let normalized = value;

      if (typeof value === 'string') {
        normalized = Number.parseInt(value, 10);
      }

      return Boolean(normalized);
    };
  } else if (type === 'datetime') {
    normalizer = value => {
      let normalized = value;

      if (typeof value === 'number') {
        normalized = new Date(value);
      }

      return normalized;
    };
  }

  return normalizer;
}
