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
 * `serializerFor` resolves the Serializer an included resource is serialized
 * with — in the request's namespace (`Controller#serializerFor()`) — so its
 * attributes are the ones loaded. Defaults to the related model's root one.
 *
 * @private
 */
export default function paramsToQuery(
  model: ModelClass,
  { id, page, sort, filter, fields, include }: Request$params,
  serializerFor: (related: ModelClass) => Serializer<Model> = related =>
    related.serializer
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
      value = [...value, ...serializerFor(relationship.model).attributes];
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
