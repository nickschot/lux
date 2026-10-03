import omit from '../../../utils/omit';
import entries from '../../../utils/entries';
import type { Model, ModelClass } from '../../database';
import type Serializer from '../../serializer';
import type { Request$params } from '../../server';

type Controller$query = {
  id?: number | string | Buffer;
  filter?: Record<string, unknown>;
  select: Array<string>;
  page?: number;
  limit?: number;
  sort?: [string, string];
  include: Record<string, Array<string>>;
};

/**
 * `serializer` is the one the response is formatted with; included resources
 * are loaded with the attributes of their Serializer in its namespace (see
 * `Serializer#serializerFor()`), which defaults to the root one.
 *
 * @private
 */
export default function paramsToQuery(
  model: ModelClass,
  { id, page, sort, filter, fields, include }: Request$params,
  serializer?: Serializer<Model>
): Controller$query {
  const relationships = entries(model.relationships);
  const includedFields = omit(fields, model.resourceName);
  // Only the first segment of a nested path (`comments.user`) is loaded by this
  // query; the serializer loads deeper levels when it builds `included`.
  const included = include && include.map(path => path.split('.')[0]);

  let query: Controller$query = {
    id,
    filter,
    select: [
      model.primaryKey,
      ...(Reflect.get(fields, model.resourceName) as Array<string>)
    ],
    include: {}
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

  const includedFieldsMap = entries(includedFields).reduce<
    Record<string, Array<string>>
  >((result, field) => {
    const [key] = field;
    const [, rawValue] = field;

    const [name, relationship] =
      relationships.find(
        ([, { model: related }]) => key === related.resourceName
      ) || [];

    if (!name || !relationship) {
      return result;
    }

    let value = rawValue as Array<string>;

    if (!value.includes(relationship.model.primaryKey)) {
      value = [relationship.model.primaryKey, ...value];
    }

    if (included && value.length === 1 && included.includes(name)) {
      value = [
        ...value,
        ...(serializer
          ? serializer.serializerFor(relationship.model)
          : relationship.model.serializer
        ).attributes
      ];
    } else if (!included && value.length > 1) {
      value = value.slice(0, 1);
    }

    return {
      ...result,
      [name]: value
    };
  }, {});

  return {
    ...query,
    include: includedFieldsMap
  };
}
