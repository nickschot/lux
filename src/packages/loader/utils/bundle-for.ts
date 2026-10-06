/* eslint-disable @typescript-eslint/no-explicit-any --
 * Loads a compiled app bundle (a manifest of user modules keyed by name) and
 * normalizes it into namespaced maps; the module values are genuinely untyped
 * app code (as they were `Object`/`any` in Flow).
 */
import { join as joinPath } from 'path';

import { Migration } from '../../database';
import { FreezeableMap } from '../../freezeable';
import { createDefaultConfig } from '../../config';
import merge from '../../../utils/merge';
import chain from '../../../utils/chain';
import entries from '../../../utils/entries';

import formatKey from './format-key';

const SUFFIX_PATTERN = /^.+(Controller|Down|Serializer|Up)/;

type Bundle = {
  application?: any;
  routes?: any;
  seed?: any;
  config: Record<string, any>;
  controllers: FreezeableMap<string, any>;
  migrations: FreezeableMap<string, any>;
  models: FreezeableMap<string, any>;
  serializers: FreezeableMap<string, any>;
};

/**
 * @private
 */
function normalize(manifest: Record<string, any>): Bundle {
  return entries(manifest).reduce<Bundle>(
    (obj, [key, value]) => {
      if (SUFFIX_PATTERN.test(key)) {
        const suffix = key.replace(SUFFIX_PATTERN, '$1');
        const stripSuffix = (source: string) => source.replace(suffix, '');

        switch (suffix) {
          case 'Controller':
            obj.controllers.set(formatKey(key, stripSuffix), value);
            break;

          case 'Serializer':
            obj.serializers.set(formatKey(key, stripSuffix), value);
            break;

          case 'Up':
          case 'Down':
            obj.migrations.set(formatKey(key), new Migration(value));
            break;

          default:
            break;
        }
      } else {
        switch (key) {
          case 'Application':
          case 'routes':
          case 'seed':
            // `formatKey` maps these to `application`, `routes` and `seed`.
            obj[formatKey(key) as 'application' | 'routes' | 'seed'] = value;
            break;

          case 'config':
            obj.config = {
              ...merge(createDefaultConfig(), {
                ...obj.config,
                ...value
              })
            };
            break;

          case 'database':
            obj.config = {
              ...obj.config,
              database: value
            };
            break;

          default:
            obj.models.set(formatKey(key), value);
            break;
        }
      }

      return obj;
    },
    {
      config: {},
      controllers: new FreezeableMap(),
      migrations: new FreezeableMap(),
      models: new FreezeableMap(),
      serializers: new FreezeableMap()
    }
  );
}

/**
 * @private
 */
export default function bundleFor(path: string): FreezeableMap<string, any> {
  // The app's compiled bundle, resolved at runtime — not a module import.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const manifest: Record<string, any> = require(
    joinPath(path, 'dist', 'bundle')
  );

  return chain(manifest)
    .pipe(normalize)
    .pipe(entries)
    .pipe(pairs => new FreezeableMap<string, any>(pairs))
    .value()
    .freeze();
}
