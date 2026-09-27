import { VERSION } from '../../../jsonapi';
import { STATUS_CODES } from '../../constants';
import * as env from '../../../../utils/env';
import type { JSONAPI$Document, JSONAPI$ErrorObject } from '../../../jsonapi';

/**
 * @private
 */
export default function dataFor(
  status: number,
  err?: Error
): string | JSONAPI$Document {
  if (status < 400 || status > 599) {
    return '';
  }

  const title = STATUS_CODES.get(status);
  const errData: JSONAPI$ErrorObject = {
    status: status.toString()
  };

  if (title) {
    errData.title = title;
  }

  // `source` only ever points into the client's own request, so unlike
  // `detail` it is safe to expose in every environment.
  const source = (err as { source?: JSONAPI$ErrorObject['source'] } | undefined)
    ?.source;

  if (source && (source.pointer || source.parameter)) {
    errData.source = source;
  }

  if (err && (env.isDevelopment() || /^\[public\]/gi.test(err.message))) {
    errData.detail = err.message.replace(/^\[public\]/gi, '');
  }

  return {
    errors: [errData],

    jsonapi: {
      version: VERSION
    }
  };
}
