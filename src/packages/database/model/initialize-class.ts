/* eslint-disable @typescript-eslint/no-explicit-any --
 * Class initialization is pure runtime metaprogramming: it reads each model's
 * user-declared static config (attributes from the DB schema, hasOne/hasMany/
 * belongsTo/hooks/scopes/validates), and installs accessors, relationship
 * descriptors and frozen metadata onto the class and its prototype via
 * Object.defineProperties/Reflect. The config values are genuinely untyped (as
 * they were `Object` in Flow).
 */
import { camelize, dasherize, pluralize, singularize } from 'inflection';

import { line } from '../../logger';
import { createAttribute } from '../attribute';
import {
  get as getRelationship,
  set as setRelationship
} from '../relationship';
import entries from '../../../utils/entries';
import underscore from '../../../utils/underscore';
import type Logger from '../../logger';
import type Database from '../index';
import type { Model } from '../index';
import type { ModelClass } from '../interfaces';

const VALID_HOOKS = new Set([
  'afterCreate',
  'afterDestroy',
  'afterSave',
  'afterUpdate',
  'afterValidation',
  'beforeCreate',
  'beforeDestroy',
  'beforeSave',
  'beforeUpdate',
  'beforeValidation'
]);

/**
 * @private
 */
function initializeProps(
  prototype: object,
  attributes: Record<string, any>,
  relationships: Record<string, any>
) {
  Object.defineProperties(prototype, {
    ...entries(attributes).reduce<PropertyDescriptorMap>(
      (obj, [key, value]) => ({
        ...obj,
        [key]: createAttribute({
          key,
          ...value
        })
      }),
      {}
    ),

    ...Object.keys(relationships).reduce<PropertyDescriptorMap>(
      (obj, key) => ({
        ...obj,
        [key]: {
          get(this: Model) {
            return getRelationship(this, key);
          },
          set(this: Model, val: any) {
            setRelationship(this, key, val);
          }
        }
      }),
      {}
    )
  });
}

/**
 * @private
 */
function initializeHooks({
  model,
  hooks,
  logger
}: {
  model: ModelClass;
  hooks: Record<string, any>;
  logger: Logger;
}) {
  return Object.freeze(
    entries(hooks).reduce<Record<string, any>>((obj, [key, value]) => {
      if (!VALID_HOOKS.has(key)) {
        logger.warn(line`
          Invalid hook '${key}' will not be added to Model '${model.name}'.
          Valid hooks are ${Array.from(VALID_HOOKS)
            .map(h => `'${h}'`)
            .join(', ')}.
        `);

        return obj;
      }

      return {
        ...obj,
        [key]: async (instance: Model, transaction: unknown) => {
          await Reflect.apply(value, model, [instance, transaction]);
        }
      };
    }, {})
  );
}

/**
 * @private
 */
function initializeValidations(opts: {
  model: ModelClass;
  logger: Logger;
  validates: Record<string, any>;
  attributes: Record<string, any>;
}) {
  const { model, logger, attributes } = opts;
  const attributeNames = Object.keys(attributes);
  let { validates } = opts;

  validates = entries(validates)
    .filter(([key, value]) => {
      let isValid = attributeNames.indexOf(key) >= 0;

      if (!isValid) {
        logger.warn(line`
          Invalid validation '${key}' will not be added to Model
          '${model.name}'. '${key}' is not an attribute of Model
          '${model.name}'.
        `);
      }

      if (typeof value !== 'function') {
        isValid = false;

        logger.warn(line`
          Invalid validation '${key}' will not be added to Model
          '${model.name}'. Validations must be a function.
        `);
      }

      return isValid;
    })
    .reduce<Record<string, any>>(
      (obj, [key, value]) => ({
        ...obj,
        [key]: value
      }),
      {}
    );

  return Object.freeze(validates);
}

/**
 * @private
 */
export default async function initializeClass<T extends ModelClass>({
  store,
  table,
  model
}: {
  store: Database;
  table: T['table'];
  model: T;
}): Promise<T> {
  let { hooks, scopes, validates } = model;
  const { logger } = store;
  const modelName = dasherize(underscore(model.name));
  const resourceName = pluralize(modelName);

  const attributes = entries(await table().columnInfo()).reduce<
    Record<string, any>
  >(
    (obj, [columnName, value]) => ({
      ...obj,
      [camelize(columnName, true)]: {
        ...(value as any),
        columnName,
        docName: dasherize(columnName)
      }
    }),
    {}
  );

  const belongsTo = entries(model.belongsTo || {}).reduce<Record<string, any>>(
    (obj, [relatedName, value]) => {
      const { inverse, model: relatedModel } = value as any;
      const relationship = {};

      Object.defineProperties(relationship, {
        model: {
          value: store.modelFor(relatedModel || relatedName),
          writable: false,
          enumerable: true,
          configurable: false
        },

        inverse: {
          value: inverse,
          writable: false,
          enumerable: true,
          configurable: false
        },

        type: {
          value: 'belongsTo',
          writable: false,
          enumerable: false,
          configurable: false
        },

        foreignKey: {
          value: `${underscore(relatedName)}_id`,
          writable: false,
          enumerable: false,
          configurable: false
        }
      });

      return {
        ...obj,
        [relatedName]: relationship
      };
    },
    {}
  );

  const hasOne = entries(model.hasOne || {}).reduce<Record<string, any>>(
    (obj, [relatedName, value]) => {
      const { inverse, model: relatedModel } = value as any;
      const relationship = {};

      Object.defineProperties(relationship, {
        model: {
          value: store.modelFor(relatedModel || relatedName),
          writable: false,
          enumerable: true,
          configurable: false
        },

        inverse: {
          value: inverse,
          writable: false,
          enumerable: true,
          configurable: false
        },

        type: {
          value: 'hasOne',
          writable: false,
          enumerable: false,
          configurable: false
        },

        foreignKey: {
          value: `${underscore(inverse)}_id`,
          writable: false,
          enumerable: false,
          configurable: false
        }
      });

      return {
        ...obj,
        [relatedName]: relationship
      };
    },
    {}
  );

  const hasMany = entries(model.hasMany || {}).reduce<Record<string, any>>(
    (hash, [relatedName, opts]) => {
      const { inverse } = opts as any;
      const relationship = {};
      let { through, model: relatedModel } = opts as any;
      let foreignKey;

      if (typeof relatedModel === 'string') {
        relatedModel = store.modelFor(relatedModel);
      } else {
        relatedModel = store.modelFor(relatedName);
      }

      if (typeof through === 'string') {
        through = store.modelFor(through);
        foreignKey = `${singularize(underscore(inverse))}_id`;
      } else {
        foreignKey = `${underscore(inverse)}_id`;
      }

      Object.defineProperties(relationship, {
        model: {
          value: relatedModel,
          writable: false,
          enumerable: true,
          configurable: false
        },

        inverse: {
          value: inverse,
          writable: false,
          enumerable: true,
          configurable: false
        },

        through: {
          value: through,
          writable: false,
          enumerable: Boolean(through),
          configurable: false
        },

        type: {
          value: 'hasMany',
          writable: false,
          enumerable: false,
          configurable: false
        },

        foreignKey: {
          value: foreignKey,
          writable: false,
          enumerable: false,
          configurable: false
        }
      });

      return {
        ...hash,
        [relatedName]: relationship
      };
    },
    {}
  );

  Object.freeze(hasOne);
  Object.freeze(hasMany);
  Object.freeze(belongsTo);

  const relationships = Object.freeze({
    ...hasOne,
    ...hasMany,
    ...belongsTo
  });

  if (!hooks) {
    hooks = {};
  }

  if (!scopes) {
    scopes = {};
  }

  if (!validates) {
    validates = {};
  }

  Object.defineProperties(model, {
    store: {
      value: store,
      writable: false,
      enumerable: false,
      configurable: false
    },

    table: {
      value: table,
      writable: false,
      enumerable: false,
      configurable: false
    },

    logger: {
      value: logger,
      writable: false,
      enumerable: false,
      configurable: false
    },

    attributes: {
      value: Object.freeze(attributes),
      writable: false,
      enumerable: false,
      configurable: false
    },

    attributeNames: {
      value: Object.freeze(Object.keys(attributes)),
      writable: false,
      enumerable: false,
      configurable: false
    },

    hasOne: {
      value: hasOne,
      writable: false,
      enumerable: Boolean(Object.keys(hasOne).length),
      configurable: false
    },

    hasMany: {
      value: hasMany,
      writable: false,
      enumerable: Boolean(Object.keys(hasMany).length),
      configurable: false
    },

    belongsTo: {
      value: belongsTo,
      writable: false,
      enumerable: Boolean(Object.keys(belongsTo).length),
      configurable: false
    },

    relationships: {
      value: relationships,
      writable: false,
      enumerable: false,
      configurable: false
    },

    relationshipNames: {
      value: Object.freeze(Object.keys(relationships)),
      writable: false,
      enumerable: false,
      configurable: false
    },

    hooks: {
      value: initializeHooks({
        model,
        hooks,
        logger
      }),
      writable: false,
      enumerable: Boolean(Object.keys(hooks).length),
      configurable: false
    },

    scopes: {
      value: scopes,
      writable: false,
      enumerable: Boolean(Object.keys(scopes).length),
      configurable: false
    },

    validates: {
      value: initializeValidations({
        model,
        logger,
        validates,
        attributes
      }),
      writable: false,
      enumerable: Boolean(Object.keys(validates).length),
      configurable: false
    },

    modelName: {
      value: modelName,
      writable: false,
      enumerable: true,
      configurable: false
    },

    resourceName: {
      value: resourceName,
      writable: false,
      enumerable: true,
      configurable: false
    },

    initialized: {
      value: true,
      writable: false,
      enumerable: false,
      configurable: false
    },

    ...Object.freeze(
      entries(scopes).reduce<PropertyDescriptorMap>(
        (obj, [name, scope]) => ({
          ...obj,
          [name]: {
            value: scope,
            writable: false,
            enumerable: false,
            configurable: false
          }
        }),
        {}
      )
    )
  });

  initializeProps(model.prototype, attributes, {
    ...hasOne,
    ...hasMany,
    ...belongsTo
  });

  Object.defineProperties(model.prototype, {
    modelName: {
      value: modelName,
      writable: false,
      enumerable: true,
      configurable: false
    },
    resourceName: {
      value: resourceName,
      writable: false,
      enumerable: true,
      configurable: false
    },
    isModelInstance: {
      value: true,
      writable: false,
      enumerable: false,
      configurable: false
    }
  });

  return model;
}
