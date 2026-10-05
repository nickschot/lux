import Parameter from '../parameter';
import ForbiddenParameter from '../parameter/forbidden-parameter';
import IgnoredParameter from '../parameter/ignored-parameter';
import ParameterGroup from '../parameter-group';
import isNull from '../../../../../utils/is-null';
import { typeForColumn } from '../../../../database';
import type { ModelClass } from '../../../../database';
import type Controller from '../../../../controller';
import type { ParameterLike } from '../interfaces';

import { parseId, parserFor } from './parse-column-value';

/**
 * @private
 */
function primaryKeyTypeFor(model: ModelClass): string | undefined {
  const primaryKeyColumn = model.columnFor(model.primaryKey);

  return primaryKeyColumn ? typeForColumn(primaryKeyColumn) : 'number';
}

/**
 * An optional object member the spec allows in a request document (`meta`,
 * `links`, `jsonapi`). It is accepted, not acted on.
 *
 * @private
 */
function getObjectParam(name: string, path: string): [string, ParameterLike] {
  return [name, new Parameter({ path, type: 'object' })];
}

/**
 * @private
 */
function getIDParam({ model }: Controller): [string, ParameterLike] {
  const type = primaryKeyTypeFor(model);

  return [
    'id',
    new Parameter({
      type,
      path: 'data.id',
      parse: parseId(type),
      required: true
    })
  ];
}

/**
 * @private
 */
function getTypeParam({ model }: Controller): [string, ParameterLike] {
  return [
    'type',
    new Parameter({
      type: 'string',
      path: 'data.type',
      values: [model.resourceName],
      required: true
    })
  ];
}

/**
 * Members the model has (`names`) but the controller's `params` do not list:
 * ignored, or answered with 403 when `reject` is set. A name the model does
 * not have at all gets neither and is a 400. See nickschot/lux#47.
 *
 * @private
 */
function getUnlistedParams(
  names: Array<string>,
  params: Array<string>,
  path: string,
  reject: boolean
): Array<[string, ParameterLike]> {
  return names
    .filter(name => !params.includes(name))
    .map((name): [string, ParameterLike] => [
      name,
      reject
        ? new ForbiddenParameter(`${path}.${name}`)
        : new IgnoredParameter(`${path}.${name}`)
    ]);
}

/**
 * @private
 */
function getAttributesParam(
  { model, params, rejectUnlistedAttributes }: Controller,
  method: 'PATCH' | 'POST'
): [string, ParameterLike] {
  const unlisted = getUnlistedParams(
    model.attributeNames,
    params,
    'data.attributes',
    rejectUnlistedAttributes
  );

  return [
    'attributes',
    new ParameterGroup(
      [
        ...params.reduce<Array<[string, ParameterLike]>>((group, param) => {
          const col = model.columnFor(param);

          if (col) {
            const type = typeForColumn(col);
            const path = `data.attributes.${param}`;
            const required =
              method !== 'PATCH' && !col.nullable && isNull(col.defaultValue);

            return [
              ...group,
              [
                param,
                new Parameter({ type, path, required, parse: parserFor(type) })
              ]
            ];
          }

          return group;
        }, []),
        ...unlisted
      ],
      {
        path: 'data.attributes'
      }
    )
  ];
}

/**
 * A resource identifier object (`{ id, type }`) of `model` at `path`.
 *
 * @private
 */
function getIdentifierParam(path: string, model: ModelClass): ParameterGroup {
  const type = primaryKeyTypeFor(model);

  return new ParameterGroup(
    [
      [
        'id',
        new Parameter({
          type,
          path: `${path}.id`,
          parse: parseId(type),
          required: true
        })
      ],

      [
        'type',
        new Parameter({
          type: 'string',
          path: `${path}.type`,
          values: [model.resourceName],
          required: true
        })
      ],

      getObjectParam('meta', `${path}.meta`)
    ],
    {
      path,
      required: true
    }
  );
}

/**
 * @private
 */
function getRelationshipsParam({
  model,
  params,
  rejectUnlistedRelationships
}: Controller): [string, ParameterLike] {
  const unlisted = getUnlistedParams(
    Object.keys(model.relationships),
    params,
    'data.relationships',
    rejectUnlistedRelationships
  );

  return [
    'relationships',
    new ParameterGroup(
      [
        ...params.reduce<Array<[string, ParameterLike]>>((group, param) => {
          const path = `data.relationships.${param}`;
          const opts = model.relationshipFor(param);

          if (!opts) {
            return group;
          }

          // Resource linkage: an array of identifiers for a to-many
          // relationship, an identifier (or `null`) for a to-one.
          const data: ParameterLike =
            opts.type === 'hasMany'
              ? new Parameter({
                  type: 'array',
                  path: `${path}.data`,
                  required: true,
                  items: itemPath => getIdentifierParam(itemPath, opts.model)
                })
              : getIdentifierParam(`${path}.data`, opts.model);

          return [
            ...group,
            [
              param,
              new ParameterGroup(
                [
                  ['data', data],
                  getObjectParam('links', `${path}.links`),
                  getObjectParam('meta', `${path}.meta`)
                ],
                {
                  path
                }
              )
            ]
          ];
        }, []),
        ...unlisted
      ],
      {
        path: 'data.relationships'
      }
    )
  ];
}

/**
 * The top level members of a request document besides `data`.
 *
 * @private
 */
export function getDocumentParams(): Array<[string, ParameterLike]> {
  return [
    getObjectParam('meta', 'meta'),
    getObjectParam('links', 'links'),
    getObjectParam('jsonapi', 'jsonapi')
  ];
}

/**
 * @private
 */
export default function getDataParams(
  controller: Controller,
  method: 'PATCH' | 'POST',
  includeID: boolean
): [string, ParameterLike] {
  let params = [
    getTypeParam(controller),
    getObjectParam('links', 'data.links'),
    getObjectParam('meta', 'data.meta')
  ];

  if (controller.hasModel) {
    params = [
      getAttributesParam(controller, method),
      getRelationshipsParam(controller),
      ...params
    ];

    if (includeID) {
      params = [getIDParam(controller), ...params];
    }
  }

  return [
    'data',
    new ParameterGroup(params, {
      path: 'data',
      required: true
    })
  ];
}
