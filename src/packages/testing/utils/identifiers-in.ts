/** A resource's `type` and `id`. */
export type Identifier = { type: string; id: string };

type Linkage = Identifier | Array<Identifier> | null | undefined;

type Resource = Identifier & {
  relationships?: Record<string, { data?: Linkage }>;
};

const isIdentifier = (value: unknown): value is Identifier =>
  typeof value === 'object' &&
  value !== null &&
  'type' in value &&
  'id' in value;

/**
 * Every resource a JSON:API document names: its primary data, its `included`
 * resources, and the linkage of each one's relationships. A relationship
 * endpoint's primary data is linkage itself, so it is covered the same way.
 * Ids are strings, as JSON:API sends them.
 *
 * @internal
 */
export default function identifiersIn(document: unknown): Array<Identifier> {
  const found: Array<Identifier> = [];

  const add = (value: unknown) => {
    if (isIdentifier(value)) {
      found.push({ type: value.type, id: String(value.id) });
    }
  };

  const addLinkage = (linkage: Linkage) => {
    (Array.isArray(linkage) ? linkage : [linkage]).forEach(add);
  };

  const addResource = (resource: unknown) => {
    add(resource);

    if (isIdentifier(resource)) {
      Object.values((resource as Resource).relationships ?? {}).forEach(
        relationship => addLinkage(relationship?.data)
      );
    }
  };

  if (typeof document !== 'object' || document === null) {
    return found;
  }

  const { data, included } = document as {
    data?: unknown;
    included?: Array<unknown>;
  };

  (Array.isArray(data) ? data : [data]).forEach(addResource);
  (included ?? []).forEach(addResource);

  return found;
}
