import { posix } from 'path';

import Controller from '../../controller';
import { VisibilityConfigError } from '../../controller/visibility/errors';
import type { Visibility } from '../../controller';
import type { ModelClass } from '../../database';
import type { Bundle$Namespace } from '../../loader';

type ControllerClass = { visibility?: Visibility };

const rulesOf = (controller: Controller): Visibility | undefined =>
  (controller.constructor as ControllerClass).visibility;

/**
 * Whether an `ApplicationController` has rules of its own: declared on its
 * class, or inherited from a class other than `Controller` (whose `{}` is
 * only the default). One extending `Controller` without declaring any —
 * e.g. to add a hook — has none, and takes its parent namespace's.
 */
const declaresRules = (application: Controller): boolean =>
  rulesOf(application) !== Controller.visibility;

/**
 * The rules that govern `key`'s namespace: those of the closest
 * `ApplicationController`, from the namespace's own up, that has rules.
 *
 * Walks up with `dirname()` until it stops changing the path — at `.` for the
 * relative keys the loader produces, at `/` for anything else — so the walk
 * ends whatever the key.
 */
function rulesFor(
  controllers: Bundle$Namespace<Controller> | Map<string, Controller>,
  key: string
): Visibility | undefined {
  let namespace = posix.dirname(key);
  let previous: string | undefined;

  while (namespace !== previous) {
    const application = controllers.get(
      namespace === '.' ? 'application' : `${namespace}/application`
    );

    if (application && declaresRules(application)) {
      return rulesOf(application);
    }

    previous = namespace;
    namespace = posix.dirname(namespace);
  }

  return undefined;
}

/**
 * Give every controller the visibility rules of its namespace — the
 * `static visibility` of the namespace's `ApplicationController`, or, when it
 * has none or declares none, the closest ancestor namespace's — and refuse to boot on rules that cannot be
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
    Object.defineProperty(controller, 'visibility', {
      value: Object.freeze({ ...(rulesFor(controllers, key) ?? {}) }),
      writable: false,
      enumerable: false,
      configurable: false
    });
  });
}
