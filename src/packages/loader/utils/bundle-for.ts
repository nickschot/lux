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
            obj.migrations.set(
              formatKey(key),
              Reflect.construct(Migration, [value])
            );
            break;

          default:
            break;
        }
      } else {
        switch (key) {
          case 'Application':
          case 'routes':
          case 'seed':
            Reflect.set(obj, formatKey(key), value);
            break;

          case 'config':
            Reflect.set(obj, 'config', {
              ...merge(createDefaultConfig(), {
                ...obj.config,
                ...value
              })
            });
            break;

          case 'database':
            Reflect.set(obj, 'config', {
              ...obj.config,
              database: value
            });
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
  const manifest: Record<string, any> = Reflect.apply(require, null, [
    joinPath(path, 'dist', 'bundle')
  ]);

  return chain(manifest)
    .pipe(normalize)
    .pipe(entries)
    .pipe(pairs => new FreezeableMap<string, any>(pairs))
    .value()
    .freeze();
}
