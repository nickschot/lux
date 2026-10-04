import Parameter from '../parameter';
import ForbiddenParameter from '../parameter/forbidden-parameter';
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
 * @private
 */
function getAttributesParam(
  { model, params }: Controller,
  method: 'PATCH' | 'POST'
): [string, ParameterLike] {
  // Attributes the model has but the controller does not accept get a 403
  // (unsupported update), like relationships; a name the model does not have
  // at all is a 400.
  const forbidden = model.attributeNames
    .filter(name => !params.includes(name))
    .map((name): [string, ParameterLike] => [
      name,
      new ForbiddenParameter(`data.attributes.${name}`)
    ]);

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
        ...forbidden
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
  params
}: Controller): [string, ParameterLike] {
  // Relationships the model has but the controller does not accept get a 403
  // (unsupported update) instead of the 400 an unknown member gets.
  const forbidden = Object.keys(model.relationships)
    .filter(key => !params.includes(key))
    .map((key): [string, ParameterLike] => [
      key,
      new ForbiddenParameter(`data.relationships.${key}`)
    ]);

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
        ...forbidden
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
