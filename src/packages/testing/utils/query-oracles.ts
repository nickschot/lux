import { dasherize, underscore } from 'inflection';

/** A primary resource of a list, as far as these checks read it. */
type ListedResource = {
  type: string;
  id: string;
  attributes?: Record<string, unknown>;
};

/**
 * What a list route serves and accepts, by the members' names in documents
 * (`created-at`).
 *
 * @internal
 */
export type Listing = {
  /** The type of the list's records. */
  type: string;
  /** The attributes its serializer outputs. */
  attributes: Array<string>;
  /** The attributes `?sort=` accepts. */
  sortable: Array<string>;
  /** The attributes `?filter[…]=` accepts. */
  filterable: Array<string>;
};

const member = (name: string) => dasherize(underscore(name));

/**
 * The listing of a list route served by a controller with these settings.
 *
 * @internal
 */
export function listingOf(
  type: string,
  attributes: ReadonlyArray<string>,
  sort: ReadonlyArray<string>,
  filter: ReadonlyArray<string>
): Listing {
  return {
    type,
    attributes: attributes.map(member),
    sortable: sort.map(member),
    filterable: filter.map(member)
  };
}

/**
 * The list's own records in `document`: its primary data of the listed type,
 * with attributes.
 *
 * @internal
 */
export function listedResources(
  document: unknown,
  { type }: Listing
): Array<ListedResource> {
  const data = (document as { data?: unknown } | null)?.data;

  return (Array.isArray(data) ? data : []).filter(
    (resource): resource is ListedResource =>
      typeof resource === 'object' &&
      resource !== null &&
      resource.type === type &&
      typeof resource.attributes === 'object' &&
      resource.attributes !== null
  );
}

const quote = (ids: Array<string>) =>
  ids.length > 5
    ? `${ids.slice(0, 5).join(', ')} and ${ids.length - 5} more`
    : ids.join(', ');

/**
 * Attributes the serializer outputs but a record leaves out, although the
 * route sorts or filters on them. Something removed them after the query (an
 * `afterAction`), yet the database still orders and selects by their real
 * values. One message per attribute.
 *
 * @internal
 */
export function hiddenButQueryable(
  resources: Array<ListedResource>,
  listing: Listing
): Array<string> {
  return listing.attributes.flatMap(name => {
    const accepted = [
      listing.sortable.includes(name) && '`sort`',
      listing.filterable.includes(name) && '`filter`'
    ].filter(Boolean);

    if (!accepted.length) {
      return [];
    }

    const ids = resources
      .filter(({ attributes }) => !(name in (attributes ?? {})))
      .map(({ id }) => id);

    return ids.length
      ? [
          `${listing.type} ${quote(ids)} leave out \`${name}\`, which this ` +
            `route accepts as ${accepted.join(' and ')}: the order or ` +
            'selection of its results reveals it'
        ]
      : [];
  });
}

const shownAsNull = (resource: ListedResource, name: string) =>
  resource.attributes?.[name] == null;

/**
 * The sortable attributes worth sorting by to look for hidden values: those
 * some records show as `null` (or leave out) and others don't.
 *
 * @internal
 */
export function sortProbes(
  resources: Array<ListedResource>,
  listing: Listing
): Array<string> {
  return listing.sortable.filter(name => {
    const nulls = resources.filter(resource => shownAsNull(resource, name));

    return nulls.length > 0 && nulls.length < resources.length;
  });
}

/**
 * A list sorted by `name` whose records showing it as `null` are not one
 * block at the start or the end. Every database sorts a real `null` before
 * or after all values, so such an order was decided by values the response
 * hides. A message naming the records shown as `null`, or nothing.
 *
 * @internal
 */
export function interleavedNulls(
  resources: Array<ListedResource>,
  listing: Listing,
  name: string
): string | undefined {
  const nulls = resources.map(resource => shownAsNull(resource, name));
  const count = nulls.filter(Boolean).length;
  const prefix = nulls.slice(0, count).every(Boolean);
  const suffix = nulls.slice(nulls.length - count).every(Boolean);

  if (count === 0 || prefix || suffix) {
    return undefined;
  }

  const ids = resources.filter((_, i) => nulls[i]).map(({ id }) => id);

  return (
    `sorting by \`${name}\` puts ${listing.type} ${quote(ids)}, which show ` +
    'it as null, between records that show a value: the order reveals values ' +
    'the response hides'
  );
}
