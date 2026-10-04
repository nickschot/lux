import { posix } from 'path';

import { VisibilityConfigError } from '../../controller/visibility/errors';
import type Controller from '../../controller';
import type { Visibility } from '../../controller';
import type { ModelClass } from '../../database';
import type { Bundle$Namespace } from '../../loader';

type ControllerClass = { visibility?: Visibility };

const rulesOf = (controller: Controller): Visibility | undefined =>
  (controller.constructor as ControllerClass).visibility;

/**
 * The `ApplicationController` whose rules govern `key`'s namespace: the
 * namespace's own, else the closest ancestor namespace's.
 *
 * Walks up with `dirname()` until it stops changing the path — at `.` for the
 * relative keys the loader produces, at `/` for anything else — so the walk
 * ends whatever the key.
 */
function applicationFor(
  controllers: Bundle$Namespace<Controller> | Map<string, Controller>,
  key: string
): Controller | undefined {
  let namespace = posix.dirname(key);
  let previous: string | undefined;

  while (namespace !== previous) {
    const application = controllers.get(
      namespace === '.' ? 'application' : `${namespace}/application`
    );

    if (application) {
      return application;
    }

    previous = namespace;
    namespace = posix.dirname(namespace);
  }

  return undefined;
}

/**
 * Give every controller the visibility rules of its namespace — the
 * `static visibility` of the namespace's `ApplicationController`, or the
 * closest ancestor namespace's — and refuse to boot on rules that cannot be
 * applied: rules declared on any other controller (a rule must hold for the
 * whole namespace, since types are included across controllers), rules for a
 * type that has no model, and rules that are not functions.
 *
 * @private
 */
export default function resolveVisibility(
  controllers: Bundle$Namespace<Controller> | Map<string, Controller>,
  models: Iterable<ModelClass>
): void {
  const types = new Set(Array.from(models, model => model.resourceName));
  const problems: Array<string> = [];

  controllers.forEach((controller, key) => {
    const isApplication = posix.basename(key) === 'application';
    const ctor = controller.constructor;

    if (!isApplication && Object.hasOwn(ctor, 'visibility')) {
      problems.push(
        `${key}: declare rules on the namespace's ApplicationController ` +
          'instead; they apply to every controller in it.'
      );
    }

    if (isApplication) {
      const rules = rulesOf(controller) ?? {};

      if (typeof rules !== 'object' || rules === null) {
        problems.push(`${key}: \`visibility\` must be an object.`);
      } else {
        Object.entries(rules).forEach(([type, rule]) => {
          if (!types.has(type)) {
            problems.push(`${key}: no model for type "${type}".`);
          } else if (typeof rule !== 'function') {
            problems.push(`${key}: the rule for "${type}" is not a function.`);
          }
        });
      }
    }
  });

  if (problems.length) {
    throw new VisibilityConfigError(problems);
  }

  controllers.forEach((controller, key) => {
    const application = applicationFor(controllers, key);

    Reflect.defineProperty(controller, 'visibility', {
      value: Object.freeze({
        ...((application && rulesOf(application)) ?? {})
      }),
      writable: false,
      enumerable: false,
      configurable: false
    });
  });
}
