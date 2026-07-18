import merge from '../../../utils/merge';
import type { Model, ModelClass, Query } from '../../database';
import type { Request } from '../../server';

import paramsToQuery from './params-to-query';

/**
 * @private
 */
export default function findOne<T extends Model>(
  model: ModelClass<T>,
  req: Request
): Query<T> {
  const params = merge(req.defaultParams, req.params);
  const { id, select, include } = paramsToQuery(model, params);

  return model
    .find(id)
    .select(...select)
    .include(include);
}
