import { line } from '../../logger';
import type Logger from '../../logger';
import type Controller from '../../controller';

import { setsItself } from './create-controller';

/**
 * Give the controllers of a namespace without visibility rules — neither its
 * own nor an ancestor's, run after `resolveVisibility()` — conservative
 * defaults, and warn once per such namespace that serves records.
 *
 * Without rules, nothing scopes what a request reaches beyond its primary
 * data: an `index` or `show` override, or a hook checking `request.action`,
 * does not apply to included resources or to the relationship and related
 * endpoints. So unless a controller (or its namespace) sets
 * `maxIncludeDepth`, `?include=` goes 1 level deep; the router serves
 * relationship endpoints only where a resource's `relationships` option asks
 * for them. Declaring rules — `static visibility = {}` for a namespace that
 * may see everything — lifts both.
 *
 * @internal
 */
export default function restrictOpenNamespaces(
  controllers: Map<string, Controller>,
  logger: Logger
): void {
  const open = new Set<string>();

  controllers.forEach(controller => {
    if (controller.hasVisibilityRules) {
      return;
    }

    if (!setsItself(controller, 'maxIncludeDepth')) {
      Object.defineProperty(controller, 'maxIncludeDepth', {
        value: 1,
        writable: true,
        enumerable: true,
        configurable: true
      });
    }

    if (controller.hasModel) {
      open.add(controller.namespace);
    }
  });

  open.forEach(namespace => {
    const file = namespace
      ? `app/controllers/${namespace}/application.js`
      : 'app/controllers/application.js';

    logger.warn(line`
      Namespace '/${namespace}' has no visibility rules, so its includes stop
      at 1 level and its resources serve no relationship or related endpoints,
      unless a controller or route sets them. Scoping in an index or show
      override, or in a hook checking request.action, covers only the primary
      data. Declare the rules in ${file}; \`static visibility = {}\` if the
      namespace may see everything.
    `);
  });
}
