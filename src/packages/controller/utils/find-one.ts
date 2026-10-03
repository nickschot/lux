import merge from '../../../utils/merge';
import type { Model, ModelClass, Query } from '../../database';
import type Serializer from '../../serializer';
import type { Request } from '../../server';

import paramsToQuery from './params-to-query';

/**
 * @private
 */
export default function findOne<T extends Model>(
  model: ModelClass<T>,
  req: Request,
  serializer?: Serializer<Model>
): Query<T> {
  const params = merge(req.defaultParams, req.params);
  const { id, select, include } = paramsToQuery(model, params, serializer);

  return model
    .find(id)
    .select(...select)
    .include(include);
}
