import type { ModelClass } from '../../database';
import type { Request$params } from '../../server';

type Controller$query = {
  id?: number | string | Buffer;
  filter?: Record<string, unknown>;
  select: Array<string>;
  page?: number;
  limit?: number;
  sort?: [string, string];
};

/**
 * Translate request params into the primary query. Only primary data is
 * loaded by it: resource linkage and included resources are batch-loaded by
 * the Serializer.
 *
 * @private
 */
export default function paramsToQuery(
  model: ModelClass,
  { id, page, sort, filter, fields }: Request$params
): Controller$query {
  let query: Controller$query = {
    id,
    filter,
    // A fieldset may also name relationships, which are not columns.
    select: [
      model.primaryKey,
      ...(fields[model.resourceName] as Array<string>).filter(name =>
        model.attributeNames.includes(name)
      )
    ]
  };

  if (page) {
    query = {
      ...query,
      page: page.number,
      limit: page.size
    };
  }

  if (sort) {
    if (sort.startsWith('-')) {
      query = {
        ...query,
        sort: [sort.substr(1), 'DESC']
      };
    } else {
      query = {
        ...query,
        sort: [sort, 'ASC']
      };
    }
  }

  return query;
}
