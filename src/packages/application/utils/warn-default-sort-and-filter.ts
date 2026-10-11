import { line } from '../../logger';
import type Logger from '../../logger';
import type Controller from '../../controller';

import { defaultedListsOf, setsItself } from './create-controller';

/**
 * Warn at boot about each namespace where sorting and filtering may give
 * away fields its responses hide. Lumen can't see an `afterAction` that
 * blanks fields per record, but it can see the risk: a namespace with
 * visibility rules that narrow something (`{}`, or rules that are all
 * `true`, declare that it may see everything, and don't count), whose
 * controllers run after hooks and accept the default `sort` and `filter`,
 * every attribute the serializer outputs.
 *
 * Setting `defaultSortAndFilter`, either way, on a controller or a namespace
 * it is in silences it: `false` accepts only what each controller lists,
 * `true` keeps the defaults on purpose. Run after `resolveVisibility()`.
 *
 * @internal
 */
export default function warnDefaultSortAndFilter(
  controllers: Map<string, Controller>,
  logger: Logger
): void {
  const atRisk = new Map<string, Array<string>>();

  controllers.forEach(controller => {
    const { namespace, visibility, afterAction, hasModel } = controller;

    if (
      !hasModel ||
      !Object.values(visibility).some(rule => typeof rule === 'function') ||
      !afterAction.length ||
      setsItself(controller, 'defaultSortAndFilter') ||
      !defaultedListsOf(controller).length
    ) {
      return;
    }

    const names = atRisk.get(namespace) ?? [];

    names.push(controller.model.resourceName);
    atRisk.set(namespace, names);
  });

  atRisk.forEach((names, namespace) => {
    const file = namespace
      ? `app/controllers/${namespace}/application.js`
      : 'app/controllers/application.js';

    logger.warn(line`
      Namespace '/${namespace}' has visibility rules and after hooks, and
      ${names.join(', ')} accept the default sort and filter: every attribute
      their serializers output. If an afterAction hides fields per record,
      sorting and filtering still use their real values, and the order or the
      selection gives them away. List \`sort\` and \`filter\` on those
      controllers, or set \`defaultSortAndFilter\` in ${file}: \`false\`
      to accept only what each controller lists, \`true\` to keep the
      defaults and silence this.
    `);
  });
}
