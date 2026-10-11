import { posix } from 'path';

import Controller from '../../controller';
import { VisibilityConfigError } from '../../controller/visibility/errors';
import type { Visibility } from '../../controller';
import type { ModelClass } from '../../database';
import type { BundleNamespace } from '../../loader';

type ControllerClass = {
  visibility?: Visibility;
  strictVisibility?: unknown;
};

const classOf = (controller: Controller): ControllerClass =>
  controller.constructor as ControllerClass;

const rulesOf = (controller: Controller): Visibility | undefined =>
  classOf(controller).visibility;

/**
 * Whether an `ApplicationController` declares `setting` itself: on its
 * class, or inherited from a class other than `Controller` (whose value is
 * only the default). One extending `Controller` without declaring it — e.g.
 * to add a hook — takes its parent namespace's. Decided by which class
 * holds the static, not by its value: `static strictVisibility = false`
 * declares it, although it equals the default.
 */
function declares(
  application: Controller,
  setting: 'visibility' | 'strictVisibility'
): boolean {
  let owner: unknown = application.constructor;

  while (owner && !Object.hasOwn(owner, setting)) {
    owner = Object.getPrototypeOf(owner);
  }

  return Boolean(owner) && owner !== Controller;
}

/**
 * The closest `ApplicationController` governing `key`'s namespace for
 * `setting`: from the namespace's own up, the first that declares it.
 *
 * Walks up with `dirname()` until it stops changing the path — at `.` for the
 * relative keys the loader produces, at `/` for anything else — so the walk
 * ends whatever the key.
 */
function governing(
  controllers: BundleNamespace<Controller> | Map<string, Controller>,
  key: string,
  setting: 'visibility' | 'strictVisibility'
): Controller | undefined {
  let namespace = posix.dirname(key);
  let previous: string | undefined;

  while (namespace !== previous) {
    const application = controllers.get(
      namespace === '.' ? 'application' : `${namespace}/application`
    );

    if (application && declares(application, setting)) {
      return application;
    }

    previous = namespace;
    namespace = posix.dirname(namespace);
  }

  return undefined;
}

/**
 * Give every controller the visibility rules of its namespace — the
 * `static visibility` of the namespace's `ApplicationController`, or, when it
 * has none or declares none, the closest ancestor namespace's — whether any
 * were declared (`hasVisibilityRules`), and whether the namespace's
 * `strictVisibility`, resolved the same way, is on (`hasStrictVisibility`);
 * and refuse to boot on rules that
 * cannot be applied: rules declared on any other controller (a rule must hold for the
 * whole namespace, since types are included across controllers), rules for a
 * type that has no model, and rules that are not functions.
 *
 * @internal
 */
export default function resolveVisibility(
  controllers: BundleNamespace<Controller> | Map<string, Controller>,
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

    if (!isApplication && Object.hasOwn(ctor, 'strictVisibility')) {
      problems.push(
        `${key}: declare \`strictVisibility\` on the namespace's ` +
          'ApplicationController instead; it applies to the whole namespace.'
      );
    }

    if (
      isApplication &&
      typeof classOf(controller).strictVisibility !== 'boolean'
    ) {
      problems.push(`${key}: \`strictVisibility\` must be true or false.`);
    }

    if (isApplication) {
      const rules = rulesOf(controller) ?? {};

      if (typeof rules !== 'object' || rules === null) {
        problems.push(`${key}: \`visibility\` must be an object.`);
      } else {
        Object.entries(rules).forEach(([type, rule]) => {
          if (!types.has(type)) {
            problems.push(`${key}: no model for type "${type}".`);
          } else if (typeof rule !== 'function' && rule !== true) {
            problems.push(
              `${key}: the rule for "${type}" is not a function or \`true\`.`
            );
          }
        });
      }
    }
  });

  if (problems.length) {
    throw new VisibilityConfigError(problems);
  }

  controllers.forEach((controller, key) => {
    const governor = governing(controllers, key, 'visibility');
    const rules = governor && rulesOf(governor);
    const strict = governing(controllers, key, 'strictVisibility');

    Object.defineProperties(controller, {
      visibility: {
        value: Object.freeze({ ...(rules ?? {}) }),
        writable: false,
        enumerable: false,
        configurable: false
      },
      hasVisibilityRules: {
        value: rules !== undefined,
        writable: false,
        enumerable: false,
        configurable: false
      },
      hasStrictVisibility: {
        value: Boolean(strict && classOf(strict).strictVisibility),
        writable: false,
        enumerable: false,
        configurable: false
      }
    });
  });
}
