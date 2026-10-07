import { EOL } from 'os';

import { classify, camelize, pluralize } from 'inflection';

import template from '../../template';
import indent from '../utils/indent';
import chain from '../../../utils/chain';
import entries from '../../../utils/entries';
import underscore from '../../../utils/underscore';

const VALID_ATTR = /^(\w|-)+:(\w|-)+$/;
const RELATIONSHIP = /^belongs-to|has-(one|many)$/;

/**
 * @private
 */
export default (name: string, attrs: Array<string>) => {
  const normalized = chain(name).pipe(underscore).pipe(classify).value();

  return template`
    import { Model } from 'lumen-framework';

    class ${normalized} extends Model {
    ${entries(
      (attrs || [])
        .filter(attr => VALID_ATTR.test(attr))
        .map(attr => attr.split(':'))
        .filter(([, type]) => RELATIONSHIP.test(type))
        .reduce<Record<string, Array<string>>>(
          (types, [related, type]) => {
            const key = chain(type)
              .pipe(underscore)
              .pipe(str => camelize(str, true))
              .value();

            const value = types[key];

            if (value) {
              // The name of this model on the other side: a `belongs-to` is
              // usually the inverse of a `has-many` (`post` belongs to `user`,
              // `user` has many `posts`), while a `has-one`/`has-many` points
              // back at a single owner.
              const singular = camelize(normalized, true);
              const inverse =
                key === 'belongsTo' ? pluralize(singular) : singular;
              const relatedKey = chain(related)
                .pipe(underscore)
                .pipe(str => camelize(str, true))
                .value();

              return {
                ...types,
                [key]: [
                  ...value,
                  `${indent(8)}${relatedKey}: {${EOL}` +
                    `${indent(10)}inverse: '${inverse}'${EOL}` +
                    `${indent(8)}}`
                ]
              };
            }

            return types;
          },
          {
            hasOne: [],
            hasMany: [],
            belongsTo: []
          }
        )
    )
      .filter(([, value]) => value.length)
      .reduce(
        (result, [key, value], index) =>
          chain(result)
            .pipe(str => {
              if (index && str.length) {
                return `${str}${EOL.repeat(2)}`;
              }

              return str;
            })
            .pipe(
              str =>
                str +
                `${indent(index === 0 ? 2 : 6)}static ${key} = {${EOL}` +
                `${value.join(`,${EOL.repeat(2)}`)}${EOL}` +
                `${indent(6)}};`
            )
            .value(),
        ''
      )}
    }

    export default ${normalized};
  `;
};
