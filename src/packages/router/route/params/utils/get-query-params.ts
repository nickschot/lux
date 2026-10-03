import Parameter from '../parameter';
import ParameterGroup from '../parameter-group';
import type Controller from '../../../../controller';
import type { ParameterLike } from '../interfaces';
import { enumerateIncludePaths } from '../../../../serializer/utils/include-tree';

/**
 * @private
 */
function getPageParam(): [string, ParameterLike] {
  return [
    'page',
    new ParameterGroup(
      [
        ['size', new Parameter({ path: 'page.size', type: 'number' })],
        ['number', new Parameter({ path: 'page.number', type: 'number' })]
      ],
      {
        path: 'page'
      }
    )
  ];
}

/**
 * @private
 */
function getSortParam({ sort }: Controller): [string, ParameterLike] {
  return [
    'sort',
    new Parameter({
      path: 'sort',
      type: 'string',

      values: [...sort, ...sort.map(value => `-${value}`)]
    })
  ];
}

/**
 * @private
 */
function getFilterParam({ filter }: Controller): [string, ParameterLike] {
  return [
    'filter',
    new ParameterGroup(
      filter.map(param => [
        param,
        new Parameter({
          path: `filter.${param}`
        })
      ]),
      {
        path: 'filter'
      }
    )
  ];
}

/**
 * @private
 */
function getFieldsParam({
  model,
  serializer
}: Controller): [string, ParameterLike] {
  const { hasOne, hasMany, attributes } = serializer;
  const relationships = [...hasOne, ...hasMany];

  return [
    'fields',
    new ParameterGroup(
      [
        [
          model.resourceName,
          new Parameter({
            path: `fields.${model.resourceName}`,
            type: 'array',
            values: attributes,
            sanitize: true
          })
        ],
        ...relationships.reduce<Array<[string, ParameterLike]>>(
          (result, relationship) => {
            const opts = model.relationshipFor(relationship);

            if (opts) {
              return [
                ...result,

                [
                  opts.model.resourceName,
                  new Parameter({
                    path: `fields.${opts.model.resourceName}`,
                    type: 'array',
                    sanitize: true,

                    values: [
                      opts.model.primaryKey,
                      ...serializer.serializerFor(opts.model).attributes
                    ]
                  })
                ]
              ];
            }

            return result;
          },
          []
        )
      ],
      {
        path: 'fields',
        sanitize: true
      }
    )
  ];
}

/**
 * @private
 */
function getIncludeParam({
  model,
  maxIncludeDepth,
  serializer
}: Controller): [string, ParameterLike] {
  const { hasOne, hasMany } = serializer;
  const relationships = [...hasOne, ...hasMany];

  return [
    'include',
    new Parameter({
      path: 'include',
      type: 'array',
      // Every top level name stays allowed (as before), plus the nested paths
      // (`comments.user`) reachable through each related serializer in this
      // controller's namespace, down to the controller's `maxIncludeDepth`.
      values: Array.from(
        new Set([
          ...relationships,
          ...enumerateIncludePaths(
            model,
            relationships,
            maxIncludeDepth,
            related => serializer.serializerFor(related)
          )
        ])
      )
    })
  ];
}

/**
 * @private
 */
export function getCustomParams({
  query
}: Controller): Array<[string, ParameterLike]> {
  return query.map((param): [string, ParameterLike] => [
    param,
    new Parameter({
      path: param
    })
  ]);
}

/**
 * @private
 */
export function getMemberQueryParams(
  controller: Controller
): Array<[string, ParameterLike]> {
  if (controller.hasModel) {
    return [
      getFieldsParam(controller),
      getIncludeParam(controller),
      ...getCustomParams(controller)
    ];
  }

  return getCustomParams(controller);
}

/**
 * @private
 */
export function getCollectionQueryParams(
  controller: Controller
): Array<[string, ParameterLike]> {
  if (controller.hasModel) {
    return [
      getPageParam(),
      getSortParam(controller),
      getFilterParam(controller),
      getFieldsParam(controller),
      getIncludeParam(controller),
      ...getCustomParams(controller)
    ];
  }

  return getCustomParams(controller);
}
