import { line } from '../../logger';
import type Logger from '../../logger';
import type Controller from '../../controller';

// JSON:API 1.0, "Query Parameters": implementation specific query parameters
// "MUST contain at least one non a-z character".
const RESERVED_SHAPE = /^[a-z]+$/;

/**
 * Warn at boot about custom `query` parameters whose names the spec reserves
 * for itself (all lowercase a-z, e.g. `search`). They keep working; a
 * spec-aware client or a future version of the spec may not agree.
 *
 * @internal
 */
export default function warnQueryParamNames(
  controllers: Map<string, Controller>,
  logger: Logger
): void {
  controllers.forEach((controller, key) => {
    const names = controller.query.filter(name => RESERVED_SHAPE.test(name));

    if (names.length) {
      logger.warn(line`
        Custom query parameters of '${key}' (${names.join(', ')}) only use the
        characters a-z, a shape JSON:API reserves for its own parameters.
        Rename them to include a non a-z character, e.g. 'search' to
        'searchTerm' or 'search-term'.
      `);
    }
  });
}
