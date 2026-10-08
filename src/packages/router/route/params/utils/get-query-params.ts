import Parameter from '../parameter';
import ParameterGroup from '../parameter-group';
import type Controller from '../../../../controller';
import type { ParameterLike } from '../interfaces';
import {
  enumerateIncludePaths,
  enumerateIncludeTypes
} from '../../../../serializer/utils/include-tree';

/** @internal */
function getPageParam({ maxPerPage }: Controller): [string, ParameterLike] {
  return [
    'page',
    new ParameterGroup(
      [
        [
          'size',
          new Parameter({
            path: 'page.size',
            type: 'number',
            min: 1,
            max: maxPerPage
          })
        ],
        [
          'number',
          new Parameter({ path: 'page.number', type: 'number', min: 1 })
        ]
      ],
      {
        path: 'page'
      }
    )
  ];
}

/** @internal */
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

/** @internal */
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
 * One `fields[TYPE]` parameter per type the response can contain, accepting
 * the fields that type's Serializer exposes: its attributes and relationships.
 * Unknown types are ignored (a client may send the same fieldsets everywhere);
 * an unknown field of a known type is a 400.
 *
 * @internal
 */
function getFieldsParam(controller: Controller): [string, ParameterLike] {
  const { model, serializer, maxIncludeDepth } = controller;
  const types = enumerateIncludeTypes(
    model,
    serializer,
    maxIncludeDepth,
    related => controller.serializerFor(related)
  );

  return [
    'fields',
    new ParameterGroup(
      Array.from(
        types,
        ([type, { attributes, hasOne, hasMany }]): [string, ParameterLike] => [
          type,
          new Parameter({
            path: `fields.${type}`,
            type: 'array',
            values: [...attributes, ...hasOne, ...hasMany]
          })
        ]
      ),
      {
        path: 'fields',
        sanitize: true
      }
    )
  ];
}

/** @internal */
function getIncludeParam(controller: Controller): [string, ParameterLike] {
  const { model, maxIncludeDepth, serializer } = controller;
  const { hasOne, hasMany } = serializer;
  const relationships = [...hasOne, ...hasMany];

  return [
    'include',
    new Parameter({
      path: 'include',
      type: 'array',
      // Every top level name stays allowed (as before), plus the nested paths
      // (`comments.user`) reachable through each related serializer in the
      // controller's namespace (at every level, even below a root fallback
      // serializer), down to the controller's `maxIncludeDepth`.
      values: Array.from(
        new Set([
          ...relationships,
          ...enumerateIncludePaths(
            model,
            relationships,
            maxIncludeDepth,
            related => controller.serializerFor(related)
          )
        ])
      )
    })
  ];
}

/** @internal */
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

/** @internal */
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

/** @internal */
export function getCollectionQueryParams(
  controller: Controller
): Array<[string, ParameterLike]> {
  if (controller.hasModel) {
    return [
      getPageParam(controller),
      getSortParam(controller),
      getFilterParam(controller),
      getFieldsParam(controller),
      getIncludeParam(controller),
      ...getCustomParams(controller)
    ];
  }

  return getCustomParams(controller);
}
